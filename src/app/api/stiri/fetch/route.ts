import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import * as Sentry from "@sentry/nextjs";
import { fetchAllFeedsWithDiag } from "@/lib/stiri/rss";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";
import { analyticsRedis } from "@/lib/analytics/redis";
import { pingIndexNowDeleted } from "@/lib/seo/indexnow";
import { pickTopCivic } from "@/lib/stiri/civic-relevance";
import { getOrGenerateAiSummary } from "@/lib/stiri/ai-summary";
import { AI_SUMMARY_VERSION } from "@/lib/ai/synthesis-version";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — pre-gen 20× AI summaries

/** Câte articole păstrăm per refresh — top civic-relevance score.
 *  2026-05-25: 20 → 40. User-ul vrea mai multe știri pe pagină;
 *  cele cu scor sub top-20 sunt încă civic-relevante, dar mai
 *  „long-tail" (e.g. știri locale puternice, niche civic). */
const TOP_CIVIC_PER_RUN = 40;
/** Concurrency pre-gen AI summaries — evităm să blow rate-limit-urile
 *  Gemini/Groq trimițând toate paralel. 4 = sweet spot la 40 articole. */
const PREGEN_CONCURRENCY = 4;
/** Pre-genăm AI summary doar pentru top 20 (cele mai relevante civic) —
 *  restul vor genera AI la prima deschidere. Optimizează Groq cost
 *  (jumătate din articole nu sunt deschise niciodată). */
const PREGEN_MAX = 20;

/**
 * Authorize the RSS refresh trigger.
 * Accepts either:
 *   1. Authorization: Bearer <CRON_SECRET> (for Vercel Cron / GitHub Actions)
 *   2. Logged-in admin user (role='admin' on profile)
 */
