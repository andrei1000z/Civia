/**
 * Extract sesizare code from inbound email.
 *
 * Strategie cu fallback-uri (din ce e mai sigur la ce e mai fragil):
 *
 *   1. Plus-addressing pe destinatar: To: sesizari+00044@civia.ro
 *      → cel mai sigur, funcționarul nu poate strica adresa (Reply
 *      o preia tale-quale din header-ele emailului original).
 *
 *   2. Subject:  "Re: Sesizare: ... — Cod 00044"
 *      → funcționarii uneori șterg „Re:" sau prefixează cu „Răspuns".
 *      Match pe „00044" oriunde în subject.
 *
 *   3. Body: „cod sesizare: 00044" sau „referință 00044" sau pur și
 *      simplu un cod alfanumeric 4-8 chars care match-uiește un
 *      pattern.
 *
 * Returnează null dacă NU putem identifica codul — webhook salvează
 * emailul oricum (sesizare_id = NULL) ca admin să-l poată asocia manual.
 */

/**
 * Pattern pentru codul de sesizare. Codurile sunt:
 *   - 5 cifre (00044, 12345) — format actual
 *   - sau alfanumerice scurte (legacy uneori 4-8 chars)
 *
 * Match strict pentru a evita false positives din corpul emailului
 * (numere de telefon, coduri de bare, etc).
 */
const CODE_PATTERN = /\b([A-Z0-9]{4,8})\b/g;

/**
 * Sub-addressing detection: sesizari+00044@civia.ro → extracted "00044".
 * Accepts both "+" and "_" as separator (some providers normalize).
 */
const PLUS_ADDR_PATTERN = /sesizari[+_]([A-Z0-9]{4,8})@/i;

/**
 * Subject patterns to recognize the code.
 *   "Cod 00044"
 *   "cod sesizare: 00044"
 *   "— 00044"
 *   "(00044)"
 *   "Ref: 00044"
 */
const SUBJECT_PATTERNS: RegExp[] = [
  /\bcod\s+(?:sesizare\s*:?\s*)?([A-Z0-9]{4,8})\b/i,
  /\bsesizare\s*[:#]?\s*([A-Z0-9]{4,8})\b/i,
  /\bref(?:erin[țt][ăa])?\s*:?\s*([A-Z0-9]{4,8})\b/i,
  /[—–-]\s*([A-Z0-9]{4,8})\b/, // dash-prefixed (em-dash, en-dash, hyphen)
  /\(([A-Z0-9]{4,8})\)/, // parens
];

/**
 * Body keyword patterns: things people might write when referencing
 * a sesizare code in free text.
 */
const BODY_PATTERNS: RegExp[] = [
  /\bcod(?:ul)?\s+sesiz[ăa]rii?\s*:?\s*([A-Z0-9]{4,8})\b/i,
  /\bsesizare\s+(?:nr\.?\s*|num[ăa]rul\s+|cu\s+codul\s+)([A-Z0-9]{4,8})\b/i,
  /\bcivia\.ro\/sesizari\/([A-Z0-9]{4,8})\b/i,
  /\bcod\s+([A-Z0-9]{4,8})\b/i,
  // 2026-06-05 — Răspunsurile auto („Solicitarea a fost înregistrată ... cu
  // urmatorul continut: Sesizare 00058 — ...") CITEAZĂ subiectul nostru
  // original „Sesizare 00058". Prindem codul de acolo. 5 cifre = format actual.
  /\bsesizare\s*[:#—–-]?\s*(\d{5})\b/i,
];

export interface ExtractCodeInput {
  to?: string | null;
  subject?: string | null;
  body?: string | null;
  /**
   * 2026-05-24 — RFC 5322 mail headers. Pasaa-le ca să încercăm
   * `In-Reply-To` și `References` (Message-ID-urile originale conțin codul).
   * Format key:value din webhook payload.
   */
  headers?: Record<string, string> | null;
}

export interface ExtractCodeResult {
  code: string | null;
  source: "plus-address" | "in-reply-to" | "subject" | "body" | "none";
}

/**
 * Try to extract a sesizare code from the inbound email's metadata.
 * The `source` field tells the caller how confident we should be.
 *
 *   - "plus-address" → strongest (~99% accuracy). Don't override.
 *   - "subject" → strong (~95%).
 *   - "body" → medium (~75%, could be false positive).
 *   - "none" → no code found.
 */
export function extractSesizareCode(input: ExtractCodeInput): ExtractCodeResult {
  // 1. Plus-addressing on To: header
  if (input.to) {
    const m = input.to.match(PLUS_ADDR_PATTERN);
    if (m?.[1]) return { code: m[1].toUpperCase(), source: "plus-address" };
  }

  // 1b. 2026-05-24 — In-Reply-To / References headers (RFC 5322).
  // Outbound emails au Message-ID `<sesizare-00044-uuid@civia.ro>` —
  // autoritățile preserveaza asta în răspuns. Match robust pe pattern.
  // Recunoaște subiecte scurte ca „Informare" / „Confirmare primire"
  // unde nu există cod în subject/body.
  if (input.headers) {
    const irt = input.headers["in-reply-to"] ?? input.headers["In-Reply-To"] ?? "";
    const refs = input.headers["references"] ?? input.headers["References"] ?? "";
    const combined = `${irt} ${refs}`;
    const m =
      combined.match(/sesizare[-_]([A-Z0-9]{4,8})[-_@]/i) ||
      combined.match(/<([A-Z0-9]{4,8})[-_]/i);
    if (m?.[1] && isPlausibleCode(m[1])) {
      return { code: m[1].toUpperCase(), source: "in-reply-to" };
    }
  }

  // 2. Subject patterns
  if (input.subject) {
    for (const pat of SUBJECT_PATTERNS) {
      const m = input.subject.match(pat);
      if (m?.[1] && isPlausibleCode(m[1])) {
        return { code: m[1].toUpperCase(), source: "subject" };
      }
    }
    // Fallback: any 5-digit-only sequence in subject (most codes are
    // 5-digit numeric like 00044).
    const anyNumeric = input.subject.match(/\b(\d{5})\b/);
    if (anyNumeric?.[1]) {
      return { code: anyNumeric[1], source: "subject" };
    }
  }

  // 3. Body patterns
  if (input.body) {
    for (const pat of BODY_PATTERNS) {
      const m = input.body.match(pat);
      if (m?.[1] && isPlausibleCode(m[1])) {
        return { code: m[1].toUpperCase(), source: "body" };
      }
    }
  }

  return { code: null, source: "none" };
}

/**
 * Filter out generic numbers / words that match CODE_PATTERN but
 * aren't real sesizare codes. Examples to reject:
 *   - "2026" (year)
 *   - "ROMA" (regular word)
 *   - "HTTP" (acronym)
 *
 * Heuristics:
 *   - 4-digit pure number that looks like a year (1900-2099) → reject
 *   - all-letter word → reject (codes always have at least one digit)
 *   - common acronyms → reject
 */
function isPlausibleCode(s: string): boolean {
  if (!s || s.length < 4 || s.length > 8) return false;
  const upper = s.toUpperCase();

  // Codes always contain at least one digit.
  if (!/\d/.test(upper)) return false;

  // Reject 4-digit years
  if (/^(19|20)\d{2}$/.test(upper)) return false;

  // Reject common Romanian admin abbreviations
  const BLACKLIST = ["GDPR", "GMT", "HTTP", "HTTPS", "OG27", "OG7", "OUG"];
  if (BLACKLIST.includes(upper)) return false;

  return true;
}

// Re-export CODE_PATTERN for tests
export { CODE_PATTERN };
