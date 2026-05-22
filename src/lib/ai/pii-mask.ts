/**
 * PII masking pentru AI prompts.
 *
 * Bug fix 5/22/2026 — GDPR concern: trimitem nume + adresa user-ului
 * direct in prompt-uri la Groq/Gemini. Aceste API-uri nu sunt
 * GDPR-certified pentru PII processing.
 *
 * Strategy:
 *   1. Inainte de call → înlocuiește PII cu token-uri placeholder
 *      (NUME_TOKEN_1, ADRESA_TOKEN_1, EMAIL_TOKEN_1).
 *   2. AI procesează cu placeholders (logic identică, doar fără PII real).
 *   3. După call → restore token-urile cu PII real în output.
 *
 * Pattern-uri detectate:
 *   - Nume complet (2+ cuvinte cu prima literă mare, romanian)
 *   - Adresă (Strada / Str. / Bulevardul / Calea / Aleea / Soseaua + nume)
 *   - Email
 *   - Telefon (+40, 07XX, 02XX)
 *   - CNP (13 cifre)
 */

export interface MaskedText {
  /** Text-ul cu PII înlocuit cu token-uri. */
  text: string;
  /** Map token → valoare reală (pentru restore). */
  tokens: Map<string, string>;
}

const NAME_PATTERN = /\b[A-ZĂÂÎȘȚ][a-zăâîșț]+(?:\s+[A-ZĂÂÎȘȚ][a-zăâîșț]+){1,3}\b/g;
const ADDRESS_PATTERN = /\b(?:Strada|Str\.|Bulevardul|Bd\.|B-dul|Calea|Aleea|Soseaua|Sos\.|Splaiul|Piața|Piata|Intrarea|Intr\.)\s+[A-ZĂÂÎȘȚ][\wăâîșțĂÂÎȘȚ.\s,-]{2,60}/g;
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_PATTERN = /\b(?:\+40|0)\s?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g;
const CNP_PATTERN = /\b[1-8]\d{12}\b/g;

/**
 * Mask PII din text. Pastreaza ordinea tokens-urilor pentru restore.
 */
export function maskPii(input: string): MaskedText {
  const tokens = new Map<string, string>();
  let text = input;
  let counter = 1;

  // Inlocuieste in ordine: cele mai specifice primele (CNP, email, telefon),
  // apoi adresa, apoi nume (cea mai broad).
  text = text.replace(CNP_PATTERN, (m) => {
    const token = `CNP_TOKEN_${counter++}`;
    tokens.set(token, m);
    return token;
  });
  text = text.replace(EMAIL_PATTERN, (m) => {
    const token = `EMAIL_TOKEN_${counter++}`;
    tokens.set(token, m);
    return token;
  });
  text = text.replace(PHONE_PATTERN, (m) => {
    const token = `TELEFON_TOKEN_${counter++}`;
    tokens.set(token, m);
    return token;
  });
  text = text.replace(ADDRESS_PATTERN, (m) => {
    const token = `ADRESA_TOKEN_${counter++}`;
    tokens.set(token, m);
    return token;
  });
  text = text.replace(NAME_PATTERN, (m) => {
    // Skip dacă match-ul e dintr-o adresă deja înlocuită (ex: „Strada Ion Popescu" → numele e capturat separat).
    // Adresa pattern matchuiește cu „Strada ..." inclusiv numele, deci dupa
    // replacement adresa, numele „Ion Popescu" nu mai apare in text. OK.
    const token = `NUME_TOKEN_${counter++}`;
    tokens.set(token, m);
    return token;
  });

  return { text, tokens };
}

/**
 * Restore PII tokens cu valori reale în output.
 */
export function unmaskPii(text: string, tokens: Map<string, string>): string {
  let result = text;
  for (const [token, real] of tokens) {
    result = result.split(token).join(real);
  }
  return result;
}

/**
 * Detect prompt injection attempts în user input (chat / form).
 * Returns true daca pare injection (instruction override).
 */
export function detectPromptInjection(text: string): boolean {
  const lower = text.toLowerCase();
  const injectionPatterns = [
    /\bignore\s+(?:previous|all|above|prior)\s+(?:instructions|prompts|rules)\b/,
    /\bforget\s+(?:previous|all|everything)\b/,
    /\byou\s+are\s+now\s+(?:a|an)\s+/,
    /\bsystem\s+prompt\s*[:=]/,
    /\b(?:reveal|show|display|print)\s+(?:your|the)\s+(?:system|initial|original)\s+prompt\b/,
    /<\s*\/?\s*system\s*>/,
    /\[\[.*system.*\]\]/,
    // Romanian variants
    /\bignor[ăa]\s+(?:instructiunile|regulile)\s+(?:anterioare|precedente)\b/,
    /\buit[ăa]\s+(?:tot|totul|instructiunile)\b/,
    /\b(?:e[ști]i|esti)\s+(?:acum|de\s+acum)\s+(?:un|o)\s+/,
  ];

  return injectionPatterns.some((p) => p.test(lower));
}
