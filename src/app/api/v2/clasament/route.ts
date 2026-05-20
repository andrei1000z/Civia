import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { ALL_COUNTIES } from "@/data/counties";

export const revalidate = 21600; // 6h

/**
 * GET /api/v2/clasament — public API pentru clasamentul primariilor.
 *
 * Returnează aggregate pe județe cu rate de răspuns + rezolvare,
 * embeddable in dashboards externe (jurnalisti, dataviz).
 *
 * Folosit de mass-media pentru articole de transparență locală.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`v2-clasament:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit." },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } },
    );
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("sesizari")
    .select("county, status")
    .eq("moderation_status", "approved")
    .not("county", "is", null);

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500, headers: CORS_HEADERS });
  }

  const RESPONDED = new Set(["in-lucru", "actiune_autoritate", "rezolvat", "respins", "amanat"]);
  const byCounty = new Map<string, { total: number; responded: number; resolved: number }>();

  for (const row of (data ?? []) as Array<{ county: string; status: string }>) {
    const c = row.county;
    if (!c) continue;
    const bucket = byCounty.get(c) ?? { total: 0, responded: 0, resolved: 0 };
    bucket.total += 1;
    if (RESPONDED.has(row.status)) bucket.responded += 1;
    if (row.status === "rezolvat") bucket.resolved += 1;
    byCounty.set(c, bucket);
  }

  const result = Array.from(byCounty.entries())
    .filter(([, b]) => b.total >= 5)
    .map(([countyId, b]) => {
      const county = ALL_COUNTIES.find((c) => c.id === countyId);
      return {
        county_id: countyId,
        county_name: county?.name ?? countyId,
        county_slug: county?.slug ?? countyId.toLowerCase(),
        total_sesizari: b.total,
        responded: b.responded,
        resolved: b.resolved,
        response_rate_pct: Math.round((b.responded / b.total) * 100),
        resolve_rate_pct: Math.round((b.resolved / b.total) * 100),
      };
    })
    .sort((a, b) => b.response_rate_pct - a.response_rate_pct);

  return NextResponse.json(
    {
      ok: true,
      version: "v2",
      total_counties: result.length,
      methodology: {
        min_sesizari_for_inclusion: 5,
        responded_statuses: Array.from(RESPONDED),
        resolved_status: "rezolvat",
      },
      clasament: result,
      docs: "https://civia.ro/dezvoltatori",
      license: "CC BY 4.0 — atribuire Civia.ro cerută la republicare",
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
      },
    },
  );
}
