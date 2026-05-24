import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().min(2).max(3000),
  from: z.enum(["ro", "en", "auto"]).default("auto"),
  to: z.enum(["ro", "en"]),
});

/**
 * POST /api/ai/translate — RO ↔ EN translation pentru diaspora + jurnaliști EN.
 * (P4.927)
 *
 * Use cases:
 *   - Diaspora vrea să citească o sesizare în EN
 *   - Jurnaliști internaționali vor data
 *   - Civia internal: standardize text înainte de embed
 *
 * Rate limit: 30 traduceri/oră per IP (anti-abuse — Groq are cost).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-translate:${ip}`, { limit: 30, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe traduceri. Reîncearcă peste o oră." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { text, from, to } = parsed.data;

  // Skip translation dacă from = to
  if (from !== "auto" && from === to) {
    return NextResponse.json({ translation: text, skipped: "same_language" });
  }

  try {
    const groq = getGroqClient();
    const fromLabel = from === "ro" ? "Romanian" : from === "en" ? "English" : "auto-detected";
    const toLabel = to === "ro" ? "Romanian (with full diacritics ăâîșț)" : "English";
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        {
          role: "system",
          content: `You are a professional translator for civic content. Translate from ${fromLabel} to ${toLabel}. Preserve formatting (paragraphs, bullets). Keep legal references (OG 27/2002, art. X) exactly as in source. Preserve proper nouns (Civia, Bucharest sectors). Return ONLY the translation, no commentary.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const translation = completion.choices[0]?.message.content?.trim() ?? "";
    if (!translation) {
      return NextResponse.json({ error: "Traducerea AI a eșuat" }, { status: 502 });
    }

    return NextResponse.json({
      translation,
      from,
      to,
      model: "Groq Llama 3.1 8B instant",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI translate failed" },
      { status: 500 },
    );
  }
}
