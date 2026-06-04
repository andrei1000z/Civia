/**
 * 2026-06-04 — Restaurare DETERMINISTĂ a diacriticelor românești.
 *
 * Motiv: chiar și modelul 70B lasă ocazional diacritice incomplete
 * („cosuri/stalpii/masinile") iar pe fallback la 8B (rate limit) mai multe.
 * Aplicăm un post-pass determinist peste output-ul AI + în fallback-urile
 * deterministe, ca textul public/către autorități să arate corect gramatical.
 *
 * PRINCIPIU DE SIGURANȚĂ: dicționarul conține DOAR cuvinte UNIVOCE — forme ASCII
 * care în română înseamnă aproape întotdeauna varianta cu diacritice. Cuvintele
 * AMBIGUE sunt EXCLUSE intenționat (ar strica sensul):
 *   fata (fată/the girl), tata, sora, peste (over/fish), vine, masa, par,
 *   publica (publishes/public-fem), prezenta, mare (sea/big), tara, vara…
 * Cuvintele care DEJA conțin diacritice sunt sărite (nu re-procesăm).
 */

// ASCII (lowercase) → formă corectă cu diacritice. Doar cuvinte univoce.
const MAP: Record<string, string> = {
  // funcționale foarte frecvente (text românesc)
  in: "în", si: "și", sunt: "sunt", intre: "între", impotriva: "împotriva",
  inainte: "înainte", incat: "încât", insa: "însă", inca: "încă",
  // vehicule / circulație
  masina: "mașina", masini: "mașini", masinile: "mașinile", masinilor: "mașinilor",
  masinii: "mașinii", autovehicul: "autovehicul", circula: "circulă",
  circulatie: "circulație", circulatia: "circulația", circulatiei: "circulației",
  viteza: "viteză", vitezei: "vitezei", incetinesc: "încetinesc",
  incetineste: "încetinește", incetinit: "încetinit", stationare: "staționare",
  stationeaza: "staționează", stationat: "staționat",
  // infrastructură stradală
  stalp: "stâlp", stalpi: "stâlpi", stalpii: "stâlpii", stalpul: "stâlpul",
  stalpilor: "stâlpilor", stalpisor: "stâlpișor", stalpisori: "stâlpișori",
  stalpisorii: "stâlpișorii", soseaua: "șoseaua", sosea: "șosea", soselei: "șoselei",
  trotuare: "trotuare", carosabil: "carosabil", strazi: "străzi",
  strazile: "străzile", strazilor: "străzilor", sant: "șanț", santuri: "șanțuri",
  groapa: "groapă", denivelare: "denivelare", semnalizare: "semnalizare",
  // siguranță / impact
  siguranta: "siguranța", sigurantei: "siguranței", pericol: "pericol",
  periculos: "periculos", periculoasa: "periculoasă", afecteaza: "afectează",
  impiedica: "împiedică", impiedicat: "împiedicat", impiedicata: "împiedicată",
  obstructioneaza: "obstrucționează", restrictioneaza: "restricționează",
  ingust: "îngust", ingusta: "îngustă", intuneric: "întuneric",
  intunecat: "întunecat", intunecata: "întunecată", intunecate: "întunecate",
  inalt: "înalt", inalta: "înaltă",
  // cetățeni / autorități
  cetatean: "cetățean", cetateanul: "cetățeanul", cetateni: "cetățeni",
  cetatenii: "cetățenii", cetatenilor: "cetățenilor", pietoni: "pietoni",
  pietonilor: "pietonilor", locuitori: "locuitori", locuitorii: "locuitorii",
  locuitorilor: "locuitorilor", primarie: "primărie", primaria: "primăria",
  primariei: "primăriei", politie: "poliție", politia: "poliția",
  politiei: "poliției", institutie: "instituție", institutia: "instituția",
  institutiei: "instituției", institutiilor: "instituțiilor",
  // proceduri
  atentie: "atenție", atentia: "atenția", situatie: "situație",
  situatia: "situația", situatiei: "situației", solutie: "soluție",
  solutia: "soluția", solutionare: "soluționare", solutionarea: "soluționarea",
  petitie: "petiție", petitia: "petiția", petitii: "petiții",
  petitiilor: "petițiilor", sanctiune: "sancțiune", sanctiuni: "sancțiuni",
  sanctionare: "sancționare", sanctionarea: "sancționarea",
  sanctionat: "sancționat", interventie: "intervenție", interventia: "intervenția",
  inregistrare: "înregistrare", inregistrarea: "înregistrarea",
  reparatie: "reparație", reparatii: "reparații", reparatiile: "reparațiile",
  actiune: "acțiune", actiuni: "acțiuni", actiunea: "acțiunea",
  masura: "măsură", masuri: "măsuri", masurile: "măsurile",
  masurilor: "măsurilor", raspuns: "răspuns", raspunsul: "răspunsul",
  raspunsuri: "răspunsuri", numar: "număr", numarul: "numărul",
  numarului: "numărului", judet: "județ", judetul: "județul",
  judetului: "județului", competente: "competențe", competentelor: "competențelor",
  corespunzator: "corespunzător", corespunzatoare: "corespunzătoare",
  // obiecte / mediu
  cosuri: "coșuri", cosurile: "coșurile", cosului: "coșului", gunoi: "gunoi",
  servetel: "șervețel", servetelul: "șervețelul", servetele: "șervețele",
  caine: "câine", caini: "câini", cainii: "câinii", cainele: "câinele",
  goala: "goală", goale: "goale", rugam: "rugăm", rugaminte: "rugăminte",
  problema: "problemă", zona: "zonă",
};

const HAS_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const WORD_RE = /[A-Za-zĂÂÎȘȚăâîșț]+/g;

function applyCase(original: string, replacement: string): string {
  // ALL CAPS (>1 literă) → tot caps
  if (original.length > 1 && original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  // Prima literă mare → capitalize replacement
  if (original[0] === original[0]!.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Restaurează diacriticele românești pe cuvintele UNIVOCE din dicționar.
 * Cuvintele care deja au diacritice sunt lăsate neatinse. Păstrează
 * capitalizarea originală.
 */
export function restoreDiacritics(text: string): string {
  if (!text) return text;
  return text.replace(WORD_RE, (word) => {
    if (HAS_DIACRITICS.test(word)) return word; // deja corect
    const fixed = MAP[word.toLowerCase()];
    return fixed ? applyCase(word, fixed) : word;
  });
}
