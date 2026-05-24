/**
 * Audit comprehensiv pe Civia: extrage statistici Supabase + Redis +
 * detectează pattern-uri (erori comune, sesiuni anormale, performanță).
 * Output JSON pe stdout pentru analiză offline.
 *
 * Run: npx tsx scripts/audit-civia.ts > /tmp/audit.json 2> /tmp/audit.log
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

interface AuditReport {
  supabase: Record<string, unknown>;
  redis: Record<string, unknown>;
  recommendations: string[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key);
  const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? Redis.fromEnv()
      : null;

  const report: AuditReport = {
    supabase: {},
    redis: {},
    recommendations: [],
  };

  // ── SUPABASE: counts pe fiecare tabel principal
  const tables = [
    "sesizari",
    "sesizare_votes",
    "petitii",
    "petitii_signatures",
    "proteste",
    "stiri_cache",
    "profiles",
    "feedback",
    "newsletter_subscribers",
    "platform_updates",
    "intreruperi_scraped",
  ];
  const counts: Record<string, number | string> = {};
  for (const t of tables) {
    try {
      const { count, error } = await supa.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? `ERR: ${error.message}` : (count ?? 0);
    } catch (e) {
      counts[t] = `ERR: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }
  report.supabase.table_counts = counts;

  // Sesizari status distribution
  try {
    const { data } = await supa
      .from("sesizari")
      .select("status, tip, sector, moderation_status");
    const statusDist: Record<string, number> = {};
    const tipDist: Record<string, number> = {};
    const sectorDist: Record<string, number> = {};
    const moderationDist: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{
      status: string;
      tip: string;
      sector: string;
      moderation_status: string;
    }>) {
      statusDist[r.status] = (statusDist[r.status] ?? 0) + 1;
      tipDist[r.tip] = (tipDist[r.tip] ?? 0) + 1;
      sectorDist[r.sector] = (sectorDist[r.sector] ?? 0) + 1;
      moderationDist[r.moderation_status] = (moderationDist[r.moderation_status] ?? 0) + 1;
    }
    report.supabase.sesizari_breakdown = { statusDist, tipDist, sectorDist, moderationDist };
  } catch (e) {
    report.supabase.sesizari_breakdown_err = e instanceof Error ? e.message : "?";
  }

  // Petitii signature counts top
  try {
    const { data } = await supa
      .from("petitii")
      .select("slug, title, signatures_count, target_signatures")
      .order("signatures_count", { ascending: false, nullsFirst: false })
      .limit(10);
    report.supabase.top_petitii = data;
  } catch (e) {
    report.supabase.top_petitii_err = e instanceof Error ? e.message : "?";
  }

  // Stiri cache health: count cu/fără ai_summary, sources distrib, oldest
  try {
    const { data: stiri } = await supa
      .from("stiri_cache")
      .select("source, category, ai_summary, ai_summary_version, published_at")
      .order("published_at", { ascending: false });
    const total = stiri?.length ?? 0;
    const withSummary = stiri?.filter((s) => (s as { ai_summary: string | null }).ai_summary).length ?? 0;
    const sourceDist: Record<string, number> = {};
    const catDist: Record<string, number> = {};
    for (const s of (stiri ?? []) as Array<{ source: string; category: string }>) {
      sourceDist[s.source] = (sourceDist[s.source] ?? 0) + 1;
      catDist[s.category] = (catDist[s.category] ?? 0) + 1;
    }
    report.supabase.stiri_health = {
      total,
      with_ai_summary: withSummary,
      pct_summarized: total ? +((withSummary / total) * 100).toFixed(1) : 0,
      sourceDist,
      catDist,
    };
  } catch (e) {
    report.supabase.stiri_health_err = e instanceof Error ? e.message : "?";
  }

  // Recent errors din feedback (kind=bug)
  try {
    const { data: bugs } = await supa
      .from("feedback")
      .select("message, page_path, created_at")
      .eq("kind", "bug")
      .order("created_at", { ascending: false })
      .limit(20);
    report.supabase.recent_bugs = bugs;
  } catch (e) {
    report.supabase.recent_bugs_err = e instanceof Error ? e.message : "?";
  }

  // Profile distribution (admin vs user)
  try {
    const { data } = await supa.from("profiles").select("role");
    const roles: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ role: string }>) {
      roles[r.role ?? "user"] = (roles[r.role ?? "user"] ?? 0) + 1;
    }
    report.supabase.profile_roles = roles;
  } catch (e) {
    report.supabase.profile_roles_err = e instanceof Error ? e.message : "?";
  }

  // ── REDIS analytics — toate cheile sunt HASH-uri (hincrby), sortăm
  // local după cheltuiala numerică din values.
  if (redis) {
    try {
      const totalHash = (await redis.hgetall("civia:analytics:total")) as Record<string, string | number> | null;
      report.redis.total_pageviews = totalHash;

      report.redis.top_routes = await topHash(redis, "civia:analytics:routes", 20);
      report.redis.top_referrers = await topHash(redis, "civia:analytics:referrers", 10);
      report.redis.top_countries = await topHash(redis, "civia:analytics:countries", 10);
      report.redis.top_cities = await topHash(redis, "civia:analytics:cities", 10);
      report.redis.top_errors = await topHash(redis, "civia:analytics:errors", 20);
      report.redis.top_error_paths = await topHash(redis, "civia:analytics:error-paths", 10);
      report.redis.top_rage_routes = await topHash(redis, "civia:analytics:rage-clicks-per-route", 10);
      report.redis.top_rage_labels = await topHash(redis, "civia:analytics:rage-clicks", 10);
      report.redis.top_events = await topHash(redis, "civia:analytics:events", 15);
      report.redis.top_clicks = await topHash(redis, "civia:analytics:clicks", 20);
      report.redis.search_terms = await topHash(redis, "civia:analytics:search", 10);
      report.redis.search_zero = await topHash(redis, "civia:analytics:search-zero", 10);
      report.redis.outbound = await topHash(redis, "civia:analytics:outbound", 10);
      report.redis.ai_usage = await topHash(redis, "civia:analytics:ai-usage", 10);
      report.redis.auth_events = await topHash(redis, "civia:analytics:auth", 10);
      report.redis.form_abandon = await topHash(redis, "civia:analytics:form-abandon", 10);

      // Web Vitals
      for (const v of ["lcp", "inp", "cls", "fcp", "ttfb"]) {
        try {
          const rating = await redis.hgetall(`civia:analytics:vital:${v}:rating`);
          if (rating && Object.keys(rating).length > 0) {
            report.redis[`vital_${v}`] = rating;
          }
        } catch {
          /* ignore */
        }
      }

      // Top users — civia:analytics:top-users e ZSET (zincrby), spre
      // diferență de routes/referrers care sunt hash-uri.
      const topUsersRaw = (await redis.zrange("civia:analytics:top-users", 0, 14, {
        rev: true,
        withScores: true,
      })) as (string | number)[];
      const topUsersList = formatZ(topUsersRaw, 15);
      report.redis.top_users = topUsersList;

      // Excluded users count
      const excluded = await redis.scard("civia:analytics:excluded-users");
      report.redis.excluded_users_count = excluded;

      // Funnel data
      try {
        const fSesizare = await redis.hgetall("civia:analytics:funnel:sesizare-create");
        if (fSesizare) report.redis.funnel_sesizare_create = fSesizare;
      } catch {
        /* ignore */
      }

      // ── PER-SESSION DEEP DIVE (top users) ──
      // Pentru top 10 useri (după pageviews), tragem timeline-ul + meta
      // ca să identificăm pattern-uri: erori repetate, abandon flows,
      // sesiuni anormal de scurte, etc.
      const sessions: Array<{
        vid: string;
        pageviews: number;
        meta?: Record<string, unknown>;
        topRoutes?: Array<{ key: string; score: number }>;
        countries?: Array<{ key: string; score: number }>;
        days?: number;
      }> = [];
      for (const tu of topUsersList) {
        if (sessions.length >= 10) break;
        const vid = tu.key;
        try {
          const meta = await redis.hgetall(`civia:analytics:user:${vid}:meta`);
          const userRoutes = await topHash(redis, `civia:analytics:user:${vid}:routes`, 5);
          const userCountries = await topHash(redis, `civia:analytics:user:${vid}:countries`, 3);
          const days = await redis.hlen(`civia:analytics:user:${vid}:days`);
          sessions.push({
            vid: vid.slice(0, 18) + "…",
            pageviews: tu.score,
            meta: meta as Record<string, unknown>,
            topRoutes: userRoutes,
            countries: userCountries,
            days: typeof days === "number" ? days : 0,
          });
        } catch (err) {
          // Diagnose dacă o cheie particulară pică
          console.error(`[audit] session deep-dive fail for ${vid}: ${err instanceof Error ? err.message : err}`);
        }
      }
      report.redis.top_session_deep_dive = sessions;
    } catch (e) {
      report.redis.error = e instanceof Error ? e.message : "?";
    }
  } else {
    report.redis.note = "Upstash Redis nu e configurat (lipsește URL/TOKEN)";
  }

  // ── Recommendations heuristice
  const recs: string[] = [];
  const stiriH = report.supabase.stiri_health as { pct_summarized?: number; total?: number } | undefined;
  if (stiriH && stiriH.pct_summarized !== undefined && stiriH.pct_summarized < 80) {
    recs.push(
      `Doar ${stiriH.pct_summarized}% din știri au AI summary cached. ` +
        `Pre-gen pe fetch route ar trebui să acopere top 20, dar restul trebuie back-fill.`,
    );
  }
  const sBreak = report.supabase.sesizari_breakdown as
    | { moderationDist?: Record<string, number> }
    | undefined;
  if (sBreak?.moderationDist?.pending && sBreak.moderationDist.pending > 0) {
    recs.push(`${sBreak.moderationDist.pending} sesizări pending — admin queue.`);
  }
  if (
    report.redis.top_zero_search &&
    Array.isArray(report.redis.top_zero_search) &&
    (report.redis.top_zero_search as unknown[]).length > 0
  ) {
    recs.push("Există căutări cu zero rezultate — verifică top zero searches.");
  }
  if (
    report.redis.top_rage_routes &&
    Array.isArray(report.redis.top_rage_routes) &&
    (report.redis.top_rage_routes as unknown[]).length > 0
  ) {
    recs.push("Rage clicks detectate pe anumite rute — UX friction puncte.");
  }
  report.recommendations = recs;

  console.log(JSON.stringify(report, null, 2));
}

function formatZ(arr: (string | number)[], limit: number): Array<{ key: string; score: number }> {
  const out: Array<{ key: string; score: number }> = [];
  for (let i = 0; i < arr.length && out.length < limit; i += 2) {
    const k = arr[i];
    const s = arr[i + 1];
    if (typeof k === "string" && typeof s === "number") {
      out.push({ key: k, score: s });
    }
  }
  return out;
}

/**
 * Citește un Redis hash, sortează descrescător după value-ul numeric și
 * returnează top N. Cheile analytics Civia sunt toate hincrby (hash field
 * = obiect/etichetă, value = counter integer).
 */
async function topHash(
  redis: Redis,
  key: string,
  limit: number,
): Promise<Array<{ key: string; score: number }>> {
  try {
    const data = (await redis.hgetall(key)) as Record<string, string | number> | null;
    if (!data) return [];
    return Object.entries(data)
      .map(([k, v]) => ({ key: k, score: typeof v === "number" ? v : parseInt(String(v), 10) || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

main().catch((e) => {
  console.error("Crash:", e);
  process.exit(1);
});
