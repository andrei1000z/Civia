/**
 * Email header sanitization.
 *
 * Inainte: `From: ${author_name} <sesizari@civia.ro>` cu author_name
 * raw → atacator poate injecta CR/LF + headere noi (BCC, Reply-To).
 * Exemplu PoC:
 *   author_name = "Andrei\r\nBcc: attacker@evil.com"
 *   → From: Andrei
 *      Bcc: attacker@evil.com <sesizari@civia.ro>
 *
 * Acum: sanitizeFromName scoate orice control char + quote-uieste
 * dacă conține caractere speciale RFC 5322. Plus length cap 80 (RFC: 78).
 */

/**
 * Sanitize a personal name pentru use in From/To/Reply-To/CC header.
 *
 * RFC 5322 §3.2.3 — `phrase = 1*(atom / quoted-string)`.
 * Atom permite litere/cifre/-+_=. Anything else needs quoted-string.
 *
 * Comportament:
 *  1. Strip CR/LF (header injection)
 *  2. Strip control chars (0x00-0x1F, 0x7F)
 *  3. Strip leading/trailing whitespace
 *  4. Cap la 80 chars
 *  5. Daca contine ", \\, <, >, sau alte specials → quote + escape
 *  6. Fallback la "Cetățean Civia" daca rezulta string gol
 */
export function sanitizeFromName(raw: string | null | undefined): string {
  if (!raw) return "Cetățean Civia";
  // Step 1+2: strip CR/LF + control chars
  let cleaned = raw.replace(/[\r\n\t\f\v\x00-\x1F\x7F]/g, " ");
  // Step 3: trim + collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "Cetățean Civia";
  // Step 4: cap length
  cleaned = cleaned.slice(0, 80).trim();
  // Step 5: if contains specials → quote
  if (/[",\\<>@;:]/.test(cleaned)) {
    const escaped = cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return cleaned;
}

/**
 * Build a complete From header safely.
 *
 * Usage:
 *   const from = buildFromHeader(sesizare.author_name, "sesizari@civia.ro");
 *   // → "Andrei Musat <sesizari@civia.ro>"
 *   //   sau cu quote daca nume contine caractere speciale
 */
export function buildFromHeader(
  displayName: string | null | undefined,
  email: string,
): string {
  const safeName = sanitizeFromName(displayName);
  return `${safeName} <${email}>`;
}

/**
 * Sanitize a subject line.
 *
 * RFC 5322 §2.2.3 — long subjects are folded. Resend handles this internally,
 * dar noi taiem la 200 chars defensive. Plus strip CR/LF la fel ca name.
 */
export function sanitizeSubject(raw: string | null | undefined): string {
  if (!raw) return "Sesizare civică";
  let cleaned = raw.replace(/[\r\n\t\f\v\x00-\x1F\x7F]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "Sesizare civică";
  return cleaned.slice(0, 200);
}
