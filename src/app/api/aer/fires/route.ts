import { NextResponse } from "next/server";
import { fetchFirms, type FireDetection } from "../sources/firms";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// FIRMS itself updates every ~3h; ISR-cache 10 minutes so we serve
// stale-while-revalidate'd data instead of hitting NASA on every map
// pan. Vercel CDN holds it the same 10 min via the response header.
export const revalidate = 1800;

interface FiresResponse {
  fires: FireDetection[];
  meta: {
    total: number;
    lastUpdate: string;
    bbox: { south: number; north: number; west: number; east: number };
    source: "nasa-firms-viirs";
  };
}

/**
 * Active wildfire detections in Romania over the last 24h. Source:
 * NASA FIRMS (Suomi NPP / VIIRS). Used by the air quality map to
 * render fire markers — same idea as the red flame icons on
 * iqair.com/romania.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`aer-fires:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  const startTime = Date.now();
  const fires = await fetchFirms();
  const { RO_BOUNDS } = await import("@/lib/aer/constants");

  const response: FiresResponse = {
    fires,
    meta: {
      total: fires.length,
      lastUpdate: new Date().toISOString(),
      bbox: RO_BOUNDS,
      source: "nasa-firms-viirs",
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
      "X-Fetch-Time": `${Date.now() - startTime}ms`,
    },
  });
}
