/**
 * Registry de provideri AI GRATUIȚI, OpenAI-compatibili. Fiecare se activează
 * AUTOMAT dacă există cheia lui în env. Au cote SEPARATE → cascada nu rămâne
 * fără AI. Vrei mai multă rezervă? Faci cont gratis oriunde mai jos și pui
 * cheia în env — restul merge singur.
 *
 * 2026-06-05 — parte din efortul „AI-ul Civia să nu se mai ardă niciodată".
 * Ordinea = calitate-română × generozitate-free (rafinată din research).
 */

export interface OpenAICompatProvider {
  name: string;
  /** Numele variabilei de env care ține cheia API. */
  keyEnv: string;
  /** Base URL fără „/chat/completions". */
  baseUrl: string;
  /** Modele de încercat, în ordine (calitate-întâi). */
  models: string[];
  /** Headere suplimentare (ex: OpenRouter cere Referer/Title). */
  extraHeaders?: Record<string, string>;
}

// Provideri free cu endpoint OpenAI-compat. NU necesită cod în plus — doar cheia
// în env. Ordine = generozitate-free × calitate-RO × fiabilitate (din research
// 2026, vezi free-ai-providers-research). Cei cu cotă mare/separată primii;
// OpenRouter ultimul (free real = ~50 cereri/zi fără prepay).
export const FREE_PROVIDERS: OpenAICompatProvider[] = [
  {
    // Cerebras: free permanent, foarte rapid, ID-uri actualizate iun. 2026.
    name: "cerebras",
    keyEnv: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1",
    models: ["zai-glm-4.7", "gpt-oss-120b", "llama-3.3-70b"],
  },
  {
    // Mistral La Plateforme — free tier, calitate bună pe RO.
    name: "mistral",
    keyEnv: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
  },
  {
    // NVIDIA NIM (build.nvidia.com) — free, modele mari (Llama 3.3 70B, Qwen3).
    name: "nvidia-nim",
    keyEnv: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    models: [
      "meta/llama-3.3-70b-instruct",
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "qwen/qwen3-235b-a22b",
    ],
  },
  {
    // GitHub Models — free pentru developeri (token GitHub cu scope models:read).
    name: "github-models",
    keyEnv: "GITHUB_MODELS_TOKEN",
    baseUrl: "https://models.github.ai/inference",
    models: ["meta/Llama-3.3-70B-Instruct", "mistral-ai/Mistral-Large-2411", "openai/gpt-4o-mini"],
  },
  {
    // OpenRouter — ULTIMUL (free real ~50/zi fără $10 prepay). Verifică colecția
    // „:free" live (se schimbă lunar) dacă o activezi.
    name: "openrouter",
    keyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "google/gemma-3-27b-it:free",
      "openai/gpt-oss-120b:free",
    ],
    extraHeaders: {
      "HTTP-Referer": "https://civia.ro",
      "X-Title": "Civia",
    },
  },
];

/** Providerii cu cheie setată în env, în ordinea din registry. */
export function configuredProviders(): OpenAICompatProvider[] {
  return FREE_PROVIDERS.filter((p) => !!process.env[p.keyEnv]);
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallParams {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  signal?: AbortSignal;
}

/**
 * Apel OpenAI-compat generic. Aruncă pe erori HTTP (status atașat) ca upstream-ul
 * să recunoască 429 și să treacă la următorul provider/model.
 */
export async function callOpenAICompat(
  provider: OpenAICompatProvider,
  model: string,
  { messages, temperature = 0.3, max_tokens = 1100, response_format, signal }: CallParams,
): Promise<string | null> {
  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) throw new Error(`${provider.name}: ${provider.keyEnv} not set`);

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: Math.max(max_tokens, 512),
  };
  if (response_format) body.response_format = response_format;

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${provider.name} ${res.status}: ${text.slice(0, 200)}`) as Error & {
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
