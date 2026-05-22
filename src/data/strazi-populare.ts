/**
 * Top străzi populare din analytics search + sesizări frecvente.
 * Folosite pentru SEO long-tail: /sesizari/strada/[slug]
 *
 * Plan 5/22/2026 — analytics arată căutări 0-result pentru:
 *   - „Iancului" (2 hits)
 *   - „Soseaua Iancului"
 *   - „Soseaua" (parțial)
 * + sesizări concentrate pe străzi specifice (Morarilor — 4 sesizări).
 *
 * Fiecare pagină are:
 *   - H1: „Sesizări pe {nume_strada}"
 *   - Filtru pre-aplicat pe sesizările publice cu locație matching
 *   - Schema.org Place + ItemList
 *   - Long-tail keywords: „sesizare {strada}", „probleme {strada}",
 *     „parcare ilegală {strada}", etc.
 */

export interface StradaPopulara {
  /** Slug ASCII pentru URL */
  slug: string;
  /** Numele afișabil cu diacritice */
  nume: string;
  /** Variante de scriere ca să match-uim flexibil în query */
  aliases?: string[];
  /** Sector dominant (București) sau null pentru general */
  sector?: "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | null;
  /** Județ */
  countyCode: string;
  /** Descriere SEO scurtă pentru meta + hero */
  descriere: string;
}

export const STRAZI_POPULARE: StradaPopulara[] = [
  {
    slug: "iancului",
    nume: "Șoseaua Iancului",
    aliases: ["Iancului", "Sos Iancului", "Soseaua Iancului"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Șoseaua Iancului, Sector 2, București: parcare ilegală, semafoare, infrastructură.",
  },
  {
    slug: "morarilor",
    nume: "Șoseaua Morarilor",
    aliases: ["Morarilor", "Sos Morarilor", "Soseaua Morarilor"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Șoseaua Morarilor, Sector 2, București: trotuare ocupate, stâlpișori anti-parcare, mașini parcate ilegal.",
  },
  {
    slug: "pantelimon",
    nume: "Șoseaua Pantelimon",
    aliases: ["Pantelimon", "Sos Pantelimon"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Șoseaua Pantelimon, Sector 2, București: stâlpișori lipsă, parcare neregulamentară.",
  },
  {
    slug: "colentina",
    nume: "Șoseaua Colentina",
    aliases: ["Colentina", "Sos Colentina"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Șoseaua Colentina, Sector 2, București: mașini pe spații verzi, parcare ilegală.",
  },
  {
    slug: "calea-13-septembrie",
    nume: "Calea 13 Septembrie",
    aliases: ["13 Septembrie", "Calea 13"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Calea 13 Septembrie, Sector 5, București: trotuare ocupate, stâlpișori anti-parcare.",
  },
  {
    slug: "novaci",
    nume: "Strada Novaci",
    aliases: ["Novaci"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Novaci, Sector 5, București: parcare pe trotuar, stâlpișori.",
  },
  {
    slug: "panduri",
    nume: "Șoseaua Panduri",
    aliases: ["Panduri", "Sos Panduri"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Șoseaua Panduri, Sector 5, București: mașini pe banda autobuz, parcare ilegală.",
  },
  {
    slug: "dorneasca",
    nume: "Strada Dorneasca",
    aliases: ["Dorneasca"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Dorneasca, Sector 5, București: stâlpișori anti-parcare, mașini pe trotuar.",
  },
  {
    slug: "constantin-istrati",
    nume: "Strada Doctor Constantin Istrati",
    aliases: ["Constantin Istrati", "Dr Constantin Istrati", "Istrati"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Doctor Constantin Istrati, Sector 5, București: stâlpișori, copaci netoaletați.",
  },
  {
    slug: "vasile-lascar",
    nume: "Strada Vasile Lascăr",
    aliases: ["Vasile Lascar", "Lascăr"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Vasile Lascăr, Sector 2, București: parcare neregulamentară.",
  },
  {
    slug: "stefan-cel-mare",
    nume: "Bulevardul Ștefan cel Mare",
    aliases: ["Stefan cel Mare", "Bd Stefan cel Mare"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Bulevardul Ștefan cel Mare, Sector 2, București: trafic, parcare, semafoare.",
  },
  {
    slug: "calea-mosilor",
    nume: "Calea Moșilor",
    aliases: ["Mosilor", "Calea Mosilor"],
    sector: "S3",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Calea Moșilor, Sector 3, București: stâlpișori anti-parcare, infrastructură.",
  },
  {
    slug: "magheru",
    nume: "Bulevardul Magheru",
    aliases: ["Magheru", "Bd Magheru"],
    sector: "S1",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Bulevardul Magheru, Sector 1, București: trafic central, pietonalizare, parcare.",
  },
  {
    slug: "calea-victoriei",
    nume: "Calea Victoriei",
    aliases: ["Victoriei"],
    sector: "S1",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Calea Victoriei, Sector 1, București: trafic, pietonalizare, accesibilitate.",
  },
  {
    slug: "natiunilor-unite",
    nume: "Bulevardul Națiunilor Unite",
    aliases: ["Natiunile Unite", "Bd Natiunilor Unite"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Bulevardul Națiunilor Unite, Sector 5, București: parcare, stâlpișori, infrastructură.",
  },
  {
    slug: "splaiul-unirii",
    nume: "Splaiul Unirii",
    aliases: ["Splai Unirii"],
    sector: "S4",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Splaiul Unirii, Sectoarele 3, 4, 5, București: semafoare, trafic, infrastructură.",
  },
  {
    slug: "lizeanu",
    nume: "Strada Lizeanu",
    aliases: ["Lizeanu"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Lizeanu, Sector 2, București: stâlpișori anti-parcare.",
  },
  {
    slug: "barbu-vacarescu",
    nume: "Strada Barbu Văcărescu",
    aliases: ["Barbu Vacarescu", "Vacarescu"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Barbu Văcărescu, Sector 2, București: gard linie tramvai, trafic, parcare.",
  },
  {
    slug: "doamna-ghica",
    nume: "Strada Doamna Ghica",
    aliases: ["Doamna Ghica"],
    sector: "S2",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Doamna Ghica, Sector 2, București: stâlpișori, infrastructură.",
  },
  {
    slug: "amurgului",
    nume: "Strada Amurgului",
    aliases: ["Amurgului"],
    sector: "S5",
    countyCode: "B",
    descriere:
      "Sesizări civice pe Strada Amurgului, Sector 5, București: gropi periculoase, trotuare deteriorate.",
  },
];
