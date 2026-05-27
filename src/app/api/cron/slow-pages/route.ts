import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { analyticsRedis, KEY } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Cron handler — slow pages alert.
 *
 * Ruleaza zilnic, scaneaza vitalPerRoute("LCP") din Redis, calculeaza
 * procentul de „poor" LCP per path, si trimite warning la Sentry pentru
 * paginile cu:
 *   - traffic semnificativ (≥ 100 LCP samples — sub asta zgomot statistic)
 *   - poor% ≥ 25 (un sfert din viewers au LCP ≥ 4s = experienta degradata)
 *
 * De ce „poor%" si nu p95: web-vitals library trimite rating-ul deja
 * computat client-side („good/needs-improvement/poor"), pragul „poor" e
 * 4000ms LCP. Avand deja per-route rating tally, e simplu sa derivam %.
 *
 * Auth: Bearer ${CRON_SECRET} (Vercel cron) sau admin session manuala.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;

  if (!isCron) {
    // Allow manual trigger by admin pentru testing.
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!analyticsRedis) {
    return NextResponse.json({ ok: true, noop: true, reason: "Redis not configured" });
  }

  // 2026-05-27 — defensive try/catch. Cron-ul rulează 1×/zi; pe Redis
  // outage skip cu noop (next run will retry).
  let data: Record<string, string> | null = null;
  try {
    data = await analyticsRedis.hgetall<Record<string, string>>(KEY.vitalPerRoute("LCP"));
  } catch {
    return NextResponse.json({ ok: true, alerts: [], redis: "degraded" });
  }
  if (!data) return NextResponse.json({ ok: true, alerts: [] });

  // Agregam pe path: { good, needsImprovement, poor, total }
  type Bucket = { good: number; needsImprovement: number; poor: number; total: number };
  const perPath = new Map<string, Bucket>();
  for (const [key, valRaw] of Object.entries(data)) {
    const val = Number(valRaw) || 0;
    const sep = key.lastIndexOf("|");
    if (sep < 0) continue;
    const path = key.slice(0, sep);
    const rating = key.slice(sep + 1);
    if (!path) continue;
    const bucket = perPath.get(path) ?? { good: 0, needsImprovement: 0, poor: 0, total: 0 };
    if (rating === "good") bucket.good += val;
    else if (rating === "needs-improvement") bucket.needsImprovement += val;
    else if (rating === "poor") bucket.poor += val;
    bucket.total += val;
    perPath.set(path, bucket);
  }

  const MIN_SAMPLES = 100;
  const POOR_THRESHOLD = 0.25;

  const alerts: Array<{ path: string; total: number; poor: number; poorPct: number }> = [];
  for (const [path, b] of perPath.entries()) {
    if (b.total < MIN_SAMPLES) continue;
    const poorPct = b.poor / b.total;
    if (poorPct < POOR_THRESHOLD) continue;
    alerts.push({
      path,
      total: b.total,
      poor: b.poor,
      poorPct: Math.round(poorPct * 1000) / 10,
    });
  }

  // Sortat descrescator pe poor% — fire la Sentry top N (cap 10) ca
  // sa nu inundam alerts cand toate paginile sunt lente.
  alerts.sort((a, b) => b.poorPct - a.poorPct);

  for (const a of alerts.slice(0, 10)) {
    Sentry.captureMessage(
      `Slow page LCP: ${a.path} — ${a.poorPct}% poor (${a.poor}/${a.total} views ≥ 4s LCP)`,
      {
        level: "warning",
        tags: {
          alert_type: "slow-page",
          path: a.path,
        },
        extra: { ...a },
      },
    );
  }

  return NextResponse.json({
    ok: true,
    scanned: perPath.size,
    alerted: alerts.length,
    alerts: alerts.slice(0, 20),
    thresholds: { minSamples: MIN_SAMPLES, poorThresholdPct: POOR_THRESHOLD * 100 },
  });
}
