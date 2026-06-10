import type { SesizareStatus } from "./status";

/**
 * Mașina de stări a statusurilor de sesizare. SURSĂ UNICĂ pentru rangul de
 * progresie + regulile de tranziție (înainte erau definite doar local în inbox
 * → risc de divergență, semnalat de auditul de statusuri 2026-06-10).
 *
 * Rangul reflectă cât de „departe" e o sesizare în ciclul de viață:
 *   nou(0) → trimis(1) → redirectionata(2) → inregistrata(3) →
 *   {in-lucru, actiune-autoritate, interventie, amanata}(4) →
 *   {rezolvat, respins, ignorat}(6, terminale)
 */
export const STATUS_RANK: Record<string, number> = {
  nou: 0,
  trimis: 1,
  redirectionata: 2,
  inregistrata: 3,
  "actiune-autoritate": 4,
  interventie: 4,
  amanata: 4,
  "in-lucru": 4,
  rezolvat: 6,
  respins: 6,
  ignorat: 6,
};

export function statusRank(s: string): number {
  return STATUS_RANK[s] ?? 0;
}

/** True dacă `to` e strict mai avansat decât `from` (progresie normală). */
export function isForwardTransition(from: string, to: string): boolean {
  return statusRank(to) > statusRank(from);
}

/** Statusuri „timpurii" la care NU te mai poți întoarce odată ce sesizarea a
 *  fost trimisă/procesată — nu poți „de-trimite" o sesizare. */
const EARLY_STATUSES = new Set<string>(["nou", "trimis"]);

/**
 * O REGRESIE PERICULOASĂ = revenire la un status timpuriu (nou/trimis) dintr-unul
 * deja avansat (peste `trimis`). Ex: rezolvat→nou resetează tot (timeline,
 * eligibilitate AVP, narațiunea cetățeanului) și e aproape mereu o greșeală de
 * 1 click. Reopen-urile legitime (rezolvat→in-lucru, redeschidere) NU sunt blocate.
 */
export function isBlockedRegression(from: string, to: string): boolean {
  return EARLY_STATUSES.has(to) && statusRank(from) > statusRank("trimis");
}

/** Mesaj uman pentru o regresie blocată. */
export function blockedRegressionMessage(from: SesizareStatus | string, to: SesizareStatus | string): string {
  return `Tranziție invalidă: o sesizare „${from}" nu poate reveni la „${to}" (nu poți de-trimite o sesizare). Pentru redeschidere folosește un status de lucru (ex: în-lucru).`;
}
