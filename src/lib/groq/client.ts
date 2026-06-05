import Groq from "groq-sdk";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  GEMINI_MODEL_FAST,
  GEMINI_MODEL_BACKUPS,
} from "@/lib/ai/gemini";

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY env variable");
  }
  client = new Groq({ apiKey });
  return client;
}

export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
export const GROQ_MODEL_FAST = process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant";
// Vision-capable model for photo analysis in sesizări. Llama 4 Scout is
// Groq's flagship vision model as of 2025-2026.
export const GROQ_MODEL_VISION =
  process.env.GROQ_MODEL_VISION || "meta-llama/llama-4-scout-17b-16e-instruct";

interface GroqTextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface GroqTextParams {
  model: string;
  messages: GroqTextMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

/**
 * 2026-06-04 — Apel Groq robust: CASCADĂ de modele + retry cu backoff.
 *
 * Motiv: modelul TEXT 70B (llama-3.3-70b-versatile) dă calitate mai bună
 * (diacritice corecte) DAR are limită zilnică mică pe Groq free tier
 * (~1000 req/zi vs ~14.400 pentru 8B). Când 70B e rate-limited (429) sau pică
 * tranzitoriu, NU vrem să cădem direct pe text BRUT — încercăm 8B (calitate
 * decentă, limită mare), apoi abia la final aruncăm (caller-ul face fallback
 * determinist). Asta a cauzat 00061: 70B limitat → fallback raw.
 *
 * `fallbackModel` se încearcă dacă modelul principal eșuează pe toate retry-urile.
 * Erorile 4xx „hard" (400/401/404 — input/cheie invalidă) NU se retry-uiesc.
 */
export async function groqText(
  params: GroqTextParams,
  opts: { fallbackModel?: string; attempts?: number } = {},
): Promise<string> {
  const groq = getGroqClient();
  const models = [params.model, ...(opts.fallbackModel && opts.fallbackModel !== params.model ? [opts.fallbackModel] : [])];
  const attempts = opts.attempts ?? 2;
  let lastErr: unknown;
  for (const model of models) {
    for (let i = 0; i < attempts; i++) {
      try {
        const completion = await groq.chat.completions.create({ ...params, model });
        const txt = completion.choices[0]?.message?.content?.trim() ?? "";
        if (txt) return txt;
        lastErr = new Error("empty completion");
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status;
        // 400/401/403/404 = eroare „hard" pe acest model → treci la fallback fără retry.
        if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) break;
      }
      if (i < attempts - 1) {
        const backoff = 500 * (i + 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  // 2026-06-05 — Toate modelele Groq au eșuat (tipic: 429 — cota zilnică
  // epuizată pe ÎNTREG contul, ambele modele simultan). Cădem pe GEMINI (quota
  // separată + generoasă, 1500 req/zi). Reparat: reformulare, polish, titlu,
  // detect-city — tot ce folosea groqText murea când Groq era rate-limited.
  if (isGeminiConfigured()) {
    const geminiModels = [GEMINI_MODEL, GEMINI_MODEL_FAST, ...GEMINI_MODEL_BACKUPS];
    for (const gm of geminiModels) {
      try {
        const out = await callGemini({
          messages: params.messages,
          model: gm,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          response_format:
            params.response_format?.type === "json_object" ? { type: "json_object" } : undefined,
        });
        if (out && out.trim()) return out.trim();
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("groqText failed");
}
