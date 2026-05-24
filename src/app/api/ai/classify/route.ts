import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { SYSTEM_PROMPT_CLASSIFIER } from "@/lib/groq/prompts";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { SESIZARE_TIPURI } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  text: z.string().min(3).max(2000),
});

// 2026-05-24 Faza 7: VALID_TIPURI consolidat — single source of truth e
// `SESIZARE_TIPURI` în lib/constants.ts. Înainte era duplicat aici cu o
// listă potențial divergentă (lipsea "trecere_pietoni", "rampa_acces" etc.).
const VALID_TIPURI = SESIZARE_TIPURI.map((t) => t.value) as readonly string[];

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-classify:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { text } = schema.parse(body);

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CLASSIFIER },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content) as { tip?: string };
    const tip = VALID_TIPURI.includes(parsed.tip ?? "") ? parsed.tip! : "altele";

    return NextResponse.json({ data: { tip } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Input invalid" }, { status: 400 });
    }
    // Dev-only log; in prod Sentry picks it up via the instrumentation
    // runtime. Keeping console.error here would flood Vercel logs with
    // expected Groq rate-limit noise.
    if (process.env.NODE_ENV !== "production") {
      console.error("[ai-classify]", e);
    }
    return NextResponse.json({ error: "AI temporar indisponibil" }, { status: 500 });
  }
}
