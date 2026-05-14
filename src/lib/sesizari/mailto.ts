import { SESIZARE_TIPURI } from "@/lib/constants";
import { getAuthoritiesFor, type ResolvedRecipients } from "./authorities";
import { normalizeRoLocation } from "./format-helpers";
import { buildParkingLegalText, type ParkingJurisdiction } from "./parking";

export interface MailtoInput {
  tip: string;
  titlu: string;
  locatie: string;
  sector?: string | null;
  lat?: number | null;
  lng?: number | null;
  descriere: string;
  formal_text?: string | null;
  author_name: string;
  author_email?: string | null;
  author_address?: string | null;
  imagini?: string[];
  code?: string;
  /** Parking-specific legal metadata. Only used when tip === "parcare". */
  parking?: {
    plate?: string | null;
    jurisdiction?: ParkingJurisdiction | null;
    /**
     * Moment of observation — either an ISO-ish "YYYY-MM-DDTHH:MM"
     * string from a <input type="datetime-local">, or a Date. Parsed
     * into the template's "data" + "ora" slots. Defaults to "now" when
     * not supplied so legacy callers keep working.
     */
    observedAt?: string | Date | null;
  };
}

export interface EmailPayload {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  recipients: ResolvedRecipients;
}

const LUNI_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatRoDate(d = new Date()): string {
  return `${d.getDate()} ${LUNI_RO[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Post-processes AI-generated formal_text so the identity block (subsemnatul +
 * adresa + signature) reflects the CURRENT submitter, not whatever the AI
 * produced at generation time. Also strips Supabase photo URL lists that
 * otherwise show as raw links in the email body, and forces today's date.
 *
 * This is essential for the "co-semnez" flow: the original author's text is
 * reused for co-signers, but each co-signer must sign with their own data.
 */
function rewriteFormalText(formalText: string, input: MailtoInput): string {
  const name = input.author_name?.trim();
  const address = input.author_address?.trim();
  const today = formatRoDate();

  let text = formalText;

  // 1. Strip "Fotografii atașate: <URL>" blocks. Pattern covers both classic
  // and colon-prefixed forms, and removes dash-bulleted supabase URLs below.
  text = text.replace(
    /\n*Fotografii?\s+ata[șs]at[eă](?:\s*\([^)]*\))?\s*:?\s*\n?(?:\s*[-•*]\s*https?:\/\/\S+\n?)+/gi,
    "\n",
  );
  // Stray supabase storage URLs on their own lines.
  text = text.replace(/^\s*[-•*]?\s*https?:\/\/\S*supabase\S+\s*$/gim, "");

  // 2. Rewrite the identity paragraph. New template uses "Mă numesc X,
  // locuiesc în Y..."; legacy templates used "Subsemnatul X, domiciliat
  // în Y...". Handle both so co-signing works on older formal_texts too.
  //
  // The tricky bit: the AI-generated opener often contains the user's
  // address with internal commas ("Strada X 12, Sector 5"). A naive
  // greedy rewrite then re-inserts the sector comma on top of the tail
  // we're trying to keep ("Sector 5, Sector 5, și doresc..."). Fix:
  // match the identity clause up to a verb marker via LOOKAHEAD so the
  // preamble after it ("și doresc...", "vă aduc...", ".") stays intact
  // OUTSIDE the replacement span — no doubling possible.
  if (name && address) {
    // Sentinel for "end of address". Stops at:
    //  • " și/şi/si {word}" — new conjunction/clause
    //  • verb of intent (doresc, vă aduc, solicit, etc.)
    //  • sentence-end „[.?!] + whitespace + Capital letter" DAR NU dupa
    //    o abreviere romana de adresa (Str./Bd./Bl./Nr./Ap./Et./etc.)
    //    pentru ca dupa ele urmeaza tot adresa (numele strazii).
    //  • paragraph break or EOS.
    const SENT_END_NOT_ABBREV = String.raw`(?<!\b(?:str|bd|bld|blv|bl|sc|ap|et|nr|sect|sec|jud|com|loc|cod|sos|cal))[.?!]\s+[A-ZĂÂÎȘȚ]`;
    const END = String.raw`(?=\s*(?:\s+(?:și|şi|si)\s+\w+|\s+(?:vă|va|mă|ma|îmi|imi|doresc|solicit|adresez|aduc)\b|${SENT_END_NOT_ABBREV}|\n\s*\n|$))`;

    // Connector flexibil intre nume si verb — AI poate produce „X, locuiesc"
    // SAU „X și locuiesc". CRITICAL fix 2026-05-14 dupa raport leak GDPR:
    // varianta cu „și" nu era acoperita → numele + adresa autorului original
    // ramaneau in body-ul mailto-ului co-semnatarilor.
    const NAME_VERB_CONNECTOR = String.raw`(?:,\s*|\s+(?:și|şi|si)\s+)`;

    // Helper: capturile pot include sau nu punctuatie de final (depinde de
    // unde s-a oprit `${END}`). Pastram „." dacă a fost consumat de match
    // ca sa nu lasam fraza neterminata gramatical.
    const buildReplacement = (matched: string): string => {
      const endsPunct = /[.?!]\s*$/.test(matched) ? "." : "";
      return `Mă numesc ${name}, locuiesc în ${address}${endsPunct}`;
    };

    // New style: "Mă numesc {name}[,| și] locuiesc (pe|în) {address}"
    const newStyleRe = new RegExp(
      String.raw`M[ăa]\s+numesc\s+[^,\n]+?\s*${NAME_VERB_CONNECTOR}locuiesc\s+(?:pe|în|in)\s+[^\n]+?${END}`,
      "gim",
    );
    text = text.replace(newStyleRe, (m) => buildReplacement(m));

    // Legacy "Subsemnatul/Subsemnata X[,| și] domiciliat(ă) pe/în Y" → same
    // new-style landing.
    const legacyRe = new RegExp(
      String.raw`Subsemnat(?:ul|a|ul\(a\)|a\/Subsemnatul)?\s+[^,\n]+?\s*${NAME_VERB_CONNECTOR}domiciliat(?:\(?ă\)?|ă|a)?\s+(?:pe|în|in)\s+[^\n]+?${END}`,
      "gim",
    );
    text = text.replace(legacyRe, (m) => buildReplacement(m));

    // Fallback: no identity line at all — inject after "Bună ziua,"
    if (!/M[ăa]\s+numesc/i.test(text) && !/Subsemnat/i.test(text)) {
      text = text.replace(
        /(Bun[ăa] ziua,?)/i,
        `$1\n\nMă numesc ${name}, locuiesc în ${address} și doresc să vă aduc la cunoștință o problemă care necesită intervenția dumneavoastră.`,
      );
    }
  }

  // 3. Rewrite the signature block. "Cu stimă," or "Cu respect," then
  // name then date.
  if (name) {
    const sigRe = /Cu\s+(respect|stim[ăa]),?\s*\n[^\n]*(?:\n[^\n]*)?$/i;
    const sigBlock = `Cu stimă,\n${name}\n${today}`;
    if (sigRe.test(text)) {
      text = text.replace(sigRe, sigBlock);
    } else {
      text = `${text.trimEnd()}\n\n${sigBlock}`;
    }
  }

  // 4. Collapse 3+ blank lines to exactly one blank line.
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

export function buildFormalText(input: MailtoInput): string {
  const tipLabel = SESIZARE_TIPURI.find((t) => t.value === input.tip)?.label ?? "";
  const today = formatRoDate();
  const numarFoto = input.imagini?.length ?? 0;
  const evidence =
    numarFoto > 0
      ? `\n\nAnexez ${numarFoto} ${numarFoto === 1 ? "fotografie" : "fotografii"}.\n`
      : "";

  // Parking: skip the generic AI template and use the legally-tuned
  // version the user specified — structured body citing OUG 195/2002 +
  // art. 39, plate number highlighted, jurisdiction-aware opener.
  // Required inputs: plate + jurisdiction. If either is missing we fall
  // through to the generic path so the form still produces *something*.
  if (input.tip === "parcare" && input.parking?.plate && input.parking.jurisdiction) {
    const recipients = getAuthoritiesFor(
      input.tip,
      input.sector ?? null,
      null,
      input.locatie,
      { jurisdiction: input.parking.jurisdiction },
    );
    const authorityName = recipients.primary[0]?.name ?? "Autoritatea competentă";

    // Normalize the observedAt input — the form supplies a browser
    // datetime-local string (local timezone, no offset); callers wiring
    // this up from the server could send a Date. Anything unparseable
    // falls through to "now".
    let observedAt: Date | undefined;
    const raw = input.parking.observedAt;
    if (raw instanceof Date) {
      observedAt = raw;
    } else if (typeof raw === "string" && raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) observedAt = d;
    }

    return buildParkingLegalText({
      authorityName,
      authorName: input.author_name || "[NUMELE]",
      authorAddress: input.author_address || "[ADRESA]",
      plate: input.parking.plate,
      jurisdiction: input.parking.jurisdiction,
      locatie: input.locatie,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      observedAt,
      photoCount: numarFoto,
    });
  }

  if (input.formal_text) {
    const rewritten = rewriteFormalText(input.formal_text, input);
    // Append "Anexez N fotografii." only if the AI text doesn't
    // already mention attached images. The previous regex only
    // matched the exact "Anexez N fotografii" phrase — but the AI
    // prompt instructs the model to write "am atașat imagini care
    // ilustrează...", so the check missed it and we appended a
    // redundant line. Broadened to match any Romanian phrasing:
    //   am atașat / atașez / anexez / am anexat / atașate /
    //   anexate — combined with imagi / fotografi / poze.
    const photoMentionRe =
      /(am\s+)?(ata[șs]at|anex[ae]z|anex[ae]t)\b[^.]*?(imagini|fotografi|poze)|(imagini|fotografi|poze)[^.]*?(ata[șs]at|anex[ae]t)/i;
    return numarFoto > 0 && !photoMentionRe.test(rewritten)
      ? `${rewritten}${evidence}`
      : rewritten;
  }

  // Fallback: narrative template in the same style as the AI prompt.
  // Used when AI hasn't run yet (no formal_text) — keeps the email
  // format consistent regardless of whether AI was invoked.
  const name = input.author_name || "[NUMELE]";
  const address = input.author_address || "[ADRESA]";
  const problem = tipLabel ? tipLabel.toLowerCase() : "situație";

  return `Bună ziua,

Mă numesc ${name}, locuiesc în ${address} și doresc să vă aduc la cunoștință o problemă care afectează calitatea vieții pe ${input.locatie}.

Astăzi, ${today}, am observat ${problem} în această zonă. ${input.descriere}${evidence}
Pentru a rezolva această situație, vă solicit respectuos să luați următoarele măsuri:

1. Verificare la fața locului: constatarea situației și identificarea autorităților competente.
2. Intervenție corespunzătoare: remedierea problemei în termen rezonabil.
3. Comunicare răspuns: informare privind măsurile luate, conform OG 27/2002.

De asemenea, vă rog să îmi furnizați un număr de înregistrare pentru această sesizare, pentru a putea urmări progresul soluționării.

Vă mulțumesc anticipat pentru atenția acordată.

Cu stimă,
${name}
${today}`;
}

export function buildEmailPayload(input: MailtoInput): EmailPayload {
  const recipients = getAuthoritiesFor(
    input.tip,
    input.sector ?? null,
    null,
    input.locatie,
    input.parking ? { jurisdiction: input.parking.jurisdiction ?? null } : undefined,
  );
  const tipLabel = SESIZARE_TIPURI.find((t) => t.value === input.tip)?.label ?? "";
  // Cetățenii tastează adresele fără diacritice ("strada Vasile Lascar
  // in capat cu Bulevardul Stefan cel Mare"). Subiectul ajunge la
  // primărie ca atare — îl normalizăm: diacritice + Title-case la
  // tipurile de stradă.
  const locatieFormatted = normalizeRoLocation(input.locatie);

  // Pentru tip="altele", label-ul generic „Altele" face un subject urât
  // („Sesizare Altele — Strada X") care arată prefacut, pre-completat —
  // primăria îl ignoră ca template automat. Folosim AI-polished titlu
  // care descrie problema concret (raportat user 5/9/2026).
  let subject: string;
  if (input.tip === "altele" && input.titlu && input.titlu.length > 5) {
    // Truncate titlu lung — subject-urile lungi sunt clipped de mail
    // clients la afișare în inbox listing. 100 char max e standardul.
    const titluTrim = input.titlu.length > 80
      ? input.titlu.slice(0, 77).trimEnd() + "..."
      : input.titlu;
    subject = `Sesizare: ${titluTrim} — ${locatieFormatted}`;
  } else {
    subject = `Sesizare ${tipLabel} — ${locatieFormatted}`;
  }
  if (input.tip === "parcare" && input.parking?.plate) {
    // Police mailrooms search inbox by plate number when triaging
    // parking complaints — putting it in the subject shaves days off
    // the response time.
    subject = `Sesizare parcare neregulamentară — ${input.parking.plate} — ${locatieFormatted}`;
  }
  // Plain-text body: strip the bold markers the parking template uses.
  // Mail clients receiving text/plain can't render bold anyway.
  const body = buildFormalText(input).replace(/\[\[BOLD]]([^[]+?)\[\[\/BOLD]]/g, "$1");

  // Previous versions appended photo URLs + a tracking link at the
  // end of the body, but the user pushed back — primăriile find
  // multi-link emails suspect (many filter them as spam) and our
  // users want the text to be clean. Photos are now the citizen's
  // manual attachment step (UI warns them before submit).

  return {
    to: recipients.primary.map((a) => a.email),
    cc: recipients.cc.map((a) => a.email),
    subject,
    body,
    recipients,
  };
}

/**
 * ASCII-fold pentru diacritice românești.
 *
 * De ce: `mailto:` URL-urile transferă subject + body prin URL encoding
 * (`%C8%99` pentru „ș" etc). Majoritatea aplicațiilor de mail decodează
 * corect UTF-8, dar Yahoo Mail Android (raportat user 5/8/2026) îl
 * sparge — „ș" devine „%#@/" în composer-ul Yahoo. Pentru robustețe
 * across-clients, foldăm la ASCII chiar din URL: text e tot inteligibil
 * pentru autorități, e neutru pe orice client de mail.
 *
 * Acoperă: ă â î ș ț (+ majuscule) + variantele cu sedilă (ş ţ — codepoint
 * diferit, comune la text vechi copy-paste). NFD + diacritic strip prinde
 * orice altă diacritică (germană, franceză etc) ca fallback.
 */
function asciiFoldRo(s: string): string {
  return s
    .replace(/ș/g, "s").replace(/Ș/g, "S")
    .replace(/ț/g, "t").replace(/Ț/g, "T")
    .replace(/ă/g, "a").replace(/Ă/g, "A")
    .replace(/â/g, "a").replace(/Â/g, "A")
    .replace(/î/g, "i").replace(/Î/g, "I")
    // Sedilă (codepoint diferit de virguliță) — apare în texte vechi.
    .replace(/ş/g, "s").replace(/Ş/g, "S") // ş Ş
    .replace(/ţ/g, "t").replace(/Ţ/g, "T") // ţ Ţ
    // Catch-all: orice diacritică rămasă (Unicode NFD + remove combining marks).
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function buildMailtoLink(input: MailtoInput): string {
  const p = buildEmailPayload(input);
  const cc = p.cc.length > 0 ? `&cc=${p.cc.join(",")}` : "";
  // ASCII-fold subject + body — vezi asciiFoldRo de ce.
  const subject = encodeURIComponent(asciiFoldRo(p.subject));
  const body = encodeURIComponent(asciiFoldRo(p.body));
  return `mailto:${p.to.join(",")}?subject=${subject}${cc}&body=${body}`;
}

export function buildGmailLink(input: MailtoInput): string {
  const p = buildEmailPayload(input);
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: p.to.join(","),
    su: p.subject,
    body: p.body,
  });
  if (p.cc.length > 0) params.set("cc", p.cc.join(","));
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Android Chrome intent URL targeting the Gmail app directly. Bypasses
 * Chrome's mailto: handler (which can route to Gmail web in a new tab
 * on phones where the user has a Google account in the browser but
 * Chrome's "default mail" isn't set to the Gmail app).
 *
 * Format MATTERS: `intent:RECIPIENT?subject=X&body=Y#Intent;...;end`
 * (no `//` — mailto: URIs don't use authority).
 *
 * Encoding MATTERS: spaces must be `%20`, not `+`. URLSearchParams
 * uses form-encoding (spaces → `+`) which Gmail does NOT decode in
 * the body field — emails arrived with literal `+` instead of spaces.
 * encodeURIComponent uses `%20` which Gmail decodes correctly.
 *
 * `S.browser_fallback_url` fires if the Gmail app isn't installed —
 * Chrome falls back to the system mailto: handler so non-Gmail-app
 * users still get SOMETHING.
 *
 * Reference: https://developer.chrome.com/docs/android/intents
 */
export function buildGmailAndroidIntent(input: MailtoInput): string {
  const p = buildEmailPayload(input);
  // Recipient(s) go in the URI path right after `intent:` — that
  // becomes the mailto: URI body (e.g. mailto:a@x.com,b@y.com). The
  // @ sign is allowed in URI paths so we don't encode it.
  const to = p.to.join(",");
  // Hand-build the query string with encodeURIComponent (NOT
  // URLSearchParams) so spaces become %20 instead of +.
  // ASCII-fold pentru robustețe — unele Android intent handlers
  // (Yahoo, default Email app, etc) sparg multi-byte UTF-8.
  const subject = encodeURIComponent(asciiFoldRo(p.subject));
  const body = encodeURIComponent(asciiFoldRo(p.body));
  const cc = p.cc.length > 0 ? `&cc=${encodeURIComponent(p.cc.join(","))}` : "";
  const fallback = encodeURIComponent(buildMailtoLink(input));
  return `intent:${to}?subject=${subject}&body=${body}${cc}#Intent;scheme=mailto;package=com.google.android.gm;S.browser_fallback_url=${fallback};end`;
}

/**
 * iOS Gmail app deep link. If the user doesn't have Gmail installed
 * the link silently fails (iOS doesn't have a Chrome-style fallback
 * mechanism for custom URL schemes), so the caller MUST also render a
 * fallback mailto: button that the user can tap if the Gmail link
 * does nothing.
 *
 * Same encoding caveat as Android intent: spaces must be %20, not +.
 *
 * Reference: Gmail iOS URL scheme docs (legacy but stable).
 */
export function buildGmailIosLink(input: MailtoInput): string {
  const p = buildEmailPayload(input);
  const to = encodeURIComponent(p.to.join(","));
  const subject = encodeURIComponent(p.subject);
  const body = encodeURIComponent(p.body);
  const cc = p.cc.length > 0 ? `&cc=${encodeURIComponent(p.cc.join(","))}` : "";
  return `googlegmail:///co?to=${to}&subject=${subject}&body=${body}${cc}`;
}

export function buildOutlookLink(input: MailtoInput): string {
  // Modern Outlook web deep-link. The legacy `/owa/?path=/mail/action/compose`
  // URL we used before lands users on a "page not found" / empty inbox
  // depending on account type — Microsoft deprecated that path in 2023.
  // The `/mail/0/deeplink/compose` route is what Outlook's own mailto
  // handler resolves to today on outlook.live.com and works for personal
  // accounts; Office 365 business accounts get auto-redirected across.
  //
  // ENCODING: hand-build query cu encodeURIComponent (NU URLSearchParams)
  // ca spațiile să fie %20, nu +. Outlook web NU decodează `+` ca spațiu
  // în body — utilizatorii primeau email-uri cu „cuvânt+cuvânt+cuvânt"
  // în loc de spații (raportat user 5/9/2026 pe sesizare 00027). Același
  // bug pe care Gmail-Android-intent îl avea — fix identic.
  const p = buildEmailPayload(input);
  const to = encodeURIComponent(p.to.join(","));
  const subject = encodeURIComponent(p.subject);
  const body = encodeURIComponent(p.body);
  const cc = p.cc.length > 0 ? `&cc=${encodeURIComponent(p.cc.join(","))}` : "";
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}${cc}`;
}

export function buildYahooLink(input: MailtoInput): string {
  // Same +/space issue ca Outlook — Yahoo web compose nu decodează `+`.
  // Hand-build cu encodeURIComponent.
  const p = buildEmailPayload(input);
  const to = encodeURIComponent(p.to.join(","));
  const subject = encodeURIComponent(p.subject);
  const body = encodeURIComponent(p.body);
  const cc = p.cc.length > 0 ? `&cc=${encodeURIComponent(p.cc.join(","))}` : "";
  return `https://compose.mail.yahoo.com/?to=${to}&subject=${subject}&body=${body}${cc}`;
}

export function getRecipientsLabel(
  tip: string,
  sector?: string | null,
  locationText?: string | null,
  parking?: { jurisdiction?: ParkingJurisdiction | null },
): string {
  return getAuthoritiesFor(
    tip,
    sector ?? null,
    null,
    locationText ?? null,
    parking ? { jurisdiction: parking.jurisdiction ?? null } : undefined,
  ).label;
}
