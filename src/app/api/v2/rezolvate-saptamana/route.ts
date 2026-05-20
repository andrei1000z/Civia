import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const revalidate = 14400; // 4h

/**
 * GET /api/v2/rezolvate-saptamana — public API "Top sesizări rezolvate
 * săptămâna asta", folosit de:
 *  - Newsletter weekly digest (cron Monday)
 *  - Homepage widget "Săptămâna asta s-au rezolvat..."
 *  - Jurnalisti pentru articole pozitive
 *
 * Returnează ultimele 10 sesizari cu status=rezolvat în ultimele 7 zile.
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
  const rl = await rateLimitAsync(`v2-rezolvate:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429, headers: CORS_HEADERS });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("sesizari_feed")
    .select(
      "code, titlu, locatie, sector, county, tip, created_at, resolved_at, upvotes, nr_comentarii, imagini, resolved_photo_url",
    )
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .eq("status", "rezolvat")
    .gte("resolved_at", sevenDaysAgo)
    .order("resolved_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      ok: true,
      version: "v2",
      since: sevenDaysAgo,
      total: data?.length ?? 0,
      sesizari: (data ?? []).map((s) => ({
        code: s.code,
        titlu: s.titlu,
        locatie: s.locatie,
        sector: s.sector,
        county: s.county,
        tip: s.tip,
        resolved_at: s.resolved_at,
        upvotes: s.upvotes,
        comments: s.nr_comentarii,
        before_photo: s.imagini?.[0] ?? null,
        after_photo: s.resolved_photo_url ?? null,
        url: `https://civia.ro/sesizari/${s.code}`,
      })),
      license: "CC BY 4.0",
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=28800",
      },
    },
  );
}
