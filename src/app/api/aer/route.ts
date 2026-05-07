import { NextResponse } from "next/server";
import { fetchSensorCommunity } from "./sources/sensor-community";
import { fetchSensorCommunityV2 } from "./sources/sensor-community-v2";
import { fetchOpenAQ } from "./sources/openaq";
import { fetchWaqi } from "./sources/waqi";
import { fetchUradMonitor } from "./sources/uradmonitor";
import type { UnifiedSensor, AirDataResponse } from "@/lib/aer/types";
import { DEDUP_RADIUS_M } from "@/lib/aer/constants";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { isInsideRomania, preloadRomaniaPolygon } from "@/lib/aer/romania-polygon";

// 3-min ISR cache. Sensor.Community individual stations vary from
// ~10s reporting to several minutes; the upstream aggregate is
// effectively fresh at the 1–3 min mark. OpenAQ + WAQI cap out
// hourly upstream but respond fast. Bumped from 60s to 180s after
// metering: the 60s window was firing ~60 cold pulls/h per route
// for marginal freshness gain (most sensors hadn't updated yet).
// 180s halves origin cost; map still feels live.
export const revalidate = 600;

/**
 * Citizen-network sensors occasionally drift out of calibration and
 * report nonsense values (PM2.5 ≈ PM10 ≈ 1320 µg/m³ from a single
 * Bistrița sensor blew up our heatmap by anchoring an entire region
 * red). Real-world PM2.5 ceiling outdoors is ~500 µg/m³ even during
 * the worst wildfire smoke; PM10 ~600. Anything past those is sensor
 * failure, not air quality. Hide such readings entirely so the
 * heatmap + dot rendering stays trustworthy.
 */
const PM25_MAX_PLAUSIBLE = 500;
const PM10_MAX_PLAUSIBLE = 600;

function isPlausible(s: UnifiedSensor): boolean {
  if (s.pm25 != null && s.pm25 > PM25_MAX_PLAUSIBLE) return false;
  if (s.pm10 != null && s.pm10 > PM10_MAX_PLAUSIBLE) return false;
  if (s.pm25 != null && s.pm25 < 0) return false;
  if (s.pm10 != null && s.pm10 < 0) return false;
  // A common stuck-sensor signature: PM2.5 == PM10 to 2 decimals AND
  // both are very high. Real readings always have PM10 > PM2.5 (PM10
  // is a superset). When they're identical AND elevated, the sensor
  // is broadcasting the same broken value across both channels.
  if (
    s.pm25 != null &&
    s.pm10 != null &&
    s.pm25 > 200 &&
    Math.abs(s.pm25 - s.pm10) < 0.01
  ) {
    return false;
  }
  return true;
}

/**
 * Distance between two points in meters (Haversine).
 */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Deduplicate sensors that are within DEDUP_RADIUS_M of each other.
 * Prefers: official > sensor-community, more data fields > fewer.
 */
function dedup(sensors: UnifiedSensor[]): UnifiedSensor[] {
  // Sort: official first, then by number of non-null fields
  const sorted = [...sensors].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
    const countFields = (s: UnifiedSensor) =>
      [s.pm25, s.pm10, s.no2, s.so2, s.o3, s.temperature].filter((v) => v != null).length;
    return countFields(b) - countFields(a);
  });

  const kept: UnifiedSensor[] = [];
  const used = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const a = sorted[i];
    if (!a) continue;
    kept.push(a);
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const b = sorted[j];
      if (!b) continue;
      if (distanceM(a.lat, a.lng, b.lat, b.lng) < DEDUP_RADIUS_M) {
        used.add(j);
      }
    }
  }

  return kept;
}

export async function GET(req: Request) {
  const rl = await rateLimitAsync(`aer:${getClientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  const startTime = Date.now();

  // Fetch all sources in parallel — don't fail if one is down. Each
  // pull is timeout-bounded inside its own module so a slow third
  // party doesn't pin the whole route. Romania polygon is preloaded
  // here so the first per-sensor membership check is a sync cache hit.
  const results = await Promise.allSettled([
    fetchSensorCommunity(),
    fetchSensorCommunityV2(),
    fetchOpenAQ(),
    fetchWaqi(),
    fetchUradMonitor(),
    preloadRomaniaPolygon().then(() => [] as UnifiedSensor[]),
  ]);
  // The preload result is intentionally a no-op array — strip it
  // before the source-name mapping so it doesn't pollute bySource.
  results.pop();

  const allSensors: UnifiedSensor[] = [];
  const bySource: Record<string, number> = {};
  const errors: string[] = [];

  const sourceNames = [
    "sensor-community",
    "sensor-community-v2",
    "openaq",
    "waqi",
    "uradmonitor",
  ] as const;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = sourceNames[i];
    if (!result || !name) continue;
    if (result.status === "fulfilled") {
      allSensors.push(...result.value);
      bySource[name] = result.value.length;
    } else {
      bySource[name] = 0;
      const reason = result.reason as { message?: string } | undefined;
      errors.push(`${name}: ${reason?.message ?? "unknown error"}`);
    }
  }

  // Filter implausible readings BEFORE dedup so a broken sensor
  // doesn't shadow the real one nearby just because it ranked higher
  // in the dedup sort (more non-null fields).
  const plausible = allSensors.filter(isPlausible);
  const droppedOutliers = allSensors.length - plausible.length;

  // Strict Romania boundary filter. WAQI returns the entire bbox
  // (which includes Belgrade, Sofia, Chișinău, Subotica and much of
  // southern Hungary) and even Sensor.Community sometimes includes a
  // sensor on a Romanian-registered owner's account that lives
  // physically across the border. Point-in-polygon here so the map
  // shows only Romania.
  const insideRo: UnifiedSensor[] = [];
  for (const s of plausible) {
    if (await isInsideRomania(s.lat, s.lng)) insideRo.push(s);
  }
  const droppedOutsideRo = plausible.length - insideRo.length;

  // Deduplicate
  const deduplicated = dedup(insideRo);

  // Calculate average AQI
  const aqiValues = deduplicated.map((s) => s.aqi).filter((v): v is number => v != null);
  const avgAqi = aqiValues.length > 0 ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : null;

  const response: AirDataResponse = {
    sensors: deduplicated,
    meta: {
      total: deduplicated.length,
      bySource,
      avgAqi,
      lastUpdate: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300",
      "X-Fetch-Time": `${Date.now() - startTime}ms`,
      "X-Outliers-Dropped": String(droppedOutliers),
      "X-Outside-Ro-Dropped": String(droppedOutsideRo),
      ...(errors.length > 0 ? { "X-Errors": errors.join("; ") } : {}),
    },
  });
}
