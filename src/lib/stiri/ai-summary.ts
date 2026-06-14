import * as Sentry from "@sentry/nextjs";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { callGemini, isGeminiConfigured, GEMINI_MODEL, GEMINI_MODEL_FAST, GEMINI_MODEL_BACKUPS } from "@/lib/ai/gemini";
import { callCloudflareText, isCloudflareTextConfigured, CF_TEXT_MODELS } from "@/lib/ai/cloudflare-text";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { polishSynthesis } from "@/lib/ai/polish-synthesis";
import { stripInventedCifre } from "@/lib/stiri/validate-cifre";
import { AI_SUMMARY_VERSION } from "@/lib/ai/synthesis-version";
import { extractArticleBody } from "@/lib/stiri/extract-body";
import { extractiveSummary } from "@/lib/stiri/extractive-summary";

export interface SummarizableStire {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  source: string;
  ai_summary: string | null;
  /** Version stamp written alongside `ai_summary`. When < AI_SUMMARY_VERSION
   *  we regenerate transparently so quality fixes propagate. */
  ai_summary_version?: number | null;
  /** Original article URL. When `content` is empty/thin we lazy-scrape
   *  the body from this URL on first synthesis attempt and persist it
   *  so subsequent attempts hit a richer cache. */
  url?: string | null;
}

