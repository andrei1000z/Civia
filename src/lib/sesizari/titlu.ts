/**
 * 2026-06-04 — Helpers PURI (fără AI) pentru titlul sesizării.
 *
 * Bug raportat de user: titlul ajungea literal „Altele (categoria se creează
 * automat din descriere)" — eticheta tip-picker-ului „altele" se scurgea ca
 * titlu (form fallback la `tipLabel` când userul nu tasta un titlu). De acolo
 * intra și în SUBIECTUL emailului către autorități: „Sesizare 00061 — Altele
 * (categoria se creează automat din descriere)" → ne făceam de râs.
 *
 * Acest modul e PUR (zero import AI/Groq) ca să poată fi importat și pe client
 * (SesizareForm) și pe server (create route). Generarea AI a titlului trăiește
 * în `reformulate-descriere.ts → generateTitlu` și folosește fallback-ul de aici.
 */

import { SESIZARE_TIPURI } from "@/lib/constants";
import { restoreDiacritics } from "@/lib/sesizari/diacritice";

const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * True dacă titlul NU e un titlu real: gol, prea scurt, un placeholder
 * („...categoria se creează..."), fallback-ul generic „Sesizare civică", sau
 * identic cu label-ul/short-ul oricărui tip (e o etichetă de picker, nu titlu).
 */
export function isPlaceholderTitlu(titlu: string | null | undefined): boolean {
  const t = (titlu ?? "").trim();
  if (t.length < 5) return true;
  if (/categoria\s+se\s+cre/i.test(t)) return true; // „...(categoria se creează...)"
  if (/\(categ/i.test(t)) return true;
  if (/^sesizare\s+civic/i.test(t)) return true; // fallback generic vechi
  const n = norm(t);
  for (const ti of SESIZARE_TIPURI) {
    if (norm(ti.label) === n) return true;
    if (ti.short && norm(ti.short) === n) return true;
  }
  return false;
}

/** Cuvinte generice de adresă — sărite când căutăm numele real al străzii. */
const ADDRESS_STOPWORDS = new Set([
  "strada", "str", "bulevardul", "bdul", "bd", "soseaua", "sos", "calea",
  "piata", "intersectia", "aleea", "splaiul", "drumul", "nr", "bloc", "bl",
  "scara", "sc", "sector", "ap", "apartamentul", "etaj", "et", "si", "de",
  "la", "din", "pe", "municipiul", "orasul", "comuna", "judetul", "bucuresti",
  "zona", "langa", "colt", "cu",
  // conectori + descriptori de tronson — NU sunt nume de stradă (altfel
  // „intre" din locație matchuia „pr-intre" din descriere → bug intro).
  "intre", "tronson", "tronsonul", "cuprins", "cuprinsa", "ambele", "ambelor",
  "trotuar", "trotuare", "trotuarul", "trotuarele", "segment", "segmentul",
  "spre", "pana", "catre", "intrarea", "fata", "spatele", "sensul", "dintre",
]);

/**
 * True dacă descrierea conține deja numele locației (un token semnificativ din
 * `locatie`, ex. numele străzii). Folosit ca să NU repetăm locația în intro-ul
 * textului formal („...problemă constatată pe Strada X: Pe Strada X ...").
 */
export function descriereContainsLocatie(descriere: string, locatie: string): boolean {
  // Potrivire pe CUVÂNT ÎNTREG (nu substring): altfel „intre" (din «între»)
  // matchuia în «p-rintre», iar „voda" în «moldova» etc. → intro pierdea adresa.
  const dWords = new Set(norm(descriere).split(/[\s,.\-/]+/).filter(Boolean));
  if (dWords.size === 0) return false;
  const tokens = norm(locatie)
    .split(/[\s,.\-/]+/)
    .filter((w) => w.length >= 4 && !ADDRESS_STOPWORDS.has(w) && !/^\d+$/.test(w));
  if (tokens.length === 0) return false;
  return tokens.some((t) => dWords.has(t));
}

/**
 * READ-SIDE GUARD — întoarce un titlu CURAT pentru afișare/email, niciodată un
 * placeholder. De apelat la TOATE locurile care citesc `sesizare.titlu` din DB
 * (subiecte email către autorități, OG image, RSS, PDF, pagina publică),
 * fiindcă rândurile VECHI din DB pot avea deja titlul placeholder „Altele
 * (categoria se creează automat din descriere)" (create înainte de fix-ul din
 * create route). Pur + sincron (fără AI) ca să fie apelabil oriunde la randare.
 */
export function safeTitlu(
  titlu: string | null | undefined,
  opts?: { descriere?: string | null },
): string {
  if (!isPlaceholderTitlu(titlu)) return (titlu ?? "").trim();
  // titlul stocat e placeholder → derivăm unul curat din descriere (sau
  // fallback final „Sesizare civică" via deriveTitluFromDescriere).
  return deriveTitluFromDescriere(opts?.descriere ?? "");
}

/**
 * Derivă DETERMINIST un titlu scurt din descriere (fallback fără AI).
 * Prima clauză, fără salut, Sentence case, ≤ 70 caractere. Nu returnează
 * niciodată placeholder — minim „Sesizare civică".
 */
export function deriveTitluFromDescriere(descriere: string | null | undefined): string {
  let s = (descriere ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "Sesizare civică";
  // scoate salut dacă a scăpat în descriere
  s = s.replace(/^(bun[ăa]\s+ziua|bun[ăa]\s+seara|salut(?:are)?|stimate?\s+\w+)[\s,.:;!-]*/i, "").trim();
  if (!s) return "Sesizare civică";
  // prima propoziție (până la . ! ?)
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0] ?? s;
  let title = firstSentence.trim();
  if (title.length > 70) {
    const cut = title.slice(0, 70);
    const lastSpace = cut.lastIndexOf(" ");
    title = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
  }
  title = restoreDiacritics(title.replace(/[.,;:!?\s]+$/, "").trim());
  if (title.length < 3) return "Sesizare civică";
  return title.charAt(0).toUpperCase() + title.slice(1);
}