async function authorize(
  req: Request,
): Promise<{ ok: boolean; reason?: string; userId?: string; viaCron?: boolean }> {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (verifyBearer(auth, cronSecret)) return { ok: true, viaCron: true };

  // fallback: allow if logged-in user has role='admin'
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

export async function POST(req: Request) {
  const authResult = await authorize(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: `Forbidden: ${authResult.reason}` },
      { status: 403 }
    );
  }

  // Rate-limit admin-triggered refreshes only — cron jobs are trusted.
  // Refresh is a 60s op (parallel RSS fetches + DB upsert); 5/min per admin
  // is more than enough and stops accidental button-mashing.
  if (!authResult.viaCron && authResult.userId) {
    const rl = await rateLimitAsync(`stiri-fetch:${authResult.userId}`, {
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

  // 2026-05-27 — Distributed lock anti-concurrent-runs (audit recommended).
  // Vercel cron retry sau click manual concomitent cu cron-ul programat poate
  // duplicate articole + irosi Groq tokens. Folosim Upstash Redis SET NX EX 120
  // — primul caller obține lock-ul, ceilalți primesc 409 cu skip silent.
  const LOCK_KEY = "stiri:fetch:lock";
  let lockAcquired = false;
  if (analyticsRedis) {
    try {
      const ok = await analyticsRedis.set(LOCK_KEY, Date.now().toString(), {
        ex: 120,
        nx: true,
      });
      // Upstash returns "OK" string când lock-ul a fost achiziționat, null altfel.
      lockAcquired = ok !== null;
      if (!lockAcquired) {
        return NextResponse.json(
          { ok: true, note: "skip_concurrent_run", lock: "held" },
          { status: 200 },
        );
      }
    } catch {
      // Redis blocat — continue fără lock (preferable la blocked).
    }
  }

  try {
    const { articles, perFeed } = await fetchAllFeedsWithDiag();

    // Diagnostic: dacă TOATE feed-urile sunt 0 sau eșuate, raportează la Sentry —
    // probabil RSS endpoints au murit/migrat. Apare în Sentry ca event distinct
    // de eroare, dar urmărit pentru intervenție rapidă.
    if (articles.length === 0) {
      Sentry.captureMessage("stiri_cache: 0 articles after fetchAll", {
        level: "warning",
        extra: { perFeed },
      });
      return NextResponse.json({
        data: { inserted: 0, total: 0, perFeed },
        warning: "All RSS feeds returned 0 articles — check feed URLs",
      });
    }

    // Per-feed warning: dacă majoritatea feed-urilor pică sau returnează 0,
    // probabil tu ai o problemă (network/blocked) sau ei (deprecated feeds).
    const dead = perFeed.filter((p) => !p.ok || p.count === 0);
    if (dead.length >= perFeed.length / 2) {
      Sentry.captureMessage("stiri_cache: more than half feeds returned 0 or failed", {
        level: "warning",
        extra: { perFeed },
      });
    }

    const supabase = createSupabaseAdmin();

    // Delete articles older than 3 days. Înainte era 24h, dar:
    // (a) useri reveneau a doua zi după ce semnaseră o petiție / postaseră
    //     pe Reddit și nu mai găseau articolul referit
    // (b) Google indexează lent — articole live <24h erau deindexate
    //     înainte să apuce să fie crawl-uite ca lume
    // 3 zile = sweet spot între freshness și retenție utilă.
    //
    // Captăm URL-urile șterse înainte de delete pentru a notifica IndexNow
    // (Bing/Yandex/Seznam) — acestea suportă deindex instant via protocol.
    // Google NU suportă IndexNow; pe el se bazează pe X-Robots-Tag noindex
    // + sitemap-ul care exclude automat articolele șterse + 410 Gone.
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: aboutToDelete } = await supabase
      .from("stiri_cache")
      .select("id")
      .lt("published_at", cutoff);
    const deletedIds = (aboutToDelete ?? []).map((r) => (r as { id: string }).id);

    const { count: deleted } = await supabase
      .from("stiri_cache")
      .delete({ count: "exact" })
      .lt("published_at", cutoff);

    // Ping IndexNow (Bing + Yandex + Seznam) pentru deindex instant.
    // Best-effort — nu blocăm cleanup-ul dacă pică.
    if (deletedIds.length > 0) {
      pingIndexNowDeleted(deletedIds).catch((e) => {
        console.warn("[stiri-fetch] IndexNow ping failed:", e);
      });
    }

    // 2026-05-27 — Near-duplicate dedup ÎNAINTE de pickTopCivic, ca să nu
    // pierdem slot-uri în top 20 pe twins. Same RSS run poate avea 2-3
    // articole cu aceeași poză din aceeași sursă (burst editorial pe
    // același subiect). Păstrăm cel mai recent. Cross-source rămâne.
    const { dedupeArticles } = await import("@/lib/stiri/dedup");
    const articlesPreDedup = articles.length;
    const dedupedArticles = dedupeArticles(
      articles.map((a) => ({
        title: a.title,
        source: a.source,
        image_url: a.image_url,
        published_at: a.published_at,
        __orig: a,
      })),
    ).map((a) => a.__orig);
    const dedupedCount = articlesPreDedup - dedupedArticles.length;

    // FILTRARE CIVIC-RELEVANCE — păstrăm doar top 20 din toate articolele
    // RSS aduse. Civia e platformă civică; nu vrem rețete + horoscop +
    // showbiz care apar în feed-urile mainstream. Heuristic determinist
    // bazat pe keyword + sursă + categorie.
    const { kept, discarded } = pickTopCivic(dedupedArticles, TOP_CIVIC_PER_RUN);

    // 2026-05-25 — AI smart category classifier înlocuiește keyword fallback
    // pentru articolele clasificate "administratie" implicit (cazul cel mai
    // frecvent de mis-categorizare). Concurrency 5, best-effort: dacă AI
    // fail → folosim categoria originală din RSS keyword classifier.
    const { classifyCategoryWithAI } = await import("@/lib/stiri/ai-category");
    const aiCategoryPromises = kept.map(async (a) => {
      if (a.category !== "administratie") return a.category; // skip dacă keyword classifier sigur
      try {
        return await classifyCategoryWithAI(a.title, a.excerpt ?? "", a.source);
      } catch {
        return a.category;
      }
    });
    const aiCategoryResults = await Promise.all(aiCategoryPromises);

    // Insert new articles (top civic only). Include counties array.
    // Onconflict=url + ignoreDuplicates → re-runs nu strică nimic, dacă
    // articolul deja există (din run-ul precedent) îl skipuim.
    const rows = kept.map((a, i) => ({
      url: a.url,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      source: a.source,
      category: aiCategoryResults[i] ?? a.category,
      author: a.author,
      image_url: a.image_url,
      published_at: a.published_at,
      counties: a.counties ?? [],
    }));
    const { error, count } = await supabase
      .from("stiri_cache")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });

    if (error) throw error;

    // PRE-GENERATE AI SUMMARIES pentru cele 20 articole selectate, ca
    // user-ul să vadă sinteza instant când deschide articolul (înainte
    // pagina /stiri/[id] aștepta inline 30-120 sec până se genera AI).
    // Concurrency 3 ca să nu blow rate-limit-urile Gemini/Groq.
    //
    // Re-fetch DUPĂ insert — avem nevoie de id-uri DB ca să persistăm
    // ai_summary cu aceleași records pe care tocmai le-am salvat.
    const { data: insertedRows } = await supabase
      .from("stiri_cache")
      .select("id, url, title, excerpt, content, source, ai_summary, ai_summary_version")
      .in("url", kept.map((a) => a.url));

    const toGenerate = (insertedRows ?? []).filter((r) => {
      const row = r as { ai_summary: string | null; ai_summary_version: number | null };
      // Skip cele care deja au summary la versiunea curentă.
      return !(
        row.ai_summary &&
        row.ai_summary.length > 20 &&
        (row.ai_summary_version ?? 0) >= AI_SUMMARY_VERSION
      );
    })
      // 2026-05-25 — pre-genăm doar primele PREGEN_MAX (top score).
      // Restul (long-tail civic) generează AI la prima deschidere.
      .slice(0, PREGEN_MAX);

    let preGenerated = 0;
    let preGenFailed = 0;
    if (toGenerate.length > 0) {
      // Worker-pool simplu cu concurrency limit. `getOrGenerateAiSummary`
      // persistă singur în DB după generare.
      const queue = [...toGenerate];
      const worker = async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          try {
            const result = await getOrGenerateAiSummary(
              next as Parameters<typeof getOrGenerateAiSummary>[0],
            );
            if (result) preGenerated++;
            else preGenFailed++;
          } catch {
            preGenFailed++;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PREGEN_CONCURRENCY, toGenerate.length) }, worker),
      );
    }

    return NextResponse.json({
      data: {
        total: articles.length,
        deduplicated: dedupedCount,
        kept: kept.length,
        discarded,
        inserted: count ?? 0,
        deleted: deleted ?? 0,
        pre_generated: preGenerated,
        pre_gen_failed: preGenFailed,
        sources: [...new Set(kept.map((a) => a.source))],
        perFeed,
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "stiri_fetch" } });
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