const SYSTEM_PROMPT = `Ești un jurnalist senior român care scrie pentru Civia, o platformă civică serioasă, de standarde editoriale înalte. Sinteza ta nu e un rezumat — e o reorganizare a faptelor cu valoare adăugată: structură scanabilă, context legal/instituțional, impact pentru cetățean.

VALOAREA ADĂUGATĂ E NEGOCIABILĂ. Cititorul a venit la Civia, nu la sursa originală, pentru că vrea CEVA ÎN PLUS:
- Structură clară, scanabilă în 30 secunde.
- Cifrele extrase și evidențiate (nu pierdute în text).
- Contextul instituțional / legal explicat scurt (cine ce poate, ce lege se aplică).
- Implicația pentru un cetățean obișnuit (cine e afectat, cum, când).

Dacă sinteza ta arată identic cu excerpt-ul original, ai eșuat. REORGANIZEAZĂ informația.

CORECTITUDINE GRAMATICALĂ — OBLIGATORIE:
- Limba română corectă, cu diacritice complete (ă, â, î, ș, ț) — fără excepții.
- Acord perfect: subiect–predicat (numerice incluse: „doi cetățeni au fost", nu „a fost"), articol hotărât/nehotărât, gen + număr la adjective.
- Folosește articulat corect: „primarul Bucureștiului" (nu „primarul București"), „ministrul Educației" etc.
- Numele proprii și instituțiile cu majusculă: „Primăria Capitalei", „Curtea Constituțională", „Ministerul Sănătății".
- Cifrele cu separatorul corect românesc (50.000 nu 50,000).
- Fără calcuri din engleză.

STRUCTURĂ — RESPECTĂ EXACT (fiecare titlu pe linie separată terminat cu „:")

1. „Pe scurt:" — 2–3 propoziții care surprind ESENȚIAL faptul, REFORMULAT. NU repeta titlul sau excerpt-ul cuvânt cu cuvânt; reformulează cu altă structură de propoziție.

2. „Cifre cheie:" — listă de 3–5 bullet-uri cu „- ", fiecare începe cu majusculă, fiecare conține o cifră / un nume / un termen legal pus pe **bold**. Omite secțiunea dacă articolul chiar nu are cifre concrete; nu inventa. Pentru articole fără cifre, sari direct la „Context".

3. „Context:" — 2–3 propoziții cu fundalul (ce s-a întâmplat înainte, ce lege se aplică, cine sunt actorii și ce rol au, ce instituție decide). Cititorul trebuie să înțeleagă povestea fără să fi urmărit subiectul. Dacă sursa nu dă context explicit, dedu DOAR generalități stabile din cunoștințele tale (cum funcționează o instituție UE, ce face NATO, ce prevede o lege românească) — dar NU atribui funcții, titluri sau roluri unei PERSOANE din memoria ta. Funcția unei persoane (primar, ministru, președinte de partid) o iei EXCLUSIV din textul-sursă, literal.

4. „Ce urmează:" — 1–2 propoziții cu pașii imediat următori (vot, decizie, deadline, sesiune parlamentară etc.). Omite dacă articolul nu menționează nimic concret; nu specula data.

5. „De ce contează:" — 1–2 propoziții despre impactul concret pentru cetățeni (cine e afectat, cum, când). OBLIGATORIE — chiar și pentru articole de politică externă, leagă de cetățean (taxe, drepturi, securitate, costuri, libertăți).

FORMATARE:
- Prima literă din fiecare paragraf, bullet și secțiune E ÎNTOTDEAUNA majusculă.
- **Bold** doar pe cifre, nume proprii, instituții, termene legale.
- Tonul: factual, civic, fără sloganuri.

INTERZIS:
- NU inventa cifre, nume sau date care nu sunt în textul original.
- FUNCȚIA / TITLUL unei persoane se preia LITERAL din sursă. NU schimba și NU inventa funcția din memoria ta (ex: dacă sursa scrie „primarul Capitalei / primarul general", NU scrie „primarul sectorului X"; dacă sursa scrie „ministrul", nu inventa ce minister). Funcțiile politice se schimbă des, iar memoria modelului e ÎNVECHITĂ — sursa are dreptate, nu memoria ta. Dacă sursa nu menționează funcția, scrie doar numele, fără funcție.
- Dacă o cifră lipsește din sursă, scrie „nepublicat" — nu plasa o estimare.
- NU repeta titlul sau excerpt-ul cuvânt cu cuvânt — reformulează.
- NU folosi emoji-uri sau adjective evaluative („incredibil", „șocant", „dramatic").
- NU produce o sinteză identică cu excerpt-ul original. E inutilă.

LUNGIME: 200–400 de cuvinte. Pentru articole foarte scurte (excerpt < 300 caractere), scoate cel puțin „Pe scurt" + „Context" + „De ce contează" — chiar și pe input puțin, structura adaugă valoare.

REGULĂ DE OUTPUT (HARD): răspunsul tău TREBUIE să conțină măcar 2 dintre titlurile de secțiune literal („Pe scurt:" / „Cifre cheie:" / „Context:" / „Ce urmează:" / „De ce contează:"), fiecare pe linie separată, terminate cu „:". Output-ul se respinge automat dacă lipsește această structură. NU genera text liber, fără secțiuni — chiar și pe excerpt scurt, structurează.`;

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Returns the cached AI summary if present AND at the current version,
 * otherwise generates a new one, persists it, and returns it.
 *
 * Concurrent calls for the same stire within one lambda are coalesced
 * into a single Groq request.
 */
/**
 * Normalize text for similarity comparison: lowercase, strip
 * punctuation, collapse whitespace. Used to detect when a summary
 * is "the excerpt with cosmetic differences" (extra punctuation,
 * truncation marker, capitalization, etc.).
 */
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true when `summary` is effectively the excerpt repeated
 * (or a 90%+ overlap of it). When the AI couldn't produce a real
 * synthesis (thin input, all providers rate-limited, etc.) it tends
 * to return the excerpt verbatim or rephrased, which produces a
 * useless "Sinteză Civia = Text Original" duplication on the page.
 */
function isJustTheExcerpt(summary: string, excerpt: string | null): boolean {
  if (!excerpt) return false;
  const a = normalizeForCompare(summary);
  const b = normalizeForCompare(excerpt);
  if (a.length === 0 || b.length === 0) return false;
  // Exact match or substring containment in either direction.
  if (a === b) return true;
  if (a.includes(b) && b.length / a.length > 0.85) return true;
  if (b.includes(a) && a.length / b.length > 0.85) return true;
  return false;
}

