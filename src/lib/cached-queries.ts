/**
 * Cross-page cached DB queries.
 *
 * Goal: eliminate duplicate Supabase round-trips when two pages (or two components
 * on the same page) ask for the same data — e.g. the homepage LiveStatsBar and the
 * /impact dashboard both want `total sesizari count`, Navbar may query AQI, etc.
 *
 * Mechanism: Next.js `unstable_cache` deduplicates based on the arguments and
 * caches the result across requests with a TTL + optional tag for manual
 * invalidation. Much cheaper than force-dynamic DB reads.
 *
 * Usage: import and call just like a normal async function. The cache layer is
 * transparent. Call `revalidateTag("sesizari-stats")` (from a mutation handler)
 * to invalidate.
 */

import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** Aggregated sesizari counts — used on home, /impact, /statistici, Navbar */
export const getSesizariStatsCached = unstable_cache(
  async () => {
    const admin = createSupabaseAdmin();
    const todayIso = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

    const [total, today, inLucru, rezolvate] = await Promise.all([
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .gte("created_at", todayIso),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .eq("status", "in-lucru"),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .eq("status", "rezolvat"),
    ]);

    return {
      total: total.count ?? 0,
      today: today.count ?? 0,
      inLucru: inLucru.count ?? 0,
      rezolvate: rezolvate.count ?? 0,
    };
  },
  ["sesizari-stats"],
  { revalidate: 300, tags: ["sesizari-stats"] }
);

/** Top voted sesizari — home widget + /impact */
export const getTopVotedCached = unstable_cache(
  async (limit = 6) => {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("sesizari_feed")
      .select("code, titlu, locatie, sector, voturi_net, status, tip, nr_comentarii")
      .eq("publica", true)
      .order("voturi_net", { ascending: false })
      .limit(limit);
    return data ?? [];
  },
  ["sesizari-top-voted"],
  { revalidate: 300, tags: ["sesizari-stats"] }
);

/** County-level sesizari counts (sum per county) — used on /impact + county pages */
export const getSesizariByCountyCached = unstable_cache(
  async () => {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("sesizari")
      .select("county, status")
      .eq("moderation_status", "approved")
      .limit(5000);

    const map = new Map<string, { count: number; resolved: number }>();
    for (const r of (data ?? []) as { county: string | null; status: string }[]) {
      if (!r.county) continue;
      const prev = map.get(r.county) ?? { count: 0, resolved: 0 };
      prev.count += 1;
      if (r.status === "rezolvat") prev.resolved += 1;
      map.set(r.county, prev);
    }
    return [...map.entries()]
      .map(([county, v]) => ({ county, ...v }))
      .sort((a, b) => b.count - a.count);
  },
  ["sesizari-by-county"],
  { revalidate: 300, tags: ["sesizari-stats"] }
);

/**
 * Full impact dashboard data — used by both /impact and /[judet]/impact.
 * Combines 9 expensive Supabase queries into a single cacheable unit.
 * Pass `countyId` to filter by county, or leave undefined for national.
 */
