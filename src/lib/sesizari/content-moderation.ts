/**
 * 2026-05-26 — Content moderation pentru sesizări înainte de send.
 *
 * Context (raportat de dkrandu pe Reddit 2026-05-26): Civia trimite acum
 * server-side via Resend de la sesizari@civia.ro în numele cetățeanului.
 * Riscul: cineva scrie o amenințare în câmpul „nume" sau în descriere și
 * Civia ar releua-o ca email oficial către autoritate (cu reputația
 * civia.ro asociată).
 *
 * Strategy: detecție regex-based pe patterns clasice RO de amenințări,
 * incitare la violență, profanity targetată (insult cu „te"/„să"). Nu
 * încercăm să cenzurăm orice critică — sesizările pot și TREBUIE să fie
 * dure cu primăria. Filtrăm doar ce e clar criminal sau threat direct:
 *
 *   - „te omor" / „o sa te omor" / „va omor" / „mor"-uri direct adresate
 *   - „dau cu bomba" / „arunc în aer"
 *   - „te impusc" / „te tai"
 *   - „te bat" / „o sa-ti dau"
 *   - „țigan/țigani" cu intent rasial (slur use)
 *   - cuvinte injurioase în câmpul „author_name" (nume nu trebuie să
 *     conțină profanity)
 *
 * Decizie returnată:
 *   - `block: true` + reason: refuzăm submisia cu 400, log Sentry
 *   - `block: false`: continuă normal
 *
 * False positives sunt acceptabile aici — preferăm să refuzăm o sesizare
 * legitimă dură (user poate reformula) decât să relayăm o amenințare.
 */

interface ModerationResult {
  block: boolean;
  reason?: string;
  matched?: string[];
}

/** Patterns de amenințări directe — match doar formele cu intent clar.
 *  Caracterele [ăa] / [îi] / [șs] / [țt] / [âa] acoperă atât scrierea cu
 *  diacritice cât și varianta ASCII (utilizator pe tastatură EN). */
const THREAT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Omor / ucid
  { pattern: /\b(o\s+s[ăa]\s+te|te|v[ăa])\s+omor\b/i, label: "amenințare cu moartea" },
  { pattern: /\b(te|v[ăa])\s+ucid\b/i, label: "amenințare cu moartea" },
  { pattern: /\bmori\s+(tu|voi|cu\s+tot)\b/i, label: "incitare la moarte" },
  { pattern: /\b(s[ăa]\s+)?mori\s+(dracul|naibii|pulii)/i, label: "incitare la moarte" },
  // Bombă / arme
  { pattern: /\b(arunc|dau)\s+(cu\s+)?bomb[ăa]\b/i, label: "amenințare cu explozibili" },
  { pattern: /\b(pun|amplasez)\s+(o\s+)?bomb[ăa]\b/i, label: "amenințare cu explozibili" },
  { pattern: /\barunc\s+(prim[ăa]ria|cl[ăa]direa|sediul)\s+([îi]n\s+aer|[îi]n\s+v[âa]nt)/i, label: "amenințare distrugere" },
  // Împușcare / tăiere — accept și forma fără diacritice „impusc" / „impuscam"
  { pattern: /\b(te|v[ăa])\s+[îi]mpu[șs]c(?:am|a|i|e|u)?\w*/i, label: "amenințare cu arma" },
  { pattern: /\b(te|v[ăa])\s+tai\b/i, label: "amenințare violență" },
  { pattern: /\b(te|v[ăa])\s+[îi]njunghii?/i, label: "amenințare cu cuțit" },
  // Bătaie
  { pattern: /\b(te|v[ăa])\s+bat(?!alion)\b/i, label: "amenințare cu bătaia" },
  { pattern: /\b(o\s+s[ăa])?\s*[țt]i-?o?\s+(dau|tr[ăa]gem)\s+(la|[îi]n\s+gur[ăa])/i, label: "amenințare fizică" },
  // Incendiere
  { pattern: /\bd[ăa]u\s+foc\s+(la|prim[ăa]riei|cl[ăa]dirii|sediului)/i, label: "amenințare incendiere" },
  { pattern: /\barunc\s+benzin[ăa]/i, label: "amenințare incendiere" },
  // Avertizare bombă fals / terorism / atac
  { pattern: /\batac\s+terorist\b/i, label: "amenințare terorism" },
  // „atentat" în RO = single t; păstrăm și varianta cu dublu t (typo)
  { pattern: /\bate?ntat\b/i, label: "amenințare terorism" },
];

