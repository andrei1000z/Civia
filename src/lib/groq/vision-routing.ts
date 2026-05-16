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
  "tip": "groapa|trotuar|iluminat|copac|gunoi|parcare|stalpisori|canalizare|semafor|pietonal|graffiti|mobilier|zgomot|animale|transport|afisaj|altele",
  "authority": "primarie_sector|primarie_municipiu|primarie_judet|cnair|salubritate|politia_locala|termoenergetica|apa_nova|necunoscut",
  "confidence": number 0-100,
  "description": "o fraza scurta in romana despre ce se vede",
  "evidence": ["bullet 1", "bullet 2"]
}

Reguli:
- Daca poza arata drum NATIONAL (DN, autostrada, indicator KM) → authority="cnair", indiferent ca e gunoi pe el.
- Daca e parcare ilegala pe trotuar/spatiu verde → "politia_locala" (NU primarie).
- Daca e gunoi nescos in container/europubela → "salubritate", NU primarie.
- Inundatie/canalizare blocata → "apa_nova" (Bucuresti) sau "primarie_municipiu" (provincie).
- Iluminat public stricat → "primarie_sector" (in Bucuresti) sau "primarie_municipiu".
- Conducta termoficare stricata, abur in strada → "termoenergetica".
- Confidence < 50 daca poza e neclara/intuneric.
- DOAR JSON, fara markdown sau text suplimentar.`;

/**
 * Trimite poza la Groq Llama 4 Scout si returneaza routing-ul + tip-ul +
 * descriere + evidence. Pe failure (network, model timeout, JSON corrupt),
 * fallback la rezultatul „necunoscut/altele/30%".
 */
export async function routeFromImage(imageUrl: string): Promise<VisionRoutingResult> {
  try {
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
    });

    const raw = res.choices[0]?.message?.content?.trim() ?? "{}";
    // Strip markdown fence if AI emite ```json...```
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      tip: typeof parsed.tip === "string" ? parsed.tip : "altele",
      authority: typeof parsed.authority === "string" ? parsed.authority : "necunoscut",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 50,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : "",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 4).map((e: unknown) => String(e).slice(0, 100)) : [],
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
