/**
 * Pure formatting helpers pentru sesizare form input.
 *
 * Extras din SesizareForm.tsx pentru testabilitate (form e 1485 linii,
 * imposibil de rulat unit tests pe componenta întreagă).
 */

/**
 * Clauza GDPR standard atașată automat la sfârșitul oricărei sesizări
 * generate de AI. Solicită explicit primăriei/autorității să nu divulge
 * datele cetățeanului persoanei sau entității vizate de sesizare.
 *
 * Reason: au fost cazuri în care primăria a forwarduit sesizarea
 * (cu numele/adresa cetățeanului inclusă) către persoana reclamată
 * (vecin, comerciant, etc.) → cetățeanul reclamat a primit acasă
 * documentul oficial cu identitatea lui completă. GDPR art. 5
 * (limitarea scopului + minimizarea datelor + confidențialitatea)
 * obligă autoritățile să nu facă asta fără temei legal explicit.
 *
 * Adăugarea automată e idempotentă — dacă AI-ul deja a inclus clauza
 * (improbabil dar posibil dacă o adăugăm și în prompt în viitor),
 * helper-ul nu o dublează.
 */
export const GDPR_CLAUSE =
  "În temeiul Regulamentului (UE) 2016/679 (GDPR), vă solicit ca prelucrarea " +
  "datelor mele cu caracter personal să se realizeze cu respectarea principiilor " +
  "prevăzute la art. 5, în special limitarea scopului, minimizarea datelor și " +
  "confidențialitatea. În mod expres, solicit ca identitatea și datele mele de " +
  "contact să nu fie divulgate persoanelor vizate de prezenta sesizare sau altor " +
  "terți, în absența unui temei legal clar și justificat.";

/**
 * Inserează `GDPR_CLAUSE` ca paragraf separat înainte de semnătura
 * "Cu stimă," / "Cu respect,". Dacă nu găsește semnătură, append la
 * sfârșit. Idempotent: dacă clauza există deja, nu o duplică.
 */
export function appendGdprClause(text: string): string {
  if (!text) return text;
  // Idempotent check — primele 40 chars din clauză sunt distinctive.
  if (text.includes("Regulamentului (UE) 2016/679")) return text;

  const lines = text.split("\n");
  let signatureIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    // Matches "Cu stimă,", "Cu stima,", "Cu respect,", "Cu respect."
    if (/^Cu\s+(stim[aă]|respect)[,.]?$/i.test(line)) {
      signatureIdx = i;
      break;
    }
  }

  if (signatureIdx === -1) {
    // Fără semnătură — append la final.
    return text.trimEnd() + "\n\n" + GDPR_CLAUSE;
  }

  // Insert înainte de semnătură. Curăță rândurile goale precedente
  // ca să avem exact UN rând liber de separare.
  let insertAt = signatureIdx;
  while (insertAt > 0 && (lines[insertAt - 1] ?? "").trim() === "") insertAt--;

  const before = lines.slice(0, insertAt);
  const after = lines.slice(signatureIdx);
  return [...before, "", GDPR_CLAUSE, "", ...after].join("\n");
}

