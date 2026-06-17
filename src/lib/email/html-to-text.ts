/**
 * Convertește HTML-ul unui email într-un fallback text/plain lizibil — pentru
 * clienții care blochează HTML ȘI pentru deliverability (Gmail/Outlook penalizează
 * emailurile fără o parte text reală). Înlocuiește fallback-ul generic de o linie
 * („Vezi conținutul complet pe civia.ro") care era trimis pentru TOATE emailurile.
 *
 * NU e un parser complet (nici nu avem nevoie) — doar: scoate style/script,
 * link-uri → „text (url)", block-uri → newline, strip tags, decode entități
 * comune, normalizare whitespace.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    // <style>/<script> → afară complet (CSS-ul din template nu e conținut).
    .replace(/<\s*(style|script)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    // <a href> → „text (url)" ca linkul să rămână utilizabil în text/plain.
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
      const t = String(inner).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!t) return String(href);
      return href && href !== t ? `${t} (${href})` : t;
    })
    // list items → bullet pe linie nouă.
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    // break + închidere de block → newline.
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|tr|li|ul|ol|table|section|header|footer)\s*>/gi, "\n")
    // strip restul de tag-uri.
    .replace(/<[^>]+>/g, "")
    // decode entități comune.
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    // normalizare whitespace.
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
