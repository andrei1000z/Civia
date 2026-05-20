import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateFollowups } from "@/lib/groq/followups";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/sesizari/[code]/followups
 *
 * Returns 3 AI-generated follow-up actions for a sesizare. Public read —
 * any visitor can see the suggestions because they are not user-specific
 * (they depend only on tip + titlu + county, all public fields).
 *
 * Aggressive caching: results are stable per (tip, county) pair, so we
 * Cache-Control public s-maxage=3600 to avoid Groq calls on hot reload.
 * Rate limit: 20/min/IP — guards against scraping the AI through this
 * surface.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    return NextResponse.json({ error: "Cod invalid" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`followups:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("sesizari")
    .select("tip, titlu, county")
    .eq("code", code)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Sesizare inexistenta sau nepublica" }, { status: 404 });
  }

  const result = await generateFollowups({
    tip: row.tip,
    titlu: row.titlu,
    county: row.county,
  });

  return NextResponse.json(
    { data: result },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
