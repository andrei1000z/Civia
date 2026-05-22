// Scrubber for PUBLIC display of a sesizare's formal_text.
// Outgoing emails keep the real name + address (authorities need them for
// legal identification). But the website version must hide the home
// address always, and the author's name when hide_name is enabled.

export interface ScrubOptions {
  authorName: string | null;
  hideName: boolean;
}

const ADDRESS_REDACTED = "[adresa]";
const NAME_REDACTED = "[nume]";

// End-of-address markers: the address starts after "locuiesc în/pe" or
// "domiciliat în" and continues until one of these shows up. Includes:
//   • " și {verb}"    — "și doresc / și vă aduc / și solicit..."
//   • ", {verb}"      — "locuiesc în X, Sector 5, vă aduc..." (verb starts
//                       after the last address comma)
//   • ". "            — next sentence, but NOT abbreviations like "Str."/"bl."
//   • double newline  — paragraph break
//   • end of string
// We write the address with a lookahead so the marker stays in the output.
// Sentence-end inside address: „[.?!] + whitespace + Capital" — DAR NU
// daca punctul vine dupa o abreviere romana de adresa (Str., Bd., Bl.,
// Sc., Ap., Et., Nr., Sect., Jud., Com., Sos., Cal., Cod.) pentru ca dupa
// ele urmeaza obligatoriu un cuvant cu majuscula (numele strazii, blocului).
// Bug istoric (raport 2026-05-14): „Str. Novaci..." prelua doar „Str" si
// lasa restul adresei in plain text → leak PII.
const SENTENCE_END_NOT_ABBREV = String.raw`(?<!\b(?:str|bd|bld|blv|bl|sc|ap|et|nr|sect|sec|jud|com|loc|cod|sos|cal))[.?!]\s+[A-ZĂÂÎȘȚ]`;

const ADDRESS_END = String.raw`(?=\s*(?:\s+(?:și|si|şi)\s+\w+|\s+(?:vă|va|mă|ma|îmi|imi|doresc|solicit|adresez|semnal(?:ez|au)|aduc)\b|${SENTENCE_END_NOT_ABBREV}|\n\s*\n|$))`;

/**
 * Strips the home address (and optionally the author's name) from an
 * AI-generated or templated formal letter. Matches both openers we've
 * used:
 *   1. "Mă numesc {NAME}, locuiesc pe/în {ADDRESS} și doresc..."  (new)
 *   2. "Subsemnatul(a) {NAME}, domiciliat(ă) pe/în {ADDRESS}, ..."  (legacy)
 * Also redacts the signature line when hiding the name, and any
 * standalone occurrence of the name mid-text.
 *
 * The ADDRESS_END sentinel is crafted so it doesn't stop at commas inside
 * the address itself (Strada X nr 12, Sector 5, București) nor at periods
 * inside Romanian abbreviations (Str., nr., bl., ap., et., sc.).
 */
