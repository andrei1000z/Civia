/**
 * GET /api/stats/today
 *
 * 🎁 MEDIUM #14 — Counter „Azi rezolvate" homepage.
 *
 * Reads view `today_civic_stats` (resolved_today, new_today, votes_today, sent_today).
 * Cached 60s edge. Public read.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("today_civic_stats").select("*").maybeSingle();

  if (error) {
    return NextResponse.json(
      { resolved_today: 0, new_today: 0, votes_today: 0, sent_today: 0 },
      { status: 200 },
    );
  }

  return NextResponse.json(data ?? { resolved_today: 0, new_today: 0, votes_today: 0, sent_today: 0 }, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
