/**
 * GET /api/heatmap/sesizari?county=B&tip=parcare
 *
 * 🎁 MEDIUM #10 — Heatmap intensitate sesizari per oraș.
 *
 * Returneaza array [lat, lng, weight] pentru Leaflet.heat plugin.
 * Bucket-uire pe coord rotunjit la 3 decimals (~100m precision).
 * Date din materialized view `sesizari_heatmap` (refresh weekly).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const county = url.searchParams.get("county");
  const tip = url.searchParams.get("tip");
  const onlyUnresolved = url.searchParams.get("unresolved") === "1";

  const admin = createSupabaseAdmin();
  let query = admin
    .from("sesizari_heatmap")
    .select("lat_bucket, lng_bucket, count_total, count_unresolved");

  if (county) query = query.eq("county", county);
  if (tip) query = query.eq("tip", tip);

  const { data, error } = await query.limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    lat_bucket: number;
    lng_bucket: number;
    count_total: number;
    count_unresolved: number;
  }>;

  // Heat plugin expects array of [lat, lng, intensity 0-1]
  const maxCount = Math.max(1, ...rows.map((r) => onlyUnresolved ? r.count_unresolved : r.count_total));
  const points = rows.map((r) => [
    r.lat_bucket,
    r.lng_bucket,
    Math.min(1, (onlyUnresolved ? r.count_unresolved : r.count_total) / maxCount),
  ]);

  return NextResponse.json({
    points,
    max_count: maxCount,
    total_points: points.length,
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
