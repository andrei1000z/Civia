import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_FAST, GROQ_MODEL_VISION } from "@/lib/groq/client";
import { SYSTEM_PROMPT_FORMAL } from "@/lib/groq/prompts";
import { getTemplate } from "@/lib/groq/templates";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { isProd } from "@/lib/env";
import { callGemini, isGeminiConfigured, GEMINI_MODEL, GEMINI_MODEL_FAST } from "@/lib/ai/gemini";
import { appendGdprClause, repairSesizareLeaks } from "@/lib/sesizari/format-helpers";
import { objectifyFormalText } from "@/lib/sesizari/objectify";
import { reformatFormalText } from "@/lib/sesizari/format-paragraphs";
import { removeMinimization } from "@/lib/sesizari/anti-minimization";

/** True for upstream 429 (rate limit / token budget exhausted). Works
 *  on both Groq SDK errors and Gemini fetch errors (we synthesise the
 *  same `status` shape in callGemini for parity). */
function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  return typeof e.message === "string" && /rate.?limit|429/i.test(e.message);
}

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const schema = z.object({
  descriere: z.string().min(5).max(2000),
  tip: z.string().optional(),
  locatie: z.string().optional(),
  nume: z.string().optional(),
  adresa: z.string().optional(),
  // Photo URLs from Supabase storage. When present, we route to the vision
  // model so the AI can refine the description based on what's actually in
  // the frame (e.g., "sidewalk is wide, pedestrians have room" — not
  // hallucinated "forced onto the road").
  imagini: z.array(z.string().url()).max(5).optional(),
});

interface AIResponse {
  formal_text: string;
  descriere_rafinata?: string;
}

// Max 5 photos to keep payload + latency sane. Groq vision accepts up to
// ~20MB of image data per request.
const MAX_PHOTOS = 5;

// Keywords that mark paragraph starts in our formal template
const PARAGRAPH_STARTS = [
  /^Bună ziua/i,
  /^Subsemnatul/i,
  /^Mă numesc/i,
  /^Vă aduc la cunoștință/i,
  /^Vă propun/i,
  /^Vă mulțumesc/i,
  /^Cu (respect|stimă)/i,
  /^Pentru a rezolva/i,
  /^Având în vedere/i,
  /^De asemenea/i,
  /^În temeiul/i,
  /^În sprijinul/i,
  /^În acest sens/i,
  /^În scopul/i,
  /^În ultima perioadă/i,
  /^Recent am/i,
  /^Astăzi am/i,
  /^De câteva (zile|săptămâni)/i,
  /^De multă vreme/i,
  /^De luni de zile/i,
  // Numbered list items — fiecare pe propria linie.
  /^\d{1,2}\.\s+[A-ZĂÂÎȘȚ]/,
];

