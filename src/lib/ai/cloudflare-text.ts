/**
 * Cloudflare Workers AI — provider de TEXT gratuit (cotă SEPARATĂ de Groq/Gemini)
 * în cascada de generare. Free tier: ~10k neurons/zi. Endpoint OpenAI-compatibil:
 *   POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions
 *
 * ENV: CLOUDFLARE_API_TOKEN (scope „Workers AI") + CLOUDFLARE_ACCOUNT_ID
 *      (sau R2_ACCOUNT_ID). Dacă lipsesc → isCloudflareTextConfigured() = false
 *      și cascada îl sare elegant.
 *
 * 2026-06-05 — adăugat ca al 3-lea furnizor gratuit ca AI-ul Civia să nu mai
 * rămână fără cotă (Groq + Gemini + Cloudflare, fiecare cu limită proprie).
 */

// Modele de text bune pentru română pe free tier (calitate-întâi).
export const CF_TEXT_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
] as const;

export function isCloudflareTextConfigured(): boolean {
  return !!(
    process.env.CLOUDFLARE_API_TOKEN &&
    (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID)
  );
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
  response_format?: { type: "json_object" };
  signal?: AbortSignal;
}

/**
 * Apel OpenAI-compatibil către Cloudflare Workers AI. Aruncă pe erori HTTP
 * (status atașat) ca upstream-ul să recunoască 429 și să treacă la următorul
 * provider, exact ca la Groq/Gemini.
 */
export async function callCloudflareText({
  messages,
  model = CF_TEXT_MODELS[0],
  temperature = 0.3,
  max_tokens = 1100,
  response_format,
  signal,
}: CallOptions): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("Cloudflare AI not configured");
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: Math.max(max_tokens, 512),
  };
  if (response_format) body.response_format = response_format;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(30_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Cloudflare ${res.status}: ${text.slice(0, 300)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return json.choices?.[0]?.message?.content ?? null;
}
