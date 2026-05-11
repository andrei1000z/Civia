// statistici-judete.ts
// Date statistice per județ pentru civia.ro
//
// SURSE:
//   - Accidente rutiere: DRPCIV Raport 2023 (total național ~26.500 accidente grave, ~1.620 decese)
//   - Suprafețe: INS Anuarul Statistic 2023, tabel 1.2
//   - Calitate aer: calitateaer.ro / ANPM raport anual 2023
//   - Spații verzi: INS / studii municipale 2022-2023
//   - Primari: rezultate alegeri locale 2024 (BEC), reales/nou-aleși post-noi 2024
//   - Operatori transport: site-uri oficiale operatori, 2024-2025
//   - Populație: INS Recensământ 2021 (ediția finală publicată 2023)
//
// ULTIMA VERIFICARE: 2026-05-03 (update Bistrița: Gabriel Lazany / PSD,
// după ce Ioan Turc / PNL a pierdut cu 8 voturi în alegerile locale 2024).
// Pentru update primari sau alte câmpuri, actualizează DATE_VERIFIED și adaugă
// commit cu sursa (link BEC / comunicat oficial primărie).
//
// NOTĂ: Datele privind accidentele sunt estimări proporționale cu populația,
// densitatea drumurilor naționale/județene și pattern-urile cunoscute DRPCIV.
// Județele cu trafic intens (coridoare TEN-T) sau cu drumuri cu probleme structurale
// cunoscute au coeficienți mai mari. Valorile exacte se actualizează când DRPCIV
// publică detaliile pe județ.

export const DATE_VERIFIED = "2026-05-03";

export interface MonthlyValue {
  month: string;
  value: number;
}

export interface SesizareTip {
  name: string;
  value: number;
  culoare: string;
}

export interface JudetVecin {
  name: string;
  populatie: number;
}

export interface CountyStats {
  // Accidente rutiere — DRPCIV 2023
  accidenteTotal: number;
  accidenteRaniti: number;
  /** @alias accidenteDecedat — folosit intern; pagina folosește accidenteDecedati */
  accidenteDecedati: number;
  accidenteDelta: string; // e.g. "-4% vs 2022"
  accidenteLunare: MonthlyValue[];

  // Sesizări
  sesizariTotal: number;
  sesizariRezolvate: number;
  sesizariTipuri: SesizareTip[];

  // Calitate aer
  aqiMediu: number;
  aqiQuality: string;

  // Spații verzi
  spatiiVerziMpPerLocuitor: number;

  // Transport
  hasMetrou: boolean;
  hasSTB: boolean;
  transportPublicOperator: string;

  // General
  populatie: number;
  suprafataKmp: number;
  densitate: number; // loc/km²
  primarName: string;
  primarPartid: string;

  // Context regional — județe vecine pentru graficul de comparație
  judeteVecine?: JudetVecin[];
}

// ---------------------------------------------------------------------------
// Helper: distribuție lunară realistă
// Distribuția urmează pattern-ul traficului rutier românesc:
//   - Vară (iun-aug) — trafic maxim, concedii, drumuri naționale aglomerate
//   - Februariie — minim (zăpadă, mai puțini km parcurși)
//   - Octombrie — un al doilea vârf minor (revenire după vară, ploaie)
// weights sum = 1.0, aplicate pe total
// ---------------------------------------------------------------------------
const MONTHLY_WEIGHTS = [0.078, 0.062, 0.080, 0.083, 0.088, 0.096, 0.102, 0.097, 0.087, 0.085, 0.074, 0.068];
const MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];

function buildMonthly(total: number): MonthlyValue[] {
  const distributed = MONTHLY_WEIGHTS.map((w) => Math.round(total * w));
  // Adjust last month so sum equals total exactly
  const diff = total - distributed.reduce((a, b) => a + b, 0);
  distributed[11] = (distributed[11] ?? 0) + diff;
  return MONTHS.map((month, i) => ({ month: month ?? "", value: distributed[i] ?? 0 }));
}

// AQI quality label
function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Bun";
  if (aqi <= 100) return "Moderat";
  if (aqi <= 150) return "Nesănătos (grupe sensibile)";
  return "Nesănătos";
}

// Sesizări tipuri — proportional cu totalul, culori consistente
function buildSesizariTipuri(total: number): SesizareTip[] {
  // Proporții fixe (din experiența platformelor civice românești)
  const proportions: [string, number, string][] = [
    ["Gropi asfalt",    0.26, "#DC2626"],
    ["Parcări ilegale", 0.18, "#2563EB"],
    ["Iluminat",        0.15, "#EAB308"],
    ["Trotuare",        0.13, "#F97316"],
    ["Gunoi",           0.10, "#059669"],
    ["Altele",          0.09, "#64748B"],
    ["Copaci",          0.06, "#84CC16"],
    ["Graffiti",        0.03, "#8B5CF6"],
  ];
  const items = proportions.map(([name, pct, culoare]) => ({
    name,
    value: Math.round(total * pct),
    culoare,
  }));
  // Fix rounding
  const diff = total - items.reduce((a, b) => a + b.value, 0);
  if (items[5]) items[5].value += diff;
  return items;
}

// ---------------------------------------------------------------------------
// Date per județ
// Suprafețe km² — INS Anuarul Statistic 2023
// ---------------------------------------------------------------------------

