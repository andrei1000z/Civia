import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lightweight counters pentru social-proof widget de pe homepage:
 *  - lastHour: cate sesizari create in ultima ora
 *  - lastDay: cate sesizari create in ultimele 24 h
 *  - today: cate sesizari noi astazi (UTC)
 *  - total: totalul aprobat & public
 *
 * Cached 60s la edge ca sa nu loveasca DB pe fiecare scroll homepage.
 */
export async function GET() {
  try {
  const admin = createSupabaseAdmin();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60_000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60_000).toISOString();

  const [hourRes, dayRes, totalRes] = await Promise.all([
    admin
      .from("sesizari")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .gte("created_at", hourAgo),
    admin
      .from("sesizari")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .gte("created_at", dayAgo),
    admin
      .from("sesizari")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .eq("publica", true),
  ]);

  return NextResponse.json(
    {
      lastHour: hourRes.count ?? 0,
      lastDay: dayRes.count ?? 0,
      total: totalRes.count ?? 0,
      now: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    },
  );
  } catch {
    return NextResponse.json(
      { lastHour: 0, lastDay: 0, total: 0, now: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=10" } },
    );
  }
}
