import { getGroqClient, GROQ_MODEL_VISION } from "./client";

export type AuthorityKind =
  | "primarie_sector"
  | "primarie_municipiu"
  | "primarie_judet"
  | "cnair"
  | "salubritate"
  | "politia_locala"
  | "termoenergetica"
  | "apa_nova"
  | "necunoscut";

export interface VisionRoutingResult {
  tip: string; // unul din SESIZARE_TIPURI.value
  authority: AuthorityKind;
  confidence: number; // 0-100
  description: string; // o fraza despre ce se vede
  evidence: string[]; // bullet-uri scurte
  fallback?: boolean;
}

const SYSTEM_PROMPT = `Esti un router civic. Vezi o poza dintr-o sesizare cetateneasca si raspunzi STRICT in JSON:
{
  "tip": "groapa|trotuar|iluminat|copac|gunoi|parcare|stalpisori|canalizare|semafor|trecere_pietoni|graffiti|mobilier|zgomot|animale|transport|afisaj|altele",
  "authority": "primarie_sector|primarie_municipiu|primarie_judet|cnair|salubritate|politia_locala|termoenergetica|apa_nova|necunoscut",
  "confidence": number 0-100,
  "description": "o fraza scurta in romana despre ce se vede",
  "evidence": ["bullet 1", "bullet 2"]
}

Reguli (rewrite 5/22/2026 — bug #7 + #9):

CNAIR — DOAR daca vezi DOVADA VIZUALA EXPLICITA (NU presupuneri):
- Indicator rutier LITERAL "DN-X" (DN1, DN6, A1, A2, A3) VIZIBIL in cadru
- SAU borna KM-marker oficial pe marginea drumului
- SAU semn "CNAIR" / "Compania Națională de Administrare a Infrastructurii Rutiere"
- NU ghicesti "pare a fi DN" pe baza de latime/marcaje — confidence MAX 40 daca nu e dovada clara.
- Default pe orice strada urbana: primarie_sector / primarie_municipiu, NU cnair.

Restul:
- Parcare ilegala pe trotuar/spatiu verde → "politia_locala" (NU primarie).
- Gunoi nescos in container/europubela → "salubritate", NU primarie.
- Inundatie/canalizare blocata, capac canal lipsa → "apa_nova" (Bucuresti) sau "primarie_municipiu" (provincie).
- Iluminat public stricat → "primarie_sector" (in Bucuresti) sau "primarie_municipiu".
- Conducta termoficare stricata, abur in strada → "termoenergetica".
- Tip "trecere_pietoni" (NU "pietonal") pentru zebra ceruta / amenajare.
- Confidence < 50 daca poza e neclara/intuneric/dubla interpretare posibila.
- DOAR JSON, fara markdown sau text suplimentar.`;

/**
 * Trimite poza la Groq Llama 4 Scout si returneaza routing-ul + tip-ul +
 * descriere + evidence. Pe failure (network, model timeout, JSON corrupt),
 * fallback la rezultatul „necunoscut/altele/30%".
 */
export async function routeFromImage(imageUrl: string): Promise<VisionRoutingResult> {
  try {
    // Bug fix #75 (5/22/2026) — image URL validation strictă.
    // Trebuie sa fie HTTPS + Supabase storage domain SAU image.civia.ro.
    // Previne SSRF si image-spoofing prin URL extern.
    const urlObj = new URL(imageUrl);
    const allowedHosts = [/\.supabase\.co$/, /^civia\.ro$/, /^www\.civia\.ro$/];
    if (urlObj.protocol !== "https:" || !allowedHosts.some((p) => p.test(urlObj.hostname))) {
      return {
        tip: "altele",
        authority: "necunoscut",
        confidence: 0,
        description: "URL invalid pentru vision (doar Supabase storage acceptat).",
        evidence: [],
        fallback: true,
      };
    }

    // Bug fix #89 (5/22/2026) — Vision timeout 25s (Vercel max 45s).
    // Daca Groq vision hang, fallback la text-only nu blocheaza request-ul.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    const client = getGroqClient();
    const res = await client.chat.completions.create({
      model: GROQ_MODEL_VISION,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analizeaza poza si raspunde strict JSON." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);

    const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
    // Strip markdown fence if AI emite ```json...```
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    // Bug fix #9 (5/22/2026) — AI poate emite „pietonal" (legacy) sau alte
    // typo-uri. Mapping inversed (toate variante → cheia oficiala din
    // SYSTEM_PROMPT_CLASSIFIER).
    const TIP_ALIASES: Record<string, string> = {
      pietonal: "trecere_pietoni",
      pieton: "trecere_pietoni",
      crossing: "trecere_pietoni",
      "trecere-pietoni": "trecere_pietoni",
    };
    const rawTip = typeof parsed.tip === "string" ? parsed.tip : "altele";
    const tip = TIP_ALIASES[rawTip] ?? rawTip;

    return {
      tip,
      authority: typeof parsed.authority === "string" ? parsed.authority : "necunoscut",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 50,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : "",
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence
            .slice(0, 4)
            .filter((e: unknown) => typeof e === "string" && (e as string).length > 0)
            .map((e: unknown) => String(e).slice(0, 100))
        : [],
    };
  } catch {
    return {
      tip: "altele",
      authority: "necunoscut",
      confidence: 30,
      description: "Nu am putut analiza poza automat.",
      evidence: [],
      fallback: true,
    };
  }
}

export const AUTHORITY_LABELS: Record<AuthorityKind, string> = {
  primarie_sector: "Primăria de sector",
  primarie_municipiu: "Primăria municipiului",
  primarie_judet: "Consiliul Județean",
  cnair: "CNAIR (drumuri naționale)",
  salubritate: "Operatorul de salubritate",
  politia_locala: "Poliția Locală",
  termoenergetica: "Termoenergetica",
  apa_nova: "Apa Nova",
  necunoscut: "Necunoscut (verifică manual)",
};
