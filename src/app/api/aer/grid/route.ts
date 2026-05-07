import { NextResponse } from "next/server";
import { fetchSensorCommunity } from "../sources/sensor-community";
import { fetchSensorCommunityV2 } from "../sources/sensor-community-v2";
import { fetchOpenAQ } from "../sources/openaq";
import { fetchWaqi } from "../sources/waqi";
import { fetchFirms } from "../sources/firms";
import type { UnifiedSensor } from "@/lib/aer/types";
import {
  buildEstimationGrid,
  type GridCell,
} from "@/lib/aer/estimation-grid";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 3-min ISR — same cadence as /api/aer. Grid is cheap to compute
// (~50ms for ~400 cells) once the sensors are fetched, but the
// upstream sensor fetches are the cost; we want to amortize them.
export const revalidate = 600;

interface GridResponse {
  cells: GridCell[];
  meta: {
    cellCount: number;
    sensorCount: number;
    fireCount: number;
    step: number;
    generatedAt: string;
  };
}

/**
 * Estimated AQI grid covering all of Romania at ~0.25° resolution
 * (~27km cells). Each cell combines IDW interpolation of real
 * sensors + temporal modifiers + industrial baselines + fire
 * proximity boost. Used by the heatmap to color the entire country,
 * not just sensor neighborhoods.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`aer-grid:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  const startTime = Date.now();

  // Fetch sensors + fires in parallel. Each source has its own
  // timeout so a slow one doesn't pin the route.
  const [scA, scB, oaq, waqi, firms] = await Promise.allSettled([
    fetchSensorCommunity(),
    fetchSensorCommunityV2(),
    fetchOpenAQ(),
    fetchWaqi(),
    fetchFirms(),
  ]);

  const sensors: UnifiedSensor[] = [];
  if (scA.status === "fulfilled") sensors.push(...scA.value);
  if (scB.status === "fulfilled") sensors.push(...scB.value);
  if (oaq.status === "fulfilled") sensors.push(...oaq.value);
  if (waqi.status === "fulfilled") sensors.push(...waqi.value);
  const fires = firms.status === "fulfilled" ? firms.value : [];

  const cells = await buildEstimationGrid({ sensors, fires });

  const response: GridResponse = {
    cells,
    meta: {
      cellCount: cells.length,
      sensorCount: sensors.length,
      fireCount: fires.length,
      step: 0.25,
      generatedAt: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300",
      "X-Fetch-Time": `${Date.now() - startTime}ms`,
    },
  });
}
