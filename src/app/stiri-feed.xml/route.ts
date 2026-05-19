import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";

/**
 * Civia News RSS feed (`/stiri-feed.xml`).
 *
 * Distinct from `/feed.xml` (which surfaces sesizări for civic-tech
 * readers). This feed is dedicated to news articles and is the one
 * Google Publisher Center / news aggregators consume.
 *
 * Compliant with:
 *   - RSS 2.0 spec
 *   - Atom self-link (atom:link rel="self")
 *   - Dublin Core author (dc:creator)
 *   - Yahoo Media RSS for image enclosure (media:content + media:thumbnail)
 *   - Standard <enclosure> for podcast-friendly readers
 *
 * The image is included in THREE places (enclosure + media:content +
 * media:thumbnail) to maximise reader compatibility — Feedly,
 * Inoreader, NetNewsWire all parse different ones.
 */

// 2026-05-19: 10min → 2h. Reader-ele RSS poll-uiesc cel mult la 30min,
// stiri noi apar 1x/zi via cron.
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
  excerpt: string | null;
  content: string | null;
  source: string;
  category: string;
  author: string | null;
  image_url: string | null;
  published_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transport",
  urbanism: "Urbanism",
  mediu: "Mediu",
  siguranta: "Siguranță",
  administratie: "Administrație",
  eveniment: "Evenimente",
};

// Best-effort image MIME from extension. Feed readers use this for
// the enclosure type attribute. Defaults to image/jpeg when unknown.
function imageMime(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".avif")) return "image/avif";
  return "image/jpeg";
}

export async function GET() {
  let rows: StireRow[] = [];
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("stiri_cache")
      .select("id,title,excerpt,content,source,category,author,image_url,published_at")
      .order("published_at", { ascending: false })
      .limit(50);
    rows = (data ?? []) as StireRow[];
  } catch {
    rows = [];
  }

  const now = new Date().toUTCString();

  const items = rows
    .map((r) => {
      const pubDate = new Date(r.published_at);
      if (isNaN(pubDate.getTime())) return "";
      const link = `${SITE_URL}/stiri/${r.id}`;
      // Description: prefer excerpt, fall back to first 500 chars of
      // content. Wrap in CDATA so we can keep punctuation/quotes
      // without double-escaping. Trimmed to 1000 chars to keep feed
      // compact; full article lives at the link.
      const summary = (r.excerpt ?? r.content ?? "").slice(0, 1000);
      const sectionLabel = CATEGORY_LABELS[r.category] ?? r.category;

      const imageBlock = r.image_url
        ? `\n      <enclosure url="${escapeXml(r.image_url)}" type="${imageMime(r.image_url)}" length="0" />` +
          `\n      <media:content url="${escapeXml(r.image_url)}" medium="image" />` +
          `\n      <media:thumbnail url="${escapeXml(r.image_url)}" />`
        : "";

      const authorBlock = r.author
        ? `\n      <dc:creator><![CDATA[${r.author}]]></dc:creator>`
        : `\n      <dc:creator><![CDATA[${SITE_NAME}]]></dc:creator>`;

      return `    <item>
      <title><![CDATA[${r.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate.toUTCString()}</pubDate>
      <category>${escapeXml(sectionLabel)}</category>
      <source url="${SITE_URL}">${escapeXml(r.source)}</source>${authorBlock}
      <description><![CDATA[${summary}]]></description>${imageBlock}
    </item>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Știri civice agregate</title>
    <link>${SITE_URL}/stiri</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ro-RO</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(SITE_NAME)}</copyright>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>10</ttl>
    <atom:link href="${SITE_URL}/stiri-feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
