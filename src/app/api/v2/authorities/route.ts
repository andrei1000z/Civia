import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const revalidate = 21600; // 6h

/**
 * GET /api/v2/authorities — public API pentru jurnaliști + apps externe.
 *
 * Returnează autoritățile verificate pe Civia cu stats agregate
 * (rata răspuns, rata rezolvare, sesizari recente).
 *
 * Query params:
 *   - county: filtru pe județ (ex: B, CJ)
 *   - kind: filtru pe tip (primarie_sector, politie_locala, etc.)
 *   - limit: default 50, max 200
 *
 * Rate-limit: 60/min/IP (CORS open pentru utilizare publica).
 *
 * Folosit de jurnalisti, ONG-uri, dashboards externe.
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
  const rl = await rateLimitAsync(`v2-authorities:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit. Retry in 60s." },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } },
    );
  }

  const { searchParams } = new URL(req.url);
  const county = searchParams.get("county");
  const kind = searchParams.get("kind");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1), 200);

  const admin = createSupabaseAdmin();
  let query = admin
    .from("authorities")
    .select("id, name, kind, county, sector, official_email, website, verified_at")
    .eq("verified", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (county) query = query.eq("county", county.toUpperCase());
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      ok: true,
      version: "v2",
      total: data?.length ?? 0,
      authorities: data ?? [],
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
