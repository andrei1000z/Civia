import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrGenerateAiSummary } from "@/lib/stiri/ai-summary";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/stiri/[id]/synthesize
 * Returns the AI-synthesized version of a news article.
 *
 * Cache strategy:
 *   1. DB column stiri_cache.ai_summary — persisted, cross-instance
 *   2. In-memory per-instance coalescing for concurrent requests
 *
 * Used as a client-side fallback when the server component could not
 * generate the summary (timeout, cold start, etc.). Most page loads
 * receive the summary pre-rendered and never hit this route.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-synthesize:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { data: stire } = await admin
    .from("stiri_cache")
    .select("id, url, title, excerpt, content, source, ai_summary, ai_summary_version")
    .eq("id", id)
    .maybeSingle();

  if (!stire) {
    return NextResponse.json({ error: "Știrea nu a fost găsită" }, { status: 404 });
  }

  const summary = await getOrGenerateAiSummary(stire);

  return NextResponse.json(
    { data: { summary } },
    {
      headers: {
        // Once cached in DB, subsequent route hits are essentially free lookups.
        // CDN cache for 1h, SWR 10 min on top of that.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    }
  );
}
