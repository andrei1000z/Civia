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

  // Cut-off: 60 zile fără reply. Considerăm doar sesizările care au fost
  // ACTIV trimise (status trimis, inregistrata, in-lucru, redirectionata,
  // actiune-autoritate, amanata) sau cele care au fost create dar n-au mai
  // primit nimic (nou, dar acelea pierd legal claim-ul după 60 zile oricum).
  const cutoff60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Verificăm reply-urile primite — dacă există ≥1 reply real de la
  // autoritate (NOT spam), atunci NU mai e „ignorat".
  const { data: candidates, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, status, created_at, sent_at, author_email")
    .in("status", ["nou", "trimis", "inregistrata", "in-lucru", "redirectionata", "actiune-autoritate", "amanata"])
    .lte("created_at", cutoff60d);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, marked: 0 });
  }

  const ids = candidates.map((c) => c.id);
  const { data: replies } = await admin
    .from("sesizare_replies")
    .select("sesizare_id")
    .in("sesizare_id", ids);
  const hasReplyMap = new Set<string>((replies ?? []).map((r) => r.sesizare_id as string));

  let marked = 0;
  const errors: string[] = [];
  for (const sez of candidates) {
    if (hasReplyMap.has(sez.id)) continue; // primit reply, nu e ignorat

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
    scanned: candidates.length,
    marked,
    errors: errors.length > 0 ? errors : undefined,
  });
}
