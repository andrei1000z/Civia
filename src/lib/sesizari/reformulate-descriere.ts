/**
 * 2026-05-27 — Reformulare AI a descrierii cetățeanului pentru textul formal.
 *
 * User a observat (sesizare test): „sunt masini parcate pana in intrarea
 * din bloc sa le ia si sa monteze stalpisori anti parcare" → ajungea în
 * formal_text exact așa (doar capitalize + punct). Aratau ca un text de
 * cetățean copiat brut, nu ca o sesizare formală.
 *
 * Soluția: AI face un pas de reformulare — păstrează ce a scris cetățeanul
 * (zero fapte noi, zero halucinații) DAR rescrie în limbaj formal românesc:
 *   - diacritice complete
 *   - gramatică corectă (acord, virgule)
 *   - registru oficial („autoturisme" în loc de „masini", „obstrucționează"
 *     în loc de „pana în intrare")
 *   - 1-3 propoziții, concis
 *
 * Constraint critic: NU ADAUGĂ fapte. Dacă cetățeanul scrie „masini
 * parcate", AI nu poate spune „10 mașini parcate" sau „mașini de tonaj
 * mare". Doar reformulează ce e deja acolo.
 *
 * Fallback dacă AI eșuează: returnează input-ul cu doar capitalize + punct
 * (comportamentul anterior). Sesizarea pleacă oricum.
 */

import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";

const SYSTEM_PROMPT = `Ești un asistent care reformulează descrierea unei probleme civice în limbaj formal românesc.

CONTEXT: Textul tău va fi inserat într-o sesizare oficială către primărie, ÎNAINTE de o listă numerotată cu măsurile solicitate. Lista cu „1. ..., 2. ..., 3. ..." e adăugată automat după textul tău — deci NU trebuie să soliciți tu nimic în reformulare.

REGULI CRITICE:
1. DESCRIE doar situația observată — fapte, locație, impact. NU solicita acțiuni.
2. NU FOLOSI niciodată: „solicităm", „vă rugăm", „cerem", „faceți", „solicit respectuos", „intervenție", „să luați măsuri", „să rezolvați". Cuvintele astea vin în lista numerotată după textul tău — dacă le pui aici, apare duplicat.
3. NU ADĂUGA fapte care nu sunt în textul original. Zero invenții. Dacă user-ul zice „mașini parcate", spui „autoturisme parcate" — NU „autoturisme parcate ilegal pe trotuar" dacă nu menționează trotuar.
4. NU EXAGERA. Fără „grav", „extrem de periculos", „pune în pericol vieți" dacă nu apare în text.
5. NU MINIMIZA. Fără „mai sunt probleme similare", „dar înțelegem".
6. Folosește diacritice complete: ă, â, î, ș, ț.
7. Registru oficial: „autoturisme" în loc de „mașini", „obstrucționează accesul" în loc de „nu se poate trece".
8. Output: 1-3 propoziții, max 300 caractere, concis, descriptiv.
9. NU începe cu „Bună ziua" / „Mă numesc" / „Subsemnatul".
10. NU termina cu „Vă mulțumesc" / „Cu stimă".

GÂNDIRE: descrii CE VEZI, nu CE CERI.

EXEMPLE BUNE (doar descriere):

Input: "sunt masini parcate pana in intrarea din bloc sa le ia si sa monteze stalpisori anti parcare"
Output: "Autoturisme parcate ilegal obstrucționează intrarea în imobil, situație care afectează accesul rezidenților și siguranța pietonilor în zonă."

Input: "groapa mare pe strada lipscani aproape de muzeu, masinile aproape se rastoarna"
Output: "În apropierea Muzeului, pe Strada Lipscani, există o groapă semnificativă în carosabil care afectează siguranța circulației auto."

Input: "iarba e mare in parc nu se mai vede nimic"
Output: "Vegetația din parc nu a fost cosită de o perioadă îndelungată, depășind înălțimea normală și reducând vizibilitatea în zonă."

Input: "gunoiul nu s a luat de o saptamana plin tomberonul"
Output: "Tomberonul stradal nu a fost golit de aproximativ o săptămână, fiind supraîncărcat cu deșeuri și generând disconfort sanitar pentru locuitorii din zonă."

Input: "iluminatu stradal nu merge de cateva zile pe strada vasile lascar"
Output: "Pe Strada Vasile Lascăr, iluminatul public este nefuncțional de câteva zile, generând zone întunecate pe timp de noapte."

EXEMPLE GREȘITE (NU FACE ASTA):

❌ "...Solicităm intervenția Poliției Locale..." → conține „solicităm" + duplicat cu lista numerotată
❌ "...Vă rugăm să interveniți urgent..." → conține solicitare directă
❌ "...trebuie montați stâlpișori anti-parcare..." → conține soluție/acțiune

OUTPUT: STRICT textul reformulat, fără preambul, fără markdown, fără ghilimele. Doar DESCRIERE faptică.`;

const FALLBACK_MAX_LEN = 500;

