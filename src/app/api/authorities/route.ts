import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const revalidate = 3600; // 1 hour cache

/**
 * GET /api/authorities?county=CJ&type=primarie&locality=cluj-napoca
 * Public API for querying authorities database.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`authorities:${getClientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const county = searchParams.get("county");
  const type = searchParams.get("type");
  const locality = searchParams.get("locality");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  try {
    const supabase = await createSupabaseServer();
    // 2026-05-25 OPTIMIZATION: explicit columns. raw_data + email_raw NU sunt
    // expuse public — fetch inutil. Salvare ~500 MB/zi Fast Origin Transfer.
    let query = supabase
      .from("authorities")
      .select("id,name,type,county_id,locality_id,email,phone,website,address,notes")
      .order("name", { ascending: true })
      .limit(limit);

    if (county) query = query.eq("county_id", county.toUpperCase());
    if (type) query = query.eq("type", type);
    if (locality) query = query.eq("locality_id", locality);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      {
        data: data ?? [],
        meta: { count: data?.length ?? 0, limit },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          // 1-hour CDN cache with 1h stale-while-revalidate. Authority
          // records change monthly at most; aggressive caching cuts
          // Supabase egress by ~20x on this endpoint.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
