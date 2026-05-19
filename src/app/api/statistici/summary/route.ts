import { NextResponse } from "next/server";
import { getSesizariStatsCached } from "@/lib/cached-queries";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 15min → 6h. Statistici agregate, schimbari lente.
export const revalidate = 21600;

/**
 * Lightweight count-based summary for homepage widgets.
 * Shares an in-memory cache with /impact and other callers — a single
 * stats pull serves all of them within the TTL window.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`stats-summary:${getClientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  try {
    const data = await getSesizariStatsCached();
    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