/** Capitalize + final punctuation fallback. */
function fallback(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, FALLBACK_MAX_LEN);
  if (cleaned.length === 0) return "";
  const capitalized = cleaned[0]!.toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Defensive post-processor — caută patterns de solicitare în output-ul AI.
 * Lista numerotată cu „1. ..., 2. ...,  3. ..." e adăugată de template
 * după textul reformulat. Dacă AI a ignorat regula 2 și a inclus
 * „solicităm" / „vă rugăm" / etc., textul ar arăta duplicat. Detectăm și
 * fallback la formalizare simplă (mai puțin elegantă dar non-duplicate).
 */
const SOLICITATION_PATTERNS = [
  /\bsolicit[ăa]m?\b/i,
  /\bsolicit[ăa]ri\b/i,
  /\bv[ăa]\s+rog[ăa]m?\b/i,
  /\brug[ăa]m\b/i,
  /\bcerem\b/i,
  /\bface[țt]i\b/i,
  /\binterven[țt]ia?\s+(poli[țt]iei|prim[ăa]riei|autorit[ăa][țt]ilor)/i,
  /\bs[ăa]\s+lua[țt]i\s+m[ăa]suri/i,
  /\bs[ăa]\s+rezolva[țt]i\b/i,
  /\bs[ăa]\s+interveni[țt]i\b/i,
  /\b[îi]n\s+regim\s+de\s+urgen[țt][ăa]/i,
  /\btrebuie\s+s[ăa]\s+(?:fie|se)\s+(montat|reparat|cur[ăa][țt]at|verificat)/i,
];

function hasSolicitation(text: string): boolean {
  return SOLICITATION_PATTERNS.some((re) => re.test(text));
}

/**
 * Reformulează descrierea cetățeanului. Returnează input fallback dacă AI
 * eșuează — nu blocăm niciodată generarea formal_text.
 */
export async function reformulateDescriere(raw: string): Promise<string> {
  const input = raw.trim();
  if (input.length < 10) return fallback(input);

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });
    const out = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!out || out.length < 10) return fallback(input);
    // Strip cazuri în care AI ignoră regulile și începe cu „Bună ziua" / etc.
    let stripped = out
      .replace(/^(bun[ăa]\s+ziua,?\s*|m[ăa]\s+numesc[^.]*\.\s*|stimat[ăa]?\s+doamn[ăa]\/?domnule[^,]*,?\s*)/i, "")
      .trim();
    // Strip trailing „1. ... 2. ... 3. ..." (AI confuz, include literal lista).
    stripped = stripped
      .replace(/\s*\d+\.\s*\.{2,}.*$/, "")
      .replace(/\s*\b\d+\.\s+[A-ZĂÂÎȘȚ][^.]*?\.(?=\s*\d+\.|\s*$)/g, "")
      .replace(/\s*-\s*$/, "")
      .trim();
    if (stripped.length < 10) return fallback(input);
    if (hasSolicitation(stripped)) return fallback(input);
    return stripped;
  } catch {
    return fallback(input);
  }
}

// ─── ACȚIUNI SOLICITATE — AI reordonează + ajustează minor ──────────

const ACTIONS_REORDER_PROMPT = `Ești un asistent care primește o listă de măsuri pre-formulate pentru o sesizare oficială către primărie. Sarcina ta e DOAR să REORDONEZI lista (eventual ajustând minimal textul) în ordine logică: imediat → planificare → permanent.

REGULI CRITICE:
1. NU REFORMULA acțiunile complet — păstrează cuvintele și referințele legale (OUG 195/2002, art. 108 etc.) EXACT ca în input.
2. DOAR reordonează după urgență:
   • PRIMA: acțiune imediată — Poliția Locală, sancțiuni, ridicare, intervenție urgentă, curățare.
   • A DOUA: verificare / planificare — analiza zonei, identificarea autorităților, planificare lucrare.
   • A TREIA: lucrare permanentă — montare stâlpișori, asfaltare, reabilitare, instalare echipamente.
3. POȚI ajusta MINIM textul DOAR dacă descrierea cetățeanului indică nevoie specifică (ex: dacă user-ul zice „în special noaptea" la iluminat, poți menționa „în special pe timp de noapte" la sfârșitul acțiunii relevante).
4. NU ADĂUGA acțiuni noi care nu sunt în input.
5. NU ELIMINA acțiuni din input.
6. NU INVENTA articole sau referințe legale noi.
7. Output: exact aceleași 2-4 acțiuni, în ordine nouă, format „1. ... 2. ... 3. ...".

EXEMPLE:

Input acțiuni:
1. Montarea stâlpișorilor anti-parcare.
2. Verificarea zonei.
3. Intervenția Poliției Locale pentru sancționarea șoferilor.

Output reordonat:
1. Intervenția Poliției Locale pentru sancționarea șoferilor.
2. Verificarea zonei.
3. Montarea stâlpișorilor anti-parcare.

Input acțiuni:
1. Plombarea gropii.
2. Verificarea integrității carosabilului în zonă.

Output (verificarea înainte):
1. Verificarea integrității carosabilului în zonă.
2. Plombarea gropii.

OUTPUT: STRICT lista numerotată, fără preambul, fără markdown.`;

