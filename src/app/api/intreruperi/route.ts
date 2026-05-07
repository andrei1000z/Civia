import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { loadInterruptions, maybeTriggerBackgroundRefresh } from "@/lib/intreruperi/store";

// Page-side polling can be aggressive; 5 min is short enough that the
// admin queue feels live but long enough that 1000 viewers don't beat
// up Supabase reads.
// 15 min (de la 5 min) — reduce ISR Writes Vercel Hobby. Date scraped
// se schimbă rar (zilnic via cron), 15 min e suficient.
export const revalidate = 900;

/**
 * GET /api/intreruperi
 *   ?county=CJ          — filtrează pe județ
 *   ?type=apa           — filtrează pe tip
 *   ?active=1           — doar cele active (neterminate)
 *   ?lat=44.43&lng=26.1&radius_km=5 — bounding-circle distance filter
 *
 * Reads from `intreruperi_scraped` Supabase + the curated static seed.
 * Background fires the scraper if the 6h Redis lock has expired.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`intreruperi-list:${ip}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const county = searchParams.get("county")?.toUpperCase();
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") === "1";
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius = Number(searchParams.get("radius_km"));

  const { items, scrapedCount, lastSeenAt, source } = await loadInterruptions();

  let list = items;
  if (activeOnly) {
    const now = Date.now();
    list = list.filter(
      (i) =>
        i.status !== "anulat" &&
        i.status !== "finalizat" &&
        new Date(i.endAt).getTime() > now,
    );
  }

  if (county) list = list.filter((i) => i.county.toUpperCase() === county);
  if (type) list = list.filter((i) => i.type === type);

  if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius) && radius > 0) {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    list = list.filter((i) => {
      if (i.lat == null || i.lng == null) return false;
      const dLat = toRad(i.lat - lat);
      const dLng = toRad(i.lng - lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(i.lat)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(a));
      return dist <= radius;
    });
  }

  // Fire the throttled background scraper AFTER the response is sent.
  // 6h Redis lock means actual scrape happens at most once per 6h
  // regardless of viewer count. Hobby cron is the daily floor.
  after(maybeTriggerBackgroundRefresh);

  return NextResponse.json(
    {
      data: list,
      count: list.length,
      updated_at: new Date().toISOString(),
      meta: { scraped_count: scrapedCount, last_seen_at: lastSeenAt, source },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
