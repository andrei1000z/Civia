/**
 * 2026-06-05 — Decide noul status al unei sesizări pornind de la clasificarea
 * unui răspuns al autorității. Sursă unică de adevăr pentru route-ul de inbox
 * ȘI backfill (consistență).
 *
 * Reguli:
 *  - „inregistrata" se aplică ACUM și fără nr_inregistrare explicit. Bug: 00060/
 *    00061 confirmate de Poliția Locală rămâneau pe „trimis" fiindcă răspunsul
 *    nu conținea un număr (dovada e însuși răspunsul autorității, deja validat
 *    de gating-ul de autenticitate/încredere din caller).
 *  - FORWARD-ONLY: nu regresăm un status mai avansat (un ack întârziat nu trebuie
 *    să dea „rezolvat" → „inregistrata").
 *  - official_response (vizibil public) doar pentru răspunsuri SUBSTANȚIALE
 *    (în lucru / rezolvat / redirecționat) cu rezumat real.
 */

// STATUS_RANK e definit canonic în state-machine.ts (sursă unică, partajată cu
// regulile de tranziție admin). Re-exportat pentru compatibilitate cu importurile
// existente din această cale.
import { STATUS_RANK } from "@/lib/sesizari/state-machine";
export { STATUS_RANK };

export interface StatusUpdate {
  status: string;
  nr_inregistrare?: string;
  official_response?: string;
  official_response_at?: string;
}

export function computeStatusUpdate(args: {
  currentStatus: string | null | undefined;
  aiStatus: string;
  nrInregistrare?: string | null;
  summary?: string | null;
  /** Timestamp pentru official_response_at (ISO). */
  at: string;
}): StatusUpdate | null {
  const candidate =
    args.aiStatus === "inregistrata" ? "inregistrata"
    : args.aiStatus === "in-lucru" ? "in-lucru"
    : args.aiStatus === "actiune-autoritate" ? "actiune-autoritate"
    : args.aiStatus === "interventie" ? "interventie"
    : args.aiStatus === "amanata" ? "amanata"
    : args.aiStatus === "rezolvat" ? "rezolvat"
    : args.aiStatus === "redirectionata" ? "redirectionata"
    : null;
  if (!candidate) return null;

  const curRank = STATUS_RANK[args.currentStatus ?? "nou"] ?? 0;
  const newRank = STATUS_RANK[candidate] ?? 0;
  if (newRank <= curRank) return null; // forward-only — nu regresăm

  const updates: StatusUpdate = { status: candidate };
  if (args.nrInregistrare && args.nrInregistrare.trim()) {
    updates.nr_inregistrare = args.nrInregistrare.trim();
  }
  const substantive = [
    "in-lucru", "actiune-autoritate", "interventie", "amanata", "rezolvat", "redirectionata",
  ].includes(candidate);
  if (substantive && args.summary && args.summary.trim().length > 20) {
    updates.official_response = args.summary.trim();
    updates.official_response_at = args.at;
  }
  return updates;
}