/**
 * Reordonează acțiunile prefab în ordine imediat → planificare → permanent,
 * cu ajustări minime contextualizate pe descriere. Fallback la input
 * neschimbat dacă AI eșuează.
 */
export async function reorderActions(args: {
  tip: string;
  descriere: string;
  prefabActions: string[];
}): Promise<string[]> {
  const desc = args.descriere?.trim() || "";
  if (args.prefabActions.length <= 1) return args.prefabActions;
  if (desc.length < 10) return args.prefabActions;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: ACTIONS_REORDER_PROMPT },
        {
          role: "user",
          content: `tip=${args.tip}\ndescriere="${desc}"\nacțiuni:\n${args.prefabActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
    });
    const out = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!out) return args.prefabActions;

    const lines = out
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\s+/.test(l))
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter((l) => l.length >= 15 && l.length <= 600);

    // Sanity: dacă AI a returnat alt număr de acțiuni decât input, fallback.
    if (lines.length !== args.prefabActions.length) return args.prefabActions;
    return lines;
  } catch {
    return args.prefabActions;
  }
}

// ─── ADRESĂ + LOCAȚIE — AI normalizează diacritice + format formal ──

/**
 * 2026-05-28 — user request: AI să normalizeze și adresa userului
 * + locația problemei (diacritice, abrevieri expand, capitalizare).
 *
 * Cetățenii scriu „str panduri 33 sect 1 bucuresti" → ar trebui să devină
 * „Strada Panduri nr. 33, Sector 1, București". Fără AI textul ajunge brut
 * în formal_text spre primărie.
 *
 * Constraint: NU INVENTA. Dacă lipsește sectorul, NU îl pune. Dacă lipsește
 * orașul, NU îl pune. Doar normalizează ce e deja acolo.
 *
 * Fallback: capitalize first letter dacă AI eșuează.
 */
const ADDRESS_NORMALIZE_PROMPT = `Ești un asistent care normalizează adrese românești pentru o sesizare oficială către primărie.

REGULI CRITICE:
1. Adaugă DIACRITICE complete: ă, â, î, ș, ț (ex: „bucuresti" → „București", „septembrie" → „Septembrie", „sosea" → „Șosea").
2. Capitalizează numele proprii (Strada, Bulevardul, Șoseaua, București, Cluj-Napoca, numele străzilor).
3. Expand abrevieri: „str" → „Strada", „bd" → „Bulevardul", „sos" → „Șoseaua", „sect" → „Sector", „nr" → „nr.", „bl" → "bloc", „sc" → "sc.", "ap" → "ap.".
4. NU ADĂUGA fapte care nu sunt în input. Dacă nu menționează sector, NU pune sector. Dacă nu menționează oraș, NU pune oraș.
5. Format final cu virgule între componente: „Strada Panduri nr. 33, Sector 1, București" sau „Bulevardul Magheru, Cluj-Napoca".
6. Păstrează exact numerele (nr. 33 rămâne nr. 33, NU devine nr. 30 sau nr. 33A).
7. Numele de străzi rămân ca în input (doar capitalizate + diacritice). NU schimbi „Petru Rares" → „Petru Rareș" decât dacă e clar nume istoric standard.

OUTPUT: STRICT adresa normalizată, fără preambul, fără ghilimele, fără markdown. Doar text.

EXEMPLE:
Input: "str panduri 33 sc a"
Output: "Strada Panduri nr. 33, sc. A"

Input: "soseaua panduri 33 bloc P1 sc A bucuresti"
Output: "Șoseaua Panduri nr. 33, bloc P1, sc. A, București"

Input: "bd basarabia sect 2"
Output: "Bulevardul Basarabia, Sector 2"

Input: "intersectia Petru Rares si Ioan Bianu sector 1"
Output: "Intersecția străzilor Petru Rareș și Ioan Bianu, Sector 1"

Input: "calea 13 septembrie cluj napoca"
Output: "Calea 13 Septembrie, Cluj-Napoca"`;

function fallbackAddress(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Normalizează o adresă românească via Groq AI. Fallback la capitalize
 * simplă dacă AI eșuează. NU adaugă fapte.
 */
export async function reformulateAdresa(raw: string | null | undefined): Promise<string> {
  const input = (raw ?? "").trim();
  if (input.length < 3) return input;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: ADDRESS_NORMALIZE_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });
    const out = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!out || out.length < 3) return fallbackAddress(input);
    // Strip ghilimele dacă AI le-a pus accidental.
    const cleaned = out.replace(/^["'„«]+|["'»"]+$/g, "").trim();
    if (cleaned.length < 3) return fallbackAddress(input);
    return cleaned;
  } catch {
    return fallbackAddress(input);
  }
}

