import { NextResponse } from "next/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 30min → 1h. Weather conditions se schimba relatively slow.
export const revalidate = 3600;

/**
 * GET /api/weather?lat=44.43&lng=26.10
 * Fetch current weather from Open-Meteo (free, no API key).
 * Accepts optional lat/lng params — defaults to București if not provided.
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`weather:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") || "44.43");
  const lng = Number(searchParams.get("lng") || "26.10");

  // Clamp to Romania bounds
  const clampedLat = Math.max(43.5, Math.min(48.3, lat));
  const clampedLng = Math.max(20.2, Math.min(30.0, lng));

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${clampedLat}&longitude=${clampedLng}&` +
      "current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,precipitation,cloud_cover,pressure_msl,uv_index&" +
      "hourly=temperature_2m,weather_code&" +
      "forecast_days=1&" +
      "timezone=Europe%2FBucharest";

    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();

    const c = json.current ?? {};
    const hourly = json.hourly ?? {};

    // Build 24h forecast from hourly data
    const forecast = (hourly.time ?? []).slice(0, 24).map((time: string, i: number) => ({
      time,
      temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
      code: hourly.weather_code?.[i] ?? 0,
    }));

    return NextResponse.json(
      {
        data: {
          temp: Math.round(c.temperature_2m ?? 0),
          feels_like: Math.round(c.apparent_temperature ?? 0),
          humidity: c.relative_humidity_2m ?? null,
          wind: c.wind_speed_10m ?? null,
          code: c.weather_code ?? null,
          precipitation: c.precipitation ?? 0,
          cloud_cover: c.cloud_cover ?? null,
          pressure: c.pressure_msl ?? null,
          uv_index: c.uv_index ?? null,
          forecast,
          lat: clampedLat,
          lng: clampedLng,
          updated_at: new Date().toISOString(),
          source: "open-meteo.com",
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "weather unavailable";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
