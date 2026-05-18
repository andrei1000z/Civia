/**
 * Sanitizare post-AI pentru formal_text sesizare.
 *
 * Problemă: AI-ul (chiar cu prompt updated) emite uneori claims subjective
 * gen „în dreptul domiciliului meu" / „în fața casei mele". Astea sunt
 * BUG-uri pentru ca:
 *
 *  1. Co-semnatarii reutilizeaza textul — ei nu locuiesc neaparat acolo.
 *  2. Sunt frecvent gramatical gresite („în dreptul domiciliu meu" lipsa
 *     articol).
 *  3. Suna ca un cetatean defensiv, nu civic.
 *
 * Functia aplica replace-uri sigure: pattern subjective -> referire la
 * locatie obiectiva (daca o avem) sau drop complet daca pasarea naturala
 * la urmatoarea propoziție ramane corecta gramatical.
 *
 * Apelat IMEDIAT după AI completion, INAINTE de save in DB.
 */

export interface ObjectifyContext {
  /** Locația obiectivă din formular (ex: „Șoseaua Pantelimon nr. 300"). */
  locatie?: string | null;
  /** Adresa de domiciliu a cetateanului (ex: „Strada Novaci 12, Sector 5").
   *  Folosita pentru a detecta cazul de match EXACT cu locatia. */
  adresaCetatean?: string | null;
}

/**
 * Pattern-uri subjective de eliminat. Ordine importanta: cele lungi
 * primele ca sa nu fie partial-matched de cele scurte.
 */
const SUBJECTIVE_PATTERNS: Array<{ pattern: RegExp; objectiveReplacement: (loc: string | null) => string }> = [
  // Cazul 1: „in dreptul meu domiciliu" (word order gresit emis ocazional de model)
  {
    pattern: /în\s+dreptul\s+meu\s+domiciliu(?:lui)?/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în zona indicată"),
  },
  // Cazul 2: „in dreptul domiciliu(lui) meu" (incl. forma gramatical gresita fara „l")
  {
    pattern: /în\s+dreptul\s+domiciliu(?:lui)?\s+meu/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în zona indicată"),
  },
  // Cazul 3: „in dreptul meu" cu sensul de locatie (urmat de spatiu/punctuatie)
  {
    pattern: /în\s+dreptul\s+meu(?=[\s,.])/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în zona indicată"),
  },
  // Cazul 4: „in fata casei/blocului/apartamentului/locuintei mele/meu"
  {
    pattern: /în\s+fața\s+(?:casei?\s+mele|blocului?\s+meu|apartamentului?\s+meu|locuinței?\s+mele)/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în zona indicată"),
  },
  // Cazul 5: „langa casa/blocul mea/meu" / „langa mine"
  {
    pattern: /lângă\s+(?:casa\s+mea|blocul\s+meu|mine)/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în zona indicată"),
  },
  // Cazul 6: „pe strada mea" / „in cartierul meu" / „in vecinatatea/zona mea"
  {
    pattern: /(?:pe\s+strada\s+mea|în\s+cartierul\s+meu|în\s+vecinătatea\s+mea|în\s+zona\s+mea)/gi,
    objectiveReplacement: (loc) => (loc ? `pe ${loc}` : "în această zonă"),
  },
  // Cazul 7: „blocul meu" / „casa mea" / „locuinta mea" — referiri scurte
  {
    pattern: /(?:blocul\s+meu|casa\s+mea|locuința\s+mea)/gi,
    objectiveReplacement: () => "blocul indicat",
  },
];

/**
 * Cazul EXCEPTIE legitima: locatia problemei coincide LITERAL cu domiciliul.
 * Cetateanul ORIGINAL e indreptatit sa spuna „în fața blocului meu".
 * Detectam prin substring match insensibil la diacritice.
 */
function locationMatchesHome(locatie: string | null | undefined, adresa: string | null | undefined): boolean {
  if (!locatie || !adresa) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[.,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const locTokens = norm(locatie).split(" ").filter((t) => /\d/.test(t)); // numere de stradă
  const homeTokens = norm(adresa).split(" ").filter((t) => /\d/.test(t));
  if (locTokens.length === 0 || homeTokens.length === 0) return false;
  // Match daca cel putin un numar coincide AND cuvinte non-numerice >=2 se intersecteaza.
  const numberMatch = locTokens.some((t) => homeTokens.includes(t));
  if (!numberMatch) return false;
  const locWords = norm(locatie).split(" ").filter((w) => w.length > 3 && !/^\d/.test(w));
  const homeWords = norm(adresa).split(" ").filter((w) => w.length > 3 && !/^\d/.test(w));
  const overlap = locWords.filter((w) => homeWords.includes(w)).length;
  return overlap >= 2;
}

/**
 * Aplica toate replace-urile. Returneaza textul curățat.
 * Pe locationMatchesHome true, lasa textul neschimbat (cetatean original
 * cu drept legitim sa zica „blocul meu").
 */
export function objectifyFormalText(
  formalText: string,
  ctx: ObjectifyContext = {},
): { text: string; changed: boolean; replacements: number } {
  if (!formalText) return { text: formalText, changed: false, replacements: 0 };

  // Cazul exceptie: cetatean cu domiciliu = locatie. Skip sanitizare.
  if (locationMatchesHome(ctx.locatie, ctx.adresaCetatean)) {
    return { text: formalText, changed: false, replacements: 0 };
  }

  let result = formalText;
  let replacements = 0;
  for (const { pattern, objectiveReplacement } of SUBJECTIVE_PATTERNS) {
    result = result.replace(pattern, () => {
      replacements += 1;
      return objectiveReplacement(ctx.locatie ?? null);
    });
  }

  // Cleanup gramatical comun după replace: dubla prepozitie „pe pe", „la la",
  // virgula dubla, spatiu dublu.
  result = result
    .replace(/\bpe pe\b/gi, "pe")
    .replace(/\bla la\b/gi, "la")
    .replace(/\bîn în\b/gi, "în")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1");

  return { text: result, changed: replacements > 0, replacements };
}
