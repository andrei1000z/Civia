import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  tip: z.string().min(1).max(40),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  sector: z.string().max(20).optional().nullable(),
  /** Radius in meters, default 50. Max 500 (anti-abuse). */
  radius: z.number().int().min(10).max(500).optional(),
});

/**
 * POST /api/sesizari/duplicates — checks for nearby sesizari with same tip
 * in the last 7 days. Returns up to 5 candidates for client to display
 * „5 alți au raportat asta aici" cu cosign CTA in loc de duplicate.
 *
 * Inspirat de SeeClickFix issue clustering. Reduce duplicate submissions
 * + boost cosign rate.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`duplicates:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe verificari" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  const { tip, lat, lng, sector, radius = 50 } = parsed.data;

  const admin = createSupabaseAdmin();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  // Strategy: prefilter on tip + sector + recent. Then haversine check
  // client-side (Postgres function would be more accurate but adds setup).
  let query = admin
    .from("sesizari_feed")
    .select("code, titlu, locatie, sector, status, tip, lat, lng, created_at, upvotes, voturi_net")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .eq("tip", tip)
    .gte("created_at", sevenDaysAgo)
    .neq("status", "rezolvat")
    .order("created_at", { ascending: false })
    .limit(20);

  if (sector) query = query.eq("sector", sector);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Filter by radius if coords provided.
  let candidates = data ?? [];
  if (lat != null && lng != null) {
    const radiusKm = radius / 1000;
    candidates = candidates
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        ...s,
        distance_m: Math.round(haversineKm({ lat, lng }, { lat: s.lat as number, lng: s.lng as number }) * 1000),
      }))
      .filter((s) => s.distance_m <= radius)
      .sort((a, b) => a.distance_m - b.distance_m);
  } else {
    // Fără coords: sortăm după votes desc (cele mai populare in zonă)
    candidates = candidates
      .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
      .slice(0, 5);
  }

  return NextResponse.json({
    ok: true,
    count: candidates.length,
    radius,
    candidates: candidates.slice(0, 5),
  });
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
