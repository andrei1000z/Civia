import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { authenticateApiKey, logApiCall } from "@/lib/api/auth";
import { getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public API v2 — read-only sesizari endpoint pentru jurnalisti + ONG.
 *
 * GET /api/v2/sesizari?county=B&status=rezolvat&tip=groapa&from=2026-01-01&limit=50&offset=0
 *
 * Auth:
 *   - Authorization: Bearer civia_pk_xxx
 *   - sau ?api_key=civia_pk_xxx
 *
 * Rate-limit: 100/h pe tier free, 1000/h pe tier pro.
 *
 * Response shape:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "code": "ABC123",
 *       "tip": "groapa",
 *       "titlu": "...",
 *       "locatie": "...",
 *       "county": "B",
 *       "sector": "S1",
 *       "lat": 44.43,
 *       "lng": 26.10,
 *       "status": "rezolvat",
 *       "created_at": "2026-...",
 *       "resolved_at": "2026-...",
 *       "cosigners": 5,
 *       "url": "https://civia.ro/sesizari/ABC123"
 *     }
 *   ],
 *   "pagination": { "total": 1234, "limit": 50, "offset": 0, "has_more": true },
 *   "meta": { "tier": "free", "rate_limit": { "limit": 100, "window": "1h" } }
 * }
 *
 * NU expunem: author_name, author_email, descriere completa (PII-light: doar titlu + locatie publica).
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "read:sesizari");
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const url = new URL(req.url);

  if (!auth.ok) {
    if (auth.keyId) logApiCall(auth.keyId, url.pathname, ip, ua, auth.status);
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: { "WWW-Authenticate": "Bearer realm=civia-api" } },
    );
  }

  const { searchParams } = url;
  const county = searchParams.get("county")?.toUpperCase() || null;
  const status = searchParams.get("status");
  const tip = searchParams.get("tip");
  const sector = searchParams.get("sector");
  const from = searchParams.get("from"); // ISO date
  const to = searchParams.get("to");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const admin = createSupabaseAdmin();
  let query = admin
    .from("sesizari_feed")
    .select(
      "id, code, tip, titlu, locatie, county, sector, lat, lng, status, created_at, resolved_at, nr_cosigners",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (county) query = query.eq("county", county);
  if (status) query = query.eq("status", status);
  if (tip) query = query.eq("tip", tip);
  if (sector) query = query.eq("sector", sector);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, count, error } = await query;
  if (error) {
    logApiCall(auth.keyId!, url.pathname, ip, ua, 500);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  const responseData = (data ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    tip: s.tip,
    titlu: s.titlu,
    locatie: s.locatie,
    county: s.county,
    sector: s.sector,
    lat: s.lat,
    lng: s.lng,
    status: s.status,
    created_at: s.created_at,
    resolved_at: s.resolved_at,
    cosigners: s.nr_cosigners ?? 0,
    url: `${SITE_URL}/sesizari/${s.code}`,
  }));

  logApiCall(auth.keyId!, url.pathname, ip, ua, 200);

  return NextResponse.json(
    {
      data: responseData,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: (count ?? 0) > offset + limit,
      },
      meta: {
        tier: auth.tier,
        rate_limit: {
          limit: auth.tier === "pro" ? 1000 : 100,
          window: "1h",
        },
        api_version: "v2",
        docs: `${SITE_URL}/dezvoltatori`,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
