/**
 * 2026-06-08 — Sinteză EXTRACTIVĂ DETERMINISTĂ (zero AI, zero dependențe ML).
 *
 * Fallback pentru sinteza știrilor când lanțul AI e indisponibil (toți providerii
 * rate-limited) — în loc de „se generează, revino", afișăm un rezumat real,
 * instant, construit din textul articolului.
 *
 * Algoritm (research-driven, Mihalcea & Tarău 2004 + features):
 *   1. Preprocesare + segmentare în propoziții (RO-aware).
 *   2. TextRank ponderat (PageRank pe graf de propoziții; similaritate =
 *      cuvinte comune / log-normalizat).
 *   3. Combinare cu poziție (lead jurnalistic) + overlap cu titlul.
 *   4. Selecție top-K cu anti-redundanță (MMR-lite) + reordonare pozițională.
 *   5. Extragere „Cifre cheie" (reutilizează extractFacts).
 *   6. Output în formatul markdown pe care îl parsează deja AiSummary.tsx.
 *
 * Conservator: NU inventează „Context"/„De ce contează" (ar fi fabricare) —
 * extractiv = STRICT ce e în text.
 */
import { extractFacts } from "./extract-facts";

const STOP = new Set([
  "si", "sau", "de", "la", "in", "pe", "cu", "un", "o", "este", "ca", "pentru",
  "care", "dar", "sa", "sau", "lui", "ei", "a", "al", "ale", "din", "prin", "sub",
  "fara", "pana", "dupa", "ce", "cei", "cele", "cel", "cea", "nu", "mai", "foarte",
  "se", "au", "fost", "va", "vor", "ar", "fi", "sunt", "era", "fie", "ne", "te",
  "el", "ea", "noi", "voi", "lor", "acest", "aceasta", "aceste", "acesti", "acel",
  "acea", "unei", "unui", "unor", "catre", "spre", "intre", "peste", "cand", "cum",
  "unde", "daca", "deci", "insa", "totusi", "asadar", "astfel", "precum", "conform",
  "potrivit", "doar", "chiar", "tot", "toate", "toti", "alt", "alta", "alte", "i",
  "s", "l", "le", "li", "iar", "ori", "nici", "decat", "ceea", "isi", "sai",
]);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tokenize = (s: string): string[] =>
  (norm(s).match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length >= 2 && !STOP.has(t));

// Abrevieri RO care NU termină o propoziție (evită split greșit).
const ABBR = /\b(nr|art|dl|dna|etc|cca|pct|str|bd|al|dr|prof|ing|ec|gen|col|lt|cpt|min|max|vol|pag|fig|ex|cf|op|cit|ed|coord|red|tel|fax|nr\.crt|alin|lit|cap|sect)\.$/i;

const BOILERPLATE =
  /^(foto|sursa|sursă|video|galerie|citește (și|mai)|citeste (si|mai)|abonează|aboneaza|distribuie|share|home|știri|stiri|externe|interne|data (actualizării|publicării|actualizarii|publicarii)|publicat|actualizat|urmărește|urmareste|vezi (și|galeria)|click|reclamă|reclama|advertisement)\b/i;

// Marcaje de FOOTER (related articles / share / aplicații) — totul DUPĂ ele e
// boilerplate (s-a scăpat de la scraping). Tăiem articolul la primul marcaj.
const FOOTER =
  /(editor\s*:|etichete\s*:|urm[ăa]re[șs]te (?:[șs]tirile|pe)|top citite|cele mai citite|desc[ăa]rc[ăa] aplica[țt]ia|cite[șs]te [șs]i|articole (?:similare|recomandate)|vezi [șs]i\b|aboneaz[ăa]|google news|pe facebook|pe twitter|digi sport|digi fm|pro fm|sursa? foto|distribuie pe)/i;

const RO_MONTHS_RE = "ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie";

/** Normalizează cedila (Ş/ş/Ţ/ţ, U+015E/F, U+0162/3) → virgulă (Ș/ș/Ț/ț) —
 *  sursele RO le amestecă; uniformizăm pentru regex + output corect. */
