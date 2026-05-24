// Detect Bucharest sector OR Ilfov locality from free-text location.
// Fallback when Nominatim or AI classifier don't return a structured answer.
//
// 2026-05-24 Faza 9 (persona Cristina, Pipera) — Ilfov suburbs added.
// Înainte: locații Pipera/Voluntari/Otopeni → sector=null → routing email
// pica la PMB sector 1 (wrong, PMB nu gestionează Voluntari). Acum:
// returnam "IF_voluntari", "IF_otopeni" etc. → routing.ts mapează la
// primăria locală Voluntari/Otopeni (autoritati-contact.ts).

const SECTOR_KEYWORDS: Record<string, string[]> = {
  S1: [
    "sector 1", "sectorul 1", "s1", "herăstrău", "herastrau", "dorobanți", "dorobanti", "floreasca", "primăverii", "primaverii",
    "aviatorilor", "băneasa", "baneasa", "victoria", "victoriei", "romană", "romana", "aviației", "aviatiei",
    "expoziției", "expozitiei", "kiseleff", "titulescu", "1 mai", "domenii", "străulești", "stroiesti",
    "gării de nord", "gara de nord", "bucureștii noi", "bucurestii noi", "jiului", "grivița", "grivita",
  ],
  S2: [
    "sector 2", "sectorul 2", "s2", "pantelimon", "colentina", "obor", "tei", "iancului", "vatra luminoasă", "vatra luminoasa",
    "moșilor", "mosilor", "doamna ghica", "stefan cel mare", "ștefan cel mare", "fundeni", "lacul tei",
    "pajura", "plumbuita", "reînvierii", "reinvierii", "silvestru", "dacia", "basarabia", "dimitrov",
  ],
  S3: [
    "sector 3", "sectorul 3", "s3", "titan", "dristor", "vitan", "unirii", "dudești", "dudesti", "ior", "nicolae grigorescu",
    "1 decembrie", "ramnicu sarat", "râmnicu sărat", "baba novac", "theodor pallady", "camil ressu",
    "liviu rebreanu", "alba iulia", "decebal", "balta albă", "balta alba", "titan 1", "lipscani",
    "universității", "universitatii", "hurmuzachi", "matei voievod", "salajan", "sălăjan",
  ],
  S4: [
    "sector 4", "sectorul 4", "s4", "berceni", "tineretului", "apărătorii patriei", "aparatorii patriei", "timpuri noi",
    "olteniței", "oltenitei", "brâncoveanu", "brancoveanu", "eroii revoluției", "eroii revolutiei",
    "văcărești", "vacaresti", "piața sudului", "piata sudului", "constantin brâncoveanu",
    "giurgiului", "metalurgiei", "păcii", "pacii", "secuilor", "văcărescu", "vacarescu",
  ],
  S5: [
    "sector 5", "sectorul 5", "s5", "rahova", "ferentari", "ghencea", "cotroceni", "13 septembrie", "alexandriei",
    "calea 13", "panduri", "șos. alexandriei", "sos. alexandriei", "sebastian", "eroilor sanitari",
    "pieptănari", "pieptanari", "prelungirea ferentari", "margeanului", "rahovei", "trapezului",
    "progresului", "izvor", "libertății", "libertatii",
    // Gov landmarks Sector 5 (Piața Constituției zone — Palatul Parlamentului,
    // ministere principale). Raport user 2026-05-15: lipseau si AI-ul nu
    // gasea sectorul → emailul nu ajungea la PMB Sector 5.
    "constituției", "constitutiei", "piața constituției", "piata constitutiei",
    "casa poporului", "palatul parlamentului", "parlamentului",
    "ministerul justiției", "ministerul justitiei", "ministerul finanțelor", "ministerul finantelor",
    "ministerul mediului", "academia română", "academia romana",
    "cnsas", "biblioteca națională", "biblioteca nationala", "izvor",
  ],
  S6: [
    "sector 6", "sectorul 6", "s6", "drumul taberei", "militari", "crângași", "crangasi", "grozăvești", "grozavesti",
    "pajura", "valea ialomiței", "valea ialomitei", "virtuții", "virtutii", "politehnica", "preciziei",
    "valea cascadelor", "valea argeșului", "valea argesului", "gorjului", "lujerului", "apusului",
    "iuliu maniu", "orșova", "orsova", "timișoara", "timisoara", "bd. timișoara", "veteranilor",
    "păcii", "pacii", "răzoare", "razoare",
  ],
  // 2026-05-24 Faza 9 — Ilfov suburbs frequented by Bucharest residents.
  // Prefix "IF_" → cod localitate. Listed in detection priority order:
  // localitățile mai mari + zone „Bucharest-feeling" frequently confused.
  IF_voluntari: [
    "voluntari", "pipera", "pipera nord", "pipera sud", "pipera tower", "pipera plaza",
    "iancu nicolae", "erou iancu nicolae", "drumul nisipoasa", "casa de cultură voluntari",
  ],
  IF_otopeni: [
    "otopeni", "henri coandă", "henri coanda", "aeroportul otopeni", "aeroport otopeni",
    "ferma otopeni", "23 august otopeni",
  ],
  IF_popesti: [
    "popești-leordeni", "popesti-leordeni", "popești leordeni", "popesti leordeni", "leordeni",
  ],
  IF_chiajna: [
    "chiajna", "roșu", "rosu", "dudu", "militari residence",
  ],
  IF_buftea: [
    "buftea", "lacul buftea",
  ],
  IF_mogosoaia: [
    "mogoșoaia", "mogosoaia", "palatul mogoșoaia", "palatul mogosoaia",
  ],
  IF_pantelimon: [
    "pantelimon ilfov", "orașul pantelimon", "orasul pantelimon",
  ],
  IF_bragadiru: [
    "bragadiru", "cartierul latin bragadiru",
  ],
  IF_corbeanca: [
    "corbeanca", "corbeanca nord", "corbeanca sat",
  ],
  IF_balotesti: [
    "balotești", "balotesti", "therme balotești", "therme balotesti",
  ],
};

export function detectSectorFromText(text: string): string | null {
  if (!text) return null;
  const normalized = text.toLowerCase();

  // Count matches per sector
  const scores: Record<string, number> = {};
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    scores[sector] = 0;
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        // Longer keywords weigh more (more specific)
        scores[sector] += kw.length;
      }
    }
  }

  // Pick top-scoring sector
  let best: string | null = null;
  let bestScore = 0;
  for (const [sector, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = sector;
    }
  }

  return bestScore >= 3 ? best : null;
}