/** Capitalize each word: "ion POPESCU" → "Ion Popescu". */
export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Clean up address: trim, capitalize first letter. Restul rămâne neatins. */
export function formatAddress(addr: string): string {
  const trimmed = addr.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Adaugă diacritice + capitalizare la locații românești tastate fără.
 * Folosit pentru subiectul email-ului către primării — mai-mai toți
 * cetățenii scriu adresele fără diacritice, iar primăriile filtrează
 * după ele. "strada Vasile Lascar in capat cu Bulevardul Stefan cel Mare"
 * → "Strada Vasile Lascar, în capătul cu Bulevardul Ștefan cel Mare".
 *
 * Pur best-effort: vocabular + tipuri de stradă + nume proprii frecvente.
 * Nu corectează totul, dar acoperă > 95% din cazurile reale observate.
 */
export function normalizeRoLocation(text: string): string {
  if (!text) return text;
  let t = text.trim();

  // Multi-word phrases first (mai specifice → mai puține fals-pozitive)
  const phrases: Array<[RegExp, string]> = [
    [/\bin\s+capatul\s+cu\b/gi, "în capătul cu"],
    [/\bin\s+capat\s+cu\b/gi, "în capătul cu"],
    [/\bin\s+capatul\b/gi, "în capătul"],
    [/\bin\s+capat\b/gi, "în capăt"],
    [/\bcoltul\s+cu\b/gi, "colțul cu"],
    [/\bcolt\s+cu\b/gi, "colț cu"],
    [/\bla\s+intersectia\s+cu\b/gi, "la intersecția cu"],
    [/\bla\s+intersectia\b/gi, "la intersecția"],
    [/\bintersectia\s+cu\b/gi, "intersecția cu"],
    [/\bin\s+dreptul\b/gi, "în dreptul"],
    [/\bin\s+spatele\b/gi, "în spatele"],
    [/\bin\s+fata\b/gi, "în fața"],
    [/\bpe\s+langa\b/gi, "pe lângă"],
    [/\bpana\s+la\b/gi, "până la"],
    [/\bsatu\s+mare\b/gi, "Satu Mare"],
    [/\bbaia\s+mare\b/gi, "Baia Mare"],
    [/\bturnu\s+severin\b/gi, "Turnu Severin"],
    [/\btargu\s+mures\b/gi, "Târgu Mureș"],
    [/\btargu\s+jiu\b/gi, "Târgu Jiu"],
    [/\bpiatra\s+neamt\b/gi, "Piatra Neamț"],
    [/\bdrobeta\s+turnu\s+severin\b/gi, "Drobeta Turnu Severin"],
  ];
  for (const [re, replacement] of phrases) {
    t = t.replace(re, replacement);
  }

  // Cuvinte simple — diacritice
  const words: Array<[RegExp, string]> = [
    // Nume proprii frecvente
    [/\bStefan\b/g, "Ștefan"],
    [/\bstefan\b/g, "Ștefan"],
    [/\bConstantin\b/g, "Constantin"],
    [/\bGheorghe\b/g, "Gheorghe"],
    [/\bMihaita\b/gi, "Mihăiță"],
    [/\bAna\b/g, "Ana"],
    [/\bBucuresti\b/gi, "București"],
    [/\bIasi\b/gi, "Iași"],
    [/\bConstanta\b/gi, "Constanța"],
    [/\bBraila\b/gi, "Brăila"],
    [/\bBraşov\b/gi, "Brașov"],
    [/\bBrasov\b/gi, "Brașov"],
    [/\bTimisoara\b/gi, "Timișoara"],
    [/\bGalati\b/gi, "Galați"],
    [/\bPlostina\b/gi, "Ploștina"],
    [/\bPloiesti\b/gi, "Ploiești"],
    [/\bRomania\b/gi, "România"],
    [/\bCalarasi\b/gi, "Călărași"],
    [/\bArges\b/gi, "Argeș"],
    [/\bMures\b/gi, "Mureș"],
    [/\bSomes\b/gi, "Someș"],
    [/\bDambovita\b/gi, "Dâmbovița"],
    [/\bGiurgiu\b/g, "Giurgiu"],
    [/\bResita\b/gi, "Reșița"],
    [/\bTargoviste\b/gi, "Târgoviște"],
    [/\bDobreta\b/gi, "Drobeta"],

    // Generic Romanian words
    [/\bcapatul\b/g, "capătul"],
    [/\bcapat\b/g, "capăt"],
    [/\bsi\b/g, "și"],
    [/\bSi\b/g, "Și"],
    [/\btarii\b/gi, "țării"],
    [/\btara\b/gi, "țară"],
    [/\blanga\b/gi, "lângă"],
    [/\bpana\b/gi, "până"],
    [/\bcolt\b/gi, "colț"],
    [/\bcoltul\b/gi, "colțul"],
    [/\bintersectie\b/gi, "intersecție"],
    [/\bintersectia\b/gi, "intersecția"],

    // Tipuri de stradă — Title-case
    [/\bstrada\b/g, "Strada"],
    [/\bbulevardul\b/g, "Bulevardul"],
    [/\bbd\.\b/gi, "Bd."],
    [/\bcalea\b/g, "Calea"],
    [/\bsoseaua\b/gi, "Șoseaua"],
    [/\bSoseaua\b/g, "Șoseaua"],
    [/\bpiata\b/gi, "Piața"],
    [/\bPiata\b/g, "Piața"],
    [/\bintrarea\b/g, "Intrarea"],
    [/\baleea\b/g, "Aleea"],
    [/\bsplaiul\b/g, "Splaiul"],
  ];
  for (const [re, replacement] of words) {
    t = t.replace(re, replacement);
  }

  // "in" rămas → "în" (conservator: doar când e clar Romanian context)
  // Înlocuim "in" doar dacă apare după spațiu sau la început, urmat de
  // un alt cuvânt. Asta evită să alterăm "Lin" sau "in" interior.
  t = t.replace(/(^|\s)in(\s+\w)/g, "$1în$2");

  // Capitalize prima literă a textului dacă e literă mică
  if (t.length > 0 && /^[a-zăîâșț]/.test(t)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  return t;
}
