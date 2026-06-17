import { groqText, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";

/**
 * AI classifier for inbound replies from Romanian authorities.
 *
 * Pipeline (2026-05-29 rewrite):
 *   1. recoverMojibake() — fix UTF-8 double-encoded as CP1252 (Sector 6
 *      portal mai ales: „PrimÄria Sector 6: Cerere Ã®nregistratÄ").
 *   2. deterministicPreClassify() — regex pe subject + body. Prinde 70-80%
 *      din cazurile common cu confidence high și ZERO AI cost.
 *   3. AI fallback (Groq Llama 3.3 70B) doar cand pre-classifier nu e sigur.
 *   4. Post-validation: nr_inregistrare hallucination check + auto-reply
 *      patterns elevate la „inregistrata" daca AI dă „necunoscut".
 *
 * Cost: ~$0.0002 per AI call. Cu pre-classifier, 70% din emailuri skip AI
 * → cost real ~$0.00006 per reply. La 5000 replies/lună = $0.30/lună.
 */

export type ReplyStatus =
  | "inregistrata"
  | "in-lucru"
  | "actiune-autoritate"
  | "interventie"
  | "amanata"
  | "rezolvat"
  | "redirectionata"
  | "respins"
  | "cerere_informatii"
  | "necunoscut";

export type SuggestedAction =
  | "wait_for_resolution"
  | "respond_with_info"
  | "escalate_now"
  | "confirm_resolution"
  | "monitor_progress";

export interface ClassifyResult {
  status: ReplyStatus;
  confidence: number;
  nr_inregistrare: string | null;
  summary: string;
  deadline: string | null;
  suggested_action: SuggestedAction;
  is_spam: boolean;
  raw?: unknown;
  /** Pipeline stage that produced final answer. Diagnostic only. */
  source?: "deterministic" | "ai" | "ai+autoreply" | "fallback";
}

/**
 * 2026-05-29 — Mojibake recovery.
 *
 * Multe primării (Sector 6 portal, registratura Sector 1, ps2 portal) trimit
 * subiectele cu encoding broken: UTF-8 bytes interpretate ca CP1252 apoi
 * re-encodate UTF-8. Rezultat: „ț" → „Èš" → „È" + „™", „â" → „Ã¢", etc.
 *
 * Heuristic: dacă vedem secvențe Ã/È + caractere suspecte, încercăm să
 * decodificăm înapoi. Funcționează pentru patterns observate în production:
 *   „MaÈini" → „Mașini"
 *   „Ã®nregistratÄ" → „înregistrată"
 *   „Solicitarea a fost inregistrata" rămâne identic.
 */
export function recoverMojibake(text: string): string {
  if (!text) return text;
  // 2026-05-29 — Textele PMB sunt 2-byte Unicode mojibake (UTF-8 bytes
  // interpretate ca CP1252 → re-encodate). Exemplu real din DB:
  //   `Ä` (Ä + control U+0083) = corespunde `ă` original.
  //   `Ã®` (Ã + ®) = `î`
  //   `È` (È + control U+0099) = `ș`
  //   `â` (â + € + ") = `—` (em-dash)
  // Detecția prinde aceste 2-byte secvențe + patterns vechi single-char.
  const hasMojibake =
    /Ä[-¿]|Ã[-¿]|È[-¿]|â[-¿]|Ä[a-zA-Z\s.,;:!?]|Ã[®¢¨]|È[a-zș™œ›¢]/i.test(text);
  if (!hasMojibake) return text;

  // 2026-05-29 — Patterns folosesc \uXXXX escapes pentru exact bytes
  // observate in producție. PMB+ multe primării trimit emailuri cu UTF-8
  // bytes interpretate ca CP1252 → ajung in DB ca Unicode pairs.
  // Ordine: 2-byte specific patterns ÎNAINTE de single-char fallbacks.
  const map: Array<[RegExp, string]> = [
    // ─── 2-byte real-world mojibake (din PMB body samples) ────────────────
    // ă: "Ä" (Ä + NO BREAK HERE)
    [/Ä/g, "ă"],
    // Ă: "Ä"
    [/Ä/g, "Ă"],
    // â: "Ã¢"
    [/Ã¢/g, "â"],
    // Â: "Ã"
    [/Ã/g, "Â"],
    // î: "Ã®"
    [/Ã®/g, "î"],
    // Î: "Ã"
    [/Ã/g, "Î"],
    // ș (Latin Small Letter S with Comma Below): "È"
    [/È/g, "ș"],
    // Ș: "È"
    [/È/g, "Ș"],
    // ț (Latin Small Letter T with Comma Below): "È"
    [/È/g, "ț"],
    // Ț: "È"
    [/È/g, "Ț"],
    // — (em-dash): "â"
    [/â/g, "—"],
    // – (en-dash): "â"
    [/â/g, "–"],
    // ' (right single quote): "â"
    [/â/g, "'"],
    // " (left double quote): "â"
    [/â/g, "\""],
    // " (right double quote): "â"
    [/â/g, "\""],
    // non-breaking space: "Â " or "Â "
    [/Â /g, " "],
    [/Â /g, " "],

    // ─── Fallback single-char patterns (legacy compat) ────────────────────
    [/È™/g, "ș"], [/Èš/g, "ț"], [/È›/g, "ț"], [/Èœ/g, "ț"], [/È¢/g, "ț"],
    [/Ã¢/g, "â"], [/Ã®/g, "î"], [/Ã¨/g, "è"], [/Ãª/g, "ê"], [/Ã„/g, "Ă"],
    [/Äƒ/g, "ă"], [/Ä‚/g, "Ă"],
    [/Â /g, " "], [/Â/g, ""],
    [/Ä(?=[\s.,;:!?]|$)/g, "ă"],
    [/Ä(?=[a-z])/g, "ă"],
    [/Ä/g, "ă"],
    [/Å£/g, "ț"], [/Å¢/g, "Ț"], [/Å/g, "Ș"],
    [/â€™/g, "'"], [/â€œ/g, "\""], [/â€/g, "\""], [/â€“/g, "—"], [/â€"/g, "—"],
    [/È(?=[a-z])/g, "ș"],
    [/È/g, "Ș"],
  ];
  let out = text;
  for (const [from, to] of map) out = out.replace(from, to);
  return out;
}

/**
 * 2026-05-29 — Numar inregistrare extractor.
 *
 * Pattern-uri observate în production:
 *   • Subject: „Numar inregistrare 'Sesizare 00050 ... / '" — gol între /
 *     și ' → CITESC body unde apare nr-ul efectiv
 *   • Subject: „Re: Sesizare X — Inregistrare oficiala" + body cu nr
 *   • Body: „a fost inregistrata sub nr. 12345/2026"
 *   • Body: „nr. inregistrare: 12345/2026"
 *   • Body: „inregistrata cu numarul A12345/2026"
 *   • Body: „inregistrarea cu nr. 12345"
 *
 * Format typic: numere 3-8 cifre, optional /AAAA.
 */
export function extractNrInregistrare(text: string): string | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    // „cu numărul PMB 89420 / DATE" — PMB specific pattern observed in prod
    /\bcu\s+num[ăa]rul\s+([A-Z]{2,5}\s+\d{3,8}(?:\s*\/\s*\d{2}\.\d{2}\.\d{4})?)/i,
    // „inregistrata cu numarul X" / „înregistrat sub nr X"
    /\b[îi]nregistrat[ăa]?\s+(?:cu|sub)\s+(?:nr\.?|num[ăa]rul)\s+([A-Z]{0,5}\s?\d{3,8}\/?\d{0,4})\b/i,
    // „înregistrare cu numărul X"
    /\b[îi]nregistrare\s+(?:cu\s+)?(?:nr\.?|num[ăa]rul)\s+([A-Z]{0,5}\s?\d{3,8}\/?\d{0,4})\b/i,
    // „numarul X" sau „numarul X/AAAA" — generic, after specific ones
    /\bnum[ăa]rul\s+([A-Z]{0,3}\d{3,8}\/?\d{0,4})\b/i,
    // „nr. X/AAAA" sau „nr X/AAAA"
    /\bnr\.?\s*([A-Z]{0,3}\d{3,8}\/?\d{0,4})\b/i,
    // pure pattern XYZ123/2026 standalone
    /\b([A-Z]{0,3}\d{4,8}\/\d{4})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const v = m[1].trim();
      // Validate: must contain at least 3 digits
      if ((v.match(/\d/g) || []).length >= 3) return v;
    }
  }
  return null;
}

