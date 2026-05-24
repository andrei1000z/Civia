/**
 * Template DETERMINIST pentru textul formal al sesizărilor.
 *
 * User a cerut explicit (2026-05-24): „DA UN MODEL SIMPLU SI GATA".
 * NU mai AI cu reguli peste reguli. Pur template cu substituții.
 *
 * Structură fixă:
 *   1. „Bună ziua,"
 *   2. „Mă numesc {nume}, locuiesc în {adresa} și doresc să vă aduc la
 *       cunoștință o problemă care afectează {affects} pe {locatie}.
 *       {problem}." — dacă lipsește numele/adresa, omitem partea „Mă
 *       numesc..."
 *   3. „Pentru a rezolva această situație, vă solicit respectuos să luați
 *       următoarele măsuri:" + listă numerotată din TIP_DATA[tip].actions
 *   4. Dacă hasPhotos: „În sprijinul acestei sesizări, am atașat imagini
 *       care ilustrează situația actuală. Acestea evidențiază {evidence}."
 *   5. „De asemenea, vă rog să îmi furnizați un număr de înregistrare ...
 *       conform OG 27/2002 ..."
 *   6. „Vă mulțumesc anticipat ..."
 *   7. Clauză GDPR (Regulament UE 2016/679, art. 5)
 *   8. „Cu stimă,\n{nume}\n{data}"
 *
 * Substituții simple. Zero AI. Zero variabilitate. Acelaşi tip + aceeași
 * locație → același text (cu excepţia datei + nume/adresa user).
 */

import type { TipTemplate } from "@/lib/groq/templates";
import { TEMPLATES } from "@/lib/groq/templates";

/** Date suplimentare per tip — adăugate pentru template-ul determinist.
 *  Separate de TEMPLATES (care e folosit ca AI hint legacy) ca să rămână
 *  compatibilitate cu codul existent. */
interface TipData {
  /** Ce afectează problema. Ex: „siguranța pietonilor", „siguranța rutieră". */
  affects: string;
  /** Descrierea concisă (1 propoziție) a problemei. Ex: „mașini parcate
   *  ilegal pe trotuar restricționează spațiul destinat pietonilor". */
  problem: string;
  /** Acțiuni propuse (fără prefix „1." — adăugat la generare). 1-3 acțiuni. */
  actions: string[];
  /** Text pentru paragraful cu poze: „Acestea evidențiază {evidence}." */
  evidence: string;
}

