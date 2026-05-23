/**
 * Single source of truth for sesizare status values + their workflow
 * meaning. Used by:
 *   - admin status route   (`POST /api/admin/sesizari/[code]/status`)
 *   - status-ticket routes (`POST /api/sesizari/[code]/status-tickets` etc)
 *   - admin UI status modal
 *   - user UI ticket modal
 *   - any place that wants the labels / colors / order
 *
 * Keep this list ordered the way it should appear in the workflow
 * picker — admins read top→bottom, citizens too.
 */

export const SESIZARE_STATUS_VALUES = [
  "nou",
  "trimis",
  "inregistrata",
  "redirectionata",
  "in-lucru",
  "actiune-autoritate",
  "interventie",
  "amanata",
  "rezolvat",
  "respins",
] as const;

export type SesizareStatus = (typeof SESIZARE_STATUS_VALUES)[number];

/**
 * Subset citizens are allowed to PROPOSE via /sesizari/[code]/status-tickets.
 * `nou` is excluded — it's the initial state, never something to propose.
 */
export const SESIZARE_TICKET_PROPOSABLE = SESIZARE_STATUS_VALUES.filter(
  (s) => s !== "nou",
) as readonly Exclude<SesizareStatus, "nou">[];

export interface SesizareStatusMeta {
  /** Pill label rendered on the public sesizare card / hero / timeline */
  label: string;
  /** Hex used for the status pill background tint + dot */
  color: string;
  /** Short helper text shown beside each option in the picker UI */
  hint: string;
  /** Optional emoji used in status-change / decision emails */
  emoji: string;
}

export const SESIZARE_STATUS_META: Record<SesizareStatus, SesizareStatusMeta> = {
  nou: {
    label: "Nou",
    color: "#DC2626",
    hint: "Sesizare proaspăt depusă, încă neprocesată",
    emoji: "📩",
  },
  trimis: {
    // 5/23/2026 — adăugat la SESIZARE_STATUS_META. Înainte era doar în
    // DB enum (migration 056) dar UI fallback-uia la raw „trimis" fără
    // label, culoare sau icon. Acum se afișează corect cu cyan + emoji.
    label: "Trimis",
    color: "#0891B2",
    hint: "Emailul a plecat către autoritate — așteptăm confirmarea (înregistrare)",
    emoji: "📤",
  },
  inregistrata: {
    label: "Înregistrată",
    color: "#7C3AED",
    hint: "Autoritatea a confirmat primirea — avem nr. de înregistrare",
    emoji: "📨",
  },
  redirectionata: {
    label: "Redirecționată",
    color: "#0EA5E9",
    hint: "Trimisă la altă instituție / direcție competentă",
    emoji: "↪️",
  },
  "in-lucru": {
    label: "În lucru",
    color: "#F59E0B",
    hint: "Procesare activă la autoritate",
    emoji: "🔧",
  },
  "actiune-autoritate": {
    label: "Acțiune autoritate",
    color: "#0EA5E9",
    hint: "Control, amenzi, verificare în teren (poliție / jandarmi / inspectorat)",
    emoji: "🛡️",
  },
  interventie: {
    label: "Intervenție",
    color: "#0EA5E9",
    hint: "Lucrare fizică efectuată (stâlpișori, asfaltare, reparație)",
    emoji: "🛠️",
  },
  amanata: {
    label: "Amânată",
    color: "#C2410C",
    hint: "Va fi tratată în cadrul unui proiect mai amplu",
    emoji: "🕒",
  },
  rezolvat: {
    label: "Rezolvat",
    color: "#059669",
    hint: "Problema a fost remediată complet",
    emoji: "✅",
  },
  respins: {
    label: "Respins",
    color: "#6B7280",
    hint: "Autoritatea refuză rezolvarea (motivat)",
    emoji: "⛔",
  },
};

/** Type guard — keeps validation tight at API boundaries. */
export function isSesizareStatus(value: unknown): value is SesizareStatus {
  return (
    typeof value === "string" &&
    (SESIZARE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/**
 * For each status value, return the timeline `event_type` we want to write
 * when the admin transitions a sesizare INTO that status. The mapping is
 * the identity for most rows because the events catalog already uses the
 * same key — we keep the indirection so future divergences don't ripple.
 */
export function timelineEventForStatus(status: SesizareStatus): string {
  switch (status) {
    case "nou":
      // No timeline row for nou — that's the depusa event from the trigger.
      // Returning empty signals the caller to skip the insert.
      return "";
    default:
      return status;
  }
}
