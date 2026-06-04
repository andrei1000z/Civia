/**
 * 2026-06-05 — Decodare corectă a header-elor / body-ului emailurilor inbound.
 *
 * Problemă raportată: subiectele răspunsurilor de la autorități apăreau corupte
 * („RE: Sesizare 00061 â Altele (cat egoria se creeazÄ...)") iar body-ul la fel
 * („BunÄ ziua, VÄ transmitem..."). Două cauze:
 *   1. SUBIECT — RFC 2047 encoded-words („=?UTF-8?B?...?=" / „=?UTF-8?Q?...?=")
 *      nu erau decodate corect; chunk-urile adiacente erau lipite cu spațiu
 *      („cat egoria" în loc de „categoria").
 *   2. BODY — bytes UTF-8 citiți ca Latin-1 → mojibake („Bună"→„BunÄ", „î"→„Ã®").
 *
 * `raw_headers.subject` conține valoarea ORIGINALĂ RFC 2047 (recuperabilă 100%).
 * Body-ul e deja decodat greșit de worker; îl reparăm best-effort (UTF-8 ca
 * Latin-1 — verificat că bytes-urile de control supraviețuiesc în Postgres).
 */

/** Decodează un singur encoded-word RFC 2047 (B=base64, Q=quoted-printable). */
function decodeEncodedWord(charset: string, enc: string, text: string): string {
  let bytes: Buffer;
  if (enc.toUpperCase() === "B") {
    bytes = Buffer.from(text, "base64");
  } else {
    // Q: „_" → spațiu, „=XX" → byte.
    const qp = text
      .replace(/_/g, " ")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
    bytes = Buffer.from(qp, "latin1");
  }
  const cs = charset.toLowerCase().replace(/['"]/g, "");
  if (cs === "utf-8" || cs === "utf8") return bytes.toString("utf8");
  // Latin-1 / Windows-1252 / ISO-8859-* → tratăm ca latin1 (suficient pt. RO).
  return bytes.toString("latin1");
}

const ENCODED_WORD_RE = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
const HAS_ENCODED_WORD = /=\?[^?]+\?[BbQq]\?[^?]*\?=/;

/**
 * Decodează un header MIME cu encoded-words RFC 2047. Colapsează spațiile dintre
 * encoded-words adiacente (RFC 2047 §6.2: whitespace între encoded-words se
 * ignoră) — fix pentru „cat egoria" → „categoria".
 */
export function decodeMimeWords(input: string): string {
  if (!input) return input;
  // 1. Scoate whitespace-ul dintre două encoded-words adiacente.
  let s = input.replace(
    /(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?[^?]*\?=)/g,
    "$1",
  );
  // 2. Decodează fiecare encoded-word.
  s = s.replace(ENCODED_WORD_RE, (_, charset: string, enc: string, text: string) =>
    decodeEncodedWord(charset, enc, text),
  );
  return s;
}

const MOJIBAKE_MARKERS = /[ÃÄÈÂ]/;
const RO_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/g;
const MOJI_MARKERS_G = /[ÃÄÈ]/g;
const REPLACEMENT = "�";

/**
 * Repară mojibake-ul „UTF-8 citit ca Latin-1" („BunÄ"→„Bună", „Ã®"→„î").
 * Conservator: aplică reparația DOAR dacă rezultatul are mai multe diacritice
 * românești + mai puține semne de mojibake ȘI fără caractere de înlocuire.
 * Astfel, textul deja corect NU e atins.
 */
export function repairMojibake(text: string): string {
  if (!text || !MOJIBAKE_MARKERS.test(text)) return text;
  let repaired: string;
  try {
    repaired = Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
  if (repaired.includes(REPLACEMENT)) return text;
  const score = (str: string): number =>
    (str.match(RO_DIACRITICS) || []).length - (str.match(MOJI_MARKERS_G) || []).length;
  return score(repaired) > score(text) ? repaired : text;
}

/**
 * Subiect corect dintr-un email inbound. Preferă `raw_headers.subject` (RFC 2047
 * brut, recuperabil 100%); altfel decodează/repară valoarea pre-decodată.
 */
export function decodeEmailSubject(
  subject: string | null | undefined,
  rawHeaders?: Record<string, unknown> | null,
): string {
  const headerVal =
    rawHeaders && typeof (rawHeaders["subject"] ?? rawHeaders["Subject"]) === "string"
      ? ((rawHeaders["subject"] ?? rawHeaders["Subject"]) as string)
      : null;
  // Header brut cu encoded-words → sursa cea mai bună.
  if (headerVal && HAS_ENCODED_WORD.test(headerVal)) {
    return decodeMimeWords(headerVal).replace(/\s+/g, " ").trim();
  }
  const s = subject ?? headerVal ?? "";
  if (HAS_ENCODED_WORD.test(s)) return decodeMimeWords(s).replace(/\s+/g, " ").trim();
  return repairMojibake(s).replace(/\s+/g, " ").trim();
}
