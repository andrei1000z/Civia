import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { authenticateApiKey, logApiCall } from "@/lib/api/auth";
import { getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public API v2 — agregari statistice pe sesizari (response-rate per judet,
 * top tip-uri, evoluție temporală 12 luni). Pentru jurnalisti + ONG-uri
 * care nu vor sa scoata datele detaliate.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "read:stats");
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const url = new URL(req.url);

  if (!auth.ok) {
    if (auth.keyId) logApiCall(auth.keyId, url.pathname, ip, ua, auth.status);
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: { "WWW-Authenticate": "Bearer realm=civia-api" } },
    );
  }

  const admin = createSupabaseAdmin();

  const [allRes, monthRes] = await Promise.all([
    admin
      .from("sesizari")
      .select("county, tip, status, created_at")
      .eq("moderation_status", "approved")
      .eq("publica", true),
    admin
      .from("sesizari")
      .select("created_at")
      .eq("moderation_status", "approved")
      .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60_000).toISOString()),
  ]);

  const rows = allRes.data ?? [];

  // Per-judet Fix Score
  const byCounty = new Map<string, { total: number; rezolvat: number }>();
  for (const r of rows) {
    if (!r.county) continue;
    let b = byCounty.get(r.county);
    if (!b) { b = { total: 0, rezolvat: 0 }; byCounty.set(r.county, b); }
    b.total += 1;
    if (r.status === "rezolvat") b.rezolvat += 1;
  }
  const fixScorePerCounty = Array.from(byCounty.entries())
    .map(([county, b]) => ({
      county,
      total: b.total,
      resolved: b.rezolvat,
      fix_score: Math.round((b.rezolvat / b.total) * 100),
    }))
    .sort((a, b) => b.fix_score - a.fix_score);

  // Top tip-uri
  const byTip = new Map<string, number>();
  for (const r of rows) {
    if (!r.tip) continue;
    byTip.set(r.tip, (byTip.get(r.tip) ?? 0) + 1);
  }
  const topTipuri = Array.from(byTip.entries())
    .map(([tip, count]) => ({ tip, count }))
    .sort((a, b) => b.count - a.count);

  // Evolutie pe luni (ultimele 12 luni)
  const monthRows = monthRes.data ?? [];
  const monthly = new Map<string, number>();
  for (const r of monthRows) {
    if (!r.created_at) continue;
    const month = r.created_at.slice(0, 7); // YYYY-MM
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }
  const timeline = Array.from(monthly.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

  logApiCall(auth.keyId!, url.pathname, ip, ua, 200);

  return NextResponse.json(
    {
      summary: {
        total: rows.length,
        rezolvate: rows.filter((r) => r.status === "rezolvat").length,
        in_lucru: rows.filter((r) => r.status !== "rezolvat" && r.status !== "respinsa").length,
        national_fix_score: Math.round(
          (rows.filter((r) => r.status === "rezolvat").length / Math.max(rows.length, 1)) * 100,
        ),
      },
      fix_score_per_county: fixScorePerCounty,
      top_tipuri: topTipuri,
      monthly_timeline_12m: timeline,
      meta: {
        tier: auth.tier,
        api_version: "v2",
        docs: `${SITE_URL}/dezvoltatori`,
        generated_at: new Date().toISOString(),
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