const TIP_DATA: Record<string, TipData> = {
  parcare: {
    affects: "siguranța pietonilor",
    problem: "mai multe autovehicule sunt parcate ilegal, restricționând spațiul destinat pietonilor și punând în pericol siguranța acestora",
    actions: [
      "Intervenția Poliției Locale pentru sancționarea șoferilor conform art. 108 alin. (1) lit. b) pct. 1 din OUG 195/2002 (amendă clasa a II-a, 810-1012,5 lei) și ridicarea vehiculelor parcate pe trotuar.",
      "Verificarea periodică a zonei pentru prevenirea parcării ilegale, conform art. 144 din HG 1391/2006.",
    ],
    evidence: "prezența mașinilor parcate ilegal",
  },
  stalpisori: {
    affects: "siguranța pietonilor",
    problem: "lipsa elementelor de protecție (stâlpișori anti-parcare) permite parcarea pe trotuar și pune în pericol pietonii, contrar art. 144 din HG 1391/2006 care prevede o lățime minimă de 1 metru liber pentru pietoni",
    actions: [
      "Montarea de stâlpișori anti-parcare pentru a delimita carosabilul de trotuar.",
      "Verificarea zonei și planificarea unui număr suficient de stâlpișori pentru tot tronsonul afectat.",
      "Până la montare, intervenția Poliției Locale pentru sancționarea șoferilor conform art. 108 alin. (1) lit. b) pct. 1 din OUG 195/2002 (amendă 810-1012,5 lei + ridicare).",
    ],
    evidence: "lipsa stâlpișorilor și parcarea pe trotuar",
  },
  groapa: {
    affects: "siguranța rutieră",
    problem: "există o groapă în carosabil care reprezintă pericol pentru șoferi, bicicliști și pietoni",
    actions: [
      "Plombarea gropii cu mixtură asfaltică la cald și nivelarea suprafeței.",
      "Verificarea integrității carosabilului în zonă și remedierea altor degradări vizibile.",
    ],
    evidence: "groapa din carosabil",
  },
  trotuar: {
    affects: "siguranța pietonilor",
    problem: "trotuarul este degradat sau ocupat de autoturisme parcate ilegal, punând în pericol trecătorii — situație contrară art. 144 din HG 1391/2006 (Regulamentul de aplicare a Codului Rutier)",
    actions: [
      "Reabilitarea pavajului trotuarului în zona afectată (plăci sparte, borduri lipsă, denivelări).",
      "Intervenția Poliției Locale pentru sancționarea șoferilor care parchează ilegal pe trotuar, conform art. 108 alin. (1) lit. b) pct. 1 din OUG 195/2002 (amendă 810-1012,5 lei + ridicare).",
    ],
    evidence: "starea degradată a trotuarului și/sau prezența mașinilor parcate ilegal",
  },
  iluminat: {
    affects: "siguranța în zonă",
    problem: "iluminatul public este defect, creând zone întunecate și crescând riscul de accidente și infracțiuni",
    actions: [
      "Înlocuirea corpurilor de iluminat defecte.",
      "Verificarea rețelei electrice și remedierea cauzei avariei.",
    ],
    evidence: "absența iluminatului funcțional",
  },
  copac: {
    affects: "siguranța pietonilor și a vehiculelor",
    problem: "există un copac cu ramuri uscate sau instabile care reprezintă pericol real de cădere",
    actions: [
      "Toaletarea urgentă a copacului sau, după caz, defrișarea lui în condiții de siguranță.",
      "Verificarea celorlalți copaci din zonă pentru identificarea altor exemplare cu risc.",
    ],
    evidence: "starea copacului afectat",
  },
  gunoi: {
    affects: "salubritatea zonei",
    problem: "tomberoanele sunt supraîncărcate sau gunoiul e împrăștiat, generând disconfort și risc sanitar pentru locuitori",
    actions: [
      "Ridicarea urgentă a deșeurilor din zonă.",
      "Revizuirea programului de colectare pentru a corespunde nevoilor cartierului.",
    ],
    evidence: "starea de salubrizare a zonei",
  },
  canalizare: {
    affects: "siguranța și salubritatea zonei",
    problem: "există probleme la rețeaua de canalizare (capac lipsă, gură de scurgere înfundată, inundație) care afectează locuitorii",
    actions: [
      "Verificarea și desfundarea sistemului de canalizare.",
      "Înlocuirea capacelor lipsă și remedierea cauzei inundațiilor.",
    ],
    evidence: "starea sistemului de canalizare",
  },
  semafor: {
    affects: "siguranța rutieră",
    problem: "sistemul de semaforizare sau semnalizare rutieră este defect, afectând fluiditatea traficului și siguranța pietonilor",
    actions: [
      "Repararea urgentă a semaforului sau a indicatorului defect.",
      "Sincronizarea cu traficul din zonă după repunerea în funcțiune.",
    ],
    evidence: "defectarea semafoarelor sau indicatoarelor",
  },
  pietonal: {
    affects: "siguranța pietonilor",
    problem: "există o traversare de pietoni periculoasă (marcaj șters, fără semaforizare sau rampă) unde riscul de accident e ridicat",
    actions: [
      "Refacerea marcajului rutier la trecere.",
      "Montarea unui semafor cu buton sau a unei rampe accesibilizate, după caz.",
    ],
    evidence: "starea trecerii de pietoni",
  },
  graffiti: {
    affects: "imaginea publică a zonei",
    problem: "există acte de vandalism (graffiti / inscripții) care degradează aspectul clădirilor sau monumentelor",
    actions: [
      "Curățarea suprafețelor afectate.",
      "Dacă e posibil, identificarea autorilor pentru aplicarea de sancțiuni.",
    ],
    evidence: "graffiti-urile sau inscripțiile vandalice",
  },
  mobilier: {
    affects: "confortul locuitorilor",
    problem: "mobilierul stradal (bănci, coșuri de gunoi, stații) este deteriorat sau vandalizat",
    actions: [
      "Înlocuirea mobilierului stradal afectat în regim de urgență.",
      "Verificarea periodică a stării mobilierului din zonă.",
    ],
    evidence: "starea mobilierului stradal",
  },
  zgomot: {
    affects: "liniștea publică",
    problem: "există zgomote excesive care depășesc limitele legale conform Ordinului 119/2014, afectând odihna locuitorilor",
    actions: [
      "Intervenția Poliției Locale pentru verificarea respectării programului de liniște publică.",
      "Aplicarea de sancțiuni conform legii dacă se confirmă încălcarea.",
    ],
    evidence: "sursa zgomotului semnalat",
  },
  animale: {
    affects: "siguranța locuitorilor",
    problem: "în zonă există câini comunitari agresivi sau haite care pun în pericol trecătorii, în special copiii",
    actions: [
      "Intervenția ASAU pentru prinderea animalelor.",
      "Evaluarea stării lor și plasarea într-un adăpost specializat.",
    ],
    evidence: "prezența câinilor comunitari",
  },
  transport: {
    affects: "calitatea transportului public",
    problem: "există o problemă la transportul public (întârzieri, vehicule nefuncționale, stații deteriorate sau linii suprasolicitate)",
    actions: [
      "Analiza STB / Metrorex și ajustarea programului.",
      "Înlocuirea vehiculelor defecte sau remedierea stației deteriorate.",
    ],
    evidence: "starea transportului public în zonă",
  },
  afisaj: {
    affects: "aspectul domeniului public",
    problem: "există afișaj sau publicitate ilegală (afișe pe stâlpi, bannere, panouri neavizate) care încalcă Legea 185/2013",
    actions: [
      "Constatarea contravenției de către Poliția Locală și identificarea beneficiarilor.",
      "Înlăturarea materialelor publicitare ilegale în regim de urgență.",
    ],
    evidence: "afișele și panourile publicitare neautorizate",
  },
  banda_transport: {
    affects: "calitatea transportului public",
    problem: "lipsa unei benzi dedicate transportului public îngreunează deplasarea autobuzelor și descurajează folosirea transportului în comun",
    actions: [
      "Analiza necesității unei benzi dedicate transportului public.",
      "Amenajarea benzii cu marcaj rutier și semnalizare adecvată conform standardelor europene.",
    ],
    evidence: "configurația actuală a străzii fără bandă dedicată",
  },
  trecere_pietoni: {
    affects: "siguranța pietonilor",
    problem: "în zonă lipsește o trecere de pietoni amenajată, obligându-i pe pietoni să traverseze prin loc nepermis",
    actions: [
      "Amenajarea unei treceri de pietoni cu marcaj rutier și indicatoare.",
      "Dacă e cazul, instalarea semaforizării sau iluminării suplimentare.",
    ],
    evidence: "lipsa trecerii de pietoni amenajate",
  },
  rampa_acces: {
    affects: "accesibilitatea persoanelor cu mobilitate redusă",
    problem: "lipsesc rampele de acces pentru persoane cu mobilitate redusă (cărucioare, scaune cu rotile), contrar Legii 448/2006",
    actions: [
      "Amenajarea unei rampe de acces conform standardelor de accesibilitate.",
      "Verificarea altor puncte din zonă unde rampele lipsesc.",
    ],
    evidence: "lipsa rampei de acces",
  },
  colectare_selectiva: {
    affects: "respectarea legislației de mediu",
    problem: "lipsește infrastructura de colectare selectivă a deșeurilor (containere separate pentru hârtie, plastic, sticlă), contrar Legii 211/2011",
    actions: [
      "Amplasarea de containere de colectare selectivă în zona indicată.",
      "Informarea cetățenilor cu privire la programul și regulile de colectare.",
    ],
    evidence: "absența infrastructurii de colectare selectivă",
  },
  fumat_interzis: {
    affects: "respectarea Legii 15/2016",
    problem: "se fumează în spațiu public unde fumatul este interzis (stații de transport, scări de bloc, locuri de joacă, etc.)",
    actions: [
      "Control al Poliției Locale în zona indicată.",
      `Instalarea de plăcuțe „Fumatul interzis" vizibile.`,
    ],
    evidence: "fumatul în zona indicată",
  },
  altele: {
    affects: "buna funcționare a zonei",
    problem: "există o situație care necesită intervenția autorităților locale",
    actions: [
      "Verificarea situației la fața locului.",
      "Luarea măsurilor corespunzătoare conform competențelor instituției.",
    ],
    evidence: "situația semnalată",
  },
};

