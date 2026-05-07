import { NextResponse } from "next/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 5-minute ISR cache. An EMSC quake in Romania is rare enough that 5 min
// latency is acceptable; the AlertBanner client polls every 5 min anyway.
// Route handlers use `revalidate` directly (not `dynamic`) for ISR semantics.
export const revalidate = 1800;

interface AlertPayload {
  id: string;
  type: "aqi" | "meteo" | "ro-alert" | "quake" | "info";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  link?: string;
  source: string;
  validUntil?: string;
}

// Romania bounding box (approximate) used to filter global feeds
const RO_BOUNDS = { latMin: 43.5, latMax: 48.3, lonMin: 20.2, lonMax: 29.7 };

function inRomania(lat: number, lon: number): boolean {
  return lat >= RO_BOUNDS.latMin && lat <= RO_BOUNDS.latMax && lon >= RO_BOUNDS.lonMin && lon <= RO_BOUNDS.lonMax;
}

/**
 * EMSC recent earthquake feed — public JSON, no API key.
 * Returns quakes M >= 3.0 within Romania bounds in the last 24h.
 */
async function fetchRecentQuake(): Promise<AlertPayload | null> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 19);
    const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmagnitude=3.0&limit=20&orderby=time&start=${since}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{
        id: string;
        properties: { mag: number; lat: number; lon: number; time: string; flynn_region: string };
      }>;
    };
    const features = json.features ?? [];
    // Keep only events within RO bbox, newest first
    const roEvents = features
      .filter((f) => inRomania(f.properties.lat, f.properties.lon))
      .sort((a, b) => new Date(b.properties.time).getTime() - new Date(a.properties.time).getTime());
    const latest = roEvents[0];
    if (!latest) return null;
    const mag = latest.properties.mag;
    // Only surface events M >= 4.0 to the banner — smaller ones are noise
    if (mag < 4.0) return null;
    const ageMin = Math.round((Date.now() - new Date(latest.properties.time).getTime()) / 60_000);
    return {
      id: `quake-${latest.id}`,
      type: "quake",
      severity: mag >= 5.0 ? "critical" : "warning",
      title: `Cutremur ${mag.toFixed(1)} în România`,
      message: `Magnitudine ${mag.toFixed(1)} în ${latest.properties.flynn_region}, acum ${ageMin} min. Verifică clădirile pentru avarii.`,
      link: "/ghiduri/ghid-cutremur",
      source: "EMSC seismicportal.eu",
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Aggregates active public alerts into a single response consumed by
 * the sticky <AlertBanner /> in the root layout.
 *
 * Sources currently checked (in priority order, highest severity wins):
 *   1. EMSC earthquake feed — M ≥ 4.0 in Romania bbox, last 24h
 *   2. AQI — if the highest sensor reading in București exceeds AQI 150
 *   3. Editorial — announcements set via env var CIVIA_ANNOUNCEMENT
 *
 * All sources fail-open — a 5xx from any external API results in null.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`alerts:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const alerts: AlertPayload[] = [];

  // 1. Earthquake feed (EMSC)
  const quake = await fetchRecentQuake();
  if (quake) alerts.push(quake);

  // 2. AQI — query our own aggregator
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/aer?county=B`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const { data } = (await res.json()) as {
        data: { sensors?: Array<{ aqi: number }> };
      };
      if (data?.sensors && data.sensors.length > 0) {
        const maxAqi = Math.max(...data.sensors.map((s) => s.aqi ?? 0));
        if (maxAqi >= 150) {
          alerts.push({
            id: `aqi-${Math.floor(maxAqi / 25) * 25}-${new Date().toISOString().slice(0, 10)}`,
            type: "aqi",
            severity: maxAqi >= 200 ? "critical" : "warning",
            title: maxAqi >= 200 ? "Poluare periculoasă" : "Calitate aer redusă",
            message: `AQI ${Math.round(maxAqi)} în București — evită efortul fizic în exterior și închide ferestrele.`,
            link: "/aer",
            source: "OpenAQ / Sensor Community",
            validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
          });
        }
      }
    }
  } catch {
    /* best-effort */
  }

  // 2. Editorial announcements — simple env-var based
  // Format: "SEVERITY|TITLE|MESSAGE|LINK"
  const announcement = process.env.CIVIA_ANNOUNCEMENT;
  if (announcement) {
    const parts = announcement.split("|");
    if (parts.length >= 3) {
      alerts.push({
        id: `editorial-${Buffer.from(announcement).toString("base64").slice(0, 12)}`,
        type: "info",
        severity: (parts[0] as AlertPayload["severity"]) ?? "info",
        title: parts[1] ?? "Anunț",
        message: parts[2] ?? "",
        link: parts[3] || undefined,
        source: "Civia",
      });
    }
  }

  alerts.sort((a, b) => {
    const order = { critical: 3, warning: 2, info: 1 };
    return order[b.severity] - order[a.severity];
  });

  return NextResponse.json(
    { data: alerts[0] ?? null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