function normalizeDiacritics(s: string): string {
  return s.replace(/Ş/g, "Ș").replace(/ş/g, "ș").replace(/Ţ/g, "Ț").replace(/ţ/g, "ț");
}

/** Curăță blob-uri de metadate INCISE între propoziții (byline, locație+dată+oră,
 *  „Scris de", „AUTORUL RECOMANDĂ", „Share") care n-au limite de propoziție și
 *  poluează rezumatul. */
function stripInlineNoise(text: string): string {
  return text
    .replace(new RegExp(`\\b[A-ZĂÂÎȘȚ]{3,}\\s+\\d{1,2}\\s+(?:${RO_MONTHS_RE})\\s+\\d{4}(?:\\s+\\d{1,2}:\\d{2})?`, "gi"), " ")
    .replace(/\bScris de\s+[A-ZĂÂÎȘȚ][\wăâîșțĂÂÎȘȚ.-]+(?:\s+[A-ZĂÂÎȘȚ][\wăâîșțĂÂÎȘȚ.-]+){0,2}/g, " ")
    .replace(/\bEditor\s*:\s*[A-ZĂÂÎȘȚ][\wăâîșțĂÂÎȘȚ.-]+(?:\s+[A-ZĂÂÎȘȚ][\wăâîșțĂÂÎȘȚ.-]+)?/g, " ")
    .replace(/\b(AUTORUL RECOMANDĂ|VEZI ȘI|CITEȘTE ȘI|RECOMANDĂ|FOTO|VIDEO)\s*:?[^.!?]{0,120}/g, " ")
    // widget „Adaugă [Sursa] ca sursă preferată (în Google)" + sursa preferată
    .replace(/Adaug[ăa] [A-ZĂÂÎȘȚ][\wăâîșț.]+ ca surs[ăa] preferat[ăa](?:\s+[îi]n Google)?/gi, " ")
    // teaser de sondaj „Ce au răspuns românii la întrebarea ..."
    .replace(/Ce au răspuns românii la întrebarea[^?]*\?/gi, " ")
    .replace(/\bShare\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Taie tot ce e după primul marcaj de footer (related/share/apps). */
function cutFooter(text: string): string {
  const m = text.slice(150).match(FOOTER); // căutăm după primii 150 chars
  if (m && m.index !== undefined) return text.slice(0, 150 + m.index).trim();
  return text;
}

/** Articolul scrapuit începe adesea cu „HOME ... Data publicării: DD.MM.YYYY HH:MM"
 *  — corpul real e DUPĂ ultima dată de header. */
function cutHeader(text: string): string {
  const dates = [...text.matchAll(/Data (?:publicării|actualizării|publicarii|actualizarii)\s*:?\s*\d{2}\.\d{2}\.\d{4}[, ]*\d{0,2}:?\d{0,2}/gi)];
  if (dates.length) {
    const last = dates[dates.length - 1]!;
    const after = text.slice(last.index! + last[0].length).trim();
    if (after.length > 300) return after;
  }
  return text;
}

/** Segmentare în propoziții (Intl.Segmenter RO + merge pe abrevieri; fallback regex). */
function segmentSentences(text: string): string[] {
  let raw: string[];
  try {
    const seg = new Intl.Segmenter("ro", { granularity: "sentence" });
    raw = [...seg.segment(text)].map((x) => x.segment);
  } catch {
    raw = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
  }
  const out: string[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (!t) continue;
    // lipește fragmentul de precedentul dacă acela se termină în abreviere
    if (out.length && ABBR.test(out[out.length - 1]!)) out[out.length - 1] += " " + t;
    else out.push(t);
  }
  return out;
}

function isUseful(sentence: string): boolean {
  const t = sentence.trim();
  if (t.length < 40 || t.length > 400) return false;
  if (BOILERPLATE.test(t)) return false;
  // prea multe MAJUSCULE = navigație/titlu de secțiune
  const caps = (t.match(/\b[A-ZĂÂÎȘȚ]{2,}\b/g) || []).length;
  if (caps > 4) return false;
  if (tokenize(t).length < 4) return false;
  return true;
}

/** Similaritate overlap log-normalizată (Mihalcea & Tarău). */
function sim(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let common = 0;
  for (const w of new Set(a)) if (setB.has(w)) common++;
  const denom = Math.log(a.length) + Math.log(b.length);
  return denom <= 0 ? 0 : common / denom;
}

const norm01 = (arr: number[]): number[] => {
  if (arr.length === 0) return arr;
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return arr.map((v) => (mx > mn ? (v - mn) / (mx - mn) : 0));
};

const capitalize = (s: string) => (s.length ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * Sinteză extractivă. Întoarce string markdown (format AiSummary.tsx) sau null
 * dacă textul e prea slab pentru un rezumat util.
 */
export function extractiveSummary(title: string, content: string | null): string | null {
  const cleaned = normalizeDiacritics((content || "").replace(/\s+/g, " ").trim());
  const text = stripInlineNoise(cutFooter(cutHeader(cleaned)));
  if (text.length < 350) return null;

  const sentences = segmentSentences(text)
    .filter(isUseful)
    .map((t, i) => ({ id: i, text: t }));
  if (sentences.length < 1) return null;

  const tok = sentences.map((s) => [...new Set(tokenize(s.text))]);
  const N = sentences.length;

  // Graf de similaritate (simetric).
  const W: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const s = sim(tok[i]!, tok[j]!);
      W[i]![j] = s;
      W[j]![i] = s;
    }
  }
  const rowSum = W.map((row) => row.reduce((a, b) => a + b, 0));

  // TextRank (PageRank ponderat).
  const d = 0.85;
  let score = new Array(N).fill(1);
  for (let it = 0; it < 50; it++) {
    let maxDelta = 0;
    const next = new Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        if (i === j || W[j]![i] === 0 || rowSum[j] === 0) continue;
        sum += (W[j]![i]! / rowSum[j]!) * score[j];
      }
      next[i] = 1 - d + d * sum;
      maxDelta = Math.max(maxDelta, Math.abs(next[i] - score[i]));
    }
    score = next;
    if (maxDelta <= 1e-4) break;
  }

  // Features auxiliare.
  const titleTok = new Set(tokenize(title));
  const position = sentences.map((_, i) => 1 / (1 + i));
  const titleOv = tok.map((t) => {
    if (titleTok.size === 0 || t.length === 0) return 0;
    let c = 0;
    for (const w of t) if (titleTok.has(w)) c++;
    return c / (titleTok.size + t.length - c); // Jaccard
  });

  const tr = norm01(score), pos = norm01(position), ti = norm01(titleOv);
  const final = sentences.map((_, i) => 0.55 * tr[i]! + 0.25 * pos[i]! + 0.2 * ti[i]!);

  // Selecție top-K cu anti-redundanță (MMR-lite).
  const ranked = sentences.map((s, i) => ({ ...s, i, fscore: final[i]! })).sort((a, b) => b.fscore - a.fscore);
  const K = Math.min(text.length < 1400 ? 2 : 3, sentences.length);
  const selected: typeof ranked = [];
  for (const cand of ranked) {
    if (selected.length >= K) break;
    if (selected.some((s) => sim(tok[cand.i]!, tok[s.i]!) > 0.6)) continue;
    selected.push(cand);
  }
  if (selected.length < 1) return null;
  selected.sort((a, b) => a.id - b.id); // reordonare pozițională (flux narativ)

  let peScurt = capitalize(selected.map((s) => s.text.trim()).join(" "));
  // Curăță reziduuri din stripping: spațiu înainte de punctuație + semne orfane
  // la final (ex. „ ?"" rămas dintr-un teaser tăiat) + garantează final cu punct.
  peScurt = peScurt
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s*[?!]?\s*["”]\s*$/, "")
    .replace(/\s+$/, "");
  if (!/[.!?]$/.test(peScurt)) peScurt += ".";

  // Cifre cheie (extragere deterministă).
  const facts = extractFacts(text, 5);
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const f of facts) {
    if (f.label === "menționate") continue; // generic catch-all = zgomot, sărim
    const key = `${f.formattedValue}|${f.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(`- **${f.formattedValue}** ${f.label}`);
  }

  let out = `Pe scurt:\n${peScurt}`;
  if (bullets.length >= 2) out += `\n\nCifre cheie:\n${bullets.join("\n")}`;
  return out;
}
