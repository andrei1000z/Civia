import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 15min → 6h. Agregate statistici.
export const revalidate = 21600;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public aggregated stats. No personal data.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`api-v1-stats:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const [total, rezolvate, inLucru, byType, byCounty] = await Promise.all([
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "rezolvat"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "in-lucru"),
      admin.from("sesizari").select("tip").eq("moderation_status", "approved").limit(5000),
      admin.from("sesizari").select("county").eq("moderation_status", "approved").limit(5000),
    ]);

    const typeMap = new Map<string, number>();
    for (const r of (byType.data ?? []) as { tip: string }[]) {
      typeMap.set(r.tip, (typeMap.get(r.tip) ?? 0) + 1);
    }
    const countyMap = new Map<string, number>();
    for (const r of (byCounty.data ?? []) as { county: string | null }[]) {
      if (!r.county) continue;
      countyMap.set(r.county, (countyMap.get(r.county) ?? 0) + 1);
    }

    return NextResponse.json(
      {
        meta: {
          version: "v1",
          license: "CC BY 4.0",
          source: "https://civia.ro",
          generated_at: new Date().toISOString(),
        },
        data: {
          total: total.count ?? 0,
          resolved: rezolvate.count ?? 0,
          in_progress: inLucru.count ?? 0,
          by_type: Object.fromEntries(typeMap),
          by_county: Object.fromEntries(countyMap),
        },
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
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
