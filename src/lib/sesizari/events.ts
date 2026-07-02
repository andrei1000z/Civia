import {
  Bell,
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
  // 2026-06-10 (audit statusuri) — culoarea aliniată la badge-ul de status `trimis`
  // (#0891B2 cyan în SESIZARE_STATUS_META). Înainte era #059669 verde → aceeași
  // noțiune apărea cu două culori pe timeline vs badge.
  trimis: { label: "Sesizare trimisă către autorități", icon: Send, color: "#0891B2" },
  // Bug fix 5/22/2026 — send-via-civia emite event_type „trimis_via_civia"
  // dar nu era in catalog, deci aparea „Eveniment" generic in timeline.
  trimis_via_civia: { label: "Sesizare trimisă către autorități prin email", icon: Send, color: "#0891B2" },
  cosemnat: { label: "Un alt cetățean a trimis și el sesizarea", icon: UserPlus, color: "#0891B2" },
  // 2026-06-10 (audit statusuri) — cosign-send scrie event_type „cosign_send"
  // (înregistrare internă a trimiterii de către co-semnatar; filtrat din timeline-ul
  // public, dar vizibil în admin/owner). Fără intrare în catalog cădea pe „Eveniment".
  cosign_send: { label: "Un co-semnatar a trimis sesizarea prin email", icon: UserPlus, color: "#0891B2" },
  inregistrata: { label: "Înregistrată", icon: Building2, color: "#7C3AED" },
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
  reamintire: { label: "Reamintire trimisă către autoritate", icon: Bell, color: "#EA580C" },
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
 *
 * ATENȚIE — divergență INTENȚIONATĂ față de FINAL_STATUSES (overdue.ts):
 * `ignorat` + `escaladat_avp` sunt terminale doar pentru UI (nu mai e nimic
 * „live" de afișat), dar legal sesizarea ignorată rămâne DESCHISĂ — e exact
 * starea care permite escaladarea la AVP. Nu unifica cele două seturi.
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
 * 2026-05-27 — Bonus: same-type events în fereastră <24h sunt colapsate
 * într-un singur rând (cazul Cluj-Napoca pe sesizarea 00049 — 5 confirmări
 * „inregistrata" în 42 min de la operatori diferiți). Atașăm `_collapsed_count`
 * și `_collapsed_window_h` pentru UI ca să afișeze „autoritatea a trimis N
 * confirmări" în loc de N evenimente identice.
 *
 * Asumă input sortat crescător după `created_at` (cum returnează
 * `getTimeline` din repository.ts). Output păstrează aceeași ordine.
 */
export function dedupeConsecutiveEvents<
  T extends { event_type: string; description: string | null; created_at?: string },
>(rows: T[]): (T & { _collapsed_count?: number; _collapsed_window_h?: number })[] {
  if (rows.length <= 1) return rows;
  const COLLAPSE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
  // Tipuri pentru care colapsăm într-o fereastră lungă (nu doar back-to-back).
  // „inregistrata" e cel mai important — autoritățile RO trimit 2-5 confirmări
  // pentru același nr înregistrare (variante de formatare / operatori diferiți).
  const WINDOWED_TYPES = new Set(["inregistrata", "trimis", "actiune-autoritate"]);

  const out: (T & { _collapsed_count?: number; _collapsed_window_h?: number })[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.event_type === row.event_type) {
      const prevHasReal = !isRedundantEventDescription(prev.event_type, prev.description);
      const currHasReal = !isRedundantEventDescription(row.event_type, row.description);

      // Verifică fereastra de timp (dacă tipul suportă collapse-windowed)
      let withinWindow = true;
      if (WINDOWED_TYPES.has(row.event_type) && prev.created_at && row.created_at) {
        const dt = new Date(row.created_at).getTime() - new Date(prev.created_at).getTime();
        withinWindow = Math.abs(dt) <= COLLAPSE_WINDOW_MS;
      }

      if (withinWindow) {
        // Incrementăm collapsed counter
        const prevCount = prev._collapsed_count ?? 1;
        const merged = {
          ...row,
          _collapsed_count: prevCount + 1,
          _collapsed_window_h: 24,
        };
        if (currHasReal || !prevHasReal) {
          // Upgrade la rândul mai bun (cu descriere reală) sau cel mai recent
          out[out.length - 1] = merged;
        } else {
          // Păstrăm prev dar bump counter
          out[out.length - 1] = { ...prev, _collapsed_count: prevCount + 1, _collapsed_window_h: 24 };
        }
        continue;
      }

      // 2026-06-12 — În afara ferestrei (>24h), dar rândul nou e GENERIC (fără
      // descriere reală): e un duplicat redundant al aceluiași tip (ex. backf-ill
      // care a re-scris un status deja existent → două „Înregistrată" identice la
      // 11 zile distanță pe 00044). Oglindim regula din appendTimelineEvent
      // („generic + același event_type ca ultimul → skip") și îl ascundem
      // SILENȚIOS (păstrăm rândul anterior, fără badge „×N în 24h" înșelător).
      if (!currHasReal) {
        continue;
      }
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
  // 2026-05-26 — user explicit: NU vrea descrieri sub aceste evenimente
  // (label-urile sunt deja explicite). Boilerplate „Sesizare depusă de
  // cetățean" / „S-au montat stâlpișori" cluttering up timeline-ul.
  if (eventType === "depusa") return true;
  if (eventType === "rezolvat") return true;
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
