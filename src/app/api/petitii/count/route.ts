import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const revalidate = 900;

/**
 * Count active petitions — folosit de LiveStatsBar pe homepage.
 * Returnează { data: { active: number } }. Zero dacă tabela nu există
 * încă (migration 020 negat applied) sau toate-s closed/draft.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`petitii-count:${getClientIp(req)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { count, error } = await admin
      .from("petitii")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    if (error) {
      // Migration 020 not applied yet → table missing → soft fallback.
      return NextResponse.json(
        { data: { active: 0 } },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
      );
    }
    return NextResponse.json(
      { data: { active: count ?? 0 } },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ data: { active: 0 } });
  }
}
