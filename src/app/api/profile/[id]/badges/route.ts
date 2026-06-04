import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { computeBadges, computeStreak } from "@/lib/badges";

export const dynamic = "force-dynamic";
// 2026-05-19: 1min → 30min. Badge-urile se ating pe milestone-uri rare,
// nu real-time. Counter-ul se updateaza on-demand cand userul depune sesizare.
export const revalidate = 1800;

/**
 * GET /api/profile/[id]/badges
 *
 * Public read — afișăm chip-uri de badge pe profil + pe sesizările publice.
 * Calculat dinamic din count-uri (sesizari, comentarii, verificări,
 * sesizări rezolvate ale autorului). Niciun storage stocat pentru badges
 * (vezi badges.ts).
 *
 * Folosim service-role pentru count-uri agregate ca RLS sa nu ascunda
 * sesizările celorlalți useri. Datele returnate sunt strict counts
 * + badge metadata (nicio PII).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: userId } = await ctx.params;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "invalid user id" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Pentru streak: ne uitam la timestamps din ultimele 120 zile pe
  // sesizari + comentarii + verificari. Limitam la 120 ca sa
  // nu pull-am o cantitate mare de date inutil.
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const [sesizariRes, commentsRes, verifsRes, resolvedRes,
    sesizariTsRes, commentsTsRes, verifsTsRes] =
    await Promise.all([
      admin
        .from("sesizari")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("sesizare_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("sesizare_verifications")
        .select("sesizare_id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("sesizari")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "rezolvat"),
      // Pentru streak — doar timestamps in ultimele 120 zile.
      admin
        .from("sesizari")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", since),
      admin
        .from("sesizare_comments")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", since),
      admin
        .from("sesizare_verifications")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", since),
    ]);

  const allTimestamps: string[] = [
    ...(sesizariTsRes.data ?? []).map((r) => (r as { created_at: string }).created_at),
    ...(commentsTsRes.data ?? []).map((r) => (r as { created_at: string }).created_at),
    ...(verifsTsRes.data ?? []).map((r) => (r as { created_at: string }).created_at),
  ];
  const streak = computeStreak(allTimestamps);

  const counts = {
    sesizari: sesizariRes.count ?? 0,
    comments: commentsRes.count ?? 0,
    verifications: verifsRes.count ?? 0,
    resolved: resolvedRes.count ?? 0,
    streak,
  };

  const badges = computeBadges(counts);

  return NextResponse.json(
    { data: { badges, counts } },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