export async function getOrGenerateAiSummary(
  stire: SummarizableStire
): Promise<string | null> {
  const cacheValid =
    stire.ai_summary &&
    stire.ai_summary.length > 20 &&
    (stire.ai_summary_version ?? 0) >= AI_SUMMARY_VERSION;

  if (cacheValid) {
    // Even cached summaries get the excerpt-overlap check — if a
    // previous run persisted excerpt-as-summary, hide the section
    // rather than show the duplicate.
    if (isJustTheExcerpt(stire.ai_summary!, stire.excerpt)) return null;
    return stire.ai_summary;
  }

  const existing = inFlight.get(stire.id);
  if (existing) return existing;

  // Lazy backfill: when content is empty/thin (RSS only gave us the
  // excerpt), scrape the original article URL once and persist. The
  // AI synthesis can then produce a real 5-section brief instead of
  // rephrasing 300 chars of excerpt.
  let content = stire.content;
  if ((!content || content.length < 500) && stire.url) {
    try {
      const scraped = await extractArticleBody(stire.url);
      if (scraped && scraped.length >= 500) {
        content = scraped;
        // Persist async — don't block synthesis on the write. Errors
        // here are fine: worst case the next visit re-scrapes.
        try {
          const admin = createSupabaseAdmin();
          await admin.from("stiri_cache").update({ content }).eq("id", stire.id);
        } catch {
          /* ignore — non-critical */
        }
      }
    } catch {
      /* extractor handles its own failures; just continue with thin input */
    }
  }

  const rawText = [stire.title, stire.excerpt, content]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (rawText.length < 30) {
    return null;
  }

  const promise = generate({ ...stire, content }, rawText).then((result) => {
    // Final guard: never return text that's effectively the excerpt
    // as the synthesis. The page hides the panel on null.
    if (result && isJustTheExcerpt(result, stire.excerpt)) return null;
    if (result) return result;
    // 2026-06-08 — AI indisponibil (toți providerii rate-limited) → fallback
    // EXTRACTIV DETERMINIST (TextRank, instant, 0 cost, 0 rețea) în loc de
    // „se generează, revino". NU se persistă → se regenerează cu AI când quota revine.
    const ext = extractiveSummary(stire.title, content);
    if (ext && isJustTheExcerpt(ext, stire.excerpt)) return null;
    return ext;
  });
  inFlight.set(stire.id, promise);
  try {
    return await promise;
  } finally {
    setTimeout(() => inFlight.delete(stire.id), 0);
  }
}

/** True for Groq 429 (rate limit / token budget exhausted). */
function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  return typeof e.message === "string" && /rate.?limit|429/i.test(e.message);
}

