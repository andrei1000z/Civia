/**
 * AI Response Quality Score — analizează răspunsurile primite de la
 * autorități și le clasifică (P2.587, P3.766):
 *
 *   - „substantive": răspuns real, concret, cu informații utile
 *   - „boilerplate": fraze standard generale, fără răspuns concret
 *   - „redirect": ne trimite la altă instituție (legitim sau evitare)
 *   - „refusal": refuz explicit, motivat sau nu
 *   - „acknowledgment": confirmare înregistrare, fără răspuns încă
 *
 * Combinație: regex pattern detection (rapid + cost-free) + Groq classify
 * pentru cazuri ambigue (boilerplate vs substantive).
 */

import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";

export type ResponseQuality =
  | "substantive"
  | "boilerplate"
  | "redirect"
  | "refusal"
  | "acknowledgment";

export interface QualityScoreResult {
  quality: ResponseQuality;
  /** 0-100, încrederea în clasificare */
  confidence: number;
  /** Bullet-uri scurte de ce e clasificat așa */
  reasoning: string[];
  /** Flag: detectat ca boilerplate via regex (zero AI cost) */
  boilerplateRegexHit: boolean;
}

// Pattern-uri română comune pentru răspunsuri boilerplate.
// Identificate din audit manual al răspunsurilor primăriilor românești.
const BOILERPLATE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:luăm|luam|vom lua)\s+(?:la\s+)?cuno[șs]tin[țt][ăa]\s+de\s+sesizar/i,
    reason: "Frază standard fără răspuns concret",
  },
  {
    pattern: /a[șs]a\s+cum\s+prevede\s+legea/i,
    reason: "Apel la lege fără citare specifică",
  },
  {
    pattern: /(?:vom|o\s+s[ăa])\s+(?:analiz|stud|examina|verifica)[a-z]*\s+(?:cu\s+aten[țt]ie|temeinic|atent)/i,
    reason: "Promisiune vagă de analiză fără termen concret",
  },
  {
    // /s flag e ES2018+, dar tsconfig target=ES2017. Folosim [\s\S] în loc de .
    pattern: /v[ăa]\s+mul[țt]umim\s+pentru\s+(?:mesaj|sesizare|adresare)[\s\S]{0,50}\.\s*(?:Cu\s+(?:stim|deosebit))/i,
    reason: "Mulțumire formală fără răspuns la întrebări",
  },
  {
    pattern: /Conform\s+(?:procedurilor|legisla[țt]iei)\s+(?:în\s+vigoare|actuale)/i,
    reason: `Apel la „proceduri" fără specificitate`,
  },
  {
    pattern: /Cu\s+respect\s+și\s+considera[țt]ie/i,
    reason: "Formulă de încheiere standard (semnal slab singur)",
  },
];

const REDIRECT_PATTERNS: Array<RegExp> = [
  /(?:redirec[țt]ion[ăa]m?|trimit[em]m|comunic[ăa]m|transferr?[ăa]m)\s+sesizar[a-z]*(?:\s+dvs)?\s+(?:c[ăa]tre|la)/i,
  /(?:nu\s+(?:intr[ăa]|este|e)\s+(?:în|in)\s+competen[țt]a)\s+(?:noastr[ăa]|prim[ăa]riei)/i,
  /aspectele?\s+(?:sesizate?|prezentate?)\s+(?:nu\s+)?(?:intr[ăa]|sunt)\s+de\s+competen[țt]a/i,
  /direc[țt]iona[mt][a-z]*\s+(?:c[ăa]tre|la)\s+(?:[A-ZȘȚ]|prim[ăa]ria|prefectur[ăa])/i,
];

const REFUSAL_PATTERNS: Array<RegExp> = [
  /nu\s+(?:putem|poate|pot|po[țt]i)\s+(?:da\s+curs|aproba|accept|onora|raspunde|răspunde)/i,
  /nu\s+(?:putem|poate|este|exist[ăa])\s+(?:posibil|posibilitatea|fezabil|justificare)/i,
  /respin[gg]e[mt][a-z]*\s+(?:cer[er][a-z]+|solicitar[a-z]+|sesizar[a-z]+)/i,
  /(?:lipsa|nu\s+sunt|insuficien[țt][ăa])\s+(?:de\s+)?(?:fonduri|resurse|buget)/i,
];

