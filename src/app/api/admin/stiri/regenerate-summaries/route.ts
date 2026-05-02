import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrGenerateAiSummary } from "@/lib/stiri/ai-summary";
import { extractArticleBody } from "@/lib/stiri/extract-body";
import { AI_SUMMARY_VERSION } from "@/lib/ai/synthesis-version";

export const dynamic = "force-dynamic";
// Vercel Hobby caps Lambda functions at 60s. Sequential AI calls
// average ~3-4s each (network + thinking + write), so 10 articles
// per call is the safe ceiling (~50s total). Users can re-run for
// the next batch.
export const maxDuration = 60;

/**
 * POST /api/admin/stiri/regenerate-summaries?limit=50&force=1
 *
 * Walks the most-recent stiri_cache rows and forces a re-synthesis
 * for each. Used after a synthesis-version bump to pre-warm the
 * cache instead of waiting for organic page views to trickle through.
 *
 * Query params:
 *   limit  — how many rows to touch (default 50, max 200)
 *   force  — when "1", clears ai_summary first so getOrGenerateAiSummary
 *            regenerates even if the row is already at AI_SUMMARY_VERSION.
 *            Default off — only rows below current version regenerate.
 *
 * Sequential by design: parallel calls would hammer Gemini's
 * per-minute rate limit (1500/day = 1 every ~57s avg, but bursts
 * trip the per-minute cap). One-at-a-time + small delay keeps the
 * provider chain happy.
 *
 * Admin role gated. Returns a per-row summary so the caller can see
 * which providers handled which articles.
 */
export async function POST(req: Request) {
  // Auth: either CRON_SECRET via Bearer token (for ops scripts +
  // post-deploy cache warming) OR an admin session cookie (for
  // dashboard-driven runs). Mirrors the pattern in /api/stiri/fetch.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const viaBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!viaBearer) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  // Cap at 10 per call to fit Vercel Hobby's 60s function timeout.
  // For larger batches, call repeatedly with `?offset=N` (TODO if
  // needed) — for now re-running works because newer cache rows
  // skip on cacheValid.
  const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
  const force = url.searchParams.get("force") === "1";

  const admin = createSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("stiri_cache")
    .select("id,url,title,excerpt,content,source,ai_summary,ai_summary_version")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When force=1, blank ai_summary upfront so getOrGenerateAiSummary
  // hits the regenerate path even on rows already at current version.
  if (force) {
    const ids = (rows ?? []).map((r) => (r as { id: string }).id);
    if (ids.length > 0) {
      await admin
        .from("stiri_cache")
        .update({ ai_summary: null, ai_summary_version: 0 })
        .in("id", ids);
    }
  }

  const results: Array<{
    id: string;
    ok: boolean;
    len: number;
    contentLen: number;
    scrapedNow: boolean;
    error?: string;
  }> = [];
  for (const r of (rows ?? []) as Array<{
    id: string;
    url: string;
    title: string;
    excerpt: string | null;
    content: string | null;
    source: string;
    ai_summary: string | null;
    ai_summary_version: number | null;
  }>) {
    let content = r.content;
    let scrapedNow = false;
    try {
      // Backfill: when the row's content is empty/thin (RSS only
      // gave us the excerpt), scrape the original URL for the full
      // article body. The AI synthesis chain needs ≥ 500 chars of
      // input to produce a real 5-section brief; below that, all
      // it can do is rephrase the excerpt.
      if (!content || content.length < 500) {
        const scraped = await extractArticleBody(r.url);
        if (scraped && scraped.length >= 500) {
          content = scraped;
          scrapedNow = true;
          // Persist so subsequent visits don't re-scrape.
          await admin
            .from("stiri_cache")
            .update({ content })
            .eq("id", r.id);
        }
      }

      // Pass a fresh row shape (no ai_summary, no version) so the
      // cache check in getOrGenerateAiSummary always misses and we
      // hit the synthesis path.
      const summary = await getOrGenerateAiSummary({
        id: r.id,
        url: r.url,
        title: r.title,
        excerpt: r.excerpt,
        content,
        source: r.source,
        ai_summary: force ? null : r.ai_summary,
        ai_summary_version: force ? 0 : r.ai_summary_version,
      });
      results.push({
        id: r.id,
        ok: !!summary,
        len: summary?.length ?? 0,
        contentLen: content?.length ?? 0,
        scrapedNow,
      });
    } catch (e) {
      results.push({
        id: r.id,
        ok: false,
        len: 0,
        contentLen: content?.length ?? 0,
        scrapedNow,
        error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      });
    }
    // 1s gap — Gemini's 15 RPM cap rarely trips with our chain
    // (Flash → Lite split between 2 separate per-model counters),
    // and the 60s Vercel timeout is the binding constraint. Tight
    // pacing maximises throughput per call.
    await new Promise((r) => setTimeout(r, 1000));
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  return NextResponse.json({
    data: {
      total: results.length,
      ok,
      failed,
      version: AI_SUMMARY_VERSION,
      results,
    },
  });
}