async function callAiWithFallback(
  prompt: string,
  rawText: string,
  source: string,
): Promise<{ raw: string; modelUsed: string } | null> {
  const userMsg = `Sintetizează acest articol de la ${source}:\n\n${rawText.slice(0, 3000)}`;
  const messages = [
    { role: "system" as const, content: prompt },
    { role: "user" as const, content: userMsg },
  ];

  // Multi-provider chain. Order matches /api/ai/improve:
  //   1. Gemini 2.5 Flash       (separate quota from Groq)
  //   2. Gemini 2.5 Flash Lite  (separate per-model Gemini counter)
  //   3. Groq Llama 3.3 70B
  //   4. Groq Llama 3.1 8B-instant
  // Gemini goes first because Groq's free 70B daily token budget
  // exhausts fast — when that happens, the previous chain (Groq-only)
  // dropped straight to the article excerpt as "summary", which is
  // why users were seeing "Sinteză Civia" identical to the excerpt
  // below it. Gemini 2.5 Flash has 1500 RPD on free tier, plenty for
  // a synthesis use-case. The polishSynthesis post-processor smooths
  // over any grammar gap between providers.
  type Candidate = {
    provider: "gemini" | "groq" | "cloudflare";
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
    // against max_tokens. 4000 leaves comfortable room for both
    // thinking + the structured 250-380 word output.
    const out = await callGemini({
      messages,
      model,
      temperature: 0.2,
      max_tokens: 4000,
    });
    return (out ?? "").trim();
  };
  // 2026-05-27 — Cap fallback chain (audit recommendation). Înainte aveam
  // 2 Gemini + 5 Gemini backups + 2 Groq = 9 candidați. Cele 5 backups
  // (latest aliases) au quota separată dar majoritar ratează la fel când
  // Google rate-limit-eaza projectul. Reducem la 2 Gemini → 2 Groq = 4
  // candidați total. Save quota + latency on degraded conditions.
  const cfCall = (model: string) => async (): Promise<string> => {
    const out = await callCloudflareText({ messages, model, temperature: 0.2, max_tokens: 1100 });
    return (out ?? "").trim();
  };
  const candidates: Candidate[] = [
    ...(isGeminiConfigured()
      ? [
          { provider: "gemini" as const, model: GEMINI_MODEL, run: geminiCall(GEMINI_MODEL) },
          { provider: "gemini" as const, model: GEMINI_MODEL_FAST, run: geminiCall(GEMINI_MODEL_FAST) },
        ]
      : []),
    { provider: "groq" as const, model: GROQ_MODEL, run: groqCall(GROQ_MODEL, 900) },
    { provider: "groq" as const, model: GROQ_MODEL_FAST, run: groqCall(GROQ_MODEL_FAST, 900) },
    // 2026-06-10 — Cloudflare Workers AI ca ULTIM nivel (cotă separată 10k/zi).
    // Înainte cascada știrilor avea DOAR Gemini+Groq → când ambele erau epuizate,
    // 36% din știri rămâneau blocate pe „se generează". Acum Cloudflare prinde mingea.
    ...(isCloudflareTextConfigured()
      ? [{ provider: "cloudflare" as const, model: CF_TEXT_MODELS[0], run: cfCall(CF_TEXT_MODELS[0]) }]
      : []),
  ];
  void GEMINI_MODEL_BACKUPS; // Keep import; cap reduce explicit pentru cost

  // Minimum chars we'll accept as a "real" synthesis. Below this it's
  // either an empty response (Gemini safety-filtered, thinking-only,
  // or truncated mid-output), so we treat it as a failure and try
  // the next provider instead of returning it as success.
  const MIN_LEN = 80;

  // Structure check: a real synthesis MUST contain at least 2 of the
  // 5 expected section headers. Otherwise the model just rephrased
  // the excerpt and stopped — no value over showing the excerpt
  // directly. Treat as failure → next provider.
  const SECTION_MARKERS = ["Pe scurt:", "Cifre cheie:", "Context:", "Ce urmează:", "De ce contează:"];
  function isStructured(raw: string): boolean {
    const found = SECTION_MARKERS.filter((m) => raw.includes(m)).length;
    return found >= 2;
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]!;
    const isLast = i === candidates.length - 1;
    try {
      const raw = await cand.run();
      // Accept ONLY responses that are both substantial AND
      // structurally valid (have the section markers). Anything
      // else cascades to the next provider.
      if (raw && raw.length >= MIN_LEN && isStructured(raw)) {
        return { raw, modelUsed: `${cand.provider}:${cand.model}` };
      }
      // Failed: empty / too short / unstructured (just rephrased the
      // excerpt without producing the 5-section brief). Log + try
      // next provider.
      if (!isLast) {
        const next = candidates[i + 1]!;
        const reason = !raw || raw.length < MIN_LEN ? "empty_or_short" : "no_structure";
        Sentry.captureMessage(`stiri AI ${reason}, falling back`, {
          level: "info",
          tags: { kind: "stiri_ai_fallback_quality" },
          extra: {
            source,
            reason,
            fromProvider: cand.provider,
            fromModel: cand.model,
            toProvider: next.provider,
            toModel: next.model,
            rawLength: raw?.length ?? 0,
          },
        });
        continue;
      }
      // Last candidate also failed quality. Return what we have so
      // generate() can decide — it will fall back to excerpt
      // without persisting (no MIN_LEN summary in DB).
      return { raw: raw ?? "", modelUsed: `${cand.provider}:${cand.model}` };
    } catch (err) {
      if (isRateLimited(err) && !isLast) {
        const next = candidates[i + 1]!;
        Sentry.captureMessage("stiri AI fell back to next provider (429)", {
          level: "info",
          tags: { kind: "stiri_ai_fallback" },
          extra: {
            source,
            fromProvider: cand.provider,
            fromModel: cand.model,
            toProvider: next.provider,
            toModel: next.model,
          },
        });
        continue;
      }
      // Non-rate-limit error — also try the next provider rather than
      // crashing. Network blips, timeouts, malformed responses all
      // get a second chance.
      if (!isLast) {
        const next = candidates[i + 1]!;
        Sentry.captureMessage("stiri AI threw, falling back to next provider", {
          level: "warning",
          tags: { kind: "stiri_ai_fallback_error" },
          extra: {
            source,
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
  stire: SummarizableStire,
  rawText: string
): Promise<string | null> {
  try {
    const result = await callAiWithFallback(SYSTEM_PROMPT, rawText, stire.source);
    if (!result) {
      // No provider produced anything — return null so the page
      // hides the "Sinteză Civia" panel rather than showing the
      // excerpt as the synthesis (the page already shows the
      // excerpt in the "Text original" panel below).
      return null;
    }
    const { raw } = result;
    // Same structure gate as the fallback chain: only persist
    // responses that look like a real synthesis. Return null when
    // we can't produce structure — the page hides the "Sinteză
    // Civia" section on null instead of showing the excerpt as
    // the "summary" (which produces ugly duplication of the
    // panel below it).
    const SECTION_MARKERS_GUARD = ["Pe scurt:", "Cifre cheie:", "Context:", "Ce urmează:", "De ce contează:"];
    const structureScore = SECTION_MARKERS_GUARD.filter((m) => raw.includes(m)).length;
    if (raw.length <= 20 || structureScore < 2) {
      Sentry.captureMessage("stiri AI summary failed quality gate", {
        level: "warning",
        tags: { kind: "stiri_ai_quality_fail" },
        extra: {
          stireId: stire.id,
          source: stire.source,
          rawLength: raw.length,
          structureScore,
        },
      });
      return null;
    }
    // 2026-06-11 (v11) — defense-in-depth: taie cifrele INVENTATE din „Cifre
    // cheie" (numere care nu apar în textul-sursă). Promptul interzice
    // inventarea, dar modelele free-tier o fac oricum (bug real: 0/1/2024
    // fabricate pe articolul Ciucu). Vezi validate-cifre.ts.
    const summary = stripInventedCifre(polishSynthesis(raw), rawText);

    // Persist with await — stamps the version so the cache check above
    // recognises this row as current. Subsequent reads from any
    // instance see it.
    try {
      const admin = createSupabaseAdmin();
      const { error: dbErr } = await admin
        .from("stiri_cache")
        .update({ ai_summary: summary, ai_summary_version: AI_SUMMARY_VERSION })
        .eq("id", stire.id);
      if (dbErr) {
        Sentry.captureException(dbErr, {
          tags: { kind: "stiri_ai_persist" },
          extra: { stireId: stire.id, source: stire.source },
        });
      }
    } catch (persistErr) {
      Sentry.captureException(persistErr, {
        tags: { kind: "stiri_ai_persist" },
        extra: { stireId: stire.id, source: stire.source },
      });
    }

    return summary;
  } catch (err) {
    // Surface the real reason (Groq rate limit, network timeout, model
    // rejection, etc.) so we stop silently falling back to the article
    // excerpt without anyone noticing in production.
    Sentry.captureException(err, {
      tags: { kind: "stiri_ai_generate" },
      extra: {
        stireId: stire.id,
        source: stire.source,
        model: GROQ_MODEL,
        rawTextLength: rawText.length,
      },
    });
    // All providers errored — hide the panel (return null) instead
    // of showing the excerpt as a fake synthesis.
    return null;
  }
}
