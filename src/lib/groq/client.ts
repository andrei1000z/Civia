import Groq from "groq-sdk";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  GEMINI_MODEL_FAST,
  GEMINI_MODEL_BACKUPS,
} from "@/lib/ai/gemini";
import {
  callCloudflareText,
  isCloudflareTextConfigured,
  CF_TEXT_MODELS,
} from "@/lib/ai/cloudflare-text";
import { configuredProviders, callOpenAICompat } from "@/lib/ai/openai-compat";
import { analyticsRedis } from "@/lib/analytics/redis";

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
// Modele Groq „production" suplimentare încercate înainte de a ieși din Groq
// (gpt-oss-120b e succesorul recomandat de Groq, calitate ~70B). Cotele sunt pe
// organizație, dar fiecare model are RPD propriu — mai multe șanse.
// 2026-06-10 FIX: scos „gemma2-9b-it" — DEZAFECTAT de Groq (400 model_decommissioned).
// Când cascada ajungea la el, dădea hard-400 în loc să treacă la Gemini/Cloudflare.
// Înlocuit cu gpt-oss-20b (variantă mică, validă) ca al treilea backup Groq.
const GROQ_MODEL_BACKUPS = ["openai/gpt-oss-120b", "llama-3.1-8b-instant", "openai/gpt-oss-20b"];
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

/** Hash stabil al cererii pentru cache (32-bit + lungime — coliziuni neglijabile). */
function requestHash(p: GroqTextParams): string {
  const s = JSON.stringify({
    t: p.temperature,
    mt: p.max_tokens,
    f: p.response_format?.type,
    msg: p.messages,
  });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}_${s.length.toString(36)}`;
}

/**
 * 2026-06-05 — Apel AI ROBUST cu CASCADĂ MULTI-PROVIDER + caching.
 *
 * Scop: AI-ul Civia să NU mai rămână NICIODATĂ fără cotă. Fiecare provider are
 * limită SEPARATĂ; când unul dă 429, trecem la următorul:
 *
 *   Groq (70B → 8B → gpt-oss) → Gemini (5 modele) → Cloudflare Workers AI
 *   → provideri OpenAI-compat configurați (Cerebras/OpenRouter/Mistral/…)
 *   → [throw] → caller-ul face fallback determinist.
 *
 * + CACHE Redis: cereri identice returnează rezultatul memorat (TTL 7 zile),
 *   economisind apeluri (dezactivabil cu opts.cache === false).
 *
 * `fallbackModel` = al doilea model Groq încercat. Erorile 4xx „hard"
 * (400/401/404) nu se retry-uiesc.
 */
export async function groqText(
  params: GroqTextParams,
  opts: { fallbackModel?: string; attempts?: number; cache?: boolean } = {},
): Promise<string> {
  const fmt =
    params.response_format?.type === "json_object" ? ({ type: "json_object" } as const) : undefined;

  // ─── CACHE ───
  const useCache = opts.cache !== false && !!analyticsRedis;
  const cacheKey = useCache ? `aitxt:${requestHash(params)}` : "";
  if (useCache) {
    try {
      const hit = await analyticsRedis!.get<string>(cacheKey);
      if (hit) return hit;
    } catch {
      /* cache miss / Redis down — continuăm */
    }
  }

  const out = await runCascade(params, opts, fmt);

  if (useCache && out) {
    try {
      await analyticsRedis!.set(cacheKey, out, { ex: 60 * 60 * 24 * 7 });
    } catch {
      /* ignore cache write errors */
    }
  }
  return out;
}

async function runCascade(
  params: GroqTextParams,
  opts: { fallbackModel?: string; attempts?: number },
  fmt: { type: "json_object" } | undefined,
): Promise<string> {
  const groq = getGroqClient();
  const groqModels = [
    params.model,
    ...(opts.fallbackModel && opts.fallbackModel !== params.model ? [opts.fallbackModel] : []),
    ...GROQ_MODEL_BACKUPS.filter((m) => m !== params.model && m !== opts.fallbackModel),
  ];
  const attempts = opts.attempts ?? 2;
  let lastErr: unknown;

  // ─── 1. GROQ (mai multe modele, cu retry/backoff) ───
  for (const model of groqModels) {
    for (let i = 0; i < attempts; i++) {
      try {
        const completion = await groq.chat.completions.create({ ...params, model });
        const txt = completion.choices[0]?.message?.content?.trim() ?? "";
        if (txt) return txt;
        lastErr = new Error("empty completion");
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status;
        // 400/401/403/404 = eroare „hard" → fără retry, treci mai departe.
        if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) break;
      }
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  // ─── 2+. FALLBACK PROVIDERS (cotă separată fiecare) ───
  const fallbacks: Array<() => Promise<string | null>> = [];
  if (isGeminiConfigured()) {
    for (const gm of [GEMINI_MODEL, GEMINI_MODEL_FAST, ...GEMINI_MODEL_BACKUPS]) {
      fallbacks.push(() =>
        callGemini({
          messages: params.messages,
          model: gm,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          response_format: fmt,
        }),
      );
    }
  }
  // Provideri OpenAI-compat configurați (Cerebras/Mistral/NVIDIA/GitHub/…) —
  // cotă mare/separată, ÎNAINTEA Cloudflare.
  for (const prov of configuredProviders()) {
    for (const m of prov.models) {
      fallbacks.push(() =>
        callOpenAICompat(prov, m, {
          messages: params.messages,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          response_format: fmt,
        }),
      );
    }
  }
  // Cloudflare ULTIMUL — cota e mică (10k neuroni/zi ≈ 30-60 emailuri pe 70B),
  // deci e rezerva finală înainte de fallback-ul determinist.
  if (isCloudflareTextConfigured()) {
    for (const cm of CF_TEXT_MODELS) {
      fallbacks.push(() =>
        callCloudflareText({
          messages: params.messages,
          model: cm,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          response_format: fmt,
        }),
      );
    }
  }

  for (const run of fallbacks) {
    try {
      const out = await run();
      if (out && out.trim()) return out.trim();
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("groqText failed (toate providerele)");
}
