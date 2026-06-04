import { groqText, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { restoreDiacritics } from "@/lib/sesizari/diacritice";
import * as Sentry from "@sentry/nextjs";

export interface PolishInput {
  titlu: string;
  descriere: string;
  locatie: string;
  tip?: string;
}

export interface PolishResult {
  titlu: string;
  descriere: string;
  locatie: string;
  /**
   * True when the AI call actually returned JSON we could parse.
   * False when we fell back to the raw input (Groq down, API key
   * missing, invalid JSON, etc). The admin diff modal uses this to
   * show a "AI n-a putut contacta modelul" warning instead of a
   * silent no-op.
   */
  aiSucceeded: boolean;
  /** Optional error tag for the admin — short, non-fatal. */
  error?: string;
}

const SYSTEM_PROMPT = `Ești un editor de conținut pentru o platformă civică românească. Primești titlul, descrierea și locația scrise de un cetățean, adesea în grabă (ALL CAPS, fără diacritice, scurt și imperativ). Trebuie să le normalizezi în format public publicabil.

REGULI:
1. TITLU — max 80 caractere, Sentence case (prima literă mare, restul minuscule cu excepția numelor proprii), diacritice corecte, formulare neutră/descriptivă. NU imperativ ("SĂ FACĂ X"), ci descriptiv ("Mașini parcate pe trotuar — necesar stâlpișori anti-parcare").
2. DESCRIERE — 1-3 propoziții concise, formale, diacritice, Sentence case. Reformulează imperativul în constatare. Elimină repetițiile.
3. LOCAȚIE — capitalizează corect numele proprii (Calea 13 Septembrie, Șoseaua Panduri, Strada Mihail Cioranu), păstrează detaliile importante, rescrie fluent și scurt (sub 200 caractere).

RĂSPUNDE DOAR CU JSON VALID în formatul:
{"titlu": "...", "descriere": "...", "locatie": "..."}

Nu adăuga text înainte/după. Nu folosi markdown. Păstrează toate informațiile factuale (nume străzi, numere, referințe la bănci/clădiri).`;

/**
 * Takes raw user-entered sesizare fields and returns a publish-ready
 * version: proper case, diacritics, descriptive title, concise description,
 * well-formatted location. Uses the fast Groq model — this isn't the formal
 * letter, just surface polish. If the AI call fails, returns the input
 * unchanged.
 */
export async function polishSesizare(input: PolishInput): Promise<PolishResult> {
  const fallback = (error: string): PolishResult => {
    // 2026-06-04 — Vizibilitate: până acum eșecul AI cădea TĂCUT pe textul brut
    // (descriere fără diacritice ajungea public — bug raportat de user). Acum
    // semnalăm fiecare fallback ca să detectăm probleme de cotă/cheie Groq în
    // producție. (polishSesizare nu aruncă — deci catch-ul din create route
    // nu prindea aceste eșecuri.)
    Sentry.captureMessage("polishSesizare fallback — text brut (AI indisponibil)", {
      level: "warning",
      tags: { kind: "polish_ai_fallback" },
      extra: { error, tip: input.tip },
    });
    // Chiar și pe fallback aplicăm diacriticele deterministe — textul brut
    // („masinile/siguranta") nu trebuie să ajungă public fără diacritice.
    return {
      titlu: restoreDiacritics(input.titlu),
      descriere: restoreDiacritics(input.descriere),
      locatie: restoreDiacritics(input.locatie),
      aiSucceeded: false,
      error,
    };
  };
  try {
    // 70B pentru diacritice/titlu de calitate, cascadă la 8B dacă 70B e
    // rate-limited (limită zilnică mică) — ca să nu cădem pe text brut.
    const content = await groqText(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              input.tip ? `Tip problemă: ${input.tip}` : "",
              `TITLU BRUT: ${input.titlu}`,
              `DESCRIERE BRUTĂ: ${input.descriere}`,
              `LOCAȚIE BRUTĂ: ${input.locatie}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
      },
      { fallbackModel: GROQ_MODEL_FAST },
    );
    if (!content) return fallback("AI a returnat răspuns gol");
    const parsed = JSON.parse(content) as Partial<PolishResult>;
    return {
      titlu: restoreDiacritics((parsed.titlu || input.titlu).trim().slice(0, 200)),
      descriere: restoreDiacritics((parsed.descriere || input.descriere).trim().slice(0, 2000)),
      locatie: restoreDiacritics((parsed.locatie || input.locatie).trim().slice(0, 300)),
      aiSucceeded: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fallback(msg.slice(0, 120));
  }
}
