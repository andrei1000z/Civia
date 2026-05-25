import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import * as Sentry from "@sentry/nextjs";

/**
 * 2026-05-25 — AI smart category classifier pentru știri civice.
 *
 * Înlocuiește (sau augmentează) keyword-based classifier din rss.ts cu
 * o decizie semantică AI, folosind Groq Llama 3.1 8B Instant (low cost,
 * <300ms) + descrieri DETALIATE per categorie.
 *
 * Use-case: keyword classifier marca multe articole ca „administratie"
 * implicit (fallback) chiar dacă erau clar despre transport / mediu /
 * siguranță. AI înțelege context, fraze indirecte, mențiuni multiple.
 *
 * Categorii cu descrieri canonice (ground truth pentru model):
 */
export const CATEGORY_DEFINITIONS: Record<string, string> = {
  transport: `
    Transport public (STB, metrou, Metrorex, autobuz, tramvai, troleibuz,
    taxi, ride-sharing), bilete/abonamente, trafic auto, semafoare,
    semnalizare rutieră, drumuri, autostrăzi, poduri, pasaje, șine,
    mobilitate urbană, piste de biciclete, parcări publice, transport în
    comun, lucrări rutiere. ATENȚIE: parcare ilegală/sancțiuni →
    "siguranta", nu "transport".`,
  urbanism: `
    Planificare urbană (PUG, PUZ), construcții civile, autorizații
    construire, dezvoltare imobiliară, cartiere noi, blocuri, terenuri
    publice, regenerare urbană, demolări legale, expropriere, primării
    care aprobă/blochează proiecte mari, dezvoltatori, certificate
    urbanism. NU include trafic/transport.`,
  mediu: `
    Poluare (aer, apă, sol), tăieri ilegale arbori, parcuri/spații
    verzi (atenție: "parcare" ≠ parc!), deșeuri, salubritate, reciclare,
    climă, schimbări climatice, animale (sălbatice, comunitare,
    bunăstare), biodiversitate, Garda de Mediu, ANPM, calitate aer/apă.
    Include eveniment de poluare specifică (incendiu pe gunoi, deversare).`,
  siguranta: `
    Accidente rutiere, incendii (clădiri, vegetație), poliție (cazuri,
    arestări, intervenții), furt, tâlhării, infracțiuni, violență, agresiuni,
    jandarmerie, ISU, urgențe medicale colective, dezastre naturale
    (inundații, cutremure), parcare ilegală cu consecințe, evacuări. NU
    include politică/decizii primărie.`,
  administratie: `
    Primării (decizii, hotărâri), consiliu local/județean (ședințe,
    voturi), prefectură, guvern, miniștri, parlament, alegeri, scrutin,
    buget public (alocări, deficit), taxe/impozite, legislație nouă,
    PNRR, fonduri europene, ANI, ANAF, Avocatul Poporului, instituții
    centrale. Articole despre politică/decizii politice ale autorităților.`,
  eveniment: `
    Festivaluri, concerte, paradă, sărbători publice (1 mai, ziua
    națională), evenimente culturale (teatru, expoziții, muzee), sportive
    (maratoane, competiții), comunitate (festivaluri stradă, târguri,
    inaugurări). ATENȚIE: proteste/manifestații civice → "administratie"
    (sunt politice).`,
};

const VALID_CATEGORIES = Object.keys(CATEGORY_DEFINITIONS);

/**
 * Clasifică o știre folosind AI cu context complet. Returnează una din
 * categoriile valide; fallback la "administratie" doar la eroare AI.
 *
 * @param title Titlul știrii (cel mai important semnal)
 * @param excerpt Lead/excerpt (poate fi vag, ok dacă lipsește)
 * @param source Sursa (Digi24, etc.) — context util pentru AI
 */
export async function classifyCategoryWithAI(
  title: string,
  excerpt: string = "",
  source: string = "",
): Promise<string> {
  // Guard: input gol → fallback fără AI call.
  if (!title || title.length < 8) return "administratie";

  const promptDefinitions = VALID_CATEGORIES.map(
    (c) => `- ${c.toUpperCase()}: ${CATEGORY_DEFINITIONS[c]!.trim().replace(/\s+/g, " ")}`,
  ).join("\n");

  const system = `Esti un clasificator de stiri civice romanesti. Ai 6 categorii:

${promptDefinitions}

Reguli stricte:
1. Returnezi STRICT un JSON: {"category": "<una din ${VALID_CATEGORIES.join("|")}>"}
2. Niciun text in afara JSON-ului.
3. Cand stirea atinge mai multe categorii, alege categoria PRINCIPALA
   (cea care domina articolul, nu cea care doar e mentionata).
4. Cand nu esti sigur, alege "administratie" (default sigur, niciodata gol).`;

  const userPrompt = `Sursa: ${source}
Titlu: ${title}
${excerpt ? `Excerpt: ${excerpt.slice(0, 500)}` : ""}

Clasifica.`;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { category?: string };
    const cat = (parsed.category ?? "").toLowerCase();
    if (VALID_CATEGORIES.includes(cat)) return cat;
    return "administratie";
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "ai_category_classify" }, extra: { title: title.slice(0, 100) } });
    return "administratie";
  }
}