export function scrubFormalTextForPublic(text: string, opts: ScrubOptions): string {
  if (!text) return text;
  let out = text;

  const nameRedacted = opts.hideName ? NAME_REDACTED : (opts.authorName?.trim() || "Cetățean");

  // Connector intre nume si verb: AI-ul genereaza fie „X, locuiesc" fie
  // „X și locuiesc" (fara virgula). Bug 2026-05-14: regex-ul cerea STRICT
  // virgula → texte cu „și locuiesc" treceau nescrubate → leak GDPR
  // (numele + adresa originalului ajungeau in mailto-ul co-semnatarilor).
  const NAME_VERB_CONNECTOR = String.raw`(?:,\s*|\s+(?:și|şi|si)\s+)`;

  // 1. New opener: "Mă numesc X[,| și] locuiesc pe/în {ADDRESS}"
  const newOpener = new RegExp(
    String.raw`M[ăa]\s+numesc\s+[^,\n]+?\s*${NAME_VERB_CONNECTOR}locuiesc\s+(?:pe|în|in)\s+[^\n]+?${ADDRESS_END}`,
    "gim",
  );
  out = out.replace(newOpener, () => `Mă numesc ${nameRedacted}, locuiesc în ${ADDRESS_REDACTED}`);

  // 2. Legacy opener: "Subsemnatul/Subsemnata X[,| și] domiciliat(ă) pe/în Y"
  const legacyOpener = new RegExp(
    String.raw`Subsemnat(?:ul|a|ul\(a\)|a\/Subsemnatul)?\s+[^,\n]+?\s*${NAME_VERB_CONNECTOR}domiciliat(?:\(?ă\)?|ă|a)?\s+(?:pe|în|in)\s+[^\n]+?${ADDRESS_END}`,
    "gim",
  );
  out = out.replace(
    legacyOpener,
    () => `Subsemnat(ul/a) ${nameRedacted}, domiciliat(ă) în ${ADDRESS_REDACTED}`,
  );

  // 3. Fallback: any remaining "locuiesc pe/în X" or "domiciliat în X"
  // clause the openers above didn't catch (user typed a weird variant).
  const bareLocuiesc = new RegExp(
    String.raw`\blocuiesc\s+(?:pe|în|in)\s+[^\n]+?${ADDRESS_END}`,
    "gim",
  );
  out = out.replace(bareLocuiesc, `locuiesc în ${ADDRESS_REDACTED}`);

  const bareDomiciliat = new RegExp(
    String.raw`\bdomiciliat(?:\(?ă\)?|ă|a)?\s+(?:pe|în|in)\s+[^\n]+?${ADDRESS_END}`,
    "gim",
  );
  out = out.replace(bareDomiciliat, `domiciliat(ă) în ${ADDRESS_REDACTED}`);

  // 4. Signature block (always uses the name). If hiding, redact it.
  if (opts.hideName) {
    out = out.replace(
      /(Cu\s+(?:respect|stim[ăa]),?\s*\n)[^\n]+/i,
      `$1${NAME_REDACTED}`,
    );
  }

  // 5. „Mă numesc X." sau „Mă numesc X și doresc/etc" FĂRĂ clauza locuiesc.
  //    AI generează acest pattern când profilul user-ului nu are adresă.
  //    Bug raportat 5/21/2026 pe 00045: name "Adrian" apărea vizibil.
  //    Pattern: „Mă numesc <word(s)>" până la punct, virgulă sau verb.
  //    5/22/2026 — adăugat ", locuiesc în [adresa]" la output ca user să
  //    vadă formatul complet pe pagina publică (cu adresa redactată), nu
  //    doar "Mă numesc [nume]. Doresc...".
  const NAKED_OPENER_END = String.raw`(?=\s*(?:\s+(?:și|si|şi)\s+\w|\s+(?:vă|va|mă|ma|îmi|imi|doresc|solicit|adresez|semnal(?:ez|au)|aduc|vreau)\b|[.?!]|\n|$))`;
  const nakedOpener = new RegExp(
    String.raw`M[ăa]\s+numesc\s+[A-ZĂÂÎȘȚ][^,.\n]*?${NAKED_OPENER_END}`,
    "gim",
  );
  out = out.replace(nakedOpener, `Mă numesc ${nameRedacted}, locuiesc în ${ADDRESS_REDACTED}`);

  // 6. Any leftover literal occurrences of the real name mid-text —
  // redactăm și NUMELE COMPLET și fiecare cuvânt individual ≥3 chars.
  // Asta acoperă cazul când DB stochează „Adrian Mușat" (full) dar
  // AI a generat doar „Adrian" (prenume) — fără split per cuvânt,
  // redactarea pe full name nu match-uiește prenumele singur.
  if (opts.hideName && opts.authorName && opts.authorName.trim().length >= 3) {
    const fullEsc = opts.authorName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${fullEsc}\\b`, "gi"), NAME_REDACTED);
    // Redact fiecare cuvânt din nume (prenume, nume de familie, etc.)
    for (const word of opts.authorName.trim().split(/\s+/)) {
      if (word.length < 3) continue;
      // Skip cuvinte care arată ca prepoziții / conector (Andrei „de la"...)
      if (/^(de|la|al|sau|si|și)$/i.test(word)) continue;
      const wEsc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${wEsc}\\b`, "gi"), NAME_REDACTED);
    }
  }
  // Curăță „[nume] [nume]" → „[nume]" (după redactare per-cuvânt).
  out = out.replace(/(\[nume\])\s+\[nume\](\s+\[nume\])*/g, "$1");

  return out;
}
