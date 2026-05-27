/**
 * GET /api/admin/perf?url=https://www.civia.ro/...
 *
 * 2026-05-27 — Admin tool: rulează PageSpeed Insights API pe orice URL
 * civia.ro și returnează Core Web Vitals + Lighthouse score.
 *
 * PageSpeed Insights API e FREE — 25,000 queries/zi fără API key, mai
 * mult cu API key (recomandat să setezi PAGESPEED_API_KEY pentru higher
 * quota și reliable).
 *
 * Auth: admin role required.
 */

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CategoryScore = { id: string; title: string; score: number | null };
type AuditMetric = { id: string; numericValue?: number; displayValue?: string; score?: number | null };

interface PSIResult {
  loadingExperience?: {
    metrics?: Record<string, { percentile: number; category: string }>;
    overall_category?: string;
  };
  lighthouseResult?: {
    categories?: Record<string, CategoryScore>;
    audits?: Record<string, AuditMetric>;
  };
  error?: { message: string };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url") ?? "https://www.civia.ro";
  const strategy = url.searchParams.get("strategy") === "desktop" ? "desktop" : "mobile";

  const apiKey = process.env.PAGESPEED_API_KEY;
  const psiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  psiUrl.searchParams.set("url", targetUrl);
  psiUrl.searchParams.set("strategy", strategy);
  psiUrl.searchParams.append("category", "performance");
  psiUrl.searchParams.append("category", "accessibility");
  psiUrl.searchParams.append("category", "seo");
  psiUrl.searchParams.append("category", "best-practices");
  if (apiKey) psiUrl.searchParams.set("key", apiKey);

  try {
    const res = await fetch(psiUrl.toString(), {
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `PSI HTTP ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as PSIResult;
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 502 });
    }

    // Extract relevant fields
    const cats = data.lighthouseResult?.categories ?? {};
    const audits = data.lighthouseResult?.audits ?? {};
    const cwv = data.loadingExperience?.metrics ?? {};

    return NextResponse.json({
      url: targetUrl,
      strategy,
      scores: {
        performance: cats.performance?.score ? Math.round(cats.performance.score * 100) : null,
        accessibility: cats.accessibility?.score ? Math.round(cats.accessibility.score * 100) : null,
        seo: cats.seo?.score ? Math.round(cats.seo.score * 100) : null,
        bestPractices: cats["best-practices"]?.score ? Math.round(cats["best-practices"].score * 100) : null,
      },
      coreWebVitals: {
        // Field data (real users from Chrome UX Report)
        lcp: cwv.LARGEST_CONTENTFUL_PAINT_MS,
        inp: cwv.INTERACTION_TO_NEXT_PAINT,
        cls: cwv.CUMULATIVE_LAYOUT_SHIFT_SCORE,
        overall: data.loadingExperience?.overall_category,
      },
      lab: {
        // Lab data (Lighthouse simulated)
        lcp_ms: audits["largest-contentful-paint"]?.numericValue,
        fcp_ms: audits["first-contentful-paint"]?.numericValue,
        tbt_ms: audits["total-blocking-time"]?.numericValue,
        cls: audits["cumulative-layout-shift"]?.numericValue,
        si_ms: audits["speed-index"]?.numericValue,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
