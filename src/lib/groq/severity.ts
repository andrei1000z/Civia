import { getGroqClient, GROQ_MODEL_VISION } from "./client";

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export interface SeverityResult {
  level: SeverityLevel;
  /** 0-100 confidence */
  confidence: number;
  /** One short reason line in Romanian. */
  reason: string;
  /** True if we returned a heuristic fallback (Groq failed). */
  fallback?: boolean;
}

const SYSTEM_PROMPT = `Esti un evaluator de severitate civica. Vezi o poza dintr-o sesizare si raspunzi STRICT in JSON:
{
  "level": "low|medium|high|critical",
  "confidence": number 0-100,
  "reason": "o fraza scurta in romana"
}

Reguli de scoring:
- critical: pericol IMINENT pentru viata (cablu electric cazut, conducta gaz, structura prabusita, puț descoperit pe trotuar/drum, copac cazut peste fir electric).
- high: risc semnificativ accident (groapa MARE pe carosabil, semafor stricat la intersectie, gura canal deschisa, panou cazut, pietoni fortati pe carosabil cu trafic).
- medium: probleme functionale fara risc viata (gropi mici, iluminat stricat punctual, gunoi necolectat de >1 saptamana, parcare ilegala pe trotuar).
- low: estetic, mobilier deteriorat fara risc, graffiti, afisaj neautorizat, gunoi sporadic.

Important:
- Daca poza e neclara/intuneric → confidence < 40, level "medium" by default (nu speriem fals).
- Severitatea NU depinde de starea estetica, ci de RISC CONCRET pentru cetateni.
- DOAR JSON, fara markdown sau text suplimentar.`;

const FALLBACK: SeverityResult = {
  level: "medium",
  confidence: 0,
  reason: "Severitate neevaluata (AI indisponibil).",
  fallback: true,
};

/**
 * Analyze a sesizare photo and return a severity score.
 *
 * Audit item #86. Uses Groq vision (Llama 4 Scout). Best-effort —
 * returns heuristic fallback on any error so the caller can proceed
 * without blocking on AI.
 *
 * Cost: ~$0.0001 per call (Llama 4 Scout pricing). Worth it for the
 * triage signal — high/critical can auto-prioritize in admin views.
 */
export async function analyzeSeverity(imageUrl: string): Promise<SeverityResult> {
  if (!imageUrl || typeof imageUrl !== "string") return FALLBACK;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_VISION,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Evalueaza severitatea acestei sesizari." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return FALLBACK;

    const parsed = JSON.parse(raw) as Partial<SeverityResult>;
    const level = parsed.level;
    if (level !== "low" && level !== "medium" && level !== "high" && level !== "critical") {
      return FALLBACK;
    }
    return {
      level,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Heuristic severity from text only (no vision call). Cheap fallback
 * used when there's no photo. Looks at keywords in tip + descriere.
 *
 * Bug fixes 5/22/2026:
 *   #13 Keywords lista extinsa + diacritics-normalize (ruptă/rupta both work)
 *   #14 Context check — „in curte privata" downgrade severity
 */

function normalizeForKeywordMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove diacritics
}

export function severityFromText(
  tip: string,
  descriere: string,
): SeverityResult {
  // Bug fix #13 — normalize diacritics ca „ruptă" sa match-uiasca cu „rupta".
  const text = normalizeForKeywordMatch(`${tip} ${descriere}`);

  // Extins cu cuvinte missed: rupt[ăa], cazatura, conducta, scurgere etc.
  const criticalKw = [
    "cablu", "gaz", "prabusit", "prabusita",
    "explozie", "incendiu", "structura prabusita",
    "put deschis", "groapa adanca",
    "conducta rupta", "conducta sparta",
    "fir cazut", "stalp cazut",
    "pericol iminent", "pericol de moarte",
    "scurgere de gaz", "fum dens",
  ];
  const highKw = [
    "semafor stricat", "semafor defect",
    "intersectie", "groapa mare", "groapa mare in carosabil",
    "panou cazut", "panou rupt",
    "canal deschis", "capac canal lipsa",
    "copac cazut", "copac rupt", "creanga rupta",
    "scurgere", "inundatie", "apa pe carosabil",
    "trecere fara semafor", "lipsa marcaje",
  ];
  const lowKw = ["graffiti", "afis", "mobilier", "panou publicitar", "tag", "afis salbatic"];

  // Bug fix #14 — context downgrade: daca e in „curte privata" sau
  // „proprietate privata", severity nu mai e public-civic responsibility.
  const privateContextPatterns = [
    /curte\s+privat[ăa]/,
    /proprietate\s+privat[ăa]/,
    /teren\s+privat/,
    /zona\s+privata/,
  ];
  const isPrivateContext = privateContextPatterns.some((p) => p.test(text));

  let level: SeverityResult["level"] = "medium";
  let confidence = 40;
  let reason = "Severitate medie estimata din text.";

  if (criticalKw.some((kw) => text.includes(kw))) {
    level = "critical";
    confidence = 65;
    reason = "Cuvinte cheie de pericol iminent in descriere.";
  } else if (highKw.some((kw) => text.includes(kw))) {
    level = "high";
    confidence = 55;
    reason = "Risc semnificativ identificat in descriere.";
  } else if (lowKw.some((kw) => text.includes(kw))) {
    level = "low";
    confidence = 50;
    reason = "Probleme estetice fara risc concret.";
  }

  // Bug #14 — context private: downgrade by 1 level (private property
  // = not municipal responsibility, severity for citizen is lower).
  if (isPrivateContext && (level === "critical" || level === "high")) {
    const downgrade: Record<SeverityResult["level"], SeverityResult["level"]> = {
      critical: "high",
      high: "medium",
      medium: "low",
      low: "low",
    };
    level = downgrade[level];
    reason = "Context privat — severity ajustată în jos (responsabilitate proprietar, nu publică).";
    confidence = Math.max(30, confidence - 10);
  }

  return { level, confidence, reason };
}
