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
  /** ISO datetime — ex: "2026-05-23T12:50:00+03:00" (oră Romania).
   *  Folosit pentru afișare „23 mai 2026, 12:50" pe pagină. */
  data: string;
  /** Titlu scurt pentru release — apare ca H2 pe pagina */
  titlu: string;
  /** Descriere opțională (suport Markdown: **bold**, *italic*, etc.) */
  descriere?: string;
  /** Lista schimbărilor cu categorie + text */
  schimbari: ActualizareSchimbare[];
  /** True pentru release-uri majore (afișate cu styling diferit) */
  major?: boolean;
  /** 5/23/2026 — flag pentru render minimalist (DOAR pentru v0.0.0):
   *  card centrat cu versiunea + descriere lungă în Markdown jos.
   *  NU listează schimbări — pentru genesis release. */
  minimalist?: boolean;
  /** Markdown content lung pentru cazul minimalist (în loc de schimbari).
   *  Suportă: **bold**, *italic*, # heading, - listă, [link](url),
   *  `cod`, ![imagine](url). */
  continutMarkdown?: string;
}

/**
 * ⚠️ ADAUGĂ NOI VERSIUNI ÎN VÂRFUL LISTEI (cea mai recentă prima).
 */
export const ACTUALIZARI: Actualizare[] = [
  {
    versiune: "0.0.0",
    data: "2026-05-23T12:50:00+03:00",
    titlu: "Civia se naște",
    minimalist: true,
    schimbari: [],
    continutMarkdown: `**Civia** este o platformă civică independentă pentru România.

Cetățenii pot trimite **sesizări oficiale** către primării, prefecturi, Poliția Locală sau CNAIR în **90 de secunde**, conform legii **OG 27/2002**.

### Ce face Civia chiar acum:

- 📸 **Camera AI** — fotografiezi problema, iar inteligența artificială detectează automat tipul (groapă, parcare ilegală, gunoi, semafor defect, etc.) și autoritatea competentă din locație
- ✍️ **AI scrie textul formal** cu temei legal românesc (Llama 3.3 70B) — tu doar revizuiești și apeși *Trimite*
- 📬 **Trimitere directă** prin \`sesizari@civia.ro\` — fără mailto, fără atașări manuale, pozele pleacă automat la primărie
- 🔔 **Urmărire automată** — când primăria răspunde, AI clasifică răspunsul și te notifică
- 🤝 **Co-trimitere** — alți cetățeni pot apăsa *Trimite și tu* cu identitatea lor, crescând presiunea publică
- 🗺️ **Acoperire națională** — 42 județe + 6 sectoare București + 220 orașe + 1500 autorități indexate
- 🤖 **Civic Assistant** — chatbot AI care răspunde la întrebări despre drepturile tale civice
- 📚 **Conținut educațional** — Glosar cu 50 termeni, ghiduri /cum-fac/[tip], drepturile cetățeanului, OG 27/2002 explicat
- 📊 **Date deschise** — statistici live, API public CC BY 4.0 pentru jurnaliști și cercetători
- 📱 **PWA installabil** — funcționează offline, push notifications native, camera 1-tap

Civia este **gratuită**, **fără reclame** și **open-source**. Misiunea: democratizarea informației civice în România.`,
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