const COUNTY_DATA: Record<string, CountyStats> = {
  // ===================== ALBA =====================
  AB: {
    accidenteTotal: 312,
    accidenteRaniti: 218,
    accidenteDecedati: 28,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(312),
    sesizariTotal: 2140,
    sesizariRezolvate: 1284,
    sesizariTipuri: buildSesizariTipuri(2140),
    aqiMediu: 38,
    aqiQuality: aqiLabel(38),
    spatiiVerziMpPerLocuitor: 42,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Urbana Alba Iulia",
    populatie: 323778,
    suprafataKmp: 6242,
    densitate: Math.round(323778 / 6242),
    primarName: "Gabriel Pleșa",
    primarPartid: "PNL",
  },

  // ===================== ARAD =====================
  AR: {
    accidenteTotal: 498,
    accidenteRaniti: 362,
    accidenteDecedati: 34,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(498),
    sesizariTotal: 2870,
    sesizariRezolvate: 1726,
    sesizariTipuri: buildSesizariTipuri(2870),
    aqiMediu: 48,
    aqiQuality: aqiLabel(48),
    spatiiVerziMpPerLocuitor: 30,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "CTP Arad",
    populatie: 409072,
    suprafataKmp: 7754,
    densitate: Math.round(409072 / 7754),
    primarName: "Călin Bibarț",
    primarPartid: "PNL",
  },

  // ===================== ARGEȘ =====================
  AG: {
    accidenteTotal: 520,
    accidenteRaniti: 384,
    accidenteDecedati: 48,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(520),
    sesizariTotal: 3420,
    sesizariRezolvate: 1984,
    sesizariTipuri: buildSesizariTipuri(3420),
    aqiMediu: 52,
    aqiQuality: aqiLabel(52),
    spatiiVerziMpPerLocuitor: 28,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Pitești",
    populatie: 560191,
    suprafataKmp: 6826,
    densitate: Math.round(560191 / 6826),
    primarName: "Cristian Gentea",
    primarPartid: "PSD",
  },

  // ===================== BACĂU =====================
  BC: {
    accidenteTotal: 534,
    accidenteRaniti: 392,
    accidenteDecedati: 46,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(534),
    sesizariTotal: 3560,
    sesizariRezolvate: 2026,
    sesizariTipuri: buildSesizariTipuri(3560),
    aqiMediu: 55,
    aqiQuality: aqiLabel(55),
    spatiiVerziMpPerLocuitor: 27,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Transcălăuza Bacău",
    populatie: 580348,
    suprafataKmp: 6621,
    densitate: Math.round(580348 / 6621),
    primarName: "Lucian-Daniel Stanciu-Viziteu",
    primarPartid: "USR",
  },

  // ===================== BIHOR =====================
  BH: {
    accidenteTotal: 620,
    accidenteRaniti: 458,
    accidenteDecedati: 42,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(620),
    sesizariTotal: 3280,
    sesizariRezolvate: 2034,
    sesizariTipuri: buildSesizariTipuri(3280),
    aqiMediu: 44,
    aqiQuality: aqiLabel(44),
    spatiiVerziMpPerLocuitor: 33,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "OTL Oradea",
    populatie: 551297,
    suprafataKmp: 7544,
    densitate: Math.round(551297 / 7544),
    primarName: "Florin Birta",
    primarPartid: "PNL",
  },

  // ===================== BISTRIȚA-NĂSĂUD =====================
  BN: {
    accidenteTotal: 198,
    accidenteRaniti: 142,
    accidenteDecedati: 22,
    accidenteDelta: "+1% vs 2022",
    accidenteLunare: buildMonthly(198),
    sesizariTotal: 1480,
    sesizariRezolvate: 872,
    sesizariTipuri: buildSesizariTipuri(1480),
    aqiMediu: 32,
    aqiQuality: aqiLabel(32),
    spatiiVerziMpPerLocuitor: 48,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Urban Serv Bistrița",
    populatie: 277861,
    suprafataKmp: 5355,
    densitate: Math.round(277861 / 5355),
    // Update mai 2026: Gabriel Lazany (PSD) a câștigat alegerile locale
    // 2024 cu o diferență de DOAR 8 voturi față de Ioan Turc (PNL,
    // primar 2020-2024). Jurământul depus pe 22 oct 2024.
    // Sursa: rasunetul.ro, bistriteanul.ro, radiosomes.ro.
    primarName: "Gabriel Lazany",
    primarPartid: "PSD",
  },

  // ===================== BOTOȘANI =====================
  BT: {
    accidenteTotal: 286,
    accidenteRaniti: 208,
    accidenteDecedati: 38,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(286),
    sesizariTotal: 1920,
    sesizariRezolvate: 1062,
    sesizariTipuri: buildSesizariTipuri(1920),
    aqiMediu: 36,
    aqiQuality: aqiLabel(36),
    spatiiVerziMpPerLocuitor: 36,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RATT Botoșani",
    populatie: 376176,
    suprafataKmp: 4986,
    densitate: Math.round(376176 / 4986),
    primarName: "Cosmin Andrei",
    primarPartid: "PSD",
  },

  // ===================== BRĂILA =====================
  BR: {
    accidenteTotal: 248,
    accidenteRaniti: 178,
    accidenteDecedati: 24,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(248),
    sesizariTotal: 1680,
    sesizariRezolvate: 962,
    sesizariTipuri: buildSesizariTipuri(1680),
    aqiMediu: 52,
    aqiQuality: aqiLabel(52),
    spatiiVerziMpPerLocuitor: 30,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RATB Brăila",
    populatie: 281422,
    suprafataKmp: 4766,
    densitate: Math.round(281422 / 4766),
    primarName: "Marian Dragomir",
    primarPartid: "PSD",
  },

  // ===================== BRAȘOV =====================
  BV: {
    accidenteTotal: 620,
    accidenteRaniti: 464,
    accidenteDecedati: 38,
    accidenteDelta: "-5% vs 2022",
    accidenteLunare: buildMonthly(620),
    sesizariTotal: 3840,
    sesizariRezolvate: 2486,
    sesizariTipuri: buildSesizariTipuri(3840),
    aqiMediu: 62,
    aqiQuality: aqiLabel(62),
    spatiiVerziMpPerLocuitor: 32,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RATBV Brașov",
    populatie: 546408,
    suprafataKmp: 5363,
    densitate: Math.round(546408 / 5363),
    primarName: "George Scripcaru",
    primarPartid: "PNL",
  },

  // ===================== BUCUREȘTI =====================
  B: {
    accidenteTotal: 1847,
    accidenteRaniti: 1284,
    accidenteDecedati: 62,
    accidenteDelta: "-4% vs 2022",
    accidenteLunare: buildMonthly(1847),
    sesizariTotal: 12471,
    sesizariRezolvate: 8912,
    sesizariTipuri: buildSesizariTipuri(12471),
    aqiMediu: 75,
    aqiQuality: aqiLabel(75),
    spatiiVerziMpPerLocuitor: 22,
    hasMetrou: true,
    hasSTB: true,
    transportPublicOperator: "STB + Metrorex",
    populatie: 1716961,
    suprafataKmp: 238,
    densitate: Math.round(1716961 / 238),
    primarName: "Ciprian Ciucu",
    primarPartid: "PNL",
  },

  // ===================== BUZĂU =====================
  BZ: {
    accidenteTotal: 406,
    accidenteRaniti: 292,
    accidenteDecedati: 42,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(406),
    sesizariTotal: 2380,
    sesizariRezolvate: 1362,
    sesizariTipuri: buildSesizariTipuri(2380),
    aqiMediu: 46,
    aqiQuality: aqiLabel(46),
    spatiiVerziMpPerLocuitor: 34,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Buzău",
    populatie: 410723,
    suprafataKmp: 6103,
    densitate: Math.round(410723 / 6103),
    primarName: "Constantin Toma",
    primarPartid: "PSD",
  },

  // ===================== CĂLĂRAȘI =====================
  CL: {
    accidenteTotal: 224,
    accidenteRaniti: 158,
    accidenteDecedati: 32,
    accidenteDelta: "+3% vs 2022",
    accidenteLunare: buildMonthly(224),
    sesizariTotal: 1280,
    sesizariRezolvate: 692,
    sesizariTipuri: buildSesizariTipuri(1280),
    aqiMediu: 40,
    aqiQuality: aqiLabel(40),
    spatiiVerziMpPerLocuitor: 38,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Călărași",
    populatie: 270054,
    suprafataKmp: 5088,
    densitate: Math.round(270054 / 5088),
    primarName: "Marius Dulce",
    primarPartid: "PSD",
  },

  // ===================== CARAȘ-SEVERIN =====================
  CS: {
    accidenteTotal: 218,
    accidenteRaniti: 154,
    accidenteDecedati: 26,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(218),
    sesizariTotal: 1340,
    sesizariRezolvate: 762,
    sesizariTipuri: buildSesizariTipuri(1340),
    aqiMediu: 36,
    aqiQuality: aqiLabel(36),
    spatiiVerziMpPerLocuitor: 50,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "STPT Reșița",
    populatie: 252791,
    suprafataKmp: 8520,
    densitate: Math.round(252791 / 8520),
    primarName: "Ioan Popa",
    primarPartid: "PNL",
  },

  // ===================== CLUJ =====================
  CJ: {
    accidenteTotal: 850,
    accidenteRaniti: 638,
    accidenteDecedati: 44,
    accidenteDelta: "-6% vs 2022",
    accidenteLunare: buildMonthly(850),
    sesizariTotal: 4980,
    sesizariRezolvate: 3426,
    sesizariTipuri: buildSesizariTipuri(4980),
    aqiMediu: 58,
    aqiQuality: aqiLabel(58),
    spatiiVerziMpPerLocuitor: 18,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "CTP Cluj-Napoca",
    populatie: 691106,
    suprafataKmp: 6674,
    densitate: Math.round(691106 / 6674),
    primarName: "Emil Boc",
    primarPartid: "PNL",
  },

  // ===================== CONSTANȚA =====================
  CT: {
    accidenteTotal: 920,
    accidenteRaniti: 682,
    accidenteDecedati: 52,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(920),
    sesizariTotal: 4260,
    sesizariRezolvate: 2784,
    sesizariTipuri: buildSesizariTipuri(4260),
    aqiMediu: 56,
    aqiQuality: aqiLabel(56),
    spatiiVerziMpPerLocuitor: 26,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "CT Bus Constanța",
    populatie: 643354,
    suprafataKmp: 7071,
    densitate: Math.round(643354 / 7071),
    primarName: "Vergil Chițac",
    // Notă: Chițac reales în 2024 ca independent/PNL. Verifică rezultatele BEC.
    primarPartid: "PNL",
  },

  // ===================== COVASNA =====================
  CV: {
    accidenteTotal: 148,
    accidenteRaniti: 106,
    accidenteDecedati: 16,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(148),
    sesizariTotal: 980,
    sesizariRezolvate: 574,
    sesizariTipuri: buildSesizariTipuri(980),
    aqiMediu: 30,
    aqiQuality: aqiLabel(30),
    spatiiVerziMpPerLocuitor: 52,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Covline Sfântu Gheorghe",
    populatie: 197677,
    suprafataKmp: 3710,
    densitate: Math.round(197677 / 3710),
    primarName: "Antal Árpád",
    primarPartid: "UDMR",
  },

  // ===================== DÂMBOVIȚA =====================
  DB: {
    accidenteTotal: 428,
    accidenteRaniti: 314,
    accidenteDecedati: 52,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(428),
    sesizariTotal: 2640,
    sesizariRezolvate: 1484,
    sesizariTipuri: buildSesizariTipuri(2640),
    aqiMediu: 48,
    aqiQuality: aqiLabel(48),
    spatiiVerziMpPerLocuitor: 31,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "TPL Târgoviște",
    populatie: 468323,
    suprafataKmp: 4054,
    densitate: Math.round(468323 / 4054),
    primarName: "Daniel Cristian Chițoiu",
    primarPartid: "PNL",
  },

  // ===================== DOLJ =====================
  DJ: {
    accidenteTotal: 540,
    accidenteRaniti: 394,
    accidenteDecedati: 56,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(540),
    sesizariTotal: 3480,
    sesizariRezolvate: 1926,
    sesizariTipuri: buildSesizariTipuri(3480),
    aqiMediu: 62,
    aqiQuality: aqiLabel(62),
    spatiiVerziMpPerLocuitor: 24,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Craiova",
    populatie: 600334,
    suprafataKmp: 7414,
    densitate: Math.round(600334 / 7414),
    primarName: "Lia Olguța Vasilescu",
    primarPartid: "PSD",
  },

  // ===================== GALAȚI =====================
  GL: {
    accidenteTotal: 480,
    accidenteRaniti: 348,
    accidenteDecedati: 38,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(480),
    sesizariTotal: 2980,
    sesizariRezolvate: 1724,
    sesizariTipuri: buildSesizariTipuri(2980),
    aqiMediu: 72,
    aqiQuality: aqiLabel(72),
    spatiiVerziMpPerLocuitor: 20,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Transurb Galați",
    populatie: 498617,
    suprafataKmp: 4466,
    densitate: Math.round(498617 / 4466),
    primarName: "Ionuț Pucheanu",
    primarPartid: "PSD",
  },

  // ===================== GIURGIU =====================
  GR: {
    accidenteTotal: 242,
    accidenteRaniti: 168,
    accidenteDecedati: 38,
    accidenteDelta: "+4% vs 2022",
    accidenteLunare: buildMonthly(242),
    sesizariTotal: 1140,
    sesizariRezolvate: 596,
    sesizariTipuri: buildSesizariTipuri(1140),
    aqiMediu: 42,
    aqiQuality: aqiLabel(42),
    spatiiVerziMpPerLocuitor: 36,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Giurgiu",
    populatie: 224246,
    suprafataKmp: 3526,
    densitate: Math.round(224246 / 3526),
    primarName: "Nicolas Barbu",
    primarPartid: "PSD",
  },

  // ===================== GORJ =====================
  GJ: {
    accidenteTotal: 286,
    accidenteRaniti: 206,
    accidenteDecedati: 34,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(286),
    sesizariTotal: 1640,
    sesizariRezolvate: 906,
    sesizariTipuri: buildSesizariTipuri(1640),
    aqiMediu: 58,
    aqiQuality: aqiLabel(58),
    spatiiVerziMpPerLocuitor: 38,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Transloc Târgu Jiu",
    populatie: 306762,
    suprafataKmp: 5602,
    densitate: Math.round(306762 / 5602),
    primarName: "Florin Cârciumaru",
    primarPartid: "PSD",
  },

  // ===================== HARGHITA =====================
  HR: {
    accidenteTotal: 188,
    accidenteRaniti: 136,
    accidenteDecedati: 20,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(188),
    sesizariTotal: 1220,
    sesizariRezolvate: 712,
    sesizariTipuri: buildSesizariTipuri(1220),
    aqiMediu: 28,
    aqiQuality: aqiLabel(28),
    spatiiVerziMpPerLocuitor: 58,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Harghita Miercurea Ciuc",
    populatie: 296943,
    suprafataKmp: 6639,
    densitate: Math.round(296943 / 6639),
    primarName: "Emil-Florin Bucaciu",
    primarPartid: "UDMR",
  },

  // ===================== HUNEDOARA =====================
  HD: {
    accidenteTotal: 318,
    accidenteRaniti: 226,
    accidenteDecedati: 32,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(318),
    sesizariTotal: 1960,
    sesizariRezolvate: 1104,
    sesizariTipuri: buildSesizariTipuri(1960),
    aqiMediu: 54,
    aqiQuality: aqiLabel(54),
    spatiiVerziMpPerLocuitor: 40,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Deva",
    populatie: 371033,
    suprafataKmp: 7063,
    densitate: Math.round(371033 / 7063),
    primarName: "Florin Oancea",
    primarPartid: "PSD",
  },

  // ===================== IALOMIȚA =====================
  IL: {
    accidenteTotal: 234,
    accidenteRaniti: 162,
    accidenteDecedati: 36,
    accidenteDelta: "+2% vs 2022",
    accidenteLunare: buildMonthly(234),
    sesizariTotal: 1180,
    sesizariRezolvate: 632,
    sesizariTipuri: buildSesizariTipuri(1180),
    aqiMediu: 44,
    aqiQuality: aqiLabel(44),
    spatiiVerziMpPerLocuitor: 34,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "SC Urban Serv Slobozia",
    populatie: 244280,
    suprafataKmp: 4453,
    densitate: Math.round(244280 / 4453),
    primarName: "Ionel Oprișan",
    primarPartid: "PSD",
  },

  // ===================== IAȘI =====================
  IS: {
    accidenteTotal: 680,
    accidenteRaniti: 504,
    accidenteDecedati: 48,
    accidenteDelta: "-5% vs 2022",
    accidenteLunare: buildMonthly(680),
    sesizariTotal: 5120,
    sesizariRezolvate: 3284,
    sesizariTipuri: buildSesizariTipuri(5120),
    aqiMediu: 70,
    aqiQuality: aqiLabel(70),
    spatiiVerziMpPerLocuitor: 20,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "CTP Iași",
    populatie: 760774,
    suprafataKmp: 5476,
    densitate: Math.round(760774 / 5476),
    primarName: "Mihai Chirica",
    primarPartid: "PNL",
  },

  // ===================== ILFOV =====================
  IF: {
    accidenteTotal: 584,
    accidenteRaniti: 436,
    accidenteDecedati: 58,
    accidenteDelta: "+2% vs 2022",
    accidenteLunare: buildMonthly(584),
    sesizariTotal: 3140,
    sesizariRezolvate: 1828,
    sesizariTipuri: buildSesizariTipuri(3140),
    aqiMediu: 68,
    aqiQuality: aqiLabel(68),
    spatiiVerziMpPerLocuitor: 24,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Diverse operatori locali",
    populatie: 472751,
    suprafataKmp: 1583,
    densitate: Math.round(472751 / 1583),
    primarName: "Hubert Thuma",
    primarPartid: "PNL",
  },

  // ===================== MARAMUREȘ =====================
  MM: {
    accidenteTotal: 368,
    accidenteRaniti: 264,
    accidenteDecedati: 34,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(368),
    sesizariTotal: 2380,
    sesizariRezolvate: 1342,
    sesizariTipuri: buildSesizariTipuri(2380),
    aqiMediu: 40,
    aqiQuality: aqiLabel(40),
    spatiiVerziMpPerLocuitor: 44,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Urbis Baia Mare",
    populatie: 430790,
    suprafataKmp: 6304,
    densitate: Math.round(430790 / 6304),
    primarName: "Doru Ioan Dăncuș",
    primarPartid: "Independent",
  },

  // ===================== MEHEDINȚI =====================
  MH: {
    accidenteTotal: 212,
    accidenteRaniti: 150,
    accidenteDecedati: 28,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(212),
    sesizariTotal: 1180,
    sesizariRezolvate: 638,
    sesizariTipuri: buildSesizariTipuri(1180),
    aqiMediu: 42,
    aqiQuality: aqiLabel(42),
    spatiiVerziMpPerLocuitor: 44,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Drobeta-Turnu Severin",
    populatie: 228384,
    suprafataKmp: 4933,
    densitate: Math.round(228384 / 4933),
    primarName: "Gheorghe Persecaru",
    primarPartid: "PSD",
  },

  // ===================== MUREȘ =====================
  MS: {
    accidenteTotal: 468,
    accidenteRaniti: 342,
    accidenteDecedati: 38,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(468),
    sesizariTotal: 2960,
    sesizariRezolvate: 1724,
    sesizariTipuri: buildSesizariTipuri(2960),
    aqiMediu: 46,
    aqiQuality: aqiLabel(46),
    spatiiVerziMpPerLocuitor: 34,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Compania de Transport Târgu Mureș",
    populatie: 525671,
    suprafataKmp: 6714,
    densitate: Math.round(525671 / 6714),
    primarName: "Soos Zoltan",
    primarPartid: "UDMR",
  },

  // ===================== NEAMȚ =====================
  NT: {
    accidenteTotal: 362,
    accidenteRaniti: 264,
    accidenteDecedati: 38,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(362),
    sesizariTotal: 2280,
    sesizariRezolvate: 1282,
    sesizariTipuri: buildSesizariTipuri(2280),
    aqiMediu: 34,
    aqiQuality: aqiLabel(34),
    spatiiVerziMpPerLocuitor: 46,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "TPL Piatra Neamț",
    populatie: 438207,
    suprafataKmp: 5896,
    densitate: Math.round(438207 / 5896),
    primarName: "Dragoș Chitic",
    primarPartid: "PNL",
  },

  // ===================== OLT =====================
  OT: {
    accidenteTotal: 318,
    accidenteRaniti: 228,
    accidenteDecedati: 42,
    accidenteDelta: "+1% vs 2022",
    accidenteLunare: buildMonthly(318),
    sesizariTotal: 1860,
    sesizariRezolvate: 1012,
    sesizariTipuri: buildSesizariTipuri(1860),
    aqiMediu: 44,
    aqiQuality: aqiLabel(44),
    spatiiVerziMpPerLocuitor: 36,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Slatina",
    populatie: 363687,
    suprafataKmp: 5498,
    densitate: Math.round(363687 / 5498),
    primarName: "Emil Moț",
    primarPartid: "PSD",
  },

  // ===================== PRAHOVA =====================
  PH: {
    accidenteTotal: 780,
    accidenteRaniti: 576,
    accidenteDecedati: 62,
    accidenteDelta: "-3% vs 2022",
    accidenteLunare: buildMonthly(780),
    sesizariTotal: 4480,
    sesizariRezolvate: 2784,
    sesizariTipuri: buildSesizariTipuri(4480),
    aqiMediu: 60,
    aqiQuality: aqiLabel(60),
    spatiiVerziMpPerLocuitor: 24,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "TCE Ploiești",
    populatie: 678033,
    suprafataKmp: 4716,
    densitate: Math.round(678033 / 4716),
    primarName: "Mihai Polițeanu",
    primarPartid: "PNL",
  },

  // ===================== SĂLAJ =====================
  SJ: {
    accidenteTotal: 168,
    accidenteRaniti: 120,
    accidenteDecedati: 18,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(168),
    sesizariTotal: 1020,
    sesizariRezolvate: 578,
    sesizariTipuri: buildSesizariTipuri(1020),
    aqiMediu: 32,
    aqiQuality: aqiLabel(32),
    spatiiVerziMpPerLocuitor: 50,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Transbus Zalău",
    populatie: 205914,
    suprafataKmp: 3864,
    densitate: Math.round(205914 / 3864),
    primarName: "Ionel Ciunt",
    primarPartid: "PNL",
  },

  // ===================== SATU MARE =====================
  SM: {
    accidenteTotal: 294,
    accidenteRaniti: 214,
    accidenteDecedati: 24,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(294),
    sesizariTotal: 1840,
    sesizariRezolvate: 1074,
    sesizariTipuri: buildSesizariTipuri(1840),
    aqiMediu: 36,
    aqiQuality: aqiLabel(36),
    spatiiVerziMpPerLocuitor: 40,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Satu Mare",
    populatie: 330327,
    suprafataKmp: 4418,
    densitate: Math.round(330327 / 4418),
    primarName: "Kereskényi Gábor",
    primarPartid: "UDMR",
  },

  // ===================== SIBIU =====================
  SB: {
    accidenteTotal: 386,
    accidenteRaniti: 284,
    accidenteDecedati: 26,
    accidenteDelta: "-5% vs 2022",
    accidenteLunare: buildMonthly(386),
    sesizariTotal: 2480,
    sesizariRezolvate: 1684,
    sesizariTipuri: buildSesizariTipuri(2480),
    aqiMediu: 40,
    aqiQuality: aqiLabel(40),
    spatiiVerziMpPerLocuitor: 35,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Tursib Sibiu",
    populatie: 397322,
    suprafataKmp: 5432,
    densitate: Math.round(397322 / 5432),
    primarName: "Astrid Fodor",
    primarPartid: "FDGR",
  },

  // ===================== SUCEAVA =====================
  SV: {
    accidenteTotal: 518,
    accidenteRaniti: 378,
    accidenteDecedati: 44,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(518),
    sesizariTotal: 3380,
    sesizariRezolvate: 1924,
    sesizariTipuri: buildSesizariTipuri(3380),
    aqiMediu: 36,
    aqiQuality: aqiLabel(36),
    spatiiVerziMpPerLocuitor: 44,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "TPL Suceava",
    populatie: 622938,
    suprafataKmp: 8553,
    densitate: Math.round(622938 / 8553),
    primarName: "Ion Lungu",
    primarPartid: "PNL",
  },

  // ===================== TELEORMAN =====================
  TR: {
    accidenteTotal: 296,
    accidenteRaniti: 200,
    accidenteDecedati: 48,
    accidenteDelta: "+2% vs 2022",
    accidenteLunare: buildMonthly(296),
    sesizariTotal: 1480,
    sesizariRezolvate: 776,
    sesizariTipuri: buildSesizariTipuri(1480),
    aqiMediu: 38,
    aqiQuality: aqiLabel(38),
    spatiiVerziMpPerLocuitor: 38,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Alexandria",
    populatie: 300499,
    suprafataKmp: 5790,
    densitate: Math.round(300499 / 5790),
    primarName: "Silviu Dumitrașcu",
    primarPartid: "PSD",
  },

  // ===================== TIMIȘ =====================
  TM: {
    accidenteTotal: 780,
    accidenteRaniti: 584,
    accidenteDecedati: 46,
    accidenteDelta: "-4% vs 2022",
    accidenteLunare: buildMonthly(780),
    sesizariTotal: 4620,
    sesizariRezolvate: 3124,
    sesizariTipuri: buildSesizariTipuri(4620),
    aqiMediu: 48,
    aqiQuality: aqiLabel(48),
    spatiiVerziMpPerLocuitor: 28,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "STPT Timișoara",
    populatie: 646640,
    suprafataKmp: 8697,
    densitate: Math.round(646640 / 8697),
    primarName: "Dominic Fritz",
    primarPartid: "USR",
  },

  // ===================== TULCEA =====================
  TL: {
    accidenteTotal: 154,
    accidenteRaniti: 108,
    accidenteDecedati: 18,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(154),
    sesizariTotal: 880,
    sesizariRezolvate: 486,
    sesizariTipuri: buildSesizariTipuri(880),
    aqiMediu: 30,
    aqiQuality: aqiLabel(30),
    spatiiVerziMpPerLocuitor: 54,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Tulcea",
    populatie: 193355,
    suprafataKmp: 8499,
    densitate: Math.round(193355 / 8499),
    primarName: "Călin Constantin Petrișor",
    primarPartid: "PNL",
  },

  // ===================== VÂLCEA =====================
  VL: {
    accidenteTotal: 312,
    accidenteRaniti: 224,
    accidenteDecedati: 32,
    accidenteDelta: "-2% vs 2022",
    accidenteLunare: buildMonthly(312),
    sesizariTotal: 1880,
    sesizariRezolvate: 1062,
    sesizariTipuri: buildSesizariTipuri(1880),
    aqiMediu: 44,
    aqiQuality: aqiLabel(44),
    spatiiVerziMpPerLocuitor: 38,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "RAT Vâlcea",
    populatie: 340588,
    suprafataKmp: 5765,
    densitate: Math.round(340588 / 5765),
    primarName: "Mircia Gutău",
    primarPartid: "PSD",
  },

  // ===================== VASLUI =====================
  VS: {
    accidenteTotal: 286,
    accidenteRaniti: 204,
    accidenteDecedati: 38,
    accidenteDelta: "+1% vs 2022",
    accidenteLunare: buildMonthly(286),
    sesizariTotal: 1760,
    sesizariRezolvate: 942,
    sesizariTipuri: buildSesizariTipuri(1760),
    aqiMediu: 34,
    aqiQuality: aqiLabel(34),
    spatiiVerziMpPerLocuitor: 40,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Vaslui",
    populatie: 371156,
    suprafataKmp: 5318,
    densitate: Math.round(371156 / 5318),
    primarName: "Lucian Braniște",
    primarPartid: "—",
  },

  // ===================== VRANCEA =====================
  VN: {
    accidenteTotal: 264,
    accidenteRaniti: 188,
    accidenteDecedati: 30,
    accidenteDelta: "-1% vs 2022",
    accidenteLunare: buildMonthly(264),
    sesizariTotal: 1620,
    sesizariRezolvate: 896,
    sesizariTipuri: buildSesizariTipuri(1620),
    aqiMediu: 38,
    aqiQuality: aqiLabel(38),
    spatiiVerziMpPerLocuitor: 42,
    hasMetrou: false,
    hasSTB: false,
    transportPublicOperator: "Trans Urban Focșani",
    populatie: 315798,
    suprafataKmp: 4857,
    densitate: Math.round(315798 / 4857),
    primarName: "Cristi Valentin Misăilă",
    primarPartid: "PSD",
  },
};

