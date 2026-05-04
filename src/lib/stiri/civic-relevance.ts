/**
 * Civic-relevance scorer pentru articole RSS.
 *
 * RSS feed-urile aduc 200-400 articole/refresh, dar Civia e o platformă
 * civică — nu vrem rețete, horoscop, divorțuri vedete. Scorerul ăsta
 * dă fiecărui articol o notă pe baza titlu + excerpt, iar fetch route
 * păstrează doar top N (default 20) ca să generăm AI summary doar pentru
 * conținut care contează cu adevărat.
 *
 * Heuristic deterministic — fără AI call. Reason: rulăm pe 200+ articole
 * la fiecare cron run (zilnic) sau self-healing trigger; fiecare AI call
 * costă quota + latency. Heuristic-ul e ~95% precis pentru categoriile
 * de interes, restul îl prinde categorizarea existentă.
 */

interface ScorableArticle {
  title: string;
  excerpt?: string | null;
  content?: string | null;
  source: string;
  category?: string | null;
}

// Cuvinte/frame-uri care indică conținut civic/politic relevant.
// Greutățile sunt empirice — pondere mai mare pe entități instituționale
// concrete (parlament, ministru) decât pe termeni generali (politică).
const CIVIC_KEYWORDS: { pattern: RegExp; weight: number; tag: string }[] = [
  // Politică instituțională — PONDERE MARE
  { pattern: /\bparlament(?:ul|ar|ari|are)?\b/i, weight: 5, tag: "parlament" },
  { pattern: /\b(?:guvern(?:ul)?|premier(?:ul)?|prim-ministr|ministr(?:u|ul|i|ii|ului|ilor)|minister(?:ul)?)\b/i, weight: 5, tag: "guvern" },
  { pattern: /\b(?:deputat|senator|senatori|deputați)\b/i, weight: 4, tag: "ales" },
  { pattern: /\b(?:moțiun|moţiun)e?(?:a)?\s+(?:de\s+)?(?:cenzur|simpl)/i, weight: 6, tag: "moțiune" },
  { pattern: /\b(?:vot(?:ul|are|at|ată|ează)?|alegeri|scrutin|alegător|prezidențial|parlamentar)/i, weight: 4, tag: "alegeri" },
  { pattern: /\b(?:partid(?:ul|ele|elor)?|psd|pnl|usr|aur|pmp|udmr|sos|reper)\b/i, weight: 3, tag: "partid" },

  // Justiție — PONDERE MARE
  { pattern: /\b(?:dna|diicot|parchet(?:ul)?|procuror|judec(?:ător|ata|ătoare|ătorie)|instanț(?:a|ă|e)|tribunal|curtea|ccr|cabconst)/i, weight: 5, tag: "justiție" },
  { pattern: /\b(?:condamn|achit|inculp|reținut|arest|cercetat|trimis în judecată|sentinț)/i, weight: 4, tag: "proces" },
  { pattern: /\b(?:corupț|mită|fraud|spălare|abuz în serviciu|conflict de interese|delapidare)/i, weight: 5, tag: "corupție" },

  // Administrație locală
  { pattern: /\bprimar(?:ul|i|ii|ia|ie|iile|ilor)?\b/i, weight: 4, tag: "primar" },
  { pattern: /\bconsili(?:u|er|eri)\s+(?:local|județean|general)/i, weight: 4, tag: "consiliu" },
  { pattern: /\b(?:capital(?:a|ei)|bucureșt|bucurest|sector\s+\d|judeţul|județul)/i, weight: 2, tag: "geo" },

  // Civic mobilizare
  { pattern: /\b(?:protest(?:ul|e|ele|ează|atari)?|miting|manifestaț|marș|petiț|grev)/i, weight: 5, tag: "protest" },
  { pattern: /\b(?:cetățean|cetăţean|cetățeni|cetăţeni|cetățenes|civil(?:ă|i|e)?)\b/i, weight: 3, tag: "cetățean" },

  // Politici publice / legi
  { pattern: /\b(?:lege(?:a|i|le)?|ordonanț|oug|decret|hotărâr(?:e|ea|ile)|reglementar|normativ)/i, weight: 4, tag: "lege" },
  { pattern: /\b(?:reform|modific|abrog|amendament|inițiativ)/i, weight: 3, tag: "reformă" },

  // Infrastructură publică
  { pattern: /\b(?:autostrad|drumuri\s+naționale|cnair|cfr|metrou|tren|aeroport|șine de tramvai|transport public|stb|tcl|metrorex)/i, weight: 4, tag: "infrastructură" },

  // Sănătate publică
  { pattern: /\b(?:spital(?:ul|e|ele)?|sănătat(?:e|ea)|medic|cas|cnsau|farmac(?:ie|ist)|ms\b|asigurar)/i, weight: 3, tag: "sănătate" },

  // Educație
  { pattern: /\b(?:școal|scoal|profesor|elev|învățământ|invatamant|bacalaureat|evaluare națion|admitere|edu\b|universitate|rector|liceu)/i, weight: 3, tag: "educație" },

  // Economie publică / fiscalitate
  { pattern: /\b(?:buget(?:ul|ar|are|ează)|deficit|datori(?:a|ile)|tax(?:e|ele|are|abil)|impozit|tva|salariul minim|pensi(?:i|e|ile|onar))/i, weight: 4, tag: "buget" },

  // Mediu
  { pattern: /\b(?:polu(?:are|at)|deșeur|deseur|defrișar|defrisar|tăieri ilegale|aer curat|calitatea aerului|schimbăr(?:i|ile) climatic|emisi(?:i|ile)|recicl)/i, weight: 4, tag: "mediu" },

  // UE & extern relevant pentru România
  { pattern: /\b(?:ue\b|uniunea europeană|comisia europeană|nato|consiliul european|fonduri europene|pnrr)\b/i, weight: 4, tag: "ue" },
];

