import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public health-check endpoint pentru uptime monitoring (BetterStack,
 * UptimeRobot, Pingdom). Returneaza 200 daca DB raspunde sub 2s,
 * 503 altfel. Folosit si de status page (status.civia.ro).
 *
 * GET /api/health
 * Response 200:
 *   { status: "ok", db_latency_ms: 42, version: "...", timestamp: "..." }
 * Response 503:
 *   { status: "degraded", db_latency_ms: null, error: "..." }
 */
export async function GET() {
  const start = Date.now();
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.npm_package_version ??
    "dev";

  try {
    const sa = createSupabaseAdmin();
    // Cheapest possible query — just confirm the connection works.
    const { error } = await sa.from("sesizari").select("id", { count: "exact", head: true }).limit(1);
    const dbLatencyMs = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          db_latency_ms: dbLatencyMs,
          error: error.message,
          version,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (dbLatencyMs > 2000) {
      return NextResponse.json(
        {
          status: "slow",
          db_latency_ms: dbLatencyMs,
          version,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        db_latency_ms: dbLatencyMs,
        version,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        status: "down",
        db_latency_ms: null,
        error: e instanceof Error ? e.message : "Unknown",
        version,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
