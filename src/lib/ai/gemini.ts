/**
 * Gemini 2.0 Flash via OpenAI-compatible endpoint.
 *
 * Used as a third fallback in the AI text-generation chain after Groq
 * 70B and 8B-instant. Gemini's free tier is generous (1500 req/day,
 * 1M tokens/min) and quality on Romanian is on par with Llama 3.3 70B,
 * so it's the right "rescue" tier when Groq's daily quota is exhausted.
 *
 * Set GEMINI_API_KEY in env to enable. If not set, callers should skip
 * this provider gracefully (see `isGeminiConfigured`).
 *
 * Endpoint reference: https://ai.google.dev/gemini-api/docs/openai
 */

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Primary = 2.5-flash (best Romanian quality on free tier); fallbacks
// cover the case where individual model counters get exhausted —
// each model on Gemini's free tier has a SEPARATE per-day quota,
// so cycling through 4 of them is functionally 4× the daily budget
// from a single-key perspective.
//
// Discovered the hard way (5/3/2026): the explicit-version aliases
// (gemini-2.5-flash, 2.0-flash-lite, etc.) and the "latest" aliases
// (gemini-flash-latest, gemini-flash-lite-latest) and the Gemma
// open-weight models (gemma-3-27b-it) all have INDEPENDENT counters
// even when invoked via the same API key. When 2.5-flash is 429,
// flash-latest still serves. The chain in callAiWithFallback should
// try each in turn before falling back to Groq.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GEMINI_MODEL_FAST = process.env.GEMINI_MODEL_FAST || "gemini-2.5-flash-lite";
/** Additional Gemini models with separate quota counters. Order is
 *  best-Romanian-quality first → smallest/least-used last. */
export const GEMINI_MODEL_BACKUPS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemma-3-27b-it",
] as const;

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** Pass-through of the OpenAI response_format param. Gemini supports
   *  `{ type: "json_object" }` via the compat layer. */
  response_format?: { type: "json_object" };
  /** Caller-controlled abort for timeouts. */
  signal?: AbortSignal;
}

interface OpenAICompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
}

/**
 * Calls Gemini's OpenAI-compatible chat.completions endpoint and
 * returns the `choices[0].message.content` string. Throws on HTTP
 * errors so the caller's try/catch + isRateLimited helper can decide
 * whether to fall through to the next provider in the chain.
 */
export async function callGemini({
  messages,
  model = GEMINI_MODEL,
  temperature = 0.3,
  max_tokens = 1100,
  response_format,
  signal,
}: CallOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
  };
  if (response_format) body.response_format = response_format;

  const res = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Mirror the shape Groq SDK errors take (status + message) so the
    // upstream isRateLimited helper recognises 429 the same way.
    const err = new Error(
      `Gemini ${res.status}: ${text.slice(0, 300)}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as OpenAICompletionResponse;
  return json.choices?.[0]?.message?.content ?? null;
}
