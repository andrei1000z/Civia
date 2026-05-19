import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 10min → 1h. API public v1.
export const revalidate = 3600;

/**
 * Public open API v1 — returns only approved, public sesizari.
 * Designed to be consumed by journalists, researchers, other platforms.
 *
 * Query params:
 *   - county: ISO code (CJ, B, IS, ...)
 *   - tip: sesizare type (groapa, iluminat, ...)
 *   - status: nou | in-lucru | rezolvat | respins
 *   - sector: S1..S6 (Bucharest only)
 *   - from / to: ISO dates for created_at filtering
 *   - limit: 1..100 (default 50)
 *   - offset: default 0
 *
 * CORS: wide-open (Access-Control-Allow-Origin: *)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const PUBLIC_FIELDS = [
  "id",
  "code",
  "tip",
  "titlu",
  "locatie",
  "sector",
  "county",
  "locality",
  "lat",
  "lng",
  "status",
  "resolved_at",
  "created_at",
  "updated_at",
  "voturi_net",
  "nr_comentarii",
].join(", ");

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`api-v1:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Limit: 120/min." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const county = searchParams.get("county")?.toUpperCase();
    const tip = searchParams.get("tip");
    const status = searchParams.get("status");
    const sector = searchParams.get("sector");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 50)));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

    const admin = createSupabaseAdmin();
    let query = admin
      .from("sesizari_feed")
      .select(PUBLIC_FIELDS, { count: "exact" })
      .eq("publica", true)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (county) query = query.eq("county", county);
    if (tip) query = query.eq("tip", tip);
    if (status) query = query.eq("status", status);
    if (sector) query = query.eq("sector", sector);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      {
        meta: {
          version: "v1",
          count: count ?? data?.length ?? 0,
          limit,
          offset,
          next: count && offset + limit < count ? offset + limit : null,
          license: "CC BY 4.0",
          source: "https://civia.ro",
        },
        data: data ?? [],
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "internal", message: msg },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
