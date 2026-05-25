import {
  Building2,
  CheckCircle2,
  FileText,
  Megaphone,
  PauseCircle,
  Send,
  Shuffle,
  Shield,
  UserPlus,
  VolumeX,
  Scale,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export interface SesizareEventVisual {
  /** Human-readable label rendered in timelines */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Hex used for icon chip + accents */
  color: string;
}

/**
 * Single source of truth for sesizare timeline event types — used by
 * /urmareste, /sesizari/[code] and any future surface that renders the
 * timeline. Keep labels in Romanian with diacritics; the keys must match
 * the `event_type` strings written by the API routes.
 *
 * IMPORTANT: every value listed in `SESIZARE_STATUS_VALUES`
 * (src/lib/sesizari/status.ts) must have a matching entry here so the
 * admin status-change endpoint can write a meaningful timeline row.
 */
export const SESIZARE_EVENT_META: Record<string, SesizareEventVisual> = {
  depusa: { label: "Sesizare depusă pe platformă", icon: FileText, color: "#2563EB" },
  trimis: { label: "Sesizare trimisă către autorități", icon: Send, color: "#059669" },
  // Bug fix 5/22/2026 — send-via-civia emite event_type „trimis_via_civia"
  // dar nu era in catalog, deci aparea „Eveniment" generic in timeline.
  trimis_via_civia: { label: "Sesizare trimisă către autorități prin email", icon: Send, color: "#059669" },
  cosemnat: { label: "Un alt cetățean a trimis și el sesizarea", icon: UserPlus, color: "#0891B2" },
  inregistrata: { label: "Înregistrată la registratură", icon: Building2, color: "#7C3AED" },
  rutata: { label: "Trimisă la direcția de resort", icon: Megaphone, color: "#0891B2" },
  redirectionata: { label: "Redirecționată către altă instituție", icon: Shuffle, color: "#0EA5E9" },
  in_teren: { label: "Inspector pe teren", icon: Wrench, color: "#F59E0B" },
  "in-lucru": { label: "În lucru", icon: Wrench, color: "#F59E0B" },
  "actiune-autoritate": { label: "Acțiune a autorității (control / amenzi)", icon: Shield, color: "#0EA5E9" },
  interventie: { label: "Intervenție în teren", icon: Wrench, color: "#0EA5E9" },
  rezolvat: { label: "Problemă rezolvată", icon: CheckCircle2, color: "#059669" },
  respins: { label: "Sesizare respinsă", icon: XCircle, color: "#DC2626" },
  amanata: { label: "Amânată", icon: PauseCircle, color: "#C2410C" },
  ignorat: { label: "Ignorat de autoritate (60+ zile fără răspuns)", icon: VolumeX, color: "#991B1B" },
  escaladat_avp: { label: "Plângere trimisă la Avocatul Poporului", icon: Scale, color: "#7C2D12" },
};

const FALLBACK: SesizareEventVisual = {
  label: "Eveniment",
  icon: Send,
  color: "#64748B",
};

export function getSesizareEventMeta(eventType: string): SesizareEventVisual {
  return SESIZARE_EVENT_META[eventType] ?? FALLBACK;
}

/**
 * Status-uri „terminale" — sesizarea s-a încheiat. Nu mai e nimic
 * „acum/live", așa că UI-ul nu afișează pill-ul „Acum" pe ele.
 * 2026-05-25: user feedback — „Problemă rezolvată e pentru totdeauna,
 * scoate Acum".
 */
export const TERMINAL_EVENT_TYPES = new Set<string>([
  "rezolvat",
  "respins",
  "ignorat",
  "escaladat_avp",
]);

export function isTerminalEvent(eventType: string): boolean {
  return TERMINAL_EVENT_TYPES.has(eventType);
}

/**
 * Colaps consecutive rows cu același `event_type` (e.g. două „rezolvat"
 * scrise de resolve-route + admin-status în succesiune apropiată). Păstrăm
 * rândul cu descriere reală — dacă ambele au, păstrăm ultimul (most recent).
 *
 * Asumă input sortat crescător după `created_at` (cum returnează
 * `getTimeline` din repository.ts). Output păstrează aceeași ordine.
 */
export function dedupeConsecutiveEvents<
  T extends { event_type: string; description: string | null },
>(rows: T[]): T[] {
  if (rows.length <= 1) return rows;
  const out: T[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.event_type === row.event_type) {
      // Same event_type back-to-back → preferăm rândul cu descriere reală.
      const prevHasReal = !isRedundantEventDescription(prev.event_type, prev.description);
      const currHasReal = !isRedundantEventDescription(row.event_type, row.description);
      if (currHasReal && !prevHasReal) {
        out[out.length - 1] = row; // upgrade prev → curr (better description)
      } else if (currHasReal && prevHasReal) {
        out[out.length - 1] = row; // both real → keep most recent
      }
      // altfel: drop curr (e duplicat fără content extra)
      continue;
    }
    out.push(row);
  }
  return out;
}

/**
 * Returns true when the timeline row's `description` is just a repeat of
 * the label (the resolve API writes "Status actualizat la: amanata" /
 * "respins" / etc., which adds nothing once we render the proper label).
 */
export function isRedundantEventDescription(eventType: string, description: string | null): boolean {
  if (!description) return true;
  if (eventType === "cosemnat") return true; // label already says everything
  const normalized = description.toLowerCase().replace(/\s+/g, " ").trim();
  // Patterns the resolve / status-update endpoints emit
  const generic = [
    `status actualizat la: ${eventType.toLowerCase()}`,
    `status actualizat: ${eventType.toLowerCase()}`,
    // 2026-05-25 — resolve route (citizen self-marks) writes asta. Etichetă
    // meta („CINE a marcat") fără conținut despre cum a fost rezolvată
    // problema → redundant când label-ul deja spune „Problemă rezolvată".
    "marcată ca rezolvată de autor",
    "marcata ca rezolvata de autor",
  ];
  return generic.some((p) => normalized === p);
}
