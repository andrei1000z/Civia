import * as Sentry from "@sentry/nextjs";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { callGemini, isGeminiConfigured, GEMINI_MODEL, GEMINI_MODEL_FAST, GEMINI_MODEL_BACKUPS } from "@/lib/ai/gemini";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { polishSynthesis } from "@/lib/ai/polish-synthesis";
import { AI_SUMMARY_VERSION } from "@/lib/ai/synthesis-version";

export interface SummarizablePetitie {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  category: string | null;
  ai_summary: string | null;
  /** Version stamp written alongside `ai_summary`. When < AI_SUMMARY_VERSION
   *  we regenerate transparently so quality fixes propagate. */
  ai_summary_version?: number | null;
}

const SYSTEM_PROMPT = `Ești un analist civic senior care sintetizează petiții pentru Civia, o platformă civică românească cu standarde editoriale înalte.

CORECTITUDINE GRAMATICALĂ — OBLIGATORIE:
- Limba română corectă, cu diacritice complete (ă, â, î, ș, ț) — fără excepții.
- Acord perfect: subiect–predicat (numerice incluse: „două instituții sunt", nu „este"), articol hotărât/nehotărât, gen + număr la adjective.
- Folosește articulat corect: „primarul Bucureștiului", „ministrul Sănătății".
- Cifrele cu separatorul corect românesc (80.000 nu 80,000).
- Numele proprii și instituțiile cu majusculă: „Primăria Capitalei", „Curtea Constituțională".

STRUCTURĂ — RESPECTĂ EXACT (fiecare titlu pe linie separată terminat cu „:")

1. „Pe scurt:" — 2–3 propoziții cu esența cererii și beneficiarul. NU repeta titlul cuvânt cu cuvânt.

2. „Ce cere petiția:" — listă de 3–6 bullet-uri cu „- ", una cerere per bullet, fiecare începând cu majusculă. Fiecare bullet e auto-suficient și conține un verb la imperativ („Adoptarea…", „Modificarea…", „Stoparea…").

3. „Cifre & date cheie:" — listă de 2–5 bullet-uri cu „- " conținând cifre concrete, termene, articole de lege, instituții implicate, geografie (toate pe **bold**). Omite secțiunea complet dacă petiția nu menționează cifre concrete; nu inventa.

4. „Context:" — 2–3 propoziții cu fundalul (ce s-a întâmplat înainte, ce lege e implicată, cine sunt actorii). Cititorul trebuie să înțeleagă subiectul fără să fi urmărit știri pe tema respectivă.

5. „De ce contează:" — 2–3 propoziții despre impactul concret pentru cetățeni (cine e afectat, cum, când). Obligatorie.

FORMATARE:
- Prima literă din fiecare paragraf, bullet și secțiune E ÎNTOTDEAUNA majusculă.
- **Bold** pe cifre, termene, articole de lege („Legea 544/2001"), public-țintă, instituții.
- Tonul: factual, civic, fără sloganuri sau retorică.

INTERZIS:
- NU inventa fapte, cifre sau termene care nu sunt în textul sursă.
- Dacă o secțiune nu poate fi compusă din text (în special „Cifre & date cheie"), omite-o complet.
- NU folosi emoji-uri sau adjective evaluative.

LUNGIME: 250–380 cuvinte total — un brief structurat, nu un rezumat scurt.`;

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Returns the cached AI synthesis if present AND at the current version,
 * otherwise generates one, persists it, and returns it.
 */
export async function getOrGeneratePetitieAiSummary(
  petitie: SummarizablePetitie,
): Promise<string | null> {
  const cacheValid =
    petitie.ai_summary &&
    petitie.ai_summary.length > 20 &&
    (petitie.ai_summary_version ?? 0) >= AI_SUMMARY_VERSION;

  if (cacheValid) {
    return petitie.ai_summary;
  }

  const existing = inFlight.get(petitie.id);
  if (existing) return existing;

  const rawText = [petitie.title, petitie.summary, petitie.body]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (rawText.length < 30) {
    return petitie.summary || petitie.title || null;
  }

  const promise = generate(petitie, rawText);
  inFlight.set(petitie.id, promise);
  try {
    return await promise;
  } finally {
    setTimeout(() => inFlight.delete(petitie.id), 0);
  }
}

/** True for Groq 429 (rate limit / token budget exhausted). Mirrors
 *  the same helper in lib/stiri/ai-summary.ts. */
function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  return typeof e.message === "string" && /rate.?limit|429/i.test(e.message);
}

/**
 * Multi-provider AI fallback chain. Mirrors the stiri synthesis chain:
 *   1. Gemini 2.5 Flash       (separate quota from Groq)
 *   2. Gemini 2.5 Flash Lite  (separate per-model Gemini counter)
 *   3. Groq Llama 3.3 70B
 *   4. Groq Llama 3.1 8B-instant
 *
 * Gemini goes first because Groq's free 70B daily token budget runs
 * out fast, and when that happens both Groq tiers 429 in tandem,
 * which used to leave the petition page rendering the raw `summary`
 * field instead of a structured 5-section brief.
 */
