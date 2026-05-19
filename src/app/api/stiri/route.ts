import { NextResponse, after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { allowedSourcesForView } from "@/lib/stiri/sources";
import { analyticsRedis } from "@/lib/analytics/redis";

// 2026-05-19: 5min → 30min. Stirile noi apar 1x/zi via cron. Plus
// self-healing background refresh fires un /api/stiri/fetch oricum.
export const revalidate = 1800;

// Self-healing background refresh: when the /stiri page is being viewed,
// kick off /api/stiri/fetch in the background — but throttled so at most
// one fetch happens every 5 minutes regardless of how many tabs are
// polling. The lock is a Redis NX SET; only the first request after the
// TTL expires acquires it. RSS feeds get hit politely; the daily Vercel
// cron remains the floor.
const FETCH_LOCK_KEY = "civia:stiri:fetch-lock";
const FETCH_LOCK_TTL_S = 5 * 60;

/**
 * Reorder a recency-sorted list so no single source appears more than
 * `maxPerWindow` times within any sliding window of `windowSize`
 * positions. Recency is preserved as much as possible — items only
 * shift later when they would over-saturate the window. When ALL
 * remaining items are over-quota (typical when one source published
 * a burst), fall back to plain recency for that step so the feed
 * doesn't deadlock.
 *
 * O(n²) worst case, but n ≤ 200 here so it's microsecond work.
 */
function diversifyBySource<T extends { source: string }>(
  rows: T[],
  opts: { maxPerWindow: number; windowSize: number },
): T[] {
  const { maxPerWindow, windowSize } = opts;
  const out: T[] = [];
  const remaining = [...rows];
  while (remaining.length > 0) {
    const recent = out.slice(-windowSize);
    const idx = remaining.findIndex((r) => {
      const count = recent.filter((p) => p.source === r.source).length;
      return count < maxPerWindow;
    });
    if (idx === -1) {
      // Everyone in `remaining` would overflow the window; take the
      // first (most recent) anyway to avoid an infinite loop. This
      // can happen if a single source dominates the entire pool.
      out.push(remaining.shift()!);
    } else {
      out.push(remaining.splice(idx, 1)[0]!);
    }
  }
  return out;
}

async function maybeTriggerBackgroundFetch() {
  if (!analyticsRedis) return;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;
  const lock = await analyticsRedis.set(FETCH_LOCK_KEY, Date.now(), {
    nx: true,
    ex: FETCH_LOCK_TTL_S,
  });
  if (lock !== "OK") return; // Someone else just triggered (or is in-flight)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";
    await fetch(`${baseUrl}/api/stiri/fetch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    // Background failure — let next stale read retry.
  }
}

export async function GET(req: Request) {
  const rl = await rateLimitAsync(`stiri:${getClientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const county = searchParams.get("county");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const search = (searchParams.get("q") ?? "").replace(/[,()%*]/g, "").slice(0, 64);

  // Source tier filtering: national-only on /stiri, national + local houses
  // on /[judet]/stiri. Driven entirely by the `source` column — local houses
  // are mapped to counties in src/lib/stiri/sources.ts.
  const allowedSources = allowedSourcesForView(county);

  try {
    const supabase = await createSupabaseServer();
    // List view (StiriList card) renders id/title/source/category/
    // excerpt/image_url/published_at/author. Skipping `content`
    // (full article body, 5–20 KB) and `ai_summary` (also large)
    // saves ~10–25 KB per row × `limit` (typically 50). Detail
    // page fetches the row again with full content via getStire.
    let query = supabase
      .from("stiri_cache")
      .select("id,title,source,category,excerpt,image_url,published_at,author,url,counties")
      .in("source", allowedSources)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (category && category !== "all") query = query.eq("category", category);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    // Source diversification — no single outlet may dominate the
    // first window of articles. Without this, a publisher with a
    // burst of recent posts (PressOne uploaded 12 articles in one
    // session) takes over the top 10, hiding everything else.
    // The diversifier keeps recency as the primary key but caps
    // per-source occurrence within a sliding window.
    const diversified = diversifyBySource(
      (data ?? []) as Array<{ source: string }>,
      { maxPerWindow: 2, windowSize: 8 },
    );

    // Fire the throttled background RSS refresh AFTER the response is
    // sent — Next 16 `after()` keeps the function instance alive long
    // enough for the trigger fetch to leave the box. The lock makes
    // sure traffic spikes don't translate to RSS feed hammering.
    after(maybeTriggerBackgroundFetch);

    return NextResponse.json(
      { data: diversified },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
