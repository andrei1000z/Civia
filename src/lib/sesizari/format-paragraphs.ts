/**
 * Reformatare paragraf-by-paragraf pentru formal_text al sesizarilor.
 *
 * Rupe inline:
 *  - „1. ... 2. ... 3." → fiecare pe linie proprie
 *  - „Bună ziua, Mă numesc..." → 2 paragrafe
 *  - Fraze de tranziție inline („Pentru a rezolva", „De asemenea", etc)
 *  - „Cu stimă, NUME DD lună YYYY" → semnatura clasica pe 3 randuri
 *
 * Folosit:
 *  - In normalizeFormatting din /api/ai/improve (la generare AI)
 *  - Defense-in-depth la save in /api/sesizari (cand formal_text vine
 *    pre-construit fără normalize aplicat)
 *  - In backfill-scripts pentru sesizari existente
 */

const TRANSITIONS = [
  "Pentru a rezolva",
  "Având în vedere",
  "De asemenea",
  "În temeiul",
  "În sprijinul",
  "În acest sens",
  "În scopul",
  "Vă mulțumesc",
  "Cu stimă",
  "Cu respect",
];

/**
 * Aplica TOATE pas-urile de paragraf-break in ordine corecta.
 * Idempotent — apel multiplu produce acelasi rezultat.
 */
export function reformatFormalText(text: string): string {
  if (!text) return text;
  let t = text.replace(/\r\n/g, "\n");

  // 1. Sparge numerotare inline („. 1." sau „: 1." → newline inainte de cifra).
  //    Lookahead pe litera mare romaneasca → evita data calendaristica „18 mai 2026".
  t = t.replace(/([.:]\s)(\d{1,2}\.\s)(?=[A-ZĂÂÎȘȚ])/g, "$1\n$2");

  // 2. Sparge frazele de tranzitie inline.
  for (const phrase of TRANSITIONS) {
    const re = new RegExp(`(\\.\\s)(${phrase})`, "g");
    t = t.replace(re, "$1\n\n$2");
  }

  // 3. Salut: „Bună ziua, Mă numesc..." → 2 paragrafe.
  t = t.replace(/(Bună ziua,)\s+(Mă numesc)/g, "$1\n\n$2");

  // 4. Semnatura: „Cu stimă, NUME DD lună YYYY" → 3 randuri.
  t = t.replace(
    /(Cu (?:stimă|respect),)\s+([^\n]+?)\s+(\d{1,2}\s+\w+\s+\d{4})$/m,
    "$1\n$2\n$3",
  );

  // 5. Collapse 3+ newlines → max 2.
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}
