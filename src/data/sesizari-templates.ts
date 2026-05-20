/**
 * F7 Sesizari Templates — pre-made 10 common cazuri pentru one-click start.
 *
 * Click pe template → form pre-completed cu tip + descriere generic.
 * User editează doar locația, foto, detalii specifice. Reduce timpul
 * de la 90s → 30s.
 *
 * Folosit pe /sesizari hero section (deasupra form).
 */

export interface SesizareTemplate {
  id: string;
  emoji: string;
  label: string;
  tip: string;
  descriere: string;
  /** Hint pentru locație — text afișat ca placeholder. */
  locatieHint?: string;
  /** Tag pentru filtering — „parcare" / „infrastructura" / „spatiu-verde". */
  category: "parcare" | "infrastructura" | "spatiu-verde" | "siguranta" | "civic";
}

export const SESIZARI_TEMPLATES: SesizareTemplate[] = [
  {
    id: "groapa-asfalt",
    emoji: "🕳️",
    label: "Groapă în asfalt",
    tip: "groapa",
    descriere:
      "Există o groapă în asfalt care reprezintă un risc pentru circulație (mașini, biciclete) și pietoni. Necesită reparație urgentă.",
    locatieHint: "Str./Bd. ... nr. ...",
    category: "infrastructura",
  },
  {
    id: "trotuar-blocat",
    emoji: "🚗",
    label: "Mașini parcate pe trotuar",
    tip: "trotuar",
    descriere:
      "Mașini parcate ilegal pe trotuar blochează circulația pietonilor (inclusiv persoane cu mobilitate redusă, părinți cu cărucioare). Solicit montarea de stâlpișori anti-parcare și sancțiuni pentru contraveniențe.",
    locatieHint: "Str./Bd. ... unde se parchează ilegal",
    category: "parcare",
  },
  {
    id: "stalpisori-lipsa",
    emoji: "🚧",
    label: "Stâlpișori anti-parcare lipsă",
    tip: "stalpisori",
    descriere:
      "Trotuarul/spațiul pietonal de pe această stradă este sistematic ocupat de mașini parcate ilegal. Lipsește delimitarea fizică între carosabil și pietonal. Solicit montarea de stâlpișori sau alte măsuri fizice anti-parcare.",
    locatieHint: "Str./Bd. ...",
    category: "parcare",
  },
  {
    id: "iluminat-stricat",
    emoji: "💡",
    label: "Iluminat public stricat",
    tip: "iluminat",
    descriere:
      "Iluminatul public din această zonă este stricat (becuri arse, stâlpi nefuncționali). Zona devine periculoasă noaptea pentru pietoni și bicicliști. Solicit înlocuirea becurilor și verificarea instalației.",
    locatieHint: "Str./Bd. ... între intersecțiile ...",
    category: "siguranta",
  },
  {
    id: "gunoi-nestos",
    emoji: "🗑️",
    label: "Container gunoi nescos / supraplin",
    tip: "gunoi",
    descriere:
      "Containerele de gunoi din această zonă sunt supraplin sau nu au fost ridicate la termenul stabilit. Pubelele revarsă deșeurile în jur, creând disconfort și risc sanitar.",
    locatieHint: "Str./Bd. ...",
    category: "spatiu-verde",
  },
  {
    id: "copac-pericol",
    emoji: "🌳",
    label: "Copac uscat / cu risc de cădere",
    tip: "copac",
    descriere:
      "Există un copac uscat sau cu crengi rupte / instabile care reprezintă risc pentru pietoni, mașini parcate dedesubt sau imobile din apropiere. Necesită evaluare urgentă de către un specialist.",
    locatieHint: "Str./Bd. ... în dreptul nr. ...",
    category: "spatiu-verde",
  },
  {
    id: "semafor-stricat",
    emoji: "🚦",
    label: "Semafor stricat / nefuncțional",
    tip: "semafor",
    descriere:
      "Semaforul din această intersecție este stricat / cu lumini blocate / cu temporizare neoptimizată. Creează risc de accidente. Solicit verificare urgentă.",
    locatieHint: "Intersecția ... cu ...",
    category: "siguranta",
  },
  {
    id: "trecere-pietoni",
    emoji: "🚸",
    label: "Trecere pietoni cu vizibilitate redusă",
    tip: "pietonal",
    descriere:
      "Trecerea de pietoni din această zonă are vizibilitate redusă (lipsă marcaje, lipsă semnalizare, mașini parcate care obstrucționează vederea). Risc major de accidente cu pietoni.",
    locatieHint: "Trecerea de pe Str./Bd. ...",
    category: "siguranta",
  },
  {
    id: "graffiti-vandalism",
    emoji: "🎨",
    label: "Graffiti / vandalism",
    tip: "graffiti",
    descriere:
      "Există graffiti / acte de vandalism pe spațiu public sau privat în această zonă. Necesită curățire și măsuri de prevenire.",
    locatieHint: "Str./Bd. ...",
    category: "civic",
  },
  {
    id: "banda-blocata",
    emoji: "🚌",
    label: "Bandă autobuz / pistă bici blocată",
    tip: "transport",
    descriere:
      "Banda dedicată autobuzului / pista de bicicleți din această zonă este sistematic blocată de mașini parcate ilegal. Întârzie transportul public și pune în pericol bicicliștii.",
    locatieHint: "Str./Bd. ...",
    category: "parcare",
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: "parcare", label: "Parcare", emoji: "🚗" },
  { id: "infrastructura", label: "Infrastructură", emoji: "🚧" },
  { id: "spatiu-verde", label: "Spațiu verde / Curățenie", emoji: "🌳" },
  { id: "siguranta", label: "Siguranță", emoji: "⚠️" },
  { id: "civic", label: "Civic", emoji: "🏛️" },
] as const;
