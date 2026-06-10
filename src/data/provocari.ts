/**
 * Provocări civice lunare (Faza 2 — hiper-localizare & retenție).
 *
 * O provocare activă pe lună: o temă (tip sesizare) + un oraș/județ + un PRAG
 * COLECTIV (ex „100 de cereri de stâlpișori în București, iunie 2026"). Pagina
 * /provocari arată o bară de progres COLECTIVĂ (câte sesizări publice s-au depus
 * pe temă+oraș luna asta) — NU competiție individuală. Cetățenii care participă
 * primesc un badge ediție-limitată (calculat dinamic, fără storage).
 *
 * Curatoriere MANUALĂ: adaugă o intrare per lună (cheia `month` = "YYYY-MM").
 * provocari.test.ts validează că tip ∈ SESIZARE_TIPURI, county ∈ ALL_COUNTIES și
 * avertizează dacă luna curentă nu e acoperită.
 */

export interface Provocare {
  /** Id stabil, unic (ex „2026-06-stalpisori-bucuresti"). */
  id: string;
  /** Slug pentru afișaj/arhivă. */
  slug: string;
  /** Luna provocării — cheia de activare, format „YYYY-MM" (UTC). */
  month: string;
  titlu: string;
  descriere: string;
  /** SESIZARE_TIPURI.value EXACT — match pe sesizari.tip. */
  tip: string;
  /** id UPPERCASE din ALL_COUNTIES — match pe sesizari.county. */
  county: string;
  /** „Iași" / „Sector 3" / null = tot județul. Sector → exact, oraș → fuzzy. */
  locality: string | null;
  /** Pragul colectiv de sesizări (ex 100). */
  pragColectiv: number;
  /** Emoji din SESIZARE_TIPURI (afișaj). */
  icon: string;
  /** Cheie din HERO_GRADIENT (ex „warning"). */
  gradient: string;
  /** Badge ediție-limitată — calculat dinamic din participare, fără tabel nou. */
  badge: { id: string; name: string; icon: string; description: string };
}

export const PROVOCARI: Provocare[] = [
  {
    id: "2026-06-stalpisori-bucuresti",
    slug: "stalpisori-bucuresti-iunie-2026",
    month: "2026-06",
    titlu: "Recucerim trotuarele Bucureștiului",
    descriere:
      "Mașinile parcate pe trotuar îi forțează pe pietoni — copii, vârstnici, persoane în scaun cu rotile — să meargă pe carosabil. Luna aceasta strângem cereri de stâlpișori anti-parcare către primării. Fiecare sesizare contează.",
    tip: "stalpisori",
    county: "B",
    locality: null, // tot Bucureștiul (evită fuzzy pe diacritice)
    pragColectiv: 50,
    icon: "🪧",
    gradient: "warning",
    badge: {
      id: "provocare-2026-06",
      name: "Apărător de trotuare",
      icon: "🛡️",
      description: "Ai depus o cerere de stâlpișori în București în iunie 2026",
    },
  },
];

/** Provocarea activă pentru luna curentă (UTC), sau null. */
export function getProvocareCurenta(now: Date = new Date()): Provocare | null {
  const ym = now.toISOString().slice(0, 7); // „2026-06"
  return PROVOCARI.find((p) => p.month === ym) ?? null;
}

/** Provocările trecute (arhivă), cele mai recente întâi. */
export function getProvocariTrecute(now: Date = new Date()): Provocare[] {
  const ym = now.toISOString().slice(0, 7);
  return PROVOCARI.filter((p) => p.month < ym).sort((a, b) => b.month.localeCompare(a.month));
}

/** Granițele lunii (ISO UTC, half-open: [start, end)). */
export function monthBounds(ym: string): { startIso: string; endIso: string } {
  const start = new Date(`${ym}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Etichetă lună prietenoasă (ex „iunie 2026"). */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1));
  return date.toLocaleDateString("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });
}
