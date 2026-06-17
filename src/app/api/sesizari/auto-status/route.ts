import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron — marchează automat sesizările cu status `ignorat` dacă au trecut
 * >60 zile fără reply primit de la autoritate.
 *
 * OG 27/2002 art. 8: termen 30 zile + extensie 15 zile = 45 zile MAX legal.
 * La 60 zile fără răspuns clar a expirat → cetățeanul are dreptul să
 * escaladeze la Avocatul Poporului.
 *
 * Sintaxă: GET cu Bearer ${CRON_SECRET} sau sesiune admin. Idempotent —
 * dacă sesizarea e deja `ignorat` / `rezolvat` / `respins`, o sărim.
 *
 * Status user a cerut explicit (2026-05-24): `ignorat`, nu `respins`.
 * Diferența: respins = primăria a refuzat oficial. Ignorat = primăria
 * a tăcut (nu a răspuns deloc) → escalare AVP.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = verifyBearer(auth, cronSecret);

  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createSupabaseAdmin();
  const nowMs = Date.now();

  // ─── 1) trimis → inregistrata (înregistrare prezumată, OG 27/2002) ─────────
  // Bug 6/17/2026: #00071+ stăteau blocate pe „trimis". Cauza: Civia marca
  // „inregistrata" DOAR pe un reply de confirmare matchuit pe sesizari@civia.ro —
  // dar confirmările de înregistrare ajung des pe emailul PERSONAL al petentului
  // (adresa lui e în petiție), nu la Civia → niciun reply de matchuit → blocaj.
  // Fix robust, independent de email: o petiție primită de autoritate E, prin
  // lege (OG 27/2002), înregistrată la primire. După GRACE zile de la trimiterea
  // via Civia, fără o confirmare explicită, o considerăm înregistrată. NU setăm
  // official_response_at (nu e răspuns de fond) → rămâne eligibilă pt. escaladarea
  // la 60 de zile dacă autoritatea tace. Forward-only: doar status='trimis'.
  const REGISTER_GRACE_DAYS = 2;
  const regCutoff = new Date(nowMs - REGISTER_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let registered = 0;
  const regErrors: string[] = [];
  const { data: toRegister } = await admin
    .from("sesizari")
    .select("id, code")
    .eq("status", "trimis")
    .eq("sent_via_civia", true)
    .not("sent_at", "is", null)
    .lte("sent_at", regCutoff);
  for (const s of (toRegister ?? []) as { id: string; code: string }[]) {
    // .eq('status','trimis') la UPDATE = gardă optimistă: dacă între timp a venit
    // un reply real care a avansat statusul, nu-l regresăm/atingem.
    const { error: updErr } = await admin
      .from("sesizari")
      .update({ status: "inregistrata" })
      .eq("id", s.id)
      .eq("status", "trimis");
    if (updErr) { regErrors.push(`${s.code}: ${updErr.message}`); continue; }
    await admin.from("sesizare_timeline").insert({
      sesizare_id: s.id,
      event_type: "inregistrata",
      description: "Înregistrare prezumată conform OG 27/2002 — autoritatea are obligația legală de a înregistra petiția la primire. Au trecut 2+ zile de la trimiterea prin Civia fără o confirmare explicită.",
    });
    registered += 1;
  }

  // ─── 2) {nou,trimis,inregistrata} fără răspuns de fond → ignorat la 60 zile ──
  // Cut-off: 60 zile fără RĂSPUNS SUBSTANȚIAL. 2026-06-10 (audit statusuri) —
  // semnalul „autoritatea a răspuns" e official_response_at (setat DOAR pe răspuns
  // real: in-lucru/rezolvat/redirectionata), NU simpla prezență a unui reply.
  // Înainte, `inregistrata` (o confirmare de înregistrare = și ea un reply) bloca
  // PE VECI marcarea ignorat → 00001/00002 stăteau 65 de zile fără să poată escalada
  // la AVP. Acum: doar statusurile FĂRĂ angajare reală (nou/trimis/inregistrata) cu
  // official_response_at NULL devin `ignorat` după 60 de zile. Statusurile in-lucru/
  // redirectionata/actiune-autoritate/amanata = autoritatea s-a implicat → nu le atingem.
  const cutoff60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, status, created_at, sent_at, author_email")
    .in("status", ["nou", "trimis", "inregistrata"])
    .is("official_response_at", null)
    .lte("created_at", cutoff60d);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, registered, scanned: 0, marked: 0, regErrors: regErrors.length ? regErrors : undefined });
  }

  // Gating-ul „fără răspuns substanțial" e deja în query (official_response_at
  // IS NULL + statusuri fără angajare) — nu mai e nevoie de verificarea pe
  // prezența unui reply (care includea și simplul ack `inregistrata`).
  let marked = 0;
  const errors: string[] = [];
  for (const sez of candidates) {
    const { error: updErr } = await admin
      .from("sesizari")
      .update({ status: "ignorat" })
      .eq("id", sez.id);
    if (updErr) {
      errors.push(`${sez.code}: ${updErr.message}`);
      continue;
    }

    // Log timeline event.
    await admin.from("sesizare_timeline").insert({
      sesizare_id: sez.id,
      event_type: "ignorat",
      description: "Marcată automat ca ignorată — 60+ zile fără răspuns de la autoritate. OG 27/2002 termen legal expirat. Poți escalada la Avocatul Poporului.",
    });

    marked += 1;
  }

  return NextResponse.json({
    ok: true,
    registered,
    scanned: candidates.length,
    marked,
    errors: errors.length > 0 ? errors : undefined,
    regErrors: regErrors.length > 0 ? regErrors : undefined,
  });
}
