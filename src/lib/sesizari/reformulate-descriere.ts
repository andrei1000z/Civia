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

import { groqText, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { deriveTitluFromDescriere, isPlaceholderTitlu } from "@/lib/sesizari/titlu";
import { restoreDiacritics } from "@/lib/sesizari/diacritice";

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

/** Capitalize + diacritice deterministe + final punctuation fallback. */
function fallback(raw: string): string {
  const cleaned = restoreDiacritics(raw.replace(/\s+/g, " ").trim().slice(0, FALLBACK_MAX_LEN));
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
    // 2026-06-04 — model TEXT (70B) pentru diacritice corecte, CU cascadă la 8B
    // dacă 70B e rate-limited (limită zilnică mică) → nu cădem direct pe raw.
    const out = await groqText(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
        temperature: 0.2,
        max_tokens: 220,
      },
      { fallbackModel: GROQ_MODEL_FAST },
    );
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
    // Post-pass diacritice: prinde cuvintele pe care modelul le-a lăsat fără
    // diacritice („cosuri/stalpii") — text public corect gramatical.
    return restoreDiacritics(stripped);
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
    const out = await groqText({
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

// ─── ACȚIUNI CONTEXTUALE — generate din descriere când prefab e generic ──

/**
 * 2026-05-29 — Pentru tip "altele" prefab actions sunt generice
 * ("Verificarea situației la fața locului", "Luarea măsurilor corespunzătoare
 * conform competențelor instituției"). User-ul a observat că emailul către
 * primărie suna gol și impersonal când contextul descrierii cerea acțiuni
 * SPECIFICE (ex: sancționare șofer pe trotuar, investigare conduită poliție).
 *
 * Această funcție generează 2-4 acțiuni CONCRETE bazate pe descriere —
 * cu referințe legale când e cazul (OUG 195/2002 art. 35 pt circulație pe
 * trotuar, OG 27/2002 pt răspuns, etc.).
 *
 * Constraint: NU INVENTA fapte noi. Acțiunile sunt DERIVATE din ce e în
 * descriere — nu adăugăm "investigarea poliției" dacă cetățeanul nu a
 * menționat poliție.
 *
 * Fallback la prefab actions dacă AI eșuează.
 */
const CONTEXTUAL_ACTIONS_PROMPT = `Ești un asistent care primește descrierea unei probleme civice și generează 2-4 acțiuni concrete pe care le solicită cetățeanul autorității.

CONTEXT: Acțiunile tale ajung într-o listă numerotată într-o sesizare oficială către primărie/poliție.

REGULI CRITICE:
1. DOAR 2-4 acțiuni. Fără introducere, fără concluzie. Direct lista.
2. Acțiunile trebuie să fie DERIVATE din descrierea cetățeanului — NU INVENTA acțiuni pentru fapte care nu sunt în text.
3. Fii CONCRET. „Verificarea situației la fața locului" e generic și inutil. Spune EXACT ce trebuie făcut: „Sancționarea șoferului identificat cu numărul de înmatriculare [X]", „Investigarea conduitei echipajului de poliție".
4. INCLUDE REFERINȚE LEGALE când relevant:
   - Vehicul pe trotuar (parcare/ocupare): art. 72 alin. (7) din OUG 195/2002 (interdicție), sancțiune art. 108 alin. (1) lit. b) pct. 7
   - Staționare neregulamentară: sancțiune art. 108 alin. (1) lit. b) pct. 7 din OUG 195/2002; locuri interzise art. 142-143 din Regulamentul de aplicare (HG 1391/2006)
   - Conduită demnitar/funcționar: art. 11 din Codul Etic al funcționarilor publici
   - Răspuns autoritate: OG 27/2002 art. 8 (30 zile)
   - Curățenie domeniu public: HCGMB 120/2010
   - Iluminat public: HCGMB 281/2006
5. ORDINE LOGICĂ: imediat (sancțiune, intervenție) → planificare (verificare, anchetă) → permanent (reabilitare, montare echipamente).
6. Fiecare acțiune termină cu PUNCT.
7. Limba: română CU DIACRITICE (ă, â, î, ș, ț).
8. NU prefa cu „1. ..., 2. ..." — listă brută, fiecare acțiune pe linie nouă.
9. NU folosi „solicităm", „vă rugăm", „cerem" — acțiunile sunt în lista numerotată după paragraful de solicitare, nu repeta cuvântul.

EXEMPLE:

Descriere: "În intersecția Chișinău cu Pantelimon, un șofer cu numărul B-957-MUT a circulat pe trotuar printre pietoni. Un echipaj de Poliție Locală (B-38-BZD) a trecut prin față, ignorând semnalul, salutând șoferul și ne aplicând nicio măsură."
Acțiuni:
Identificarea și sancționarea șoferului autoturismului cu numărul de înmatriculare B-957-MUT pentru circulația/staționarea pe trotuar, conform art. 72 alin. (7) din OUG 195/2002.
Investigarea conduitei echipajului de Poliție Locală cu numărul de înmatriculare B-38-BZD pentru neîndeplinirea atribuțiilor de serviciu și pasivitate față de o încălcare flagrantă observată.
Aplicarea măsurilor disciplinare ce se impun conform legislației în vigoare și a Codului Etic al funcționarilor publici.

Descriere: "Iluminatul stradal pe strada Vasile Lascăr nu funcționează de o săptămână, zona e foarte întunecată noaptea, e periculos."
Acțiuni:
Verificarea funcționării corpurilor de iluminat public pe Strada Vasile Lascăr.
Înlocuirea sau repararea în regim de urgență a becurilor defecte sau a tabloului electric afectat.
Comunicarea unui termen estimativ pentru remediere, conform HCGMB 281/2006.

Descriere: "Pe trotuarul de la blocul 14 e o groapă mare, persoanele în vârstă riscă să cadă."
Acțiuni:
Verificarea integrității trotuarului la adresa indicată și evaluarea gradului de pericol.
Plombarea sau reabilitarea zonei afectate de către administratorul rețelei de utilități responsabile.
Semnalizarea temporară a zonei până la finalizarea reparațiilor pentru protecția pietonilor.

OUTPUT: STRICT lista de acțiuni (2-4 linii), fiecare pe rând nou, fără numerotare, fără preambul, fără markdown.`;

/**
 * Generează acțiuni contextuale derivate din descrierea cetățeanului.
 * Folosit pentru tip "altele" sau când prefab e prea generic. Fallback
 * la prefab dacă AI eșuează sau output e invalid.
 */
export async function generateContextualActions(args: {
  descriere: string;
  tip: string;
  locatie?: string | null;
  prefabFallback: string[];
}): Promise<string[]> {
  const desc = args.descriere?.trim() || "";
  if (desc.length < 20) return args.prefabFallback;

  try {
    // acțiunile (cu referințe legale) merg la autorități → 70B, cascadă la 8B.
    const out = await groqText(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: CONTEXTUAL_ACTIONS_PROMPT },
          {
            role: "user",
            content: `tip=${args.tip}\nlocatie=${args.locatie || "N/A"}\ndescriere="${desc}"`,
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      },
      { fallbackModel: GROQ_MODEL_FAST },
    );
    if (!out) return args.prefabFallback;

    // Parse: split pe linii, scoate numerotare daca AI a inclus, filtru length.
    const lines = out
      .split(/\n+/)
      .map((l) => l.trim())
      .map((l) => l.replace(/^[\d]+[.)]\s*/, "")) // strip "1. " sau "1) "
      .map((l) => l.replace(/^[-•*]\s*/, ""))     // strip bullet markers
      .filter((l) => l.length >= 20 && l.length <= 400)
      .filter((l) => !/^solicit|^v[ăa]\s+rog|^cerem|^rug[ăa]m/i.test(l)); // skip solicit lines

    if (lines.length < 2) return args.prefabFallback;
    return lines.slice(0, 4); // max 4 actions
  } catch {
    return args.prefabFallback;
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

// ─── TITLU — AI generează un titlu scurt descriptiv din descriere ──────

/**
 * 2026-06-04 — Generează TITLUL sesizării din descrierea cetățeanului.
 *
 * Înainte, titlul era extras printr-un regex pe textul formal („Vă sesizez cu
 * privire la...") — frază INTERZISĂ de prompt, deci regex-ul nu prindea
 * niciodată → titlul cădea pe eticheta tip-picker-ului („Altele (categoria se
 * creează automat din descriere)"). Acum AI-ul produce un titlu real,
 * descriptiv, pentru ORICE sesizare. Fallback determinist (prima clauză din
 * descriere) dacă AI eșuează — niciodată placeholder.
 *
 * Constraint: NU INVENTA. Doar din ce e în descriere.
 */
const TITLU_PROMPT = `Ești editor pentru o platformă civică. Creezi TITLUL scurt al unei sesizări către primărie, pornind STRICT de la descrierea cetățeanului.

REGULI:
1. DESCRIPTIV, nu imperativ. „Mașini parcate pe trotuar pe Strada Zori de Zi" — NU „Luați măsuri!".
2. Concis: 4-9 cuvinte, MAXIM 70 de caractere.
3. Sentence case (doar prima literă mare + nume proprii), diacritice complete (ă, â, î, ș, ț).
4. Spune PROBLEMA + (dacă încape) locația scurtă. NU copia toată descrierea.
5. NU INVENTA fapte. Doar din descriere.
6. Fără ghilimele, fără punct final, fără markdown, fără emoji.
7. INTERZIS cuvinte goale ca titlu: „Altele", „Sesizare", „Problemă", „Diverse".

EXEMPLE:
Descriere: "sunt masini parcate pe trotuar pe zori de zi nu se poate trece"
Titlu: Mașini parcate pe trotuar pe Strada Zori de Zi

Descriere: "cosuri de gunoi pe stalpii de iluminat pe cetatea de balta sector 6 direct pe carosabil periculos"
Titlu: Coșuri de gunoi montate pe carosabil pe Strada Cetatea de Baltă

Descriere: "groapa mare pe lipscani langa muzeu masinile aproape se rastoarna"
Titlu: Groapă periculoasă în carosabil pe Strada Lipscani

Descriere: "iluminatu stradal nu merge de o saptamana pe vasile lascar e periculos noaptea"
Titlu: Iluminat public defect pe Strada Vasile Lascăr

OUTPUT: STRICT titlul, o singură linie, fără preambul.`;

/**
 * Generează un titlu descriptiv din descriere via Groq. Fallback determinist
 * (prima clauză) dacă AI eșuează sau întoarce un titlu invalid/placeholder.
 */
export async function generateTitlu(args: {
  descriere: string;
  locatie?: string | null;
}): Promise<string> {
  const desc = (args.descriere ?? "").trim();
  if (desc.length < 10) return deriveTitluFromDescriere(desc);

  try {
    // titlul e public + în subiect email → 70B pentru calitate, cascadă la 8B.
    let out = (await groqText(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: TITLU_PROMPT },
          {
            role: "user",
            content: `descriere="${desc}"${args.locatie ? `\nlocatie="${args.locatie}"` : ""}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 40,
      },
      { fallbackModel: GROQ_MODEL_FAST },
    )).trim();
    // strip ghilimele / punct final / markdown accidental
    out = out
      .replace(/^["'„«»\s]+|["'„«»\s]+$/g, "")
      .replace(/[.]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (out.length < 5 || isPlaceholderTitlu(out)) {
      return deriveTitluFromDescriere(desc);
    }
    if (out.length > 80) {
      const cut = out.slice(0, 78);
      const sp = cut.lastIndexOf(" ");
      out = (sp > 40 ? cut.slice(0, sp) : cut).trim();
    }
    return restoreDiacritics(out);
  } catch {
    return deriveTitluFromDescriere(desc);
  }
}

/**
 * Normalizează o adresă românească via Groq AI. Fallback la capitalize
 * simplă dacă AI eșuează. NU adaugă fapte.
 */
export async function reformulateAdresa(raw: string | null | undefined): Promise<string> {
  const input = (raw ?? "").trim();
  if (input.length < 3) return input;

  try {
    const out = await groqText({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: ADDRESS_NORMALIZE_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });
    if (!out || out.length < 3) return fallbackAddress(input);
    // Strip ghilimele dacă AI le-a pus accidental.
    const cleaned = out.replace(/^["'„«]+|["'»"]+$/g, "").trim();
    if (cleaned.length < 3) return fallbackAddress(input);
    return cleaned;
  } catch {
    return fallbackAddress(input);
  }
}