export const getImpactDataCached = unstable_cache(
  async (countyId?: string) => {
    const admin = createSupabaseAdmin();
    const todayIso = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

    // Helper: apply optional county filter to a query builder chain
    const withCounty = <T extends { eq: (col: string, val: string) => T }>(q: T): T =>
      countyId ? q.eq("county", countyId.toUpperCase()) : q;

    const [totalRes, rezolvateRes, inLucruRes, todayRes, byTypeRes, byCountyRes, resolvedDates, topRes, latestRes] =
      await Promise.all([
        withCounty(admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved")),
        withCounty(admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "rezolvat")),
        withCounty(admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "in-lucru")),
        withCounty(admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").gte("created_at", todayIso)),
        withCounty(admin.from("sesizari").select("tip").eq("moderation_status", "approved").limit(5000)),
        countyId
          ? Promise.resolve({ data: [] as Array<{ county: string | null; status: string }> })
          : admin.from("sesizari").select("county, status").eq("moderation_status", "approved").limit(5000),
        withCounty(
          admin
            .from("sesizari")
            .select("created_at, resolved_at")
            .eq("moderation_status", "approved")
            .eq("status", "rezolvat")
            .not("resolved_at", "is", null)
            .limit(500)
        ),
        withCounty(
          admin
            .from("sesizari_feed")
            .select("code, titlu, locatie, sector, voturi_net, status, tip, nr_comentarii")
            .eq("publica", true)
            .order("voturi_net", { ascending: false })
            .limit(6)
        ),
        withCounty(
          admin
            .from("sesizari")
            .select("code, titlu, locatie, resolved_at")
            .eq("moderation_status", "approved")
            .eq("status", "rezolvat")
            .not("resolved_at", "is", null)
            .order("resolved_at", { ascending: false })
            .limit(6)
        ),
      ]);

    // Aggregate by tip
    const byTypeMap = new Map<string, number>();
    for (const r of (byTypeRes.data ?? []) as { tip: string }[]) {
      byTypeMap.set(r.tip, (byTypeMap.get(r.tip) ?? 0) + 1);
    }
    const byType = [...byTypeMap.entries()]
      .map(([tip, count]) => ({ tip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Aggregate by county (only when national)
    const countyMap = new Map<string, { count: number; resolved: number }>();
    for (const r of (byCountyRes.data ?? []) as { county: string | null; status: string }[]) {
      if (!r.county) continue;
      const prev = countyMap.get(r.county) ?? { count: 0, resolved: 0 };
      prev.count += 1;
      if (r.status === "rezolvat") prev.resolved += 1;
      countyMap.set(r.county, prev);
    }
    const byCounty = [...countyMap.entries()]
      .map(([county, v]) => ({ county, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Compute average resolution time
    let avgResolutionDays: number | null = null;
    const resolvedArr = (resolvedDates.data ?? []) as { created_at: string; resolved_at: string }[];
    if (resolvedArr.length > 0) {
      const totalMs = resolvedArr.reduce((acc, r) => {
        const c = new Date(r.created_at).getTime();
        const s = new Date(r.resolved_at).getTime();
        if (isNaN(c) || isNaN(s) || s <= c) return acc;
        return acc + (s - c);
      }, 0);
      avgResolutionDays = Math.round((totalMs / resolvedArr.length) / (1000 * 60 * 60 * 24));
    }

    return {
      total: totalRes.count ?? 0,
      rezolvate: rezolvateRes.count ?? 0,
      inLucru: inLucruRes.count ?? 0,
      today: todayRes.count ?? 0,
      byType,
      byCounty,
      avgResolutionDays,
      topVoted: (topRes.data ?? []) as Array<{
        code: string;
        titlu: string;
        locatie: string;
        voturi_net: number;
        status: string;
      }>,
      latestResolved: (latestRes.data ?? []) as Array<{
        code: string;
        titlu: string;
        locatie: string;
        resolved_at: string;
      }>,
    };
  },
  ["impact-data"],
  { revalidate: 300, tags: ["sesizari-stats"] }
);

/** County-level metadata (name, authorities, latest sesizari) — expensive combined query */
export const getCountyOverviewCached = unstable_cache(
  async (countyId: string) => {
    const admin = createSupabaseAdmin();
    const id = countyId.toUpperCase();
    const [county, authorities, sesizari] = await Promise.all([
      admin.from("counties").select("*").eq("id", id).maybeSingle(),
      admin.from("authorities").select("*").eq("county_id", id).order("type"),
      admin
        .from("sesizari")
        .select("code, titlu, status, tip, created_at")
        .eq("county", id)
        .eq("moderation_status", "approved")
        .eq("publica", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return {
      county: county.data,
      authorities: authorities.data ?? [],
      sesizari: sesizari.data ?? [],
    };
  },
  ["county-overview"],
  { revalidate: 300, tags: ["county-overview", "sesizari-stats"] }
);

/**
 * Call from mutation handlers (create sesizare, vote, moderate, etc.) to bust
 * the cache immediately for everyone. Without this, cached data stays stale
 * until the TTL expires.
 */
export function invalidateSesizariCache() {
  // `profile: "max"` enables stale-while-revalidate semantics — visitors keep
  // seeing the previous (fast) value while the next pageview refreshes it.
  // Wrapped in try-catch because revalidateTag can throw at build time or
  // in unusual runtime contexts; a cache miss is acceptable, a crashing
  // mutation route is not.
  try {
    revalidateTag("sesizari-stats", "max");
  } catch (err) {
    // Intentionally non-fatal: stats stale until TTL (5 min). Logam la
    // Sentry pe nivel `error` pentru ca daca aceasta cale esueaza
    // repetat e un semn de regression (revalidateTag API broken sau Next
    // version mismatch), nu un dev-only warn de ignorat.
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(err, {
        level: "error",
        tags: { kind: "cache_invalidation", target: "sesizari-stats" },
      });
    }).catch(() => { /* sentry missing — accept silent */ });
  }
}
