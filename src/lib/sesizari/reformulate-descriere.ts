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

const SYSTEM_PROMPT = `Ești un asistent care reformulează descrierea unei probleme civice în limbaj formal românesc pentru o sesizare oficială către primărie.

REGULI CRITICE:
1. NU ADĂUGA fapte care nu sunt în textul original. Zero invenții.
2. NU SCHIMBA sensul. Dacă user-ul zice „mașini parcate", spui „autoturisme parcate" — NU „autoturisme parcate ilegal pe trotuar" dacă nu menționează trotuar.
3. NU EXAGERA. Fără „grav", „extrem de periculos", „pune în pericol vieți" dacă nu apare în text.
4. NU MINIMIZA. Fără „mai sunt probleme similare", „dar înțelegem".
5. Folosește diacritice complete: ă, â, î, ș, ț.
6. Folosește registru oficial: „autoturisme" în loc de „mașini", „obstrucționează accesul" în loc de „nu se poate trece", „solicităm intervenție" în loc de „faceți ceva".
7. Output: 1-3 propoziții, max 350 caractere, concis, formal.
8. NU începe cu „Bună ziua" sau „Mă numesc" sau „Subsemnatul" — doar descrierea problemei.
9. NU termina cu „Vă mulțumesc" sau „Cu stimă" — doar fapte.

EXEMPLE:

Input: "sunt masini parcate pana in intrarea din bloc sa le ia si sa monteze stalpisori anti parcare"
Output: "Autoturisme parcate ilegal obstrucționează intrarea în bloc. Solicităm intervenția Poliției Locale pentru ridicarea acestora și montarea de stâlpișori anti-parcare în zona afectată."

Input: "groapa mare pe strada lipscani aproape de muzeu, masinile aproape se rastoarna"
Output: "Pe Strada Lipscani, în apropierea Muzeului, există o groapă semnificativă în carosabil care afectează siguranța circulației auto."

Input: "iarba e mare in parc nu se mai vede nimic"
Output: "Vegetația din parc nu a fost cosită de o perioadă îndelungată, depășind înălțimea normală și reducând vizibilitatea în zonă."

Input: "gunoiul nu s a luat de o saptamana plin tomberonul"
Output: "Tomberonul stradal nu a fost golit de aproximativ o săptămână, fiind supraîncărcat cu deșeuri."

OUTPUT: STRICT textul reformulat, fără preambul, fără markdown, fără ghilimele.`;

const FALLBACK_MAX_LEN = 500;

/** Capitalize + final punctuation fallback. */
function fallback(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, FALLBACK_MAX_LEN);
  if (cleaned.length === 0) return "";
  const capitalized = cleaned[0]!.toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
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
    return stripped.length >= 10 ? stripped : fallback(input);
  } catch {
    return fallback(input);
  }
}
