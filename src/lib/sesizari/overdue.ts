/**
 * Overdue detection pentru sesizări care n-au primit răspuns în 30 de zile
 * de la depunere (OG 27/2002 art. 14 — termenul legal de soluționare).
 *
 * Logică:
 *  • Sesizarea trebuie să fie depusă acum cel puțin 30 de zile
 *  • Nu există `official_response_at` setat
 *  • Status-ul NU e final („rezolvat" / „respins") — pe acestea, autoritatea
 *    a luat o decizie chiar dacă n-a marcat oficial răspunsul
 *
 * Constanta `OFFICIAL_RESPONSE_DAYS` poate fi modificată (ex: dacă legea
 * se schimbă), dar standardul actual e 30 zile calendaristice.
 */
export const OFFICIAL_RESPONSE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverdueInput {
  created_at: string | Date;
  status: string;
  official_response_at: string | Date | null;
}

export interface OverdueResult {
  isOverdue: boolean;
  /** Câte zile de la depunere până acum. */
  daysSinceFiled: number;
  /** Câte zile peste termenul de 30 (negativ dacă încă în termen). */
  daysOverdue: number;
}

const FINAL_STATUSES = new Set(["rezolvat", "respins"]);

export function evaluateOverdue(
  s: OverdueInput,
  now: Date = new Date(),
): OverdueResult {
  const filed = new Date(s.created_at).getTime();
  const nowMs = now.getTime();
  const daysSinceFiled = Math.floor((nowMs - filed) / DAY_MS);
  const daysOverdue = daysSinceFiled - OFFICIAL_RESPONSE_DAYS;

  const isOverdue =
    daysOverdue > 0 &&
    !s.official_response_at &&
    !FINAL_STATUSES.has(s.status);

  return { isOverdue, daysSinceFiled, daysOverdue };
}

/** Variantă rapidă pentru când nu ai nevoie de detalii. */
export function isOverdue(
  s: OverdueInput,
  now: Date = new Date(),
): boolean {
  return evaluateOverdue(s, now).isOverdue;
}
