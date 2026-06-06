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

export type Severity = "low" | "medium" | "high" | "critical";

export interface VisionRoutingResult {
  tip: string; // unul din SESIZARE_TIPURI.value
  authority: AuthorityKind;
  confidence: number; // 0-100
  // 2026-05-24 (P2.566) — severity auto-attribuit de AI Vision.
  // "critical"/"high" → featured priority pe /sesizari-publice.
  severity?: Severity;
  description: string; // o fraza despre ce se vede
  evidence: string[]; // bullet-uri scurte
  fallback?: boolean;
}

const SYSTEM_PROMPT = `Esti un router civic. Vezi o poza dintr-o sesizare cetateneasca si raspunzi STRICT in JSON:
{
  "tip": "groapa|trotuar|iluminat|copac|gunoi|parcare|stalpisori|canalizare|semafor|trecere_pietoni|graffiti|mobilier|zgomot|animale|transport|afisaj|altele",
  "authority": "primarie_sector|primarie_municipiu|primarie_judet|cnair|salubritate|politia_locala|termoenergetica|apa_nova|necunoscut",
  "severity": "low|medium|high|critical",
  "confidence": number 0-100,
  "description": "o fraza scurta in romana despre ce se vede",
  "evidence": ["bullet 1", "bullet 2"]
}

Severity rules (P2.566 — 2026-05-24):
- "critical": pericol IMINENT viața/siguranță (groapă mare în șosea, copac căzut pe carosabil, scurgere gaz, semafor stins la intersecție mare, cablu electric pe jos, inundație activă)
- "high": pericol cert dar nu iminent (stâlpișori distruși cu mașini pe trotuar, gropi mari, trecere pietoni fără marcaj la școală/spital, animale comunitare agresive)
- "medium": problemă semnificativă, nu pericol imediat (parcare ilegală tipică, gunoi împrăștiat, iluminat parțial defect, graffiti banal)
- "low": nuisance estetic sau minor (afișaj ilegal, mobilier deteriorat, gunoi minor)

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
- Infrastructura TRAMVAI / METROU / TREN (sine, gard despartitor pe linia de tramvai, statie deteriorata, peron, oprire, semnalizare cale ferata) → tip="transport", NU "stalpisori". Stalpisorii anti-parcare sunt DOAR pe trotuar, nu pe linie tramvai. Daca vezi sine/cale rulanta in poza → transport.
- Confidence < 50 daca poza e neclara/intuneric/dubla interpretare posibila.
- DOAR JSON, fara markdown sau text suplimentar.`;

/**
 * Trimite poza la Groq Llama 4 Scout si returneaza routing-ul + tip-ul +
 * descriere + evidence. Pe failure (network, model timeout, JSON corrupt),
 * fallback la rezultatul „necunoscut/altele/30%".
 */
/**
 * Batch 6 (5/22/2026) — Vision result cache via Upstash Redis.
 * Hash URL → cache routing decision 7 zile. Plan item #88.
 *
 * Aceeasi imagine analizata de 100 useri = 1 AI call, nu 100.
 * Economie: ~80-90% pe vision pe sesizari publice / similar issues.
 */
// 2026-06-06 — MIGRAT Upstash → Cloudflare D1 (Upstash suspendat billing).
// Cache vision pe 7 zile: aceeași imagine analizată de N useri = 1 apel Groq.
function visionCacheKey(imageUrl: string): string {
  // djb2 (fără crypto — compatibil edge).
  let hash = 5381;
  for (let i = 0; i < imageUrl.length; i++) {
    hash = ((hash << 5) + hash + imageUrl.charCodeAt(i)) | 0;
  }
  return `vision-cache:${Math.abs(hash).toString(36)}`;
}

async function getCachedVision(imageUrl: string): Promise<VisionRoutingResult | null> {
  try {
    const { analyticsD1 } = await import("@/lib/analytics/d1-client");
    if (!analyticsD1) return null;
    const raw = await analyticsD1.get<string>(visionCacheKey(imageUrl));
    return raw ? (JSON.parse(raw) as VisionRoutingResult) : null;
  } catch {
    return null;
  }
}

async function setCachedVision(imageUrl: string, result: VisionRoutingResult): Promise<void> {
  try {
    const { analyticsD1 } = await import("@/lib/analytics/d1-client");
    if (!analyticsD1) return;
    await analyticsD1.set(visionCacheKey(imageUrl), JSON.stringify(result), {
      ex: 7 * 24 * 60 * 60, // 7 zile
    });
  } catch {
    // silent — cache failure NU trebuie sa rupa flow
  }
}

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

    // Batch 6 — check cache inainte de a chema Groq (plan item #88).
    // Cache hit = zero AI cost + sub-50ms response.
    const cached = await getCachedVision(imageUrl);
    if (cached) return cached;

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

    const validSeverities: Severity[] = ["low", "medium", "high", "critical"];
    const parsedSeverity =
      typeof parsed.severity === "string" && validSeverities.includes(parsed.severity as Severity)
        ? (parsed.severity as Severity)
        : "medium"; // safe fallback

    const result: VisionRoutingResult = {
      tip,
      authority: typeof parsed.authority === "string" ? parsed.authority : "necunoscut",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 50,
      severity: parsedSeverity,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : "",
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence
            .slice(0, 4)
            .filter((e: unknown) => typeof e === "string" && (e as string).length > 0)
            .map((e: unknown) => String(e).slice(0, 100))
        : [],
    };

    // Batch 6 — cache result 7 zile pentru aceeasi imagine.
    // Fire-and-forget, nu blocheaza response.
    void setCachedVision(imageUrl, result);

    return result;
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
