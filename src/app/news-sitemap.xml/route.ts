import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

/**
 * Google News Sitemap (https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap)
 *
 * Strict requirements per Google's spec:
 *   - Articles MUST be published within the last 48 hours.
 *   - Maximum 1,000 articles per sitemap.
 *   - Each <url> includes a <news:news> block with <news:publication>
 *     (name + language), <news:publication_date> (W3C / ISO 8601),
 *     and <news:title>.
 *   - Should be regenerated as new articles arrive.
 *
 * Civia regenerates this every 10 minutes (matching the stiri ISR
 * cadence) — Google polls news sitemaps frequently and stale ones
 * cause "no new articles" warnings in Search Console.
 */

// 2026-05-19: 10min → 2h. Google News crawl-uieste cel mult la 30min.
// Cron-ul de stiri ruleaza 1x/zi, deci news noi apar maxim o data/zi.
export const revalidate = 7200;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface StireRow {
  id: string;
  title: string;
  published_at: string;
  image_url: string | null;
}

export async function GET() {
  let rows: StireRow[] = [];
  try {
    const admin = createSupabaseAdmin();
    // 48-hour cutoff per Google News spec. Newer articles only.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("stiri_cache")
      .select("id,title,published_at,image_url")
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(1000);
    rows = (data ?? []) as StireRow[];
  } catch {
    // Fail soft: return empty sitemap rather than 500. Google will
    // re-poll on the next interval and find articles when the DB
    // recovers. A 500 here would have Search Console flag the feed
    // as broken and stop polling.
    rows = [];
  }

  const items = rows
    .map((r) => {
      const pubDate = new Date(r.published_at);
      if (isNaN(pubDate.getTime())) return "";
      // Image tag is optional but recommended — Google uses it for
      // the article thumbnail in News results.
      const imageBlock = r.image_url
        ? `\n    <image:image>\n      <image:loc>${escapeXml(r.image_url)}</image:loc>\n    </image:image>`
        : "";
      return `  <url>
    <loc>${SITE_URL}/stiri/${r.id}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>ro</news:language>
      </news:publication>
      <news:publication_date>${pubDate.toISOString()}</news:publication_date>
      <news:title>${escapeXml(r.title)}</news:title>
    </news:news>${imageBlock}
  </url>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Short CDN cache — Google News expects sitemap freshness;
      // 5 min keeps origin cost low while letting new articles
      // surface within the next poll window.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
