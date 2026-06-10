// Promisometru (Faza 3) — promisiuni publice ale primarilor, urmărite cu sursă
// + termen + verdict FACTUAL. Curatoriat manual (ca PROVOCARI/PETITII): fiecare
// intrare TREBUIE să aibă sursă de presă/oficială reală și verdict neacuzator.
// REGULĂ LEGALĂ: nota descrie FAPTE verificabile („termenul anunțat a trecut;
// nu există anunț de finalizare"), niciodată intenții/acuzații („a mințit").

export type PromisiuneStatus =
  | "respectata" // livrată, cu dovadă (anunț de finalizare)
  | "in-curs" // înainte de termen, lucrări/pași vizibili
  | "intarziata" // termenul a trecut fără anunț de finalizare
  | "incalcata"; // abandonată explicit / anulată (dovadă solidă)

export interface Promisiune {
  /** Slug stabil (kebab-case) — cheie React + ancoră. */
  id: string;
  /** Cine a promis (persoană sau instituție). */
  autoritate: string;
  /** Funcția la momentul promisiunii (ex: „Primar Sector 2"). */
  functie: string;
  /** Cod județ (B = București) — pentru filtrare viitoare. */
  county: string;
  /** Promisiunea, concis și fidel sursei. */
  promisiune: string;
  /** Termenul promis, uman („sfârșitul lui 2026") sau „nedeclarat". */
  termen: string;
  /** Termen mașină (YYYY-MM-DD) pentru sortare/countdown; null = nedeclarat. */
  termenIso: string | null;
  /** Sursa primară (articol de presă / comunicat oficial). */
  sursaUrl: string;
  publicatie: string;
  /** Data sursei (YYYY-MM-DD). */
  dataSursa: string;
  status: PromisiuneStatus;
  /** Verdict FACTUAL, neacuzator, 1-2 fraze. */
  nota: string;
  /** Ultima reevaluare a statusului (YYYY-MM-DD). */
  verificatLa: string;
}

export const PROMISIUNI: Promisiune[] = [
  // Se populează din research-ul verificat (workflow 2026-06-11). Adaugă DOAR
  // intrări cu sursă verificată manual sau prin verificare adversarială.
];

export const PROMISIUNE_STATUS_META: Record<
  PromisiuneStatus,
  { label: string; color: string; icon: string }
> = {
  respectata: { label: "Respectată", color: "#059669", icon: "✅" },
  "in-curs": { label: "În curs", color: "#0891B2", icon: "🔵" },
  intarziata: { label: "Întârziată", color: "#D97706", icon: "⏰" },
  incalcata: { label: "Încălcată", color: "#DC2626", icon: "❌" },
};
