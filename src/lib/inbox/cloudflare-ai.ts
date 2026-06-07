/**
 * Cloudflare Workers AI — backup OCR free pentru când Gemini quota e atinsă.
 *
 * 2026-05-27 — Workers AI free tier: 10k neurons/zi. Llama 3.2 11B Vision
 * (model: @cf/meta/llama-3.2-11b-vision-instruct) face OCR + vision Q&A
 * gratis. Folosit ca fallback când GEMINI_API_KEY hits quota.
 *
 * REST API: POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}
 * Auth: Bearer CLOUDFLARE_API_TOKEN cu „Workers AI Edit" scope.
 *
 * ENV vars:
 *   CLOUDFLARE_ACCOUNT_ID = same as R2_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN  = token cu permisiuni Workers AI
 */

interface CloudflareAIResult {
  text: string | null;
  error: string | null;
}

export async function cloudflareAIVision(opts: {
  imageBytes: Uint8Array;
  prompt: string;
}): Promise<CloudflareAIResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    return { text: null, error: "Cloudflare AI not configured" };
  }

  // Llama 3.2 11B Vision expectă image ca array de bytes (numeric).
  const imageArray = Array.from(opts.imageBytes);

  try {
    const res = await fetch(
      // LLaVA 1.5 — fără blocaj UE (Llama 3.2 Vision e restricționat Meta în UE).
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/llava-hf/llava-1.5-7b-hf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageArray,
          prompt: opts.prompt,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      result?: { response?: string };
      errors?: Array<{ message: string }>;
    };
    if (!json.success) {
      const err = json.errors?.[0]?.message || "Unknown CF AI error";
      return { text: null, error: err };
    }
    return { text: json.result?.response ?? null, error: null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
