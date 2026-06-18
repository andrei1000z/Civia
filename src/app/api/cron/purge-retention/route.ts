import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Purge de retenție (conformitate UE — GDPR Art. 5(1)(e), „storage limitation").
 *
 * Aplică AUTOMAT retențiile pe care politica de confidențialitate le promite,
 * dar care până acum nu erau executate:
 *   (a) Co-semnatari: șterge email + ip_hash + city + message pentru sesizările
 *       ÎNCHISE (rezolvat/respins) de >90 zile SAU mai vechi de 1 an (scopul —
 *       notificarea autorității + anti-dedup — e epuizat). Păstrează `name` +
 *       contorul pentru recordul public.
 *   (b) Sesizări ANONIME (fără cont) mai vechi de 3 ani: author_name→„Cetățean",
 *       author_email→null.
 *
 * Idempotent (filtrele exclud rândurile deja curățate). Rulat de cron-ul zilnic
 * + apelabil manual de admin pentru curățarea retroactivă a datelor istorice.
 *
 * Auth: Bearer ${CRON_SECRET} (cron) sau sesiune admin.
 */
const DAY = 86_400_000;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = verifyBearer(auth, cronSecret);
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((prof as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createSupabaseAdmin();
  const now = Date.now();
  const cutoff90 = new Date(now - 90 * DAY).toISOString();
  const cutoff1y = new Date(now - 365 * DAY).toISOString();
  const cutoff3y = new Date(now - 3 * 365 * DAY).toISOString();

  // ─── (a) Co-semnatari: sesizări închise >90z SAU mai vechi de 1 an ────────
  const [closedRes, oldRes] = await Promise.all([
    admin.from("sesizari").select("id").in("status", ["rezolvat", "respins"]).lt("created_at", cutoff90),
    admin.from("sesizari").select("id").lt("created_at", cutoff1y),
  ]);
  const expiredIds = [
    ...new Set(
      [...(closedRes.data ?? []), ...(oldRes.data ?? [])].map((r) => (r as { id: string }).id),
    ),
  ];

  let cosignersPurged = 0;
  for (const ids of chunk(expiredIds, 200)) {
    const { count } = await admin
      .from("sesizare_cosigners")
      .update(
        { email: null, ip_hash: null, city: null, message: null },
        { count: "exact" },
      )
      .in("sesizare_id", ids)
      .or("email.not.is.null,ip_hash.not.is.null");
    cosignersPurged += count ?? 0;
  }

  // ─── (b) Sesizări anonime (fără cont) > 3 ani → anonimizare autor ─────────
  const { count: sesizariAnonimizate } = await admin
    .from("sesizari")
    .update({ author_name: "Cetățean", author_email: null }, { count: "exact" })
    .lt("created_at", cutoff3y)
    .is("user_id", null)
    .not("author_email", "is", null);

  // ─── (c) inbox_debug_log: purjă > 30 zile ────────────────────────────────
  // 6/18 (audit consum): tabela creștea MONOTON (body până la 50KB/rând, zero
  // cleanup). 30z păstrăm ca plasă de recuperare (vezi scripts/recover-lost-
  // replies.ts) dar mărginim creșterea. Tolerăm eroarea dacă tabela lipsește.
  const cutoff30 = new Date(now - 30 * DAY).toISOString();
  let inboxLogsPurged = 0;
  try {
    const { count } = await admin
      .from("inbox_debug_log")
      .delete({ count: "exact" })
      .lt("received_at", cutoff30);
    inboxLogsPurged = count ?? 0;
  } catch { /* best-effort */ }

  // ─── (d) Poze ORFANE în Storage (bucket sesizari-photos) ─────────────────
  // 6/18 (audit consum): pozele sesizărilor/conturilor ȘTERSE nu se curățau
  // niciodată → singura limită Supabase cu orizont real de epuizare (1 GB).
  // Ștergem DOAR obiectele nereferite de NICIO `sesizari.imagini` ȘI mai vechi
  // de 7 zile (timestamp-ul e în numele fișierului: „<ms>-<uuid>.<ext>") — gardă
  // contra cursei upload→creare-sesizare (poza e încărcată înainte ca imagini să
  // fie populat). Numai obiectele clar abandonate dispar.
  let orphanPhotosDeleted = 0;
  try {
    const { data: allImg } = await admin.from("sesizari").select("imagini");
    const referenced = new Set<string>();
    for (const r of (allImg ?? []) as { imagini: string[] | null }[]) {
      for (const url of r.imagini ?? []) {
        const m = String(url).match(/\/sesizari-photos\/(.+)$/);
        const p = m?.[1]?.split("?")[0];
        if (p) referenced.add(p); // ex: public/123-abc.jpg
      }
    }
    const orphans: string[] = [];
    let offset = 0;
    for (;;) {
      const { data: objs } = await admin.storage
        .from("sesizari-photos")
        .list("public", { limit: 1000, offset });
      if (!objs || objs.length === 0) break;
      for (const o of objs) {
        const key = `public/${o.name}`;
        const ts = o.name.match(/^(\d{10,13})-/);
        const olderThan7d = ts ? Number(ts[1]) < now - 7 * DAY : true;
        if (!referenced.has(key) && olderThan7d) orphans.push(key);
      }
      if (objs.length < 1000) break;
      offset += 1000;
    }
    for (const batch of chunk(orphans, 100)) {
      const { data } = await admin.storage.from("sesizari-photos").remove(batch);
      orphanPhotosDeleted += data?.length ?? 0;
    }
  } catch { /* best-effort — storage list poate eșua dacă bucket-ul lipsește */ }

  return NextResponse.json({
    ok: true,
    cosignersPurged,
    sesizariAnonimizate: sesizariAnonimizate ?? 0,
    expiredSesizari: expiredIds.length,
    inboxLogsPurged,
    orphanPhotosDeleted,
  });
}
