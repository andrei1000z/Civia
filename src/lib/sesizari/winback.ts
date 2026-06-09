/**
 * Win-back a-doua-acțiune (Faza 1) — logica PURĂ de eligibilitate a chaser-ului
 * la 48h. Extrasă din endpoint ca să fie testabilă: un bug aici = fie spam-uim
 * cetățeni deja angajați, fie ratăm exact userii care au nevoie de nudge.
 */

export interface WinbackActivity {
  /** Câte sesizări a depus userul în total. Eligibil DOAR dacă exact 1 (prima). */
  sesizari: number;
  /** Câte comentarii a lăsat. O a doua acțiune → nu mai e „inactiv". */
  comments: number;
  /** Câte co-semnături a dat. O a doua acțiune. */
  cosigners: number;
}

/**
 * Eligibil pentru chaser = a făcut EXACT o acțiune (prima sesizare) și nimic
 * altceva, ȘI și-a dat consimțământul de email (newsletter_email_optin).
 */
export function isWinbackEligible(activity: WinbackActivity, consented: boolean): boolean {
  return (
    consented &&
    activity.sesizari === 1 &&
    activity.comments === 0 &&
    activity.cosigners === 0
  );
}
