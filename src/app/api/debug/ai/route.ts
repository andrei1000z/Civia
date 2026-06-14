import { NextResponse } from "next/server";
import { isGeminiConfigured, GEMINI_MODEL, callGemini } from "@/lib/ai/gemini";
import { verifyBearer } from "@/lib/auth/constant-time";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/ai — checks whether each AI provider is configured
 * at runtime AND optionally pings Gemini live (?ping=1) to confirm
 * the key actually works.
 *
 * GATED: necesită `Authorization: Bearer ${CRON_SECRET}`. Înainte era
 * public → leak de prefixe de chei (6 caractere) + `?ping=1` permitea
 * oricui să ardă cota Gemini. Nu mai returnează niciun fragment de cheie.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://civia.ro/api/debug/ai
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://civia.ro/api/debug/ai?ping=1
 */
export async function GET(req: Request) {
  if (!verifyBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const shouldPing = url.searchParams.get("ping") === "1";

  const status = {
    gemini: {
      configured: isGeminiConfigured(),
      model: GEMINI_MODEL,
    },
    groq: {
      configured: !!process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      modelFast: process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant",
    },
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };

  if (!shouldPing) {
    return NextResponse.json(status);
  }

  // Live ping to Gemini — confirms the key is valid + the API is
  // reachable from the Vercel region. Returns first 100 chars of the
  // response or the error message.
  let geminiPing: { ok: boolean; result?: string; error?: string } = { ok: false };
  if (isGeminiConfigured()) {
    try {
      const out = await callGemini({
        messages: [
          { role: "user", content: "Spune doar cuvântul: pong" },
        ],
        max_tokens: 10,
        temperature: 0,
      });
      geminiPing = { ok: true, result: out?.slice(0, 100) ?? "(empty)" };
    } catch (err) {
      geminiPing = {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      };
    }
  } else {
    geminiPing = { ok: false, error: "GEMINI_API_KEY not set" };
  }

  return NextResponse.json({ ...status, geminiPing });
}
