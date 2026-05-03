/**
 * Lightweight HTML body extractor for news articles.
 *
 * RSS feeds we ingest from emit only the article excerpt (~300 chars
 * in the <description> tag) — never the full body. That's enough for
 * a card preview but starves the AI synthesis: with only 300 chars of
 * input the model can't produce a structured 5-section brief, it just
 * rephrases the excerpt and stops.
 *
 * This module fetches the original article URL and extracts the body
 * text via deterministic regex/string operations (no DOM lib, no
 * external dependencies). It's tuned to the structure of the major
 * Romanian news sites we aggregate (Digi24, Hotnews, G4Media, PressOne,
 * Recorder, Adevărul, Gândul, Mediafax, etc.) — all of which use one
 * of a small set of conventional content containers (<article>, <main>,
 * .article-body, .entry-content, etc.).
 *
 * Failure mode is benign: returns null. Caller falls back to whatever
 * text it already has (excerpt). Worst case the AI synthesis stays as
 * thin as before — never gets worse.
 */

const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_CHARS = 6000;

// User agent that identifies us as a real client (some news sites
// 403 on bare User-Agents). Mimics a recent Chrome on Windows.
const UA =
  "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch the article body text from a source URL. Returns null on any
 * failure (network timeout, 4xx/5xx, parse failure, suspiciously
 * short result).
 */
export async function extractArticleBody(url: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        // Romanian sites often serve a cookie wall on the first
        // request; we accept whatever they send and don't store.
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
      },
      signal: ctrl.signal,
      // Don't cache aggressively — we may need different bodies on
      // republish, and the upstream sets its own cache headers.
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    html = await res.text();
  } catch {
    return null;
  }

  if (!html || html.length < 500) return null;
  return extractBodyFromHtml(html);
}

/**
 * Body-from-HTML extraction split out so callers that have already
 * fetched the HTML (e.g. aftermath/scrape, which also wants <meta>
 * tags from the same page) can avoid a duplicate network round-trip.
 *
 * Returns null if the page doesn't contain enough usable text to
 * synthesize from (paywall, error page, single-line listing, etc.).
 */
export function extractBodyFromHtml(html: string): string | null {
  if (!html || html.length < 500) return null;

  // 1. Strip stuff that always pollutes content: <script>, <style>,
  //    <noscript>, <iframe>, comments, nav, header, footer, aside,
  //    forms. Done up-front so the container search later doesn't
  //    accidentally pick up a sidebar widget.
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|iframe|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // 2. Find the most likely content container. Order matters — the
  //    first match wins, so put more-specific selectors before more-
  //    generic ones. Most Romanian news CMSes use one of these.
  const containerPatterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]*\bclass="[^"]*\b(?:article-body|article-content|article__body|article__content|story-body|story-content|entry-content|post-content|post-body|content-body|main-content)\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div\b[^>]*\bid="(?:article-body|article-content|story-body|main-content|post-content)"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let container: string | null = null;
  for (const re of containerPatterns) {
    const m = cleaned.match(re);
    if (m && m[1] && m[1].length > 200) {
      container = m[1];
      break;
    }
  }
  // Fallback: use whole <body> if no specific container matched.
  if (!container) {
    const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    container = bodyMatch?.[1] ?? null;
  }
  if (!container) return null;

  // 3. Extract text from the container. Strategy:
  //    - Replace block-level closing tags with double newlines so
  //      paragraph structure survives.
  //    - Replace <br> with single newline.
  //    - Strip remaining HTML tags.
  //    - Decode common HTML entities.
  //    - Collapse whitespace.
  const text = container
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    // Common entities. Full decode would need an HTML parser, but
    // these cover ~95% of what news sites emit.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&bdquo;/g, "„")
    .replace(/&rdquo;/g, "”")
    // Generic numeric entities
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    // Whitespace normalization
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 4. Quality check. Below ~500 chars after extraction the page is
  //    probably a paywall, error page, or single-line list — useless
  //    for synthesis.
  if (text.length < 500) return null;

  // 5. Strip common boilerplate that survives the container filter
  //    on Romanian news sites: share buttons, "Citește și", related
  //    article links, comment prompts.
  const cleanedText = text
    .replace(/^.*?(Cite[șs]te [șs]i|Citeste si|Articol relevant|Citeste si|Vezi galeria foto|Mai mult[ăa]?  +informa[țt]ii)[\s\S]*$/gim, "")
    .replace(/^[\s\S]{0,100}?(?:Distribuie|Share|Trimite|Email)\s*[\s\S]*$/m, (m) =>
      m.length < 200 ? "" : m,
    )
    .trim();

  return cleanedText.slice(0, MAX_BODY_CHARS);
}
