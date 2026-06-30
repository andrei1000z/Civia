/**
 * Detecție duplicat la TRIMITERE (hard-block server-side) — completează
 * `/api/sesizari/duplicates` (care e doar advisory pe client).
 *
 * Motivație (2026-06-29): un singur om a postat 3 sesizări „amenajare parcare"
 * la aceeași adresă în 7 minute (2 identice la virgulă, sub nume diferite,
 * anonim). Rate-limit-ul (5/10min) nu prinde asta, iar dedup-ul era doar un
 * avertisment ignorabil. Aici blocăm CLAR re-trimiterea unei sesizări
 * aproape-identice — pe bază NEUTRĂ (același tip + aceeași zonă + text foarte
 * similar), independent de subiect. Conservator ca să nu respingă raportări
 * genuin diferite la aceeași intersecție (text diferit → trece).
 */

/** Normalizează pentru comparație: lowercase, fără diacritice, doar [a-z0-9 ]. */
export function normalizeForCompare(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard pe set de cuvinte (>2 litere). 0..1. */
export function tokenSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const toks = (s: string) => new Set(normalizeForCompare(s).split(" ").filter((w) => w.length > 2));
  const ta = toks(a ?? "");
  const tb = toks(b ?? "");
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

/** Distanță în metri (haversine). */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface DedupTarget {
  lat: number | null;
  lng: number | null;
  titlu: string;
  descriere: string;
}
export interface DedupCandidate {
  code: string;
  lat: number | null;
  lng: number | null;
  titlu: string | null;
  descriere: string | null;
}

/** Praguri (conservatoare ca să nu respingă raportări legitime distincte). */
export const NEAR_METERS = 150;
export const NEAR_DESC_SIM = 0.5; // aproape + jumătate din cuvinte comune
export const NEAR_TITLE_SIM = 0.7;
export const EXACT_DESC_SIM = 0.82; // clonă text, oriunde (chiar fără coords)

/**
 * Returnează `true` dacă `candidate` (sesizare existentă, ACELAȘI tip — filtrat
 * de caller) e un duplicat al lui `target`. Blochează dacă:
 *  - sunt în aceeași zonă (≤150m) ȘI textul e foarte similar (desc≥0.5 sau titlu≥0.7), SAU
 *  - descrierea e aproape identică oriunde (≥0.82) — prinde clonele copy-paste.
 */
export function isDuplicate(target: DedupTarget, candidate: DedupCandidate): boolean {
  const descSim = tokenSimilarity(target.descriere, candidate.descriere);
  if (descSim >= EXACT_DESC_SIM) return true;

  const haveCoords =
    target.lat != null && target.lng != null && candidate.lat != null && candidate.lng != null;
  const near = haveCoords && haversineMeters(target.lat!, target.lng!, candidate.lat!, candidate.lng!) <= NEAR_METERS;
  if (!near) return false;

  const titleSim = tokenSimilarity(target.titlu, candidate.titlu);
  return descSim >= NEAR_DESC_SIM || titleSim >= NEAR_TITLE_SIM;
}

/** Găsește primul duplicat dintr-o listă de candidați (același tip). */
export function findDuplicate(target: DedupTarget, candidates: DedupCandidate[]): string | null {
  for (const c of candidates) {
    if (isDuplicate(target, c)) return c.code;
  }
  return null;
}
