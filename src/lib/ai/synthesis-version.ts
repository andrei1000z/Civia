/**
 * Bump this whenever we change the synthesis prompt, the model, the
 * post-processor, or the rendering contract in a way that should
 * invalidate cached output. Old summaries with `ai_summary_version`
 * less than this constant are transparently regenerated on next read.
 *
 * Version log:
 *   1 — initial release (Llama 3.1 8B, lax prompt)
 *   2 — Llama 3.3 70B, strict Romanian grammar/style rules,
 *       polishSynthesis post-processor (capitalize, fix dangling
 *       bold, normalize section titles, tighten punctuation spacing).
 *   3 — stiri prompt switched to a structured brief with five
 *       sections („Pe scurt", „Cifre cheie", „Context", „Ce urmează",
 *       „De ce contează") + 250–380 word target. Petitii prompt
 *       unchanged (already structured). Old 2-line stiri summaries
 *       regenerate on next visit.
 *   4 — petitii prompt expanded to a five-section brief matching the
 *       stiri standard: „Pe scurt", „Ce cere petiția", „Cifre & date
 *       cheie", „Context", „De ce contează" + 250–380 word target.
 *       Old 3-section petitii summaries regenerate on next visit.
 *   5 — petitii AI generate() gained the same 70B → 8B fallback that
 *       stiri had. v4 silently shipped petition.summary as ai_summary
 *       whenever 70B was rate-limited, so a lot of v4 cache rows are
 *       actually the wrong shape (single paragraph, not 5 sections).
 *       Bumping invalidates them so the new fallback path regenerates
 *       proper structured briefs on next read.
 *   6 — Both stiri AND petitii synthesis chains now go Gemini-first
 *       (2.5 Flash → 2.5 Flash Lite → Groq 70B → Groq 8B). v5 cached
 *       a lot of rows with stire.excerpt as ai_summary because both
 *       Groq tiers were 429-ing daily; those rows render identical
 *       text in "Sinteză Civia" and "Text original" panels. Bumping
 *       invalidates them so the Gemini-backed regeneration produces
 *       proper structured 5-section briefs. Stiri prompt also tightened
 *       with explicit "value-add" rules + "if your output looks like
 *       the excerpt, you failed; reorganise" instruction.
 *   7 — v6 chain still cached excerpt-as-summary on a lot of rows
 *       because of a bug in the fallback loop: Gemini sometimes
 *       returns an empty content field (safety filter on political
 *       articles, thinking-only response with all max_tokens spent
 *       on internal reasoning, mid-output truncation), and the loop
 *       accepted the empty string as success instead of falling
 *       through to Groq. Fix: reject responses < 80 chars and try
 *       the next provider; non-rate-limit errors also cascade now
 *       instead of crashing. Bump invalidates v6 cache so the next
 *       page view of any v6 article regenerates properly.
 *   8 — v7 still cached excerpt-rephrased text as summary because
 *       most stiri rows have empty `content` (RSS only gives the
 *       excerpt) — the AI receives ~300 chars of input and returns
 *       a 320-char rephrasing of it. Two fixes:
 *         (a) STRUCTURE GATE in callAiWithFallback + generate():
 *             require ≥ 2 of the 5 expected section markers
 *             ("Pe scurt:", "Cifre cheie:", "Context:",
 *              "Ce urmează:", "De ce contează:") in the AI output;
 *             cascade if missing; refuse to persist if the last
 *             provider also failed.
 *         (b) Prompt updated with a HARD output rule: the response
 *             MUST contain ≥ 2 section headers literally; output
 *             is auto-rejected otherwise.
 *       Bump invalidates v7 rows so the new gate applies.
 *   9 — When AI fails to produce structured output (thin input from
 *       empty `content` field), return null instead of falling back
 *       to the excerpt. The page (StireDetailPage) already renders
 *       the synthesis section conditionally on `aiSummary` being
 *       truthy, so null hides the panel — way better UX than
 *       showing identical text in "Sinteză Civia" + "Text original"
 *       panels stacked on top of each other.
 *       Plus: isJustTheExcerpt() similarity guard catches v7/v8
 *       cache rows where the AI produced text that's structurally
 *       valid but content-wise ~90% the excerpt — also returns null.
 *       Bump invalidates v8 cache.
 *  10 — Real fix: lib/stiri/extract-body.ts scrapes the original
 *       article URL when stiri_cache.content is empty/thin, returning
 *       up to 6000 chars of body text via deterministic regex (no
 *       new deps). Wired into:
 *         - getOrGenerateAiSummary (lazy-scrapes on first synthesis,
 *           persists to content column for next time)
 *         - /api/admin/stiri/regenerate-summaries (backfills on bulk
 *           regen so admins don't wait for organic traffic)
 *       With real article body, AI now has 2-5 KB of input and can
 *       produce the full 5-section structured brief that v6-v9 were
 *       failing to elicit. Bump invalidates v9 cache rows so they
 *       re-synthesize against the (now-richer) content.
 *  11 — Defense-in-depth contra cifrelor INVENTATE în „Cifre cheie" /
 *       „Cifre & date cheie". Bug real (articol Gândul despre Ciucu,
 *       2026-06-11): modelul, forțat de structura cu secțiuni, a umplut
 *       „Cifre cheie" cu numere fabricate („0: numărul de funcții pe
 *       care dorește să le părăsească", „1: ani de muncă", „2024" —
 *       în 2026), deși promptul interzice explicit inventarea.
 *       Fix: stripInventedCifre (lib/stiri/validate-cifre.ts) — fiecare
 *       bullet cu cifre din secțiune trebuie să aibă TOATE numerele
 *       prezente în textul-sursă; bullet inventat → tăiat; secțiune
 *       golită → scoasă complet (e opțională prin prompt). Aplicat pe
 *       AMBELE pipeline-uri (stiri + petitii). Bump invalidează cache-ul
 *       v10 ca sumarele vechi cu cifre fabricate să se regenereze curat.
 *  12 — Anti-filler în stripInventedCifre: bullet-urile ale căror numere
 *       sunt toate 0/1 FĂRĂ cuvânt de magnitudine/unitate (milioane, lei,
 *       km, ani…) sunt tăiate — „1 mesaj publicat pe Facebook" nu e cifră
 *       cheie chiar dacă „1" apare în articol. „1 milion de lei" rămâne.
 *       Bump regenerează cache-ul v11 (puține rânduri, abia lansat).
 *  13 — Anti-halucinare de FUNCȚIE/TITLU: modelele scriau funcția unei
 *       persoane din memoria lor învechită, IGNORÂND sursa (bug real
 *       14.06.2026 — articolul „Ciprian Ciucu atac la Nicușor Dan": sursa
 *       zicea corect „primarul Capitalei", AI-ul a scris „primarul
 *       sectorului 3"). Promptul cere acum funcția LITERAL din sursă +
 *       interzice deducerea ei din memorie. Bump regenerează tot cu regula nouă.
 */
export const AI_SUMMARY_VERSION = 13;
