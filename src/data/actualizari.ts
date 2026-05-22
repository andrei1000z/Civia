/**
 * Istoricul actualizărilor Civia — afișat la /actualizari.
 *
 * Plan 5/23/2026 — pagină publică cu changelog uman, nu commit log.
 * Fiecare entry are versiune semver, dată, titlu sumar, 3-8 bullet-uri
 * concise, opțional categorie (feature/fix/security/perf/ux).
 *
 * Format dată: ISO 8601 (YYYY-MM-DD) — sortat descrescător la display.
 * Cea mai recentă apare prima.
 */

export type ActualizareCategorie = "feature" | "fix" | "security" | "perf" | "ux" | "release";

export interface ActualizareSchimbare {
  /** Una din categoriile de mai sus — folosit pentru badge color */
  categorie: ActualizareCategorie;
  /** Text scurt (max ~120 chars) — descrierea unei singure schimbări */
  text: string;
}

export interface Actualizare {
  /** Semver — ex: "0.0.0" */
  versiune: string;
  /** ISO date (YYYY-MM-DD) — ziua release-ului */
  data: string;
  /** Titlu scurt pentru release — apare ca H2 pe pagina */
  titlu: string;
  /** Descriere opțională de 1-2 propoziții pentru context */
  descriere?: string;
  /** Lista schimbărilor cu categorie + text */
  schimbari: ActualizareSchimbare[];
  /** True pentru release-uri majore (afișate cu styling diferit) */
  major?: boolean;
}

/**
 * ⚠️ ADAUGĂ NOI VERSIUNI ÎN VÂRFUL LISTEI (cea mai recentă prima).
 */
export const ACTUALIZARI: Actualizare[] = [
  {
    versiune: "0.0.0",
    data: "2026-05-23",
    titlu: "Civia se naște",
    descriere:
      "Prima versiune publică Civia — platforma civică pentru România. Sesizări către primării cu AI, conform OG 27/2002.",
    major: true,
    schimbari: [
      { categorie: "release", text: "Lansare publică Civia.ro — versiune pre-alpha" },
      { categorie: "feature", text: "Sesizări civice cu AI: formulare formală automată conform OG 27/2002" },
      { categorie: "feature", text: "Trimitere directă prin sesizari@civia.ro — fără mailto, fără atașări manuale" },
      { categorie: "feature", text: "AI Vision detectează tipul sesizării din poză (Llama 4 Scout 17B)" },
      { categorie: "feature", text: "Co-trimitere: alți cetățeni pot adăuga numele lor la sesizare" },
      { categorie: "feature", text: "Webhook Resend pentru tracking livrare email (delivered/bounced/complained)" },
      { categorie: "feature", text: "20 pagini per stradă populară pentru SEO local (Iancului, Morarilor, Pantelimon, etc.)" },
      { categorie: "feature", text: "30 pagini per oraș + 15 ghiduri /cum-fac/[tip] + Glosar civic cu 50 termeni" },
      { categorie: "feature", text: "Avocatul Poporului online + Drepturile cetățeanului + Statistici sesizări România" },
      { categorie: "feature", text: "Newsletter săptămânal cu nudge la 30s pe /sesizari-publice" },
      { categorie: "feature", text: "PWA installabil cu push notifications native + camera 1-tap + funcționare offline" },
      { categorie: "ux", text: "Mod dark unic — interfață emerald + cyan, design system Liquid Civic" },
      { categorie: "ux", text: `Categorii AI custom afișate (ex: „Copaci netoaletați") în loc de „Altele"` },
      { categorie: "perf", text: "CLS 0.28 → 0.05 (Core Web Vitals pass) + font-display optional" },
      { categorie: "perf", text: "Funnel sesizare: tip nu mai blochează submit + auto-detect din vision" },
      { categorie: "security", text: "PII redaction în Sentry + prompt injection block + per-user AI quota" },
      { categorie: "security", text: `Anti-minimization regex pe AI output (no „rămâne spațiu de trecere")` },
      { categorie: "fix", text: "Background fix: scoase gradient-uri care lăsau zone negre pe ecran" },
      { categorie: "fix", text: "Send hardening: ghost sends detectate + buton retrimitere automat" },
    ],
  },
];

/**
 * Helper — returnează entry-ul curent (cel mai recent) pentru afișare
 * în header sau pe pagina principală.
 */
export function getLatestActualizare(): Actualizare | null {
  return ACTUALIZARI[0] ?? null;
}

/**
 * Mapare categorie → metadata vizual (label RO + culoare badge).
 */
export const CATEGORIE_META: Record<ActualizareCategorie, { label: string; color: string; bg: string }> = {
  release: { label: "Lansare", color: "#7C3AED", bg: "#7C3AED1a" },
  feature: { label: "Funcție nouă", color: "#059669", bg: "#0596691a" },
  fix: { label: "Reparare bug", color: "#0891B2", bg: "#0891B21a" },
  ux: { label: "UX / Design", color: "#EC4899", bg: "#EC48991a" },
  perf: { label: "Performanță", color: "#F59E0B", bg: "#F59E0B1a" },
  security: { label: "Securitate", color: "#DC2626", bg: "#DC26261a" },
};
