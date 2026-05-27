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
    const stripped = out
      .replace(/^(bun[ăa]\s+ziua,?\s*|m[ăa]\s+numesc[^.]*\.\s*|stimat[ăa]?\s+doamn[ăa]\/?domnule[^,]*,?\s*)/i, "")
      .trim();
    if (stripped.length < 10) return fallback(input);
    // 2026-05-27 — Defensive: dacă AI a ignorat regula 2 și a inclus
    // „solicităm" / „vă rugăm" / „intervenția poliției", returnăm fallback
    // ca să nu duplicăm acțiunile cu lista numerotată din template.
    if (hasSolicitation(stripped)) return fallback(input);
    return stripped;
  } catch {
    return fallback(input);
  }
}
