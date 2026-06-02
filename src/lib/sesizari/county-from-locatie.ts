/**
 * 2026-05-26 — Fallback pentru detectarea județului dintr-un string de
 * locație, când coloana `county` lipsește în DB.
 *
 * Bug-ul rezolvat: sesizarea 00049 avea `county = null` (nu s-a detectat
 * automat la creare) → routing default București → preview „Brigada
 * Rutieră + PMB + PL București" pentru o sesizare din Cluj-Napoca.
 *
 * Algoritmul: caută numele orașului-capitală de județ și numele județului
 * în textul `locatie`. Match case-insensitive, fără diacritice.
 *
 * NU înlocuiește reverse-geocode (mai precis prin lat/lng), e doar
 * fallback pentru rândurile vechi sau cele unde geocoder a eșuat.
 */

import { ALL_COUNTIES } from "@/data/counties";

/**
 * Mapping oraș principal / variante → cod județ. Acoperă majoritatea
 * municipiilor reședință de județ + variantele comune cu/fără diacritice.
 * Lista exhaustivă, nu doar capitalele: includ și orașe importante care
 * apar frecvent în sesizari (Cluj-Napoca pentru CJ etc.).
 */
const CITY_TO_COUNTY: Record<string, string> = {
  // Capitala — includ și referințe la sectoare care implică București
  "bucuresti": "B",
  "bucurești": "B",
  "sector 1": "B", "sector 2": "B", "sector 3": "B",
  "sector 4": "B", "sector 5": "B", "sector 6": "B",
  // Bulevarde/șosele distinctive București (nu apar în alte județe)
  "bulevardul primaverii": "B", "bulevardul primăverii": "B",
  "soseaua pantelimon": "B", "șoseaua pantelimon": "B",
  "bulevardul chisinau": "B", "bulevardul chișinău": "B",
  "bulevardul unirii": "B",
  "calea victoriei": "B",
  "bulevardul magheru": "B",
  "bulevardul balcescu": "B", "bulevardul bălcescu": "B",
  "bulevardul decebal": "B",
  "bulevardul iuliu maniu": "B",
  "soseaua colentina": "B", "șoseaua colentina": "B",
  "soseaua mihai bravu": "B", "șoseaua mihai bravu": "B",
  "calea mosilor": "B", "calea moșilor": "B",
  "calea dudesti": "B", "calea dudești": "B",

  // Reședințe județe (alfabetic după county code)
  "alba iulia": "AB",
  "arad": "AR",
  "pitești": "AG", "pitesti": "AG",
  "bacău": "BC", "bacau": "BC",
  "oradea": "BH",
  "bistrița": "BN", "bistrita": "BN",
  "botoșani": "BT", "botosani": "BT",
  "brăila": "BR", "braila": "BR",
  "brașov": "BV", "brasov": "BV",
  "buzău": "BZ", "buzau": "BZ",
  "călărași": "CL", "calarasi": "CL",
  "reșița": "CS", "resita": "CS",
  "cluj-napoca": "CJ",
  "cluj": "CJ",
  "constanța": "CT", "constanta": "CT",
  "sfântu gheorghe": "CV", "sfantu gheorghe": "CV",
  "târgoviște": "DB", "targoviste": "DB",
  "craiova": "DJ",
  "galați": "GL", "galati": "GL",
  "giurgiu": "GR",
  "târgu jiu": "GJ", "targu jiu": "GJ",
  "miercurea ciuc": "HR",
  "deva": "HD",
  "slobozia": "IL",
  "iași": "IS", "iasi": "IS",
  "ilfov": "IF",
  "baia mare": "MM",
  "drobeta-turnu severin": "MH", "drobeta": "MH",
  "târgu mureș": "MS", "targu mures": "MS",
  "piatra-neamț": "NT", "piatra neamt": "NT",
  "slatina": "OT",
  "ploiești": "PH", "ploiesti": "PH",
  "satu mare": "SM",
  "zalău": "SJ", "zalau": "SJ",
  "sibiu": "SB",
  "suceava": "SV",
  "alexandria": "TR",
  "timișoara": "TM", "timisoara": "TM",
  "tulcea": "TL",
  "vaslui": "VS",
  "râmnicu vâlcea": "VL", "ramnicu valcea": "VL",
  "focșani": "VN", "focsani": "VN",
};

/**
 * Normalize text: lowercase, replace common diacritics, collapse whitespace.
 * Diacritics handled inline ca să nu depindem de Intl.Collator.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ț/g, "t")
    .replace(/ș/g, "s")
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detectează codul județului dintr-un string de locație.
 *
 * Examples:
 *   "Strada Fabricii, Cluj-Napoca, ..." → "CJ"
 *   "Bulevardul Eroilor, Sibiu" → "SB"
 *   "Calea Victoriei, București" → "B"
 *   "Strada Mihai Eminescu" → null (no city in text)
 *
 * @returns county ID (e.g. "CJ") sau null dacă nu e match clar
 */
export function detectCountyFromLocatie(locatie: string | null | undefined): string | null {
  if (!locatie || locatie.trim().length === 0) return null;
  const normLoc = normalize(locatie);

  // 1) Match exact pe orașe cunoscute (sortate descrescător după lungime
  //    ca să match-uim „cluj-napoca" înainte de „cluj").
  const cityEntries = Object.entries(CITY_TO_COUNTY).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [city, countyId] of cityEntries) {
    const normCity = normalize(city);
    // Match cu word boundary (ca să nu match „arad" în „aradul")
    const re = new RegExp(`\\b${normCity.replace(/[-]/g, "[- ]?")}\\b`, "i");
    if (re.test(normLoc)) return countyId;
  }

  // 2) Match pe numele JUDEȚULUI însuși (ex: „Sector 1, București" sau
  //    „Jud. Cluj"). Mai puțin precis decât orașul dar prinde edge cases.
  for (const county of ALL_COUNTIES) {
    if (county.id === "B") continue; // București deja prins via city
    const normName = normalize(county.name);
    // Match prefix „jud" sau „județ" în fața numelui, sau numele singur.
    const re = new RegExp(`(?:\\bjud\\.?\\s+|\\bjudetul\\s+|\\bjudețul\\s+|\\b)${normName}\\b`, "i");
    if (re.test(normLoc)) return county.id;
  }

  return null;
}