/** Profanity / slurs de filtrat în NUMELE autorului (câmpul „nume").
 *  Numele e cea mai expusă suprafață pentru abuz: scurt, vizibil în
 *  subject + signature, ușor de strecurat. Aici e mai strict decât în
 *  descriere — un nume legitim nu conține astea. */
const NAME_PROFANITY = [
  // Vulgar generic + slur (catch-all common)
  /\bp[uú]l[ăa]/i,
  /\bpula\s+mea/i,
  /\bcacat\b/i,
  /\bcăcat\b/i,
  /\bm[uú]l[ăa]/i,
  /\bmuie\b/i,
  /\bcurv[ăa]\b/i,
  /\bbo[șs]orog/i,
  /\bbozgor/i,
  // Slur etnice — folosite ca nume = harassment.
  // Notă: `\b` în JS RegExp nu match-uiește înainte de „ț" (caracterul nu
  // e word-char ASCII). Folosim look-behind `(?:^|\W)` sau flag `u` cu
  // Unicode property. Sintaxa cea mai portabilă: anchor pe start-of-string
  // sau whitespace.
  /(?:^|\W)[țt]igan\w*/i,
  /(?:^|\W)[țt]ig[ăa]nc[ăa]/i,
  /(?:^|\W)jidan(ul)?/i,
  // Anti-LGBT slurs
  /\bpoponar/i,
  /\bbulangiu/i,
  // Politicieni-specific abuse (numele ar fi de fapt un atac)
  /\biohannis\s+pula/i,
  /\bciolacu\s+sug[ăa]/i,
];

/** Profanity în „author_name" — mai strict decât în descriere. */
function checkNameProfanity(name: string): string | null {
  const n = name.toLowerCase();
  for (const re of NAME_PROFANITY) {
    if (re.test(n)) {
      return `numele conține limbaj nepermis`;
    }
  }
  // Heuristic: nume cu >40% non-alphabetic chars + lungime mare e suspect
  // ("@$$$$ddfg" / „xxxxxxx" / „aaaaaa")
  if (name.length >= 5) {
    const nonAlpha = name.replace(/[a-zA-ZăâîșțĂÂÎȘȚ\s'.-]/g, "").length;
    if (nonAlpha / name.length > 0.4) {
      return `numele conține caractere neobișnuite — folosește numele real`;
    }
    // Repetitive char („xxxxxx", „aaaaaa") = test/spam
    if (/^(.)\1{4,}$/i.test(name.replace(/\s/g, ""))) {
      return `numele pare invalid — folosește numele real`;
    }
  }
  return null;
}

/** Detectează amenințări în orice text (descriere, locație, titlu). */
function checkThreats(text: string): { reason?: string; matched: string[] } {
  if (!text || text.length < 4) return { matched: [] };
  const matched: string[] = [];
  let reason: string | undefined;
  for (const { pattern, label } of THREAT_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(label);
      if (!reason) reason = `mesajul conține ${label}`;
    }
  }
  return { reason, matched };
}

export interface ModerateSesizareArgs {
  author_name: string;
  titlu?: string;
  descriere: string;
  locatie: string;
  /** Pentru cosign — co-semnatarul adaugă propriul nume. Folosit doar la
   *  validare nume; descriere/locatie sunt deja moderată la creare. */
  isCosign?: boolean;
}

/**
 * Verifică conținutul unei sesizări (sau cosign) ÎNAINTE de send.
 *
 * Returnează `{ block: true, reason }` dacă găsește o amenințare clară
 * sau profanity în nume. Caller-ul trebuie să respingă request-ul cu 400
 * + mesaj user-friendly + log în Sentry pentru audit.
 */
export function moderateSesizareContent(args: ModerateSesizareArgs): ModerationResult {
  // 1. Numele — strictețe maximă, e expus în signature + subject email
  const nameIssue = checkNameProfanity(args.author_name);
  if (nameIssue) {
    return { block: true, reason: nameIssue };
  }

  // 2. La cosign nu re-moderăm descrierea/locația — sesizarea originală
  //    a trecut deja moderation la creare. Verificăm doar numele.
  if (args.isCosign) {
    return { block: false };
  }

  // 3. Threats în câmpurile text
  const allText = [args.titlu ?? "", args.descriere, args.locatie].join(" \n ");
  const t = checkThreats(allText);
  if (t.reason) {
    return { block: true, reason: t.reason, matched: t.matched };
  }

  return { block: false };
}

/** Versiune pentru teste — expune patterns ca să verifice exhaustiv. */
export const _internals = {
  THREAT_PATTERNS,
  NAME_PROFANITY,
  checkNameProfanity,
  checkThreats,
};
