import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { fetchAllFeedsWithDiag } from "@/lib/stiri/rss";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";
import { pingIndexNowDeleted } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, viaCron: true };

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

    // Insert new articles (include counties array)
    const rows = articles.map((a) => ({
      url: a.url,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      source: a.source,
      category: a.category,
      author: a.author,
      image_url: a.image_url,
      published_at: a.published_at,
      counties: a.counties ?? [],
    }));
    const { error, count } = await supabase
      .from("stiri_cache")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });

    if (error) throw error;

    return NextResponse.json({
      data: {
        total: articles.length,
        inserted: count ?? 0,
        deleted: deleted ?? 0,
        sources: [...new Set(articles.map((a) => a.source))],
        perFeed,
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "stiri_fetch" } });
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
