/**
 * Petition updates scraper — extrage update-urile postate de inițiator din
 * pagina externă a petiției (Declic momentan; extensibil la alte platforme).
 *
 * Strategie Declic (verified live 5/23/2026):
 *   - noifacem.declic.ro: <cmpr-accordion-item header="Update DD.MM.YYYY - ...">body</cmpr-accordion-item>
 *     Filtrăm doar item-urile al căror header începe cu „Update".
 *   - campaniamea.declic.ro: are propriul format (TBD — fallback la regex universal)
 *
 * Output: array de update-uri parsed, deduplicabile via content_hash.
 */

import crypto from "node:crypto";

export interface ScrapedUpdate {
  /** Data update-ului ca ISO YYYY-MM-DD; null dacă header-ul nu conține dată. */
  updateDate: string | null;
  title: string;
  body: string;
  /** SHA-256 al `title + "\n" + body` trimmed — stable across re-scrapes. */
  contentHash: string;
}

/** SHA-256 hex pentru deduplicare insert-uri. */
function hashContent(title: string, body: string): string {
  return crypto
    .createHash("sha256")
    .update(`${title.trim()}\n${body.trim()}`)
    .digest("hex");
}

/**
 * Parsează „27.04..2026" sau „27.04.2026" → ISO „2026-04-27".
 * Acceptă DD.MM.YYYY cu .. în mijloc (typos reali pe Declic).
 */
function parseRomDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\.\.?(\d{1,2})\.\.?(\d{4})/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  if (Number(mm) < 1 || Number(mm) > 12) return null;
  if (Number(dd) < 1 || Number(dd) > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Strip HTML tags + decode &nbsp; → space, &amp; → &, etc. Quick-and-dirty,
 * sufficient pentru body update-urilor Declic (no script/style risk fiindcă
 * tag-urile <script> sunt stripped la fetch-ul cu user-agent normal).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&bdquo;/g, "„")
    .replace(/&ldquo;/g, "„")
    .replace(/&rdquo;/g, "”")
    .replace(/&hellip;/g, "…")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlAttribute(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Detect dacă URL-ul e Declic — singura platformă suportată acum.
 */
export function canScrapeUpdates(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return /(^|\.)declic\.ro$/.test(host) || /(^|\.)de-clic\.ro$/.test(host);
  } catch {
    return false;
  }
}

/**
 * Fetch + parse update-urile dintr-o petiție Declic. Returnează array gol
 * dacă pagina nu mai există (404), fetch eșuează, sau nu sunt update-uri.
 *
 * IMPORTANT: user-agent ca de browser pentru a evita 403/captcha. Timeout
 * 15s ca să nu blocăm cron-ul pe petițiile lente.
 */
/**
 * 2026-06-06 (audit #5) — extrage nr. de semnături din HTML-ul sursei.
 * Best-effort: „12.345 semnături", „12.345 de oameni au semnat", „12,345
 * signatures". Numerele RO folosesc „." ca separator de mii → îl curățăm.
 */
export function extractSignatureCount(html: string): number | null {
  const patterns = [
    // Declic/ControlShift: „...signatures"> <span class="number">14.113"
    /(?:signatures?|semn[ăa]turi|sus[țt]in[ăa]tori)["'\s>]*<span[^>]*class="number"[^>]*>\s*([\d][\d., ]*\d|\d)/i,
    // număr ÎNAINTE de cuvânt: „14.113 (de) semnături / susținători"
    /([\d][\d., \s]*\d)\s*(?:de\s+)?(?:semn[ăa]turi|sus[țt]in[ăa]tori)/i,
    /([\d][\d., \s]*\d)\s*(?:de\s+)?(?:persoane|oameni)\s+au\s+semnat/i,
    // număr DUPĂ cuvânt, generic: „signatures: 14.113"
    /(?:semn[ăa]turi|signatures?|au\s+semnat|signed)[^\d<]{0,40}([\d][\d., ]*\d|\d)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1].replace(/[., \s]/g, ""), 10);
      if (Number.isFinite(n) && n > 100 && n < 100_000_000) return n;
    }
  }
  return null;
}

export async function scrapeDeclicUpdates(
  externalUrl: string,
): Promise<{ updates: ScrapedUpdate[]; signatureCount: number | null; error: string | null }> {
  if (!canScrapeUpdates(externalUrl)) {
    return { updates: [], signatureCount: null, error: "not-declic" };
  }

  let html: string;
  try {
    const res = await fetch(externalUrl, {
      headers: {
        // Browser-real UA — controlshift.app (Declic) 403-ează „bot" UA-uri.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { updates: [], signatureCount: null, error: `http-${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    return {
      updates: [],
      signatureCount: null,
      error: `fetch-failed: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }

  // Parser: găsește <cmpr-accordion-item header="..."> body </cmpr-accordion-item>
  // și filtrează doar item-urile cu header începând cu „Update".
  // Regex multiline; nu folosim un DOM parser ca să rămânem ușor în Edge runtime.
  const itemRegex =
    /<cmpr-accordion-item[^>]*\bheader="([^"]+)"[^>]*>([\s\S]*?)<\/cmpr-accordion-item>/gi;

  const updates: ScrapedUpdate[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(html)) !== null) {
    if (!m[1] || !m[2]) continue;
    const rawHeader = decodeHtmlAttribute(m[1]);
    const rawBody = m[2];

    // Filtru: doar item-urile cu „Update" la început (FAQ items sar peste).
    const headerTrimmed = rawHeader.trim();
    if (!/^Update\b/i.test(headerTrimmed)) continue;

    const date = parseRomDate(headerTrimmed);
    // Curățăm titlul: scoatem prefix „Update DD.MM.YYYY -" pentru afișare.
    const cleanTitle = headerTrimmed
      .replace(/^Update\s+\d{1,2}\.\.?\d{1,2}\.\.?\d{4}\s*[-–—:]\s*/i, "")
      .trim();
    const body = stripHtml(rawBody);

    // Skip dacă body-ul e gol (placeholder accordion items).
    if (body.length < 10) continue;

    updates.push({
      updateDate: date,
      title: cleanTitle || `Update din ${date ?? "necunoscut"}`,
      body,
      contentHash: hashContent(cleanTitle, body),
    });
  }

  return { updates, signatureCount: extractSignatureCount(html), error: null };
}
