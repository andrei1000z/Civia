/**
 * Helper: nume afișat public pentru o sesizare/comentariu/etc.
 *
 * Logica:
 *   1. Daca user-ul are cont si display_name setat in profile → folosim display_name
 *      (ex: „Andrei", „Mihai" — prenume scurt din Google sau setat manual).
 *   2. Daca display_name lipseste (user anonim sau profile fara display_name)
 *      → folosim primul cuvant din author_name (ex: „Mușat Eduard Andrei" → „Mușat").
 *   3. Daca author_name e gol (NU ar trebui sa se intample) → fallback la „Cetățean".
 *
 * IMPORTANT: cetateanul care primește emailul de sesizare la primarie tot vede
 * numele complet (author_name) — display_name e DOAR pentru vizualizarea publica
 * pe site. Asta respecta:
 *   - GDPR minimizare: pe site nu apar nume complete fara nevoie
 *   - OG 27/2002: primaria are nevoie de nume complet pentru a putea raspunde
 */

const ANONYMOUS_FALLBACK = "Cetățean";

export interface DisplayNameInput {
  /** Display name din profile (numele afișat — setat de user pe /cont). */
  display_name?: string | null;
  /** Numele complet trimis cand a depus sesizarea (din formular). */
  author_name?: string | null;
}

/**
 * Returneaza numele public pentru un cetatean.
 */
export function publicAuthorName(input: DisplayNameInput): string {
  const display = input.display_name?.trim();
  if (display) return display;
  const full = input.author_name?.trim();
  if (full) {
    const firstWord = full.split(/\s+/)[0]?.trim();
    if (firstWord) return firstWord;
  }
  return ANONYMOUS_FALLBACK;
}

/**
 * Helper specific pentru leaderboard si agregari unde avem nume complete
 * fara display_name (sesizari vechi sau anonim). Pseudo-anonimizare:
 *   - Cu display_name: returneaza display_name DIRECT.
 *   - Fara display_name dar author_name: returneaza „Prenume X." (primul
 *     cuvant + initiala ultimului) — mai pretensios decat doar primul
 *     cuvant cand e nevoie sa avem si o forma de „inseamna ceva specific".
 */
export function leaderboardAuthorName(input: DisplayNameInput): string {
  const display = input.display_name?.trim();
  if (display) return display;
  const full = input.author_name?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return ANONYMOUS_FALLBACK;
    if (parts.length === 1) return parts[0]!;
    return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
  }
  return ANONYMOUS_FALLBACK;
}