const LUNI_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

export function formatDateRo(date: Date = new Date()): string {
  return `${date.getDate()} ${LUNI_RO[date.getMonth()]} ${date.getFullYear()}`;
}

export interface GenerateFormalTextArgs {
  /** Tip-ul sesizării — match cu cheile din TIP_DATA / TEMPLATES. */
  tip: string;
  /** Locația problemei (stradă, sector, oraș). Ex: „Strada X nr. 7, Sector 6, București". */
  locatie: string;
  /** Numele cetățeanului (opțional — dacă lipsește, omitem fraza „Mă numesc..."). */
  nume?: string | null;
  /** Adresa cetățeanului (opțional — dacă lipsește, omitem fraza „Mă numesc..."). */
  adresa?: string | null;
  /** Are sesizarea poze atașate? Dacă da, includem paragraful cu „În sprijinul ..." */
  hasPhotos?: boolean;
  /** Data trimiterii — default azi. Pentru backfill, folosim data inițială a sesizării. */
  date?: Date;
}

/** Generează textul formal DETERMINIST. Zero AI. */
export function generateFormalText(args: GenerateFormalTextArgs): string {
  const tipData = TIP_DATA[args.tip] ?? TIP_DATA["altele"]!;
  const date = args.date ?? new Date();
  const dataRo = formatDateRo(date);
  const nume = args.nume?.trim() || "";
  const adresa = args.adresa?.trim() || "";
  const locatie = args.locatie?.trim() || "în zona semnalată";

  // Paragraf 1 — intro + identitate. 3 variante:
  //  a) Avem ȘI nume ȘI adresa → „Mă numesc X, locuiesc în Y și doresc..."
  //  b) Avem doar nume → „Mă numesc X și doresc..."
  //  c) N-avem nici nume, nici adresa → „Doresc să vă aduc la cunoștință..."
  const introBody = `doresc să vă aduc la cunoștință o problemă care afectează ${tipData.affects} pe ${locatie}. În prezent, ${tipData.problem}.`;
  let intro: string;
  if (nume.length > 0 && adresa.length > 0) {
    intro = `Mă numesc ${nume}, locuiesc în ${adresa} și ${introBody}`;
  } else if (nume.length > 0) {
    intro = `Mă numesc ${nume} și ${introBody}`;
  } else {
    intro = `D${introBody.slice(1)}`; // capitalize: „doresc..." → „Doresc..."
  }

  // Paragraf 2 — măsuri solicitate
  const actionsBlock = tipData.actions
    .map((a, i) => `${i + 1}. ${a}`)
    .join("\n");
  const masuri = `Pentru a rezolva această situație, vă solicit respectuos să luați următoarele măsuri:\n${actionsBlock}`;

  // Paragraf 3 — poze (opțional)
  const photoBlock = args.hasPhotos
    ? `În sprijinul acestei sesizări, am atașat imagini care ilustrează situația actuală. Acestea evidențiază ${tipData.evidence}.`
    : null;

  // Paragraf 4 — număr înregistrare + OG 27/2002
  const numarInregistrare = `De asemenea, vă rog să îmi furnizați un număr de înregistrare pentru această sesizare și să îmi comunicați un răspuns în termen de maximum 30 de zile, conform OG 27/2002 privind soluționarea petițiilor.`;

  // Paragraf 5 — mulțumiri
  const multumiri = `Vă mulțumesc anticipat pentru atenția acordată și pentru măsurile pe care le veți lua.`;

  // Paragraf 6 — GDPR
  const gdpr = `În temeiul Regulamentului (UE) 2016/679 (GDPR), vă solicit ca prelucrarea datelor mele cu caracter personal să se realizeze cu respectarea principiilor prevăzute la art. 5, în special limitarea scopului, minimizarea datelor și confidențialitatea. În mod expres, solicit ca identitatea și datele mele de contact să nu fie divulgate persoanelor vizate de prezenta sesizare sau altor terți, în absența unui temei legal clar și justificat.`;

  // Semnătură
  const semnatura = nume
    ? `Cu stimă,\n${nume}\n${dataRo}`
    : `Cu stimă,\n${dataRo}`;

  const paragraphs = [
    "Bună ziua,",
    intro,
    masuri,
    photoBlock,
    numarInregistrare,
    multumiri,
    gdpr,
    semnatura,
  ].filter((p): p is string => p !== null && p.length > 0);

  return paragraphs.join("\n\n");
}

/** Pentru consumatori care vor doar lista de tipuri suportate. */
export function getSupportedTipuri(): string[] {
  return Object.keys(TIP_DATA);
}

/** Backwards-compat helper — TEMPLATES (vechi) e încă referit în câteva
 *  locuri pentru compatibilitate (AI fallback). Re-export ca să avem o
 *  singură import-line în consumeri. */
export { TEMPLATES };
export type { TipTemplate };
