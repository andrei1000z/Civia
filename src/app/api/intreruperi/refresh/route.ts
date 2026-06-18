import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import * as Sentry from "@sentry/nextjs";
import { createHash } from "crypto";
import { scrapeAllSources } from "@/lib/intreruperi/scrapers";
import { warmBuildingsForOutages } from "@/lib/intreruperi/buildings";
import { loadInterruptions } from "@/lib/intreruperi/store";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";
import { dispatchAlertsForIntreruperi } from "@/lib/intreruperi/alerts-matcher";

export const dynamic = "force-dynamic";
// 300s budget — scrape ~10s + serialized Overpass warm of ~50 outages
// at 600ms each ≈ 30s. Headroom for slow Overpass responses.
export const maxDuration = 300;

/**
 * POST /api/intreruperi/refresh
 *
 * Re-runs the utility-outage scrapers and upserts results into the
 * `intreruperi_scraped` Supabase table. Authentication: either a
 * `Bearer ${CRON_SECRET}` header (Vercel cron path) or an admin user
 * session. Hobby plan only allows one daily cron, so the page itself
 * also fires this in the background once every 6 hours via a Redis NX
 * lock.
 */
async function authorize(
  req: Request,
): Promise<{ ok: boolean; reason?: string; userId?: string; viaCron?: boolean }> {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (verifyBearer(auth, cronSecret)) return { ok: true, viaCron: true };

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "auth required" };
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role === "admin") {
      return { ok: true, userId: user.id };
    }
    return { ok: false, reason: "admin required" };
  } catch {
    return { ok: false, reason: "auth check failed" };
  }
}

/**
 * Stable hash of the upstream content fields. Used so that re-running
 * the scraper on unchanged source data doesn't bump `updated_at` for
 * every row — only when something actually changed. Helps the admin
 * queue see "scraper saw nothing new" vs "scraper updated 12 rows".
 */
function hashContent(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha1").update(stable).digest("hex");
}

export async function POST(req: Request) {
  const authResult = await authorize(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: `Forbidden: ${authResult.reason}` },
      { status: 403 },
    );
  }

  // Cap admin-triggered runs — full scrape is ~10s and cron has it
  // covered. 5/min keeps the button-mash floor without blocking quick
  // back-to-back fixes during scraper development.
  if (!authResult.viaCron && authResult.userId) {
    const rl = await rateLimitAsync(`intreruperi-refresh:${authResult.userId}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Prea multe refresh-uri. Încearcă peste un minut." },
        { status: 429 },
      );
    }
  }

  try {
    const result = await scrapeAllSources();

    if (result.items.length === 0) {
      // All sources returning 0 is unusual but plausible (Cloudflare
      // tightening, all upstreams going dark at once). Flag it in
      // Sentry so we notice before the catalog goes stale for a week.
      Sentry.captureMessage("intreruperi_refresh: 0 items scraped", {
        level: "warning",
        extra: { bySource: result.bySource, errors: result.errors },
      });
      return NextResponse.json({
        data: { upserted: 0, total: 0, ...result },
        warning: "All scrapers returned 0 items",
      });
    }

    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();

    const rows = result.items.map((it) => {
      const contentHash = hashContent({
        title: it.sourceEntryTitle ?? "",
        reason: it.reason,
        addresses: it.addresses,
        startAt: it.startAt,
        endAt: it.endAt,
        sourceEntryUrl: it.sourceEntryUrl ?? "",
      });
      return {
        id: it.id,
        external_id: it.externalId ?? null,
        type: it.type,
        status: it.status,
        provider: it.provider,
        source_url: it.sourceUrl ?? null,
        source_entry_url: it.sourceEntryUrl ?? null,
        source_entry_title: it.sourceEntryTitle ?? null,
        reason: it.reason,
        addresses: it.addresses,
        lat: it.lat ?? null,
        lng: it.lng ?? null,
        county: it.county,
        locality: it.locality ?? null,
        sector: it.sector ?? null,
        start_at: it.startAt,
        end_at: it.endAt,
        affected_population: it.affectedPopulation ?? null,
        excerpt: it.excerpt ?? null,
        content_hash: contentHash,
        updated_at: now,
        last_seen_at: now,
      };
    });

    const { error, count } = await supabase
      .from("intreruperi_scraped")
      .upsert(rows, { onConflict: "id", count: "exact" });

    if (error) throw error;

    // 2026-05-25 — Dispatch alerts pentru abonați.
    // Match intreruperi NOI (sau active) cu adresele monitorizate ale
    // subscriber-ilor. Anti-spam via notified_interruption_ids[]. Best-effort:
    // erori NU blochează response-ul (Sentry capture intern).
    let alertsStats: { sent: number; matched: number; skipped: number } | null = null;
    try {
      // Filtrare: doar intreruperi cu start_at viitor sau status "programat".
      // Skip-uim cele expirate / istorice (ar trimite spam pe re-scrape).
      const now = Date.now();
      const activeForAlerts = result.items
        .filter((it) => new Date(it.endAt).getTime() > now)
        .filter((it) => it.status !== "anulat" && it.status !== "finalizat")
        .map((it) => ({
          id: it.id,
          type: it.type,
          county: it.county,
          sector: it.sector ?? null,
          addresses: it.addresses,
          reason: it.reason,
          start_at: it.startAt,
          end_at: it.endAt,
          source_entry_url: it.sourceEntryUrl ?? null,
          provider: it.provider,
        }));
      alertsStats = await dispatchAlertsForIntreruperi(activeForAlerts);
    } catch (e) {
      Sentry.captureException(e, { tags: { kind: "intreruperi_alerts_dispatch" } });
    }

    // Pre-warm the OSM building polygon cache for every active outage
    // with coordinates. Serialized 600ms-apart inside warmBuildings so
    // we stay under Overpass's per-IP rate limit. Runs in-band on
    // cron path (we have 60s budget, plenty); on admin-triggered
    // refreshes we skip warming so the dashboard returns fast and
    // the next visit triggers it via the GET path.
    let warmStats: { warmed: number; skipped: number; total: number } | null = null;
    if (authResult.viaCron) {
      try {
        const { items } = await loadInterruptions();
        const targets = items
          .filter((i) => i.lat != null && i.lng != null)
          .filter((i) => i.status !== "anulat" && i.status !== "finalizat")
          .map((i) => {
            const pop = i.affectedPopulation ?? i.addresses.length * 200;
            const radiusM = Math.max(
              200,
              Math.min(2500, Math.round(150 * Math.sqrt(pop / 1000))),
            );
            return { id: i.id, lat: i.lat!, lng: i.lng!, radiusM };
          })
          // Cap to 50 — covers Bucharest + 1-2 cities at full coverage.
          // Past 50 we'd risk timing out the 60s function, and stale
          // outages can wait for the next cron tick.
          .slice(0, 50);
        warmStats = await warmBuildingsForOutages(targets);
      } catch (e) {
        Sentry.captureException(e, { tags: { kind: "intreruperi_warm_buildings" } });
      }
    }

    return NextResponse.json({
      data: {
        total: result.items.length,
        upserted: count ?? rows.length,
        bySource: result.bySource,
        errors: result.errors,
        buildingsWarmed: warmStats,
        alertsDispatched: alertsStats,
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "intreruperi_refresh" } });
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
