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

  return NextResponse.json({
    ok: true,
    cosignersPurged,
    sesizariAnonimizate: sesizariAnonimizate ?? 0,
    expiredSesizari: expiredIds.length,
  });
}