const ACKNOWLEDGMENT_PATTERNS: Array<RegExp> = [
  /am\s+(?:înregistrat|primit)\s+sesizar[a-z]*\s+(?:dvs|dumneavoastr[ăa])/i,
  /(?:nr|num[ăa]r)\.?\s*(?:de\s+)?(?:înregistrare|înreg)\.?\s*[:#]?\s*[\w\d\-\/]+/i,
  /v[ăa]\s+vom\s+(?:r[ăa]spunde|informa)\s+în\s+termen/i,
];

/** Quick pre-screen via regex. Returnează quality only dacă e clar. */
export function quickScore(text: string): {
  quality: ResponseQuality | null;
  reasoning: string[];
  boilerplateRegexHit: boolean;
} {
  const reasoning: string[] = [];
  let boilerplateHits = 0;

  for (const { pattern, reason } of BOILERPLATE_PATTERNS) {
    if (pattern.test(text)) {
      boilerplateHits += 1;
      reasoning.push(reason);
    }
  }

  const isRedirect = REDIRECT_PATTERNS.some((p) => p.test(text));
  const isRefusal = REFUSAL_PATTERNS.some((p) => p.test(text));
  const isAck = ACKNOWLEDGMENT_PATTERNS.some((p) => p.test(text));

  // Priority order: explicit redirect > explicit refusal > ack > boilerplate
  if (isRedirect) {
    reasoning.unshift("Pattern de redirecționare detectat");
    return { quality: "redirect", reasoning, boilerplateRegexHit: boilerplateHits > 0 };
  }
  if (isRefusal) {
    reasoning.unshift("Pattern de refuz detectat");
    return { quality: "refusal", reasoning, boilerplateRegexHit: boilerplateHits > 0 };
  }
  // 3+ boilerplate hits = clearly boilerplate (prioritate înainte de ack)
  if (boilerplateHits >= 3) {
    return { quality: "boilerplate", reasoning, boilerplateRegexHit: true };
  }
  if (isAck && text.length < 800) {
    reasoning.unshift("Doar confirmare înregistrare (text scurt)");
    return { quality: "acknowledgment", reasoning, boilerplateRegexHit: boilerplateHits > 0 };
  }

  // Ambiguous — needs AI
  return { quality: null, reasoning, boilerplateRegexHit: boilerplateHits > 0 };
}

/** Full score via Groq pentru cazuri ambigue. */
export async function aiScoreResponse(text: string): Promise<QualityScoreResult> {
  // Quick first
  const quick = quickScore(text);
  if (quick.quality) {
    return {
      quality: quick.quality,
      confidence: 90,
      reasoning: quick.reasoning,
      boilerplateRegexHit: quick.boilerplateRegexHit,
    };
  }

  // AI fallback pentru ambiguu
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        {
          role: "system",
          content:
            "Ești un analist civic. Clasifici răspunsul unei autorități române la o sesizare cetățenească. Răspunzi în JSON strict cu cheile: quality (substantive/boilerplate/redirect/refusal/acknowledgment), confidence (0-100), reasoning (array de bullet-uri scurte în română).",
        },
        {
          role: "user",
          content: `Răspuns autoritate:\n\n${text.slice(0, 3000)}\n\nClasifică conform definitiilor:\n- substantive: oferă răspuns concret + acțiuni specifice + termene\n- boilerplate: fraze standard fără răspuns la întrebare\n- redirect: ne trimite la altă instituție\n- refusal: refuz explicit (cu sau fără motiv)\n- acknowledgment: doar confirmare înregistrare`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<QualityScoreResult>;

    const validQualities: ResponseQuality[] = ["substantive", "boilerplate", "redirect", "refusal", "acknowledgment"];
    const quality = validQualities.includes(parsed.quality as ResponseQuality)
      ? (parsed.quality as ResponseQuality)
      : "boilerplate";

    return {
      quality,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 50,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 5) : quick.reasoning,
      boilerplateRegexHit: quick.boilerplateRegexHit,
    };
  } catch {
    // Fallback: boilerplate if AI fails (safe assumption)
    return {
      quality: quick.boilerplateRegexHit ? "boilerplate" : "substantive",
      confidence: 40,
      reasoning: quick.reasoning.length > 0 ? quick.reasoning : ["AI clasificare nu a putut rula"],
      boilerplateRegexHit: quick.boilerplateRegexHit,
    };
  }
}
