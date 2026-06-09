import { FINAL_STATUSES } from "./overdue";

/**
 * Eligibilitate de escaladare la Avocatul Poporului (AVP) — Faza 1.
 *
 * SURSA UNICĂ DE ADEVĂR pentru pragul de escaladare. Extras din magic-number-ul
 * 45 care era hardcodat în escalate-avp/route.ts, ca să nu poată diverge clientul
 * (buton disabled) de server (422).
 *
 * ⚖️ REGULĂ LEGALĂ LOAD-BEARING — NU MODIFICA fără temei legal:
 * Escaladarea la AVP e legitimă DOAR când autoritatea a depășit termenul legal
 * (OG 27/2002: 30 zile art. 14 + extensia max de 15 zile art. 9 = 45 zile) FĂRĂ
 * să fi răspuns. Numărul de CO-SEMNĂTURI nu intră NICIODATĂ în acest calcul —
 * co-semnăturile dau greutate/vizibilitate, nu grăbesc termenul legal. O sesizare
 * cu 1000 de co-semnături și 2 zile vechime NU e escaladabilă. Testul
 * „2 zile + 50 co-semnături => NOT eligible" codifică această interdicție.
 */
export const AVP_ESCALATION_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AvpEligibilityInput {
  created_at: string | Date;
  status: string;
  /** Dovadă că autoritatea a răspuns — blochează escaladarea, oricât de veche. */
  official_response_at: string | Date | null;
}

export type AvpReason =
  | "ignorat" // override admin/auto (60+ zile) — eligibil instant
  | "time-expired" // 45+ zile fără răspuns — eligibil
  | "too-early" // termenul legal încă curge
  | "responded" // există răspuns oficial → termenul a fost respectat
  | "resolved"; // status final (rezolvat/respins) → nimic de escaladat

export interface AvpEligibility {
  eligible: boolean;
  reason: AvpReason;
  daysSinceFiled: number;
  /** Câte zile până devine eligibilă pe calea organică (0 dacă deja e). */
  daysUntilEligible: number;
}

export function evaluateAvpEligibility(
  s: AvpEligibilityInput,
  now: Date = new Date(),
): AvpEligibility {
  const filed = new Date(s.created_at).getTime();
  const daysSinceFiled = Math.floor((now.getTime() - filed) / DAY_MS);
  const daysUntilEligible = Math.max(0, AVP_ESCALATION_DAYS - daysSinceFiled);

  // 1) Status final — autoritatea a decis (rezolvat/respins) → nu escaladăm.
  if (FINAL_STATUSES.has(s.status)) {
    return { eligible: false, reason: "resolved", daysSinceFiled, daysUntilEligible };
  }

  // 2) Răspuns oficial înregistrat → termenul a fost respectat. PRECONDIȚIE
  //    pentru TOATE căile (inclusiv „ignorat"): nu putem reclama „ignorare" la
  //    AVP dacă avem dovada unui răspuns. Edge case legacy (ignorat + răspuns) →
  //    răspunsul câștigă, NOT eligible.
  if (s.official_response_at) {
    return { eligible: false, reason: "responded", daysSinceFiled, daysUntilEligible };
  }

  // 3) „ignorat" — semnal explicit admin/auto de 60+ zile fără răspuns → instant.
  if (s.status === "ignorat") {
    return { eligible: true, reason: "ignorat", daysSinceFiled, daysUntilEligible: 0 };
  }

  // 4) Calea organică pe timp: 45 zile (30 termen + 15 extensie) fără răspuns.
  if (daysSinceFiled >= AVP_ESCALATION_DAYS) {
    return { eligible: true, reason: "time-expired", daysSinceFiled, daysUntilEligible: 0 };
  }

  return { eligible: false, reason: "too-early", daysSinceFiled, daysUntilEligible };
}
