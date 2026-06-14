import { SESIZARE_TIPURI, PETITIE_CATEGORII } from "@/lib/constants";

/**
 * Chaining petiție↔sesizare (Faza 1) — mapping bidirecțional, FĂRĂ AI, fără DB.
 * Single source of truth pentru cardurile „Următorul pas" la momentul de
 * intenție maximă:
 *   • după ce semnezi o petiție națională → „fă o sesizare locală pe temă"
 *   • după ce trimiți o sesizare → „semnează o petiție pe aceeași temă"
 *
 * Maparea e ASIMETRICĂ intenționat: 22 tipuri de sesizare (probleme intrinsec
 * LOCALE) → 14 categorii de petiție (teme adesea NAȚIONALE). Multe tipuri de
 * sesizare se grupează într-o categorie (many-to-one); invers, unele categorii
 * de petiție (Justiție, Economie, Educație…) NU au o acțiune locală echivalentă
 * → întorc null și cardul se ascunde. E o decizie de PRODUS, ușor de ajustat
 * aici, înghețată de chaining.test.ts.
 */

const VALID_CATEGORII = new Set<string>(PETITIE_CATEGORII.map((c) => c.value));
const VALID_TIPURI = new Set<string>(SESIZARE_TIPURI.map((t) => t.value));

/**
 * DIRECȚIA B (sesizare → petiție): tipul sesizării → categoria de petiție.
 * Acoperă TOATE valorile din SESIZARE_TIPURI (active + deprecated + „altele").
 * `null` = nu mapăm (temă fără petiție-corespondent) → card ascuns.
 */
export const SESIZARE_TIP_TO_CATEGORIE: Record<string, string | null> = {
  groapa: "Locuințe",
  trotuar: "Locuințe",
  iluminat: "Siguranță",
  copac: "Mediu",
  gunoi: "Mediu",
  parcare: "Transport",
  amenajare_parcare: "Transport",
  stalpisori: "Transport",
  canalizare: "Mediu",
  semafor: "Transport",
  graffiti: "Siguranță",
  mobilier: "Locuințe",
  transport: "Transport",
  afisaj: "Locuințe",
  banda_transport: "Transport",
  trecere_pietoni: "Transport",
  rampa_acces: "Drepturi", // accesibilitate = drepturile persoanelor cu dizabilități
  colectare_selectiva: "Mediu",
  fumat_interzis: "Sănătate",
  // DEPRECATED (nu apar în form, dar sesizările istorice le pot avea)
  pietonal: "Transport",
  zgomot: "Sănătate",
  animale: "Animale",
  // FALLBACK generic — nu se poate mapa la o singură temă.
  altele: null,
};

/**
 * DIRECȚIA A (petiție → sesizare): categoria petiției → tipul de sesizare
 * locală relevant + un „pitch" scurt. Acoperă TOATE cele 14 PETITIE_CATEGORII.
 * `null` = temă pur națională, fără acțiune locală → card ascuns.
 */
export const PETITIE_CATEGORIE_TO_SESIZARE: Record<
  string,
  { tip: string; pitch: string } | null
> = {
  Mediu: {
    tip: "copac",
    pitch: "Vezi un copac tăiat, gunoi pe spațiul verde sau altă problemă de mediu în cartierul tău?",
  },
  Transport: {
    tip: "transport",
    pitch: "Bandă de autobuz blocată, semafor stricat sau altă problemă de transport în zona ta?",
  },
  Sănătate: {
    tip: "fumat_interzis",
    pitch: "Fumat în locuri interzise, gunoi insalubru sau altă problemă de sănătate publică lângă tine?",
  },
  Drepturi: {
    tip: "rampa_acces",
    pitch: "Lipsă rampă de acces sau trotuar inaccesibil — semnalează o barieră pentru persoanele cu dizabilități în orașul tău?",
  },
  Locuințe: {
    tip: "trotuar",
    pitch: "Trotuar degradat, mobilier stradal stricat sau altă problemă de urbanism în cartierul tău?",
  },
  Siguranță: {
    tip: "iluminat",
    pitch: "Iluminat stricat, parcare ilegală sau altă problemă de siguranță în zona ta?",
  },
  Cultură: {
    tip: "graffiti",
    pitch: "Vandalism, clădire istorică degradată sau afișaj ilegal pe patrimoniu în orașul tău?",
  },
  Animale: {
    tip: "animale",
    pitch: "Vezi animale fără stăpân sau abuzate în zona ta? Semnalează autorităților locale.",
  },
  // Teme pur naționale — fără acțiune locală concretă → card ascuns.
  Educație: null,
  Justiție: null,
  Tehnologie: null,
  Egalitate: null,
  Economie: null,
  Altele: null,
};

/** sesizare.tip → categoria de petiție (sau null). */
export function sesizareToPetitieCategorie(tip: string | null | undefined): string | null {
  if (!tip) return null;
  const cat = SESIZARE_TIP_TO_CATEGORIE[tip];
  return cat && VALID_CATEGORII.has(cat) ? cat : null;
}

/** petiție.category → { tip, pitch } pentru sesizarea locală (sau null). */
export function petitieToSesizareTip(
  category: string | null | undefined,
): { tip: string; pitch: string } | null {
  if (!category) return null;
  const mapped = PETITIE_CATEGORIE_TO_SESIZARE[category];
  if (!mapped) return null;
  return VALID_TIPURI.has(mapped.tip) ? mapped : null;
}
