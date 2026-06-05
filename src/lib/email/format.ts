/**
 * Email-side text formatting helpers. Keeps every transactional email
 * consistent: no „Salut ion.popescu123," lines, no double commas,
 * no missing comma when a real name is present.
 *
 * Why this lives here and not next to `emailTemplate`: the template is
 * dumb HTML; the heuristics for what counts as a "real" name are a
 * separate concern that's also tested in isolation (see format.test.ts).
 */

const HAS_DIGITS = /\d/;
const NAME_TOKEN = /^[\p{L}'\-]+$/u;

/** Lower-cased values we treat as "no usable name" placeholders. */
const PLACEHOLDER_NAMES = new Set(["cetățean", "cetatean", "cetățean anonim", "user", "admin"]);

/**
 * Extract a clean, capitalized first name from the candidates we have
 * for a recipient. Returns null when none of the candidates look like
 * a real human name — so the caller falls back to a generic „Bună!".
 *
 * Heuristics that drop a candidate:
 *   - placeholder strings (Cetățean, Cetățean anonim, …)
 *   - matches the email's local part (default Supabase display_name
 *     for users who never set their name)
 *   - contains digits (ion.popescu123, user1000z)
 *   - not all letters / hyphen / apostrophe (no spaces / digits / dots)
 *   - ≤ 1 char or > 30 chars
 *
 * What survives: a single word of letters, 2–30 chars, that doesn't
 * collide with the email's local part. Capitalized as proper noun.
 */
export function formatRecipientName(opts: {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string | null {
  const localPart = opts.email?.split("@")[0]?.toLowerCase() ?? "";

  // fullName carries the strongest signal when present (user typed it
  // explicitly). Fall back to displayName otherwise.
  const candidates = [opts.fullName, opts.displayName]
    .map((c) => c?.trim())
    .filter((c): c is string => !!c && c.length > 0);

  for (const candidate of candidates) {
    if (PLACEHOLDER_NAMES.has(candidate.toLowerCase())) continue;

    // Drop when the entire candidate equals the email username.
    if (localPart && candidate.toLowerCase() === localPart) continue;

    const firstWord = candidate.split(/\s+/)[0];
    if (!firstWord) continue;
    if (firstWord.length < 2 || firstWord.length > 30) continue;
    if (HAS_DIGITS.test(firstWord)) continue;
    if (!NAME_TOKEN.test(firstWord)) continue;

    // Properly capitalized, Romanian-aware (ș/ț stay below the line).
    // Handles hyphenated compounds like "Maria-Elena" → "Maria-Elena"
    // by capitalizing the segment after each hyphen / apostrophe too.
    return firstWord
      .split(/([-'])/u)
      .map((segment) =>
        /[-']/.test(segment)
          ? segment
          : segment.charAt(0).toLocaleUpperCase("ro-RO") +
            segment.slice(1).toLocaleLowerCase("ro-RO"),
      )
      .join("");
  }

  return null;
}

/**
 * Build the salutation line. With a name we get „Salut, Eduard 👋"
 * (the wave emoji is opt-in via `withEmoji` so transactional /
 * decision emails can stay sober). Without a name we get „Bună!" —
 * never „Salut ion.popescu123".
 */
export function buildSalutation(opts: {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
  withEmoji?: boolean;
}): string {
  const name = formatRecipientName(opts);
  if (!name) return "Bună!";
  return opts.withEmoji ? `Salut, ${name} 👋` : `Salut, ${name},`;
}

/**
 * 2026-06-05 — Sanitizează numele afișat (display name) dintr-un header
 * `From: Name <email>` conform RFC 5322 + RFC 2047. Apărare împotriva
 * email header injection (CR/LF din input user) + mojibake la diacritice.
 *
 *  - Elimină CR/LF/control chars (anti-injection).
 *  - Diacritice / non-ASCII → encoded-word RFC 2047 (=?UTF-8?B?...?=) ca să
 *    nu se corupă numele („Ștefan Mușat") în clientul autorității.
 *  - Caractere RFC 5322 „specials" (ASCII) → quoted-string.
 */
export function sanitizeEmailDisplayName(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .replace(/[\r\n\t]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  // Non-ASCII (diacritice) → RFC 2047 encoded-word UTF-8 base64.
  if (/[^\x20-\x7e]/.test(cleaned)) {
    return `=?UTF-8?B?${Buffer.from(cleaned, "utf8").toString("base64")}?=`;
  }
  // ASCII cu „specials" RFC 5322 → quoted-string (escape " și \).
  if (/[()<>[\]:;@\\,."]/.test(cleaned)) {
    return `"${cleaned.replace(/(["\\])/g, "\\$1")}"`;
  }
  return cleaned;
}

/**
 * Construiește un header `From` sigur: `Display Name <email>` (sau doar
 * `email` dacă numele e gol/invalid). Folosit la toate emailurile trimise
 * în numele cetățeanului către autorități.
 */
export function buildFromHeader(name: string | null | undefined, email: string): string {
  const dn = sanitizeEmailDisplayName(name);
  return dn ? `${dn} <${email}>` : email;
}
