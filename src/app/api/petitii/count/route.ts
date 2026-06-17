import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 15min → 1h. Petitii noi se adauga rar (admin manual).
export const revalidate = 3600;

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
      .select("id", { count: "exact", head: true })
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