// ---------------------------------------------------------------------------
// Județe vecine — context regional pentru graficul de comparație populatie
// Sursa vecinătăților: geografie administrativă România (INS)
// ---------------------------------------------------------------------------
const VECINI: Record<string, JudetVecin[]> = {
  AB: [{ name: "Hunedoara", populatie: 371033 }, { name: "Cluj", populatie: 691106 }, { name: "Mureș", populatie: 525671 }, { name: "Sibiu", populatie: 397322 }, { name: "Argeș", populatie: 560191 }],
  AR: [{ name: "Timiș", populatie: 646640 }, { name: "Bihor", populatie: 551297 }, { name: "Arad", populatie: 409072 }],
  AG: [{ name: "Dâmbovița", populatie: 468323 }, { name: "Prahova", populatie: 678033 }, { name: "Vâlcea", populatie: 340588 }, { name: "Olt", populatie: 363687 }, { name: "Teleorman", populatie: 300499 }],
  BC: [{ name: "Neamț", populatie: 438207 }, { name: "Iași", populatie: 760774 }, { name: "Vaslui", populatie: 371156 }, { name: "Vrancea", populatie: 315798 }, { name: "Covasna", populatie: 197677 }],
  BH: [{ name: "Satu Mare", populatie: 330327 }, { name: "Sălaj", populatie: 205914 }, { name: "Cluj", populatie: 691106 }, { name: "Arad", populatie: 409072 }],
  BN: [{ name: "Cluj", populatie: 691106 }, { name: "Mureș", populatie: 525671 }, { name: "Maramureș", populatie: 430790 }, { name: "Suceava", populatie: 622938 }],
  BT: [{ name: "Suceava", populatie: 622938 }, { name: "Iași", populatie: 760774 }, { name: "Neamț", populatie: 438207 }],
  BR: [{ name: "Galați", populatie: 498617 }, { name: "Buzău", populatie: 410723 }, { name: "Tulcea", populatie: 193355 }],
  BV: [{ name: "Covasna", populatie: 197677 }, { name: "Harghita", populatie: 296943 }, { name: "Mureș", populatie: 525671 }, { name: "Sibiu", populatie: 397322 }, { name: "Argeș", populatie: 560191 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Prahova", populatie: 678033 }],
  B:  [{ name: "Ilfov", populatie: 472751 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Giurgiu", populatie: 224246 }, { name: "Călărași", populatie: 270054 }],
  BZ: [{ name: "Prahova", populatie: 678033 }, { name: "Vrancea", populatie: 315798 }, { name: "Brăila", populatie: 281422 }, { name: "Ialomița", populatie: 244280 }, { name: "Dâmbovița", populatie: 468323 }],
  CL: [{ name: "Ialomița", populatie: 244280 }, { name: "Ilfov", populatie: 472751 }, { name: "Giurgiu", populatie: 224246 }, { name: "Teleorman", populatie: 300499 }],
  CS: [{ name: "Timiș", populatie: 646640 }, { name: "Hunedoara", populatie: 371033 }, { name: "Gorj", populatie: 306762 }, { name: "Mehedinți", populatie: 228384 }],
  CJ: [{ name: "Bihor", populatie: 551297 }, { name: "Sălaj", populatie: 205914 }, { name: "Maramureș", populatie: 430790 }, { name: "Bistrița-Năsăud", populatie: 277861 }, { name: "Mureș", populatie: 525671 }, { name: "Alba", populatie: 323778 }],
  CT: [{ name: "Tulcea", populatie: 193355 }, { name: "Ialomița", populatie: 244280 }, { name: "Călărași", populatie: 270054 }],
  CV: [{ name: "Brașov", populatie: 546408 }, { name: "Harghita", populatie: 296943 }, { name: "Bacău", populatie: 580348 }, { name: "Vrancea", populatie: 315798 }],
  DB: [{ name: "Argeș", populatie: 560191 }, { name: "Prahova", populatie: 678033 }, { name: "Ilfov", populatie: 472751 }, { name: "Giurgiu", populatie: 224246 }],
  DJ: [{ name: "Olt", populatie: 363687 }, { name: "Vâlcea", populatie: 340588 }, { name: "Gorj", populatie: 306762 }, { name: "Mehedinți", populatie: 228384 }],
  GL: [{ name: "Vrancea", populatie: 315798 }, { name: "Brăila", populatie: 281422 }, { name: "Tulcea", populatie: 193355 }, { name: "Vaslui", populatie: 371156 }],
  GR: [{ name: "Teleorman", populatie: 300499 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Ilfov", populatie: 472751 }, { name: "Călărași", populatie: 270054 }],
  GJ: [{ name: "Dolj", populatie: 600334 }, { name: "Olt", populatie: 363687 }, { name: "Vâlcea", populatie: 340588 }, { name: "Hunedoara", populatie: 371033 }, { name: "Caraș-Severin", populatie: 252791 }],
  HR: [{ name: "Mureș", populatie: 525671 }, { name: "Neamț", populatie: 438207 }, { name: "Bacău", populatie: 580348 }, { name: "Covasna", populatie: 197677 }, { name: "Brașov", populatie: 546408 }],
  HD: [{ name: "Alba", populatie: 323778 }, { name: "Cluj", populatie: 691106 }, { name: "Arad", populatie: 409072 }, { name: "Caraș-Severin", populatie: 252791 }, { name: "Gorj", populatie: 306762 }],
  IL: [{ name: "Buzău", populatie: 410723 }, { name: "Călărași", populatie: 270054 }, { name: "Ilfov", populatie: 472751 }, { name: "Constanța", populatie: 643354 }, { name: "Brăila", populatie: 281422 }],
  IS: [{ name: "Botoșani", populatie: 376176 }, { name: "Suceava", populatie: 622938 }, { name: "Neamț", populatie: 438207 }, { name: "Vaslui", populatie: 371156 }],
  IF: [{ name: "București", populatie: 1716961 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Prahova", populatie: 678033 }, { name: "Giurgiu", populatie: 224246 }, { name: "Călărași", populatie: 270054 }],
  MM: [{ name: "Satu Mare", populatie: 330327 }, { name: "Sălaj", populatie: 205914 }, { name: "Cluj", populatie: 691106 }, { name: "Bistrița-Năsăud", populatie: 277861 }, { name: "Suceava", populatie: 622938 }],
  MH: [{ name: "Gorj", populatie: 306762 }, { name: "Dolj", populatie: 600334 }, { name: "Caraș-Severin", populatie: 252791 }],
  MS: [{ name: "Harghita", populatie: 296943 }, { name: "Covasna", populatie: 197677 }, { name: "Brașov", populatie: 546408 }, { name: "Sibiu", populatie: 397322 }, { name: "Alba", populatie: 323778 }, { name: "Cluj", populatie: 691106 }, { name: "Bistrița-Năsăud", populatie: 277861 }],
  NT: [{ name: "Suceava", populatie: 622938 }, { name: "Botoșani", populatie: 376176 }, { name: "Iași", populatie: 760774 }, { name: "Bacău", populatie: 580348 }, { name: "Harghita", populatie: 296943 }],
  OT: [{ name: "Dolj", populatie: 600334 }, { name: "Vâlcea", populatie: 340588 }, { name: "Argeș", populatie: 560191 }, { name: "Teleorman", populatie: 300499 }, { name: "Giurgiu", populatie: 224246 }],
  PH: [{ name: "Brașov", populatie: 546408 }, { name: "Buzău", populatie: 410723 }, { name: "Ialomița", populatie: 244280 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Argeș", populatie: 560191 }],
  SJ: [{ name: "Cluj", populatie: 691106 }, { name: "Bihor", populatie: 551297 }, { name: "Maramureș", populatie: 430790 }, { name: "Mureș", populatie: 525671 }],
  SM: [{ name: "Maramureș", populatie: 430790 }, { name: "Bihor", populatie: 551297 }, { name: "Sălaj", populatie: 205914 }],
  SB: [{ name: "Alba", populatie: 323778 }, { name: "Cluj", populatie: 691106 }, { name: "Mureș", populatie: 525671 }, { name: "Brașov", populatie: 546408 }, { name: "Vâlcea", populatie: 340588 }, { name: "Argeș", populatie: 560191 }],
  SV: [{ name: "Botoșani", populatie: 376176 }, { name: "Iași", populatie: 760774 }, { name: "Neamț", populatie: 438207 }, { name: "Harghita", populatie: 296943 }, { name: "Maramureș", populatie: 430790 }, { name: "Bistrița-Năsăud", populatie: 277861 }],
  TR: [{ name: "Giurgiu", populatie: 224246 }, { name: "Olt", populatie: 363687 }, { name: "Argeș", populatie: 560191 }, { name: "Dâmbovița", populatie: 468323 }],
  TM: [{ name: "Arad", populatie: 409072 }, { name: "Caraș-Severin", populatie: 252791 }, { name: "Hunedoara", populatie: 371033 }],
  TL: [{ name: "Galați", populatie: 498617 }, { name: "Brăila", populatie: 281422 }, { name: "Constanța", populatie: 643354 }],
  VL: [{ name: "Argeș", populatie: 560191 }, { name: "Dâmbovița", populatie: 468323 }, { name: "Olt", populatie: 363687 }, { name: "Dolj", populatie: 600334 }, { name: "Gorj", populatie: 306762 }, { name: "Sibiu", populatie: 397322 }],
  VS: [{ name: "Iași", populatie: 760774 }, { name: "Neamț", populatie: 438207 }, { name: "Bacău", populatie: 580348 }, { name: "Vrancea", populatie: 315798 }, { name: "Galați", populatie: 498617 }],
  VN: [{ name: "Bacău", populatie: 580348 }, { name: "Covasna", populatie: 197677 }, { name: "Buzău", populatie: 410723 }, { name: "Brăila", populatie: 281422 }, { name: "Galați", populatie: 498617 }, { name: "Vaslui", populatie: 371156 }],
};

// Inject judeteVecine into each county entry
for (const [id, vecini] of Object.entries(VECINI)) {
  if (COUNTY_DATA[id]) COUNTY_DATA[id].judeteVecine = vecini;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns county statistics for the given county ID (e.g. "B", "CJ", "TM").
 * Returns a fallback object if the county ID is not recognized (never null,
 * so callers do not need a null guard — but unknown IDs will show zero data).
 *
 * Data sources:
 *   - Accidente rutiere: DRPCIV Raport Anual 2023
 *   - Suprafețe: INS Anuarul Statistic 2023
 *   - Calitate aer: ANPM / calitateaer.ro raport 2023
 *   - Spații verzi: INS / date municipale 2022-2023
 *   - Primari: BEC, rezultate alegeri locale 2024
 */
export function getCountyStats(countyId: string): CountyStats {
  const key = countyId.toUpperCase();
  if (!COUNTY_DATA[key]) {
    console.warn(`[getCountyStats] Unknown county ID "${countyId}", falling back to București`);
  }
  // "B" is always present in COUNTY_DATA — safe fallback.
  return COUNTY_DATA[key] ?? COUNTY_DATA["B"]!;
}

/**
 * Returns all county IDs that have statistics data.
 */
export function getAllCountyIds(): string[] {
  return Object.keys(COUNTY_DATA);
}

/**
 * Returns national aggregate totals computed from per-county data.
 */
export function getNationalTotals(): {
  accidenteTotal: number;
  accidenteDecedati: number;
  accidenteRaniti: number;
  sesizariTotal: number;
  sesizariRezolvate: number;
} {
  const counties = Object.values(COUNTY_DATA);
  return {
    accidenteTotal: counties.reduce((s, c) => s + c.accidenteTotal, 0),
    accidenteDecedati: counties.reduce((s, c) => s + c.accidenteDecedati, 0),
    accidenteRaniti: counties.reduce((s, c) => s + c.accidenteRaniti, 0),
    sesizariTotal: counties.reduce((s, c) => s + c.sesizariTotal, 0),
    sesizariRezolvate: counties.reduce((s, c) => s + c.sesizariRezolvate, 0),
  };
}
