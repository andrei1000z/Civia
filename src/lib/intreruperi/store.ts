/**
 * Server-side reader for the `intreruperi_scraped` Supabase table.
 *
 * Replaces the static JSON merge that used to live inside `src/data/intreruperi.ts`.
 * The page calls `loadInterruptions()` once per request — the result is
 * the static seed (curated rows for cities without scrapers) merged with
 * fresh scraper output (PMB + Apa Nova best-effort), preferring scraped
 * rows when they share an externalId with a seeded one.
 *
 * If Supabase is unreachable / table is empty (e.g. fresh deploy before
 * the first cron tick), we degrade to the static seed alone — the page
 * still renders, the user sees curated outages, and a warning logs to
 * Sentry but isn't surfaced.
 */

import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  INTRERUPERI,
  type Interruption,
  type InterruptionType,
  type InterruptionStatus,
} from "@/data/intreruperi";

interface ScrapedRow {
  id: string;
  external_id: string | null;
  type: string;
  status: string;
  provider: string;
  source_url: string | null;
  source_entry_url: string | null;
  source_entry_title: string | null;
  reason: string;
  addresses: string[];
  lat: number | null;
  lng: number | null;
  county: string;
  locality: string | null;
  sector: string | null;
  start_at: string;
  end_at: string;
  affected_population: number | null;
  excerpt: string | null;
  updated_at: string;
  last_seen_at: string;
}

function rowToInterruption(r: ScrapedRow): Interruption {
  return {
    id: r.id,
    externalId: r.external_id ?? undefined,
    type: r.type as InterruptionType,
    status: r.status as InterruptionStatus,
    provider: r.provider,
    sourceUrl: r.source_url ?? undefined,
    sourceEntryUrl: r.source_entry_url ?? undefined,
    sourceEntryTitle: r.source_entry_title ?? undefined,
    reason: r.reason,
    addresses: r.addresses,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    county: r.county,
    locality: r.locality ?? undefined,
    sector: r.sector ?? undefined,
    startAt: r.start_at,
    endAt: r.end_at,
    affectedPopulation: r.affected_population ?? undefined,
    excerpt: r.excerpt ?? undefined,
  };
}

/**
 * Returns the merged catalog (seed + scraped). Drops scraped rows whose
 * `end_at` is more than 7 days in the past — keeps the read query small
 * and the page free of long-finished outages.
 */
export async function loadInterruptions(): Promise<{
  items: Interruption[];
  scrapedCount: number;
  lastSeenAt: string | null;
  source: "supabase+seed" | "seed-only";
}> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let scraped: Interruption[] = [];
  let lastSeenAt: string | null = null;
  let source: "supabase+seed" | "seed-only" = "seed-only";

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("intreruperi_scraped")
      .select(
        "id,external_id,type,status,provider,source_url,source_entry_url,source_entry_title,reason,addresses,lat,lng,county,locality,sector,start_at,end_at,affected_population,excerpt,updated_at,last_seen_at",
      )
      .gte("end_at", cutoff)
      .order("start_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    if (data && data.length > 0) {
      scraped = (data as ScrapedRow[]).map(rowToInterruption);
      lastSeenAt = (data as ScrapedRow[]).reduce<string | null>(
        (acc, r) => (acc == null || r.last_seen_at > acc ? r.last_seen_at : acc),
        null,
      );
      source = "supabase+seed";
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "intreruperi_load" } });
    // fall through with empty `scraped` — seed alone is the fallback.
  }

  // Scraped wins on externalId collision: real source data is fresher
  // than the curated seed for the same outage.
  const externalIds = new Set(
    scraped.map((s) => s.externalId).filter((x): x is string => Boolean(x)),
  );
  const seedKept = INTRERUPERI.filter(
    (s) => !s.externalId || !externalIds.has(s.externalId),
  );

  return {
    items: [...scraped, ...seedKept],
    scrapedCount: scraped.length,
    lastSeenAt,
    source,
  };
}

// ─── Public getters ────────────────────────────────────────────────────

export async function getAllInterruptions(): Promise<Interruption[]> {
  const { items } = await loadInterruptions();
  return items;
}

export async function getInterruptionsForCounty(
  countyCode: string,
): Promise<Interruption[]> {
  const { items } = await loadInterruptions();
  return items.filter(
    (i) => i.county.toUpperCase() === countyCode.toUpperCase(),
  );
}

export async function getInterruptionById(
  id: string,
): Promise<Interruption | null> {
  const { items } = await loadInterruptions();
  return items.find((i) => i.id === id) ?? null;
}

/** Active = not finalized/cancelled and end_at still in the future,
 *  ordered with in-progress rows first then scheduled by start time. */
export async function getActiveInterruptions(): Promise<Interruption[]> {
  const { items } = await loadInterruptions();
  const now = Date.now();
  return items
    .filter((i) => {
      if (i.status === "anulat") return false;
      if (i.status === "finalizat") return false;
      return new Date(i.endAt).getTime() > now;
    })
    .sort((a, b) => {
      if (a.status === "in-desfasurare" && b.status !== "in-desfasurare") return -1;
      if (a.status !== "in-desfasurare" && b.status === "in-desfasurare") return 1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
}

const FETCH_LOCK_KEY = "civia:intreruperi:refresh-lock";
// 12h lock (5/8/2026): reducem invocations pe Vercel (lock-ul de 6h
// declanșa până la 4 refresh-uri/zi pe trafic). Plus cron zilnic =
// fereastra max-staleness 12h pentru date scraped.
const FETCH_LOCK_TTL_S = 12 * 60 * 60; // 12h

/**
 * Self-healing background refresh. Invoked from `after()` on the
 * /api/intreruperi GET handler so that browser visits to the page nudge
 * the scraper at most once every 6 hours, regardless of how many tabs
 * are open. Vercel Hobby's daily cron is the floor; this is the ceiling
 * that prevents > 6h-old data even if cron fires at the wrong wall-clock
 * minute.
 */
export async function maybeTriggerBackgroundRefresh(): Promise<void> {
  const { analyticsRedis } = await import("@/lib/analytics/redis");
  if (!analyticsRedis) return;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;
  // 2026-05-27 — defensive try/catch pe Redis lock. Upstash outage NU
  // trebuie să propage unhandled rejection în after().
  let lock: unknown;
  try {
    lock = await analyticsRedis.set(FETCH_LOCK_KEY, Date.now(), {
      nx: true,
      ex: FETCH_LOCK_TTL_S,
    });
  } catch {
    return;
  }
  if (lock !== "OK") return;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";
    await fetch(`${baseUrl}/api/intreruperi/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    // Background failure — next read will try again after lock TTL.
  }
}