function stripMarkdown(text: string): string {
  // Sesizările pleacă ca text simplu — markdown apare literal în mail
  // și arată neprofesional. Llama strecoară uneori **bold:** sau __italic__
  // în pofida promptului; aici curățăm last-mile.
  let t = text;
  // **bold** și __bold__ → bold
  t = t.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  t = t.replace(/__([^_\n]+?)__/g, "$1");
  // *italic* și _italic_ (doar când e clar emphasis, nu math/cod)
  t = t.replace(/(^|\s)\*([^*\n]+?)\*(?=\s|[.,;:!?)]|$)/g, "$1$2");
  t = t.replace(/(^|\s)_([^_\n]+?)_(?=\s|[.,;:!?)]|$)/g, "$1$2");
  // ## titluri la început de linie
  t = t.replace(/^#{1,6}\s+/gm, "");
  // `cod inline`
  t = t.replace(/`([^`\n]+?)`/g, "$1");
  return t;
}

function normalizeFormatting(text: string): string {
  // 1. Strip markdown leaks (** __ ## etc).
  // 2. Aplica regulile de paragraf-break via lib reusable (folosit si in
  //    POST /api/sesizari ca defense-in-depth si in backfill scripts).
  // 3. Re-aliniaza paragraph starts (Bună ziua, Pentru, Cu stimă, etc).
  const t = reformatFormalText(stripMarkdown(text));

  const lines = t.split("\n").map((l) => l.trim());

  // Rebuild: insert blank line before paragraph-start keywords if missing
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const isParaStart = PARAGRAPH_STARTS.some((rx) => rx.test(line));
    if (isParaStart && out.length > 0 && out[out.length - 1] !== "") {
      out.push("");
    }
    out.push(line);
  }

  // Signature: "Cu respect," \n {Name} — no blank line between them
  for (let i = out.length - 2; i > 0; i--) {
    const cur = out[i];
    if (cur && /^Cu (respect|stimă),?$/i.test(cur) && out[i + 1] === "" && out[i + 2]) {
      out.splice(i + 1, 1);
      break;
    }
  }

  return out.join("\n").trim();
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-improve:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Prea multe cereri. Reîncearcă în ${Math.ceil(rl.resetIn / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const { descriere, tip, locatie, nume, adresa, imagini } = schema.parse(body);
    const template = getTemplate(tip ?? "altele");
    const photos = (imagini ?? []).slice(0, MAX_PHOTOS);
    const hasPhotos = photos.length > 0;

    // Today's date as a literal Romanian string — passed to the model
    // so it doesn't try to "compute" a date itself. Previously the
    // prompt just said "DATA_DE_AZI — scrie data reală de azi", and
    // Llama occasionally emitted `+ (new Date()).toLocaleDateString(
    // "ro-RO")` — a JavaScript expression inside the JSON string —
    // which broke response_format:json_object and returned a 400
    // `json_validate_failed` error. Giving it the literal date
    // eliminates the hallucination path entirely.
    const LUNI_RO = [
      "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
      "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
    ];
    const now = new Date();
    const todayRo = `${now.getDate()} ${LUNI_RO[now.getMonth()]} ${now.getFullYear()}`;

    const textContext = [
      `Descrierea brută a cetățeanului: ${descriere}`,
      locatie ? `Locație: ${locatie}` : "",
      nume ? `Nume cetățean: ${nume}` : "Nume: [NUMELE]",
      adresa ? `Adresa cetățean: ${adresa}` : "Adresa: [ADRESA]",
      tip ? `Tip problemă: ${tip}` : "",
      `DATA DE AZI (pune-o literal în semnătură, NU folosi JavaScript / new Date / expresii — doar string exact): ${todayRo}`,
      `Ghid pentru {DESCRIEREA_FORMALA_A_PROBLEMEI}: ${template.problema_ghid}`,
      `Ghid pentru {PROPUNEREA_CONCRETA}: ${template.propunere}`,
    ].filter(Boolean).join("\n");

    const visionInstruction = hasPhotos
      ? `\n\n⚠️ ATENȚIE — ${photos.length} FOTOGRAFII ATAȘATE mai jos. Le ANALIZEZI PRIMELE, apoi scrii sesizarea.

REGULI VISION (OBLIGATORII):
1. INTERZIS să scrii "pietonii sunt forțați să circule pe carosabil" decât dacă se VEDE clar că trotuarul e complet blocat și nu mai au pe unde merge.
2. Dacă se vede trotuar lat cu mașini doar pe o parte → scrie EXACT: "mașinile ocupă X% din lățimea trotuarului, rămâne spațiu de trecere de aproximativ Y metri."
3. Dacă se vede trotuar îngust/blocat → atunci poți menționa blocarea pietonilor.
4. Numără mașinile parcate în poze și menționează numărul concret.
5. Descrie doar fapte observabile: tip de stradă, lățime, număr mașini, starea pavajului, prezența/absența stâlpișorilor existenți, lăți­mea spațiului liber.
6. NU inventa copii, persoane cu dizabilități, biciclete, animale care nu se văd în poze.
7. Dacă descrierea cetățeanului spune "blocat complet" dar pozele arată că pietonii au loc, CORECTEAZĂ în sesizare pe baza pozelor.

Răspunde JSON:
{ "formal_text": "...", "descriere_rafinata": "propoziție scurtă (1-2 rânduri) care descrie fidelis ce vezi în poze, fără dramatizare" }`
      : "";

    const groq = getGroqClient();
    const userContent = hasPhotos
      ? [
          { type: "text" as const, text: textContext + visionInstruction },
          ...photos.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ]
      : textContext;

    // Multi-provider fallback chain. Order: Gemini 2.0 Flash (1500
    // req/day free, separate quota, doesn't share Groq's daily token
    // budget) → Groq 70B (richer Romanian prose when it has budget)
    // → Groq 8B-instant (degraded but always-on rescue). Gemini goes
    // first because in practice Groq's free 70B daily quota burns
    // fast and the user was hitting the 429 path more often than the
    // happy path. Vision requests stay on Groq Vision — Gemini can
    // do vision too but we keep the photo path single-provider for
    // now to avoid re-tuning SYSTEM_PROMPT_FORMAL's photo rules.
    //
    // Each candidate is a thunk so we can mix Groq SDK and Gemini
    // fetch calls in the same loop. isRateLimited() recognises 429
    // from both providers (callGemini synthesises the same `status`
    // shape the Groq SDK throws).
    type Candidate = {
      provider: "groq" | "gemini";
      model: string;
      run: () => Promise<string | null>;
    };
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT_FORMAL },
      // Groq SDK accepts string or array content depending on model.
      { role: "user" as const, content: userContent as unknown as string },
    ];
    const groqCall = (model: string) => async (): Promise<string | null> => {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1100,
        response_format: { type: "json_object" },
      });
      return completion.choices[0]?.message?.content ?? null;
    };
    // Gemini 2.5 Flash uses internal "thinking" tokens that count
    // against max_tokens. With 1100 the model spends ~800 thinking
    // and truncates the JSON output, causing parse failures down-
    // stream. 4000 leaves comfortable room for both. Free tier per-
    // minute token budget is 1M so this is well within limits.
    const geminiCall = (model: string) => () =>
      callGemini({
        messages: messages.map((m) => ({ role: m.role, content: m.content as string })),
        model,
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" as const },
      });
    const candidates: Candidate[] = hasPhotos
      ? [{ provider: "groq", model: GROQ_MODEL_VISION, run: groqCall(GROQ_MODEL_VISION) }]
      : [
          ...(isGeminiConfigured()
            ? [
                { provider: "gemini" as const, model: GEMINI_MODEL, run: geminiCall(GEMINI_MODEL) },
                { provider: "gemini" as const, model: GEMINI_MODEL_FAST, run: geminiCall(GEMINI_MODEL_FAST) },
              ]
            : []),
          { provider: "groq", model: GROQ_MODEL, run: groqCall(GROQ_MODEL) },
          { provider: "groq", model: GROQ_MODEL_FAST, run: groqCall(GROQ_MODEL_FAST) },
        ];

    let content: string | null = null;
    let lastError: unknown = null;
    let usedProvider = "unknown";
    let usedModel = "unknown";
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i]!;
      const isLast = i === candidates.length - 1;
      try {
        content = await cand.run();
        if (content) {
          usedProvider = cand.provider;
          usedModel = cand.model;
          break;
        }
      } catch (err) {
        lastError = err;
        if (isRateLimited(err) && !isLast) {
          const next = candidates[i + 1]!;
          Sentry.captureMessage("ai-improve fell back to next provider (429)", {
            level: "info",
            tags: { kind: "ai_improve_fallback" },
            extra: {
              fromProvider: cand.provider,
              fromModel: cand.model,
              toProvider: next.provider,
              toModel: next.model,
            },
          });
          continue;
        }
        throw err;
      }
    }
    if (!content) throw lastError ?? new Error("Empty response from text generator");

    // Resilient JSON extraction: strip markdown code fences if the
    // model wraps its output in ```json ... ```, then try to extract
    // the first {...} block if surrounding prose leaks through.
    function extractJson(raw: string): string {
      const trimmed = raw.trim();
      // ```json\n{...}\n``` or ```\n{...}\n```
      const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
      // First {...} block (handles leading/trailing prose)
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
      }
      return trimmed;
    }
    let parsed: AIResponse;
    try {
      parsed = JSON.parse(extractJson(content)) as AIResponse;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    if (!parsed.formal_text) {
      throw new Error("AI response missing formal_text");
    }

    // Last-mile scrub: if Llama slipped a JavaScript expression
    // through despite the prompt (e.g. `+ (new Date()).toLocale...`),
    // replace it with the literal Romanian date. Better a clean
    // literal than raw JS code in the email signature.
    parsed.formal_text = parsed.formal_text
      .replace(/\+\s*\(?\s*new\s+Date\s*\([^)]*\)[^,\n"]*\)?/gi, todayRo)
      .replace(/\$\{[^}]*new\s+Date[^}]*\}/gi, todayRo);

    // Audit DB pe sesizări reale (5/4/2026) a arătat că prompt-ul singur
    // nu e suficient: 29% conțineau „Subsemnatul" / „domiciliat în",
    // 18% începeau cu „Vă sesizez cu privire la", 6% aveau placeholder
    // [ADRESA] copiat literal. Reparăm post-AI determinist înainte de
    // normalizeFormatting (care pe urmă curăță whitespace-urile lăsate).
    parsed.formal_text = repairSesizareLeaks(parsed.formal_text);

    // Objectify claims subjective („în dreptul domiciliu meu", „în fața
    // blocului meu", etc). Inlocuieste cu locatia obiectiva ca textul sa
    // poata fi reutilizat de co-semnatari fara minciuni. EXCEPTIE: cand
    // locatia problemei = domiciliul cetateanului (match LITERAL pe nr).
    const { text: objectified, replacements } = objectifyFormalText(parsed.formal_text, {
      locatie: locatie ?? null,
      adresaCetatean: adresa ?? null,
    });
    if (replacements > 0) {
      parsed.formal_text = objectified;
      // Debug header pentru a vedea cate sanitizari aplicam in prod
      // (Sentry breadcrumb mai bun, dar header e zero-config).
    }

    // Anti-minimizare: scoate fraze care submineaza sesizarea („pietonilor
    // li se asigura inca suficient spatiu" etc). Bug raportat 5/19/2026
    // pe sesizarea 00041 — AI-ul a scris exact opusul intentiei userului.
    const antiMin = removeMinimization(parsed.formal_text);
    if (antiMin.changed) {
      parsed.formal_text = antiMin.text;
      Sentry.captureMessage("AI minimization detected and patched", {
        level: "warning",
        tags: { kind: "ai_minimization_caught", count: String(antiMin.replacements) },
        extra: { matched: antiMin.matched },
      });
    }

    parsed.formal_text = normalizeFormatting(parsed.formal_text);

    // Apendix GDPR — adăugat determinist DUPĂ AI generation. Nu lăsăm
    // AI-ul să-l producă (poate să-l rescrie/scape) — îl injectăm exact
    // pe formularea cerută de cetățean ca paragraf înainte de „Cu stimă".
    // Idempotent: dacă deja apare în text, nu se duplică.
    parsed.formal_text = appendGdprClause(parsed.formal_text);

    // Debug headers — open DevTools → Network → /api/ai/improve →
    // Headers to see which provider actually generated the text.
    // Useful when debugging "did Gemini fire?" without leaking keys.
    return NextResponse.json(
      { data: parsed },
      {
        headers: {
          "X-AI-Provider": usedProvider,
          "X-AI-Model": usedModel,
        },
      },
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Input invalid" }, { status: 400 });
    }
    // Translate upstream Groq errors to a clean Romanian message
    // instead of dumping the raw JSON blob onto the form. Devs can
    // still read the full error in server logs via the caught
    // exception. User-visible copy avoids "AI" name-dropping AND
    // tells the user they can submit anyway — the submit-time
    // polishSesizare() has a fallback to raw text, so the sesizare
    // goes through with the user's description even when this route
    // is fully throttled.
    const raw = e instanceof Error ? e.message : "";
    if (!isProd()) console.error("[ai-improve]", raw);
    if (/json_validate_failed|invalid JSON/i.test(raw)) {
      return NextResponse.json(
        { error: "Refacerea textului a returnat un răspuns invalid. Încearcă din nou — de obicei reușește a doua oară. Sau trimite sesizarea direct cu textul tău." },
        { status: 502 }
      );
    }
    if (/rate[- ]?limit|429/i.test(raw)) {
      return NextResponse.json(
        { error: "Limita zilnică de refacere automată a textului a fost atinsă. Trimite sesizarea direct cu descrierea ta — va merge la primărie cu textul tău, fără probleme." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Refacerea automată a textului e temporar indisponibilă. Trimite sesizarea cu descrierea ta — va ajunge la primărie cu textul tău." },
      { status: 503 }
    );
  }
}