async function callAiWithFallback(
  prompt: string,
  rawText: string,
  petitie: SummarizablePetitie,
): Promise<string | null> {
  const userMsg = `Sintetizează această petiție civică${petitie.category ? ` (categorie: ${petitie.category})` : ""}:\n\n${rawText.slice(0, 4000)}`;
  const messages = [
    { role: "system" as const, content: prompt },
    { role: "user" as const, content: userMsg },
  ];

  type Candidate = {
    provider: "gemini" | "groq";
    model: string;
    run: () => Promise<string>;
  };
  const groq = getGroqClient();
  const groqCall = (model: string, max_tokens: number) => async (): Promise<string> => {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      max_tokens,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  };
  const geminiCall = (model: string) => async (): Promise<string> => {
    // Gemini 2.5 Flash uses internal "thinking" tokens that count
    // against max_tokens. 4500 leaves room for both the thinking
    // and the structured 250-380 word output.
    const out = await callGemini({
      messages,
      model,
      temperature: 0.2,
      max_tokens: 4500,
    });
    return (out ?? "").trim();
  };
  const candidates: Candidate[] = [
    ...(isGeminiConfigured()
      ? [
          { provider: "gemini" as const, model: GEMINI_MODEL, run: geminiCall(GEMINI_MODEL) },
          { provider: "gemini" as const, model: GEMINI_MODEL_FAST, run: geminiCall(GEMINI_MODEL_FAST) },
          ...GEMINI_MODEL_BACKUPS.map((m) => ({
            provider: "gemini" as const,
            model: m,
            run: geminiCall(m),
          })),
        ]
      : []),
    { provider: "groq" as const, model: GROQ_MODEL, run: groqCall(GROQ_MODEL, 1200) },
    { provider: "groq" as const, model: GROQ_MODEL_FAST, run: groqCall(GROQ_MODEL_FAST, 1200) },
  ];

  // Same MIN_LEN guard as stiri — empty/short responses cascade to
  // the next provider instead of being accepted as success.
  const MIN_LEN = 80;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]!;
    const isLast = i === candidates.length - 1;
    try {
      const raw = await cand.run();
      if (raw && raw.length >= MIN_LEN) return raw;
      if (!isLast) {
        const next = candidates[i + 1]!;
        Sentry.captureMessage("petitii AI returned empty/short response, falling back", {
          level: "info",
          tags: { kind: "petitii_ai_fallback_empty" },
          extra: {
            petitieId: petitie.id,
            fromProvider: cand.provider,
            fromModel: cand.model,
            toProvider: next.provider,
            toModel: next.model,
            rawLength: raw?.length ?? 0,
          },
        });
        continue;
      }
      return raw ?? null;
    } catch (err) {
      if (isRateLimited(err) && !isLast) {
        const next = candidates[i + 1]!;
        Sentry.captureMessage("petitii AI fell back to next provider (429)", {
          level: "info",
          tags: { kind: "petitii_ai_fallback" },
          extra: {
            petitieId: petitie.id,
            fromProvider: cand.provider,
            fromModel: cand.model,
            toProvider: next.provider,
            toModel: next.model,
          },
        });
        continue;
      }
      // Non-rate-limit error — try next instead of crashing.
      if (!isLast) {
        const next = candidates[i + 1]!;
        Sentry.captureMessage("petitii AI threw, falling back to next provider", {
          level: "warning",
          tags: { kind: "petitii_ai_fallback_error" },
          extra: {
            petitieId: petitie.id,
            fromProvider: cand.provider,
            fromModel: cand.model,
            toProvider: next.provider,
            toModel: next.model,
            errorMessage: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
          },
        });
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function generate(
  petitie: SummarizablePetitie,
  rawText: string,
): Promise<string | null> {
  try {
    const raw = await callAiWithFallback(SYSTEM_PROMPT, rawText, petitie);
    if (!raw || raw.length <= 20) {
      Sentry.captureMessage("petitii AI summary too short or empty", {
        level: "warning",
        tags: { kind: "petitii_ai_short" },
        extra: { petitieId: petitie.id, rawLength: raw?.length ?? 0 },
      });
      return petitie.summary || petitie.body || petitie.title || null;
    }
    // 2026-06-06 (audit #16) — validează STRUCTURA: promptul cere secțiunile
    // „Pe scurt / Ce cere petiția / De ce contează". Dacă modelul (mai ales pe
    // fallback Gemini/Groq) a întors text neformatat (sub 2 secțiuni
    // recunoscute), NU-l persista ca sinteză — cădem pe textul existent.
    const nSections = (
      raw.match(/(Pe scurt|Ce cere petiția|Cifre (?:&|și) date|De ce contează)/gi) ?? []
    ).length;
    if (nSections < 2) {
      Sentry.captureMessage("petitii AI summary lacks structure", {
        level: "warning",
        tags: { kind: "petitii_ai_unstructured" },
        extra: { petitieId: petitie.id, sections: nSections },
      });
      return petitie.summary || petitie.body || petitie.title || null;
    }
    const summary = polishSynthesis(raw);

    try {
      const admin = createSupabaseAdmin();
      const { error: dbErr } = await admin
        .from("petitii")
        .update({ ai_summary: summary, ai_summary_version: AI_SUMMARY_VERSION })
        .eq("id", petitie.id);
      if (dbErr) {
        Sentry.captureException(dbErr, {
          tags: { kind: "petitii_ai_persist" },
          extra: { petitieId: petitie.id },
        });
      }
    } catch (persistErr) {
      Sentry.captureException(persistErr, {
        tags: { kind: "petitii_ai_persist" },
        extra: { petitieId: petitie.id },
      });
    }

    return summary;
  } catch (err) {
    // Surface the real reason (Groq error, network timeout, etc.) so
    // we stop silently falling back to the petition's plain summary
    // without anyone noticing in production.
    Sentry.captureException(err, {
      tags: { kind: "petitii_ai_generate" },
      extra: {
        petitieId: petitie.id,
        rawTextLength: rawText.length,
      },
    });
    return petitie.summary || petitie.body || petitie.title || null;
  }
}