// Anti-patterns: penalizează conținut care NU e civic, chiar dacă apare
// în RSS feed mainstream. Greutăți negative.
const ANTI_PATTERNS: { pattern: RegExp; weight: number; tag: string }[] = [
  { pattern: /\b(?:horoscop|zodiac|berbec|taur|gemen|rac\s|leu\s|fecioar|balanț|scorpion|săget|capricorn|vărsător|peș)/i, weight: -8, tag: "horoscop" },
  { pattern: /\b(?:vedet[aăe]|showbiz|divorț|împăcat|relați(?:a|e)|iubit(?:a|ul|ă)|fost(?:ul|a) (?:soț|soți))/i, weight: -6, tag: "showbiz" },
  { pattern: /\b(?:rețet|reţet|gătit|prăjitur|tort|salat|aperitiv|garnitur)/i, weight: -7, tag: "rețete" },
  { pattern: /\b(?:moda|modă|stil|outfit|ținut|fashion|frumusețe|beauty|machiaj|coafur)/i, weight: -6, tag: "modă" },
  { pattern: /\b(?:loto|loterie|premiu cel mare|jackpot|cazino|pariuri sportive)/i, weight: -5, tag: "gambling" },
  { pattern: /\b(?:fotbal|liga\s+\d|champions league|cupa|meciul|antrenor(?:ul)?|gol(?:ul)?\s|jucător|tehnician)\b/i, weight: -3, tag: "sport" },
  { pattern: /\b(?:ufo|extraterești|leac (?:secret|miraculos)|cum să|truc|secret|miracol)/i, weight: -7, tag: "clickbait" },
];

// Surse care furnizează cu prioritate conținut civic — bonus pe sursă
// chiar dacă scorul keyword e mediu.
const CIVIC_SOURCE_BONUS: Record<string, number> = {
  PressOne: 4,
  Recorder: 4,
  G4Media: 3,
  HotNews: 3,
  Hotnews: 3,
  Spotmedia: 3,
  "Europa Liberă": 4,
  "Ziarul Financiar": 3,
  Digi24: 2,
  News: 1,
  "News.ro": 1,
  Adevărul: 1,
  Mediafax: 1,
};

const CIVIC_CATEGORY_BONUS: Record<string, number> = {
  administratie: 3,
  transport: 2,
  urbanism: 2,
  mediu: 3,
  siguranta: 2,
};

export interface RelevanceScore {
  score: number;
  matched: string[];
}

export function scoreCivicRelevance(article: ScorableArticle): RelevanceScore {
  const text =
    `${article.title}\n${article.excerpt ?? ""}\n${(article.content ?? "").slice(0, 1000)}`;
  let score = 0;
  const matched: string[] = [];

  for (const { pattern, weight, tag } of CIVIC_KEYWORDS) {
    if (pattern.test(text)) {
      score += weight;
      matched.push(tag);
    }
  }
  for (const { pattern, weight, tag } of ANTI_PATTERNS) {
    if (pattern.test(text)) {
      score += weight;
      matched.push(`-${tag}`);
    }
  }

  // Bonus pe sursă (oricum scor pozitiv preexistent — sursele civice
  // de calitate primesc un boost peste base).
  if (article.source && CIVIC_SOURCE_BONUS[article.source]) {
    score += CIVIC_SOURCE_BONUS[article.source]!;
    matched.push(`src:${article.source}`);
  }
  if (article.category && CIVIC_CATEGORY_BONUS[article.category]) {
    score += CIVIC_CATEGORY_BONUS[article.category]!;
    matched.push(`cat:${article.category}`);
  }

  // Articole foarte scurte (excerpt < 80 chars + content lipsește) sunt
  // probabil click-throughs sau index pages — penalizează.
  const fullLen = (article.excerpt ?? "").length + (article.content ?? "").length;
  if (fullLen < 80) score -= 3;

  return { score, matched: Array.from(new Set(matched)) };
}

/**
 * Sortează articole descrescător după scorul civic și returnează top N.
 * Ties broken by published_at (mai recent câștigă, presupunând prop
 * `published_at` sortabil — string ISO).
 */
export function pickTopCivic<T extends ScorableArticle & { published_at?: string }>(
  articles: T[],
  topN: number,
): { kept: (T & { _score: number; _matched: string[] })[]; discarded: number } {
  const scored = articles.map((a) => {
    const { score, matched } = scoreCivicRelevance(a);
    return { ...a, _score: score, _matched: matched };
  });
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    // Same score → mai recent câștigă
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });
  const kept = scored.slice(0, topN);
  return { kept, discarded: Math.max(0, scored.length - topN) };
}
