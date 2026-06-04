import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 10min → 1h. API public legacy + v1, folosit de external apps.
export const revalidate = 3600;

// LEGACY public API — deprecated in favour of /api/v1/sesizari which
// returns a more complete field set, has proper versioning and
// pagination cursors. This endpoint stays so existing consumers
// don't break, but it's soft-deprecated via the Deprecation +
// Sunset headers (RFC 8594 / draft-ietf-httpapi-deprecation).
// New consumers should call /api/v1/sesizari. Target removal: 2027.

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(req: Request) {
  const rl = await rateLimitAsync(`public-sesizari:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const sector = searchParams.get("sector");
  const tip = searchParams.get("tip");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
  const offset = Number(searchParams.get("offset") ?? 0);

  try {
    const supabase = await createSupabaseServer();
    let query = supabase
      .from("sesizari_feed")
      .select("code, titlu, descriere, locatie, sector, lat, lng, tip, status, created_at, nr_comentarii")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (sector) query = query.eq("sector", sector);
    if (tip) query = query.eq("tip", tip);

    const { data, error } = await query;
    if (error) throw error;

    return new NextResponse(JSON.stringify({
      data: data ?? [],
      meta: {
        count: data?.length ?? 0,
        limit,
        offset,
        deprecation: "This endpoint is deprecated. Migrate to /api/v1/sesizari for richer fields + pagination.",
        replacement: "https://civia.ro/api/v1/sesizari",
        license: "CC BY 4.0 — free to use with attribution to Civia",
        license_url: "https://creativecommons.org/licenses/by/4.0/",
      },
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        // RFC 8594 — indicates the endpoint is deprecated as of
        // 2026-04-22, and will be removed on 2027-04-22 (1-year runway
        // for consumers). Link header points to the replacement.
        "Deprecation": "Wed, 22 Apr 2026 00:00:00 GMT",
        "Sunset": "Thu, 22 Apr 2027 00:00:00 GMT",
        "Link": '</api/v1/sesizari>; rel="successor-version"; type="application/json"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