/**
 * 2026-05-29 — Deterministic pre-classifier.
 *
 * Bazat pe pattern-uri OBSERVATE din 61 răspunsuri primite în production
 * pe sesizari@civia.ro de la primării Bucuresti, Cluj, Cluj-Napoca, Sector 1-6.
 *
 * Întoarce { status, confidence, ...} dacă pattern match. NULL → fallback la AI.
 */
function deterministicPreClassify(args: {
  subject: string;
  body: string;
  trustedSender: boolean;
}): Partial<ClassifyResult> | null {
  // 2026-05-29 — Defensive trim. Emailurile Outlook/Exchange uneori
  // adauga whitespace leading la subject („ Re: Sesizare X") care strica
  // regex `^sesizare`. Trim-uim TOT input-ul aici, o singura data.
  const subjectTrim = args.subject.trim();
  const bodyTrim = args.body.trim();
  const s = subjectTrim.toLowerCase();
  const b = bodyTrim.toLowerCase();
  const both = `${s} ${b}`;

  // ─── REDIRECȚIONATĂ — verificate înainte de înregistrată (mai specific) ────
  if (
    /^fw[:.\- ]/i.test(subjectTrim) ||
    /^fwd[:.\- ]/i.test(subjectTrim) ||
    // 6/17 — ținte extinse + diacritice: „transmisă la PRIMĂRIA/ADMINISTRAȚIA/
    // DIRECȚIA/Sectorul X" + „spre competentă soluționare" + „are competența
    // legală de soluționare" (clasic redirect — altă instituție e competentă).
    /\btransmis[ăa]?\s+(?:al[ăa]turat\s+)?(?:la|c[ăa]tre|spre)\s+(?:autoritatea|institu[tț]ia|departamentul|prim[ăa]ria|administra[tț]ia|direc[tț]ia|compania|sectorul|competen)/i.test(b) ||
    /\bspre\s+competent[ăa]?\s+solu[tț]ionare/i.test(b) ||
    /\bare\s+competen[tț]a\s+(?:legal[ăa]\s+)?(?:de\s+)?solu[tț]ionare/i.test(b) ||
    // 6/17 (caz real #00050): PLMB forwardează SESIZAREA către poliția de sector
    // „vă transmitem alăturat sesizarea ... pentru luarea măsurilor ce se impun".
    // Cheia e „transmitem (alăturat) SESIZAREA/petiția" (nu „răspunsul" — ăla e
    // doar cover-ul), urmat de „pentru luarea măsurilor / competență / soluționare".
    /\bv[ăa]\s+transmit[ee]m\s+(?:al[ăa]turat\s+)?(?:sesizarea|peti[tț]ia|adresa|solicitarea|memoriul)\b[\s\S]{0,200}?\bpentru\s+(?:luarea\s+m[ăa]surilor|competent|solu[tț]ion|analiz|verific)/i.test(b) ||
    /\bnu\s+(este|intr[ăa])\s+(?:în|in)\s+competen[tț]a\s+(noastr[ăa]|institutiei)/i.test(b) ||
    /\bv[ăa]\s+(rug[ăa]m\s+)?(s[ăa]\s+v[ăa]\s+)?adresa[tț]i\s+(c[ăa]tre|la)/i.test(b) ||
    /\bredirec[tț]ion[ăa]m?\s+sesizarea/i.test(b)
  ) {
    return {
      status: "redirectionata",
      confidence: 92,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  // ─── CERERE INFORMAȚII ─────────────────────────────────────────────────────
  if (
    /\b(precizat?i|completat?i|transmit?eti)\s+(?:exact\s+)?(?:locatia|adresa|locația|imaginile|mai\s+multe\s+detalii)/i.test(b) ||
    /\bv[ăa]\s+rug[ăa]m\s+s[ăa]\s+(?:ne\s+)?(?:transmit?eti|comunicat?i|preciza|complet)/i.test(b) ||
    /\b(avem|este)\s+nevoie\s+de\s+(?:mai\s+)?(?:multe\s+)?(?:detalii|informa[tț]ii|preciz[ăa]ri|clarific[ăa]ri)/i.test(b) ||
    /\bpentru\s+(?:a\s+)?(?:putea|sa\s+putem)\s+(?:solu[tț]iona|trata|analiza)/i.test(b)
  ) {
    return {
      status: "cerere_informatii",
      confidence: 88,
      suggested_action: "respond_with_info",
      source: "deterministic",
    };
  }

  // ─── REZOLVAT ──────────────────────────────────────────────────────────────
  if (
    /\b(?:lucrar(?:ea|ile))\s+(?:a|au)\s+fost\s+finalizat[ăa]?/i.test(b) ||
    /\bproblema\s+(?:semnalat[ăa]|sesizat[ăa]|raportat[ăa])\s+(?:a\s+fost|este)\s+(?:remediat[ăa]|rezolvat[ăa]|solu[tț]ionat[ăa])/i.test(b) ||
    /\bv[ăa]\s+comunic[ăa]m\s+(?:rezolvarea|solu[tț]ionarea|finalizarea)/i.test(b)
  ) {
    return {
      status: "rezolvat",
      confidence: 93,
      suggested_action: "confirm_resolution",
      source: "deterministic",
    };
  }

  // ─── INTERVENȚIE — lucrare fizică EFECTUATĂ (stâlpișori montați, asfaltat) ──
  // Distinct de rezolvat: lucrarea concretă e gata, dar e o intervenție punctuală.
  if (
    /\bst[âa]lpi[șs]or\w*\s+(?:de\s+protec[tț]ie\s+|antiparcare\s+)?(?:au\s+fost\s+|s-?au\s+)?monta[tț]i?/i.test(b) ||
    /\b(?:au\s+fost\s+|s-?au\s+)(?:montat|instalat|asfaltat|amplasat|reparat)(?:e|i)?\s+(?:st[âa]lpi|marcaj|carosabil|trotuar)/i.test(b) ||
    /\blucrar(?:ea|e)\s+fizic[ăa]\s+(?:a\s+fost\s+)?efectuat[ăa]/i.test(b)
  ) {
    return {
      status: "interventie",
      confidence: 90,
      suggested_action: "confirm_resolution",
      source: "deterministic",
    };
  }

  // ─── ACȚIUNE AUTORITATE — control / amenzi / verificare în teren (poliție) ──
  // Poliția Locală a ACȚIONAT: Note de Constatare, procese-verbale, înștiințări,
  // sancțiuni contravenționale APLICATE vehiculelor. Mai precis decât in-lucru.
  // (Verbe la TRECUT — „au aplicat" — nu cereri viitoare „solicităm aplicarea".)
  if (
    /\bnot[ăae]\s+de\s+constatare/i.test(b) ||
    /\bprocese?[-\s]?verbale?\s+(?:de\s+)?(?:sanc[tț]ionare|sanc[tț]ion|contraven)/i.test(b) ||
    /\b(?:s-?au\s+|au\s+fost\s+|am\s+)?aplicat\s+(?:[îi]n[șs]tiin[tț][ăa]ri|sanc[tț]iuni|amenzi|amend[ăa]|avertismente?)/i.test(b) ||
    /[îi]n[șs]tiin[tț][ăa]ri\s+(?:vehiculelor|conduc[ăa]torilor)/i.test(b) ||
    /\bsanc[tț]iuni\s+contraven[tț]ionale\s+conduc[ăa]torilor/i.test(b) ||
    /\bau\s+(?:efectuat|[îi]ntreprins)\s+verific[ăa]ri\s+(?:[îi]n\s+(?:teren|zon)|pe\s+(?:artera|str|calea|[șs]os))/i.test(b)
  ) {
    return {
      status: "actiune-autoritate",
      confidence: 90,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  // ─── AMÂNATĂ — planificat în alt proiect / depinde de buget / fără termen ───
  // Tipic Administrația Străzilor: „urmează să demareze lucrări în funcție de
  // buget", „în cadrul contractului de reparații", „după finalizarea modernizării",
  // „nu vă putem oferi un termen estimativ", „în funcție de gradul de risc".
  // = recunoscut + planificat, dar amânat într-un proiect mai amplu.
  if (
    // NB: fără \b înainte de „î" — în JS regex \b nu se declanșează lângă diacritice
    // (î nu e \w ASCII), deci „\b[îi]n" rata „în funcție/în cadrul".
    /[îi]n\s+func[tț]ie\s+de\s+(?:buget|bugetul|gradul\s+de\s+risc|fonduri|efectivele)/i.test(b) ||
    /\bnu\s+(?:v[ăa]\s+)?put[ee]m\s+oferi\s+un\s+termen/i.test(b) ||
    /[îi]n\s+cadrul\s+(?:unui\s+)?(?:proiect|contract|program|proces)\b/i.test(b) ||
    /\bdup[ăa]\s+(?:finalizarea|materializarea|recep[tț]ia|predarea|reabilitarea)\b/i.test(b) ||
    /\bproces\s+de\s+(?:reconfigurare|modernizare|reabilitare)/i.test(b) ||
    /\bva\s+intra\s+[îi]n\s+reabilitare/i.test(b) ||
    /\bvor\s+fi\s+(?:analizate|materializate)\s+(?:[șs]i\s+)?(?:implementate\s+)?ulterior/i.test(b)
  ) {
    return {
      status: "amanata",
      confidence: 88,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  // ─── IN-LUCRU — măsuri/procesare în curs, generic (problema NU e încă reparată) ──
  // „echipa va interveni", „se vor demara lucrări", „am dispus măsuri". Acțiunea
  // poliției + amânarea pe buget au fost prinse mai sus în statusuri mai precise.
  if (
    /\b(?:echipa|echipele|departamentul)\s+(?:noastr[ăa]|de\s+specialitate)\s+(?:va|vor)\s+(?:interveni|interven[tț]ia|verifica)/i.test(b) ||
    /\bl[ăa]\s+urm[ăa]toarea\s+(?:saptam[âa]n[ăa]|edi[tț]ie|lun[ăa])/i.test(b) ||
    /\b(?:am\s+alocat|am\s+programat|am\s+repartizat)\s+(?:resurse|lucrare|interven[tț]ia)/i.test(b) ||
    /\bse\s+vor\s+(?:demara|efectua|executa|realiza|întreprinde)\s+(?:lucrar|m[ăa]sur|repara|ac[tț]iun)/i.test(b) ||
    /\b(?:am|au\s+fost)\s+dispus[e]?\s+(?:m[ăa]suri|verific[ăa]ri|repara[tț]ii)/i.test(b) ||
    /\bm[ăa]suri\s+de\s+remediere/i.test(b) ||
    /\burmeaz[ăa]\s+(?:s[ăa]\s+fie|a\s+fi)\s+(?:efectuate|executate|demarate|realizate)/i.test(b)
  ) {
    return {
      status: "in-lucru",
      confidence: 88,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  // ─── RESPINS ───────────────────────────────────────────────────────────────
  if (
    /\bsesizarea?\s+(?:dvs|dumneavoastr[ăa])?\s*nu\s+este\s+(?:întemeiat[ăa]|fondat[ăa]|justificat[ăa])/i.test(b) ||
    /\bnu\s+se\s+(?:justific[ăa]|impune)\s+interven[tț]ia/i.test(b) ||
    /\bclasamen?t\s+f[ăa]r[ăa]\s+(?:obiect|m[ăa]suri)/i.test(b)
  ) {
    return {
      status: "respins",
      confidence: 90,
      suggested_action: "escalate_now",
      source: "deterministic",
    };
  }

  // ─── ÎNREGISTRATĂ — patterns common (cel mai larg) ─────────────────────────
  // Subject patterns (cel mai puternic signal). Folosim subjectTrim.
  const subjectInreg =
    /numar\s+inregistrare/i.test(subjectTrim) ||
    /num[ăa]r\s+(?:de\s+)?[îi]nregistrare/i.test(subjectTrim) ||
    /solicitarea\s+a\s+fost\s+inregistrat/i.test(subjectTrim) ||
    /solicitarea\s+a\s+fost\s+înregistrat/i.test(subjectTrim) ||
    /cerere\s+(?:a\s+fost\s+)?[îi]nregistrat/i.test(subjectTrim) ||
    /[îi]nregistrare\s+cerere/i.test(subjectTrim) ||
    /[îi]nregistrare\s+oficial[ăa]/i.test(subjectTrim) ||
    /confirmare\s+(?:de\s+)?primire/i.test(subjectTrim) ||
    /confirmare\s+[îi]nregistrare/i.test(subjectTrim);

  // Body patterns (mai diverse, observate in production)
  const bodyInreg =
    /\bsolicitarea\s+(?:dvs|dumneavoastr[ăa]?\s+)?a\s+fost\s+[îi]nregistrat/i.test(b) ||
    /\bcererea\s+(?:dvs|dumneavoastr[ăa]?\s+)?a\s+fost\s+[îi]nregistrat/i.test(b) ||
    /\b(?:sesizarea|peti[tț]ia)\s+(?:dvs|dumneavoastr[ăa]?\s+)?a\s+fost\s+[îi]nregistrat/i.test(b) ||
    /\bam\s+primit\s+(?:sesizarea|peti[tț]ia|cererea|solicitarea)/i.test(b) ||
    /\bv[ăa]\s+(?:confirm[ăa]m|comunic[ăa]m)\s+primirea/i.test(b) ||
    /\b[îi]nregistrat[ăa]?\s+(?:sub|cu)\s+(?:nr\.?|num[ăa]rul|num[ăa]rul\s+de\s+[îi]nregistrare|num[ăa]rul\s+PMB|num[ăa]rul\s+[A-Z]{2,4})/i.test(b) ||
    /\bv[ăa]\s+r[ăa]spundem\s+[îi]n\s+(?:termenul\s+legal|maximum\s+30\s+zile|30\s+de\s+zile)/i.test(b) ||
    /\bconform\s+(?:OG|Ordonan[tț]ei)\s+27\/2002/i.test(both) ||
    /\bcerere\s+[îi]nregistrat[ăa]/i.test(b) ||
    /\bsolicitare\s+[îi]nregistrat[ăa]/i.test(b) ||
    // PMB pattern „cu numărul PMB 89420 / DATA"
    /\bcu\s+num[ăa]rul\s+[A-Z]{2,5}\s+\d+/i.test(b) ||
    // „Confirm[ăa]m primirea" / „Confirm[ăa]m primirea e-mailului"
    /\bconfirm[ăa]m\s+primirea/i.test(b);

  if (subjectInreg || bodyInreg) {
    // Confidence boost dacă subject + body ambele match SAU sender e trusted
    let confidence = 85;
    if (subjectInreg && bodyInreg) confidence = 95;
    if (args.trustedSender && (subjectInreg || bodyInreg)) confidence = Math.max(confidence, 90);
    return {
      status: "inregistrata",
      confidence,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  // ─── SUBJECT ECHO de la trusted sender (fără body informativ) ──────────────
  // „Sesizare 00050 — X" sau „Re: Sesizare 00006 — X" trimis înapoi de
  // PMB/sector ca acknowledgment. Pe sector5 (dezvoltareurbana@) am observat
  // si cazul cand emailul are 0 body + atașamente cu pozele originale +
  // logo-uri institutionale → „Re: Sesizare X" + trusted sender = clear
  // acknowledgment chiar fara body. Bump confidence la 80.
  if (
    args.trustedSender &&
    /^(?:re|fw|fwd)?:?\s*sesizare\s+\d{3,8}/i.test(subjectTrim) &&
    bodyTrim.length < 500 &&
    !/marketing|newsletter|abonare|abonament/i.test(b)
  ) {
    return {
      status: "inregistrata",
      confidence: 85,
      suggested_action: "monitor_progress",
      source: "deterministic",
    };
  }

  return null;
}

const SYSTEM_PROMPT = `Esti un classifier specializat in raspunsuri oficiale de la autoritati publice romanesti la sesizari civice depuse prin platforma Civia.

Userul a depus o sesizare. Acum autoritatea (primarie, prefectura, Brigada Rutiera, CNAIR, etc.) raspunde. Citesti textul raspunsului si returnezi UN SINGUR JSON cu schema:

{
  "status": "inregistrata|in-lucru|actiune-autoritate|interventie|amanata|rezolvat|redirectionata|respins|cerere_informatii|necunoscut",
  "confidence": <0-100>,
  "nr_inregistrare": "<numarul de inregistrare daca apare, altfel null>",
  "summary": "<o fraza scurta in romana, neutra, max 150 caractere>",
  "deadline": "<dead-line sau perioada mentionata, altfel null>",
  "suggested_action": "wait_for_resolution|respond_with_info|escalate_now|confirm_resolution|monitor_progress",
  "is_spam": <true daca emailul nu pare raspuns oficial, altfel false>
}

CRITERII STATUS:

- "inregistrata": Autoritatea confirma primirea sesizarii/cererii/peititiei sau ofera numar de inregistrare. Subject-ul tipic contine: „Numar inregistrare 'Sesizare X'", „Solicitarea a fost inregistrata", „Cerere inregistrata", „înregistrare cerere", „Confirmare primire". Body tipic: „Va comunicam ca am primit sesizarea dvs", „Va raspundem in termenul legal de 30 zile conform OG 27/2002", „Sesizarea a fost inregistrata sub nr X/AN", „Cerere inregistrata cu nr X/AN". DACA SUBIECTUL ESTE „Numar inregistrare 'Sesizare X'" SAU „Solicitarea a fost inregistrata" → ASTA E INREGISTRATA cu confidence 95+, indiferent ce e in body. NU PUNE „necunoscut" pe astfel de subiecte.

- "in-lucru": Autoritatea a LUAT MASURI / a actionat, DAR problema NU e inca reparata. Include: „Echipa noastra va interveni saptamana viitoare", „Lucrarea este in executie", „Am alocat resurse pentru remediere", „Am programat interventia", „Am aplicat Note de Constatare", „S-au aplicat sanctiuni/amenzi", „Am dispus masuri de remediere", „Se vor demara lucrarile". REGULA: daca autoritatea CONSTATA + ANUNTA masuri viitoare („se vor demara", „urmeaza sa", „am dispus") → ASTA E IN-LUCRU, NU rezolvat.

- "actiune-autoritate": Poliția Locală / Brigada Rutiera A ACTIONAT in teren: „au aplicat Note de Constatare", „procese-verbale de sanctionare", „au aplicat instiintari vehiculelor", „sanctiuni contraventionale conducatorilor auto", „au efectuat verificari pe artera/in zona". DOAR la TRECUT (au aplicat / au efectuat) — NU cereri viitoare („solicitam sprijinul Politiei pentru aplicarea sanctiunilor" = NU asta, ala e amanata/in-lucru). Mai PRECIS decat in-lucru pentru raspunsuri de la politie.

- "interventie": Lucrarea fizica e EFECTUATA, punctual. „Stalpisorii au fost montati", „s-a asfaltat", „marcajul a fost refacut", „lucrarea fizica a fost efectuata". (Daca problema e complet rezolvata, foloseste rezolvat.)

- "amanata": Autoritatea RECUNOASTE problema dar AMANA interventia intr-un proiect mai amplu / depinde de buget. „urmeaza sa demareze lucrari in functie de bugetul alocat", „in cadrul contractului de reparatii", „dupa finalizarea/materializarea/receptia lucrarilor", „dupa modernizarea infrastructurii", „nu va putem oferi un termen estimativ", „in functie de gradul de risc", „va intra in reabilitare in cadrul acestui proiect". Tipic Administratia Strazilor.

- "rezolvat": DOAR cand problema e EFECTIV reparata, la TRECUT, finalizat. „Lucrarea a fost finalizata", „Problema semnalata a fost remediata", „Va comunicam rezolvarea". NU folosi rezolvat daca apare „se vor demara", „urmeaza", „in functie de buget" (= amanata), „Note de Constatare/sanctiuni aplicate" (= actiune-autoritate).

- "redirectionata": Autoritatea spune ca nu e competenta ei. „Nu intra in competenta noastra, va rugam adresati X", „Am transmis sesizarea catre X", subject FW: / FWD: cu trimitere catre alta institutie.

- "respins": Autoritatea refuza explicit. „Sesizarea nu este intemeiata", „Nu se justifica interventia", „Conform legii X, nu se incadreaza".

- "cerere_informatii": Autoritatea cere clarificari. „Va rugam sa precizati exact locatia", „Avem nevoie de mai multe detalii", „Va rugam transmiteti imaginile".

- "necunoscut": DOAR DACA emailul nu se potriveste cu NICIO categorie de mai sus. Cazuri tipice: marketing/newsletter, autoreply pe vacation, email pierdut accidental. Daca subject sau body CONTINE pattern de inregistrare/confirmare → NU folosi „necunoscut".

REGULI:

1. Confidence 90+ DOAR pentru raspunsuri clare. Daca match-uiesti DOAR pe subject („Numar inregistrare 'Sesizare X'") cu body generic, confidence 85-90. Daca subject + body confirma, 95+.
2. nr_inregistrare: cauta pattern „nr X/AN", „numarul X", „X/AAAA", „A1234/2026". Returneaza string-ul exact. Daca NU apare numar concret in text (doar subject „Numar inregistrare 'Sesizare 00050 / '" cu / gol), returneaza null.
3. summary: in romana, neutra. NU adauga interpretari („felicitari", „bun"), DOAR fapte.
4. is_spam=true DOAR pentru: marketing real (oferte, abonari), newsletter explicit, vacation auto-reply. „Va raspundem in 30 zile" NU e spam, e inregistrata.
5. Mojibake (encoding broken): textul „MaÈini" inseamna „Mașini", „Ã®nregistratÄ" inseamna „înregistrată". NU lasa mojibake-ul sa te confuza — citeste prin el.
6. RASPUNZI DOAR JSON valid. Fara markdown, fara explicatii.`;

const FALLBACK: ClassifyResult = {
  status: "necunoscut",
  confidence: 0,
  nr_inregistrare: null,
  summary: "Email primit, clasificarea AI a eșuat — verificare manuală necesară.",
  deadline: null,
  suggested_action: "wait_for_resolution",
  is_spam: false,
  source: "fallback",
};

export async function classifyReply(args: {
  subject: string | null | undefined;
  body: string | null | undefined;
  sender_name?: string | null;
  authority_hint?: string | null;
  /** 2026-05-29 — Pass dacă sender e trusted (primarie verificată). */
  trusted_sender?: boolean;
}): Promise<ClassifyResult> {
  // 1. Mojibake recovery — fix subject + body inainte de orice classifier
  const subjectClean = recoverMojibake(args.subject ?? "");
  const bodyClean = recoverMojibake(args.body ?? "");

  // 2. Build combined text pentru AI fallback
  const text = [
    subjectClean ? `Subject: ${subjectClean}` : "",
    args.sender_name ? `From: ${args.sender_name}` : "",
    args.authority_hint ? `Authority hint: ${args.authority_hint}` : "",
    "",
    bodyClean,
  ].filter(Boolean).join("\n");

  if (!text.trim() || text.length < 20) {
    return { ...FALLBACK, summary: "Email gol sau prea scurt pentru clasificare." };
  }

  // 3. Deterministic pre-classifier (skip AI if matched cu confidence high)
  const pre = deterministicPreClassify({
    subject: subjectClean,
    body: bodyClean,
    trustedSender: args.trusted_sender === true,
  });

  if (pre && pre.status && pre.confidence && pre.confidence >= 85) {
    // Extract nr_inregistrare din subject + body (text combinat)
    const nr = extractNrInregistrare(`${subjectClean}\n${bodyClean}`);
    const summary = buildDeterministicSummary(pre.status, subjectClean);
    return {
      status: pre.status,
      confidence: pre.confidence,
      nr_inregistrare: nr,
      summary,
      deadline: null,
      suggested_action: pre.suggested_action ?? "wait_for_resolution",
      is_spam: false,
      source: "deterministic",
    };
  }

  // 4. AI fallback — cascadă rezilientă (Groq→Gemini→Cloudflare→registry).
  // 2026-06-07: înainte era apel Groq DIRECT → orice 429 cădea la FALLBACK
  // „necunoscut", chiar și pe răspunsuri oficiale de fond → sesizarea nu avansa.
  // Acum trece prin groqText (același cascadă ca restul AI-ului).
  try {
    const raw = await groqText(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 8000) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 400,
      },
      { fallbackModel: GROQ_MODEL_FAST },
    );
    if (!raw) return FALLBACK;

    const parsed = JSON.parse(raw) as Partial<ClassifyResult>;

    const validStatuses: ReplyStatus[] = [
      "inregistrata", "in-lucru", "actiune-autoritate", "interventie", "amanata",
      "rezolvat", "redirectionata", "respins", "cerere_informatii", "necunoscut",
    ];
    const status = validStatuses.includes(parsed.status as ReplyStatus)
      ? (parsed.status as ReplyStatus)
      : "necunoscut";

    const validActions: SuggestedAction[] = [
      "wait_for_resolution", "respond_with_info", "escalate_now",
      "confirm_resolution", "monitor_progress",
    ];
    const suggested_action = validActions.includes(parsed.suggested_action as SuggestedAction)
      ? (parsed.suggested_action as SuggestedAction)
      : "wait_for_resolution";

    // Hallucination guard pe nr_inregistrare
    let nrInregistrare: string | null = null;
    if (typeof parsed.nr_inregistrare === "string" && parsed.nr_inregistrare.length > 0) {
      const cand = parsed.nr_inregistrare.slice(0, 50);
      const isValidFormat = /^[A-Z0-9.\-/]{3,20}(?:\/\d{4})?$/i.test(cand);
      const numCore = cand.replace(/^(?:nr\.?|numar\s*|nr)/i, "").trim();
      const appearsInText = text.toLowerCase().includes(numCore.toLowerCase());
      nrInregistrare = isValidFormat && appearsInText ? cand : null;
    }
    // Fallback la deterministic extraction dacă AI nu a returnat
    if (!nrInregistrare) {
      nrInregistrare = extractNrInregistrare(text);
    }

    // Auto-reply elevate: dacă AI returnează „necunoscut" dar textul are
    // pattern clar de auto-acknowledgment, elevăm la „inregistrata".
    const autoReplyPatterns = [
      /v[ăa]\s+r[ăa]spundem\s+[îi]n\s+\d+\s+zile/i,
      /am\s+primit\s+(?:sesizarea|peti[tț]ia|cererea|solicitarea)/i,
      /va\s+fi\s+(?:analizat[ăa]|solu[tț]ionat[ăa])\s+[îi]n\s+termenul\s+legal/i,
      /conform\s+(?:OG|Ordonan[tț]ei)\s+27\/2002/i,
      /solicitarea\s+a\s+fost\s+[îi]nregistrat/i,
      /cerere\s+[îi]nregistrat[ăa]/i,
      /[îi]nregistrare\s+cerere/i,
      /numar\s+inregistrare/i,
      /num[ăa]r\s+(?:de\s+)?[îi]nregistrare/i,
    ];
    const elevated = autoReplyPatterns.some((p) => p.test(`${subjectClean} ${bodyClean}`));
    let finalStatus: ReplyStatus = status;
    let finalAction: SuggestedAction = suggested_action;
    let finalSource: ClassifyResult["source"] = "ai";
    let finalConfidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    if (elevated && status === "necunoscut") {
      finalStatus = "inregistrata";
      finalAction = "monitor_progress";
      finalSource = "ai+autoreply";
      finalConfidence = Math.max(finalConfidence, 80);
    }

    return {
      status: finalStatus,
      confidence: finalConfidence,
      nr_inregistrare: nrInregistrare,
      summary: typeof parsed.summary === "string"
        ? parsed.summary.slice(0, 300)
        : "Răspuns oficial primit.",
      deadline: typeof parsed.deadline === "string" && parsed.deadline.length > 0
        ? parsed.deadline.slice(0, 100)
        : null,
      suggested_action: finalAction,
      is_spam: parsed.is_spam === true,
      raw: parsed,
      source: finalSource,
    };
  } catch {
    return FALLBACK;
  }
}

/** Generates a neutral RO summary for deterministic pre-classifier hits. */
function buildDeterministicSummary(status: ReplyStatus, subject: string): string {
  switch (status) {
    case "inregistrata":
      return `Autoritatea confirmă înregistrarea sesizării. Subject: „${subject.slice(0, 80)}"`;
    case "in-lucru":
      return "Autoritatea confirmă că lucrează / a programat intervenția.";
    case "actiune-autoritate":
      return "Autoritatea a acționat în teren (verificări, înștiințări, sancțiuni / procese-verbale).";
    case "interventie":
      return "Autoritatea a efectuat lucrarea fizică (montare stâlpișori / reparație).";
    case "amanata":
      return "Autoritatea recunoaște problema, dar amână intervenția (buget / proiect amplu / fără termen).";
    case "rezolvat":
      return "Autoritatea declară problema rezolvată — verifică în teren.";
    case "redirectionata":
      return "Autoritatea a redirecționat sesizarea către o altă instituție competentă.";
    case "respins":
      return "Autoritatea respinge sesizarea — escaladare recomandată (Avocatul Poporului).";
    case "cerere_informatii":
      return "Autoritatea cere clarificări — răspunde cu detalii suplimentare.";
    default:
      return "Răspuns oficial primit.";
  }
}

/**
 * Decide whether the AI classification should be auto-applied to the
 * sesizare status, vs require manual user confirmation.
 */
export function shouldAutoApply(args: {
  classification: ClassifyResult;
  trusted_sender: boolean;
}): boolean {
  const { classification, trusted_sender } = args;
  if (!trusted_sender) return false;
  if (classification.is_spam) return false;
  if (classification.confidence < 80) return false;
  if (classification.status === "necunoscut") return false;
  if (classification.status === "respins") return false;
  return true;
}
