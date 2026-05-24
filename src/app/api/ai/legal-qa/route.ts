import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(10).max(500),
});

/**
 * POST /api/ai/legal-qa — AI Q&A pentru întrebări civice cu citation legală.
 * (P4.928)
 *
 * NU oferă consultanță juridică profesională. Răspunde la întrebări tipice
 * despre drepturile civice + legile care le reglementează, cu citate
 * concrete (OG 27/2002 art. X, Constituția art. Y, etc.).
 *
 * Rate limit: 10 întrebări/oră per IP. Cost: Groq Llama 3.3 70B per call.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-legal-qa:${ip}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe întrebări. Reîncearcă peste o oră." }, { status: 429 });
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

  const { question } = parsed.data;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `Ești un consultant civic român. Răspunzi la întrebări simple despre drepturile civice și legile care le reglementează. Format răspuns:

1. Răspuns scurt (1-2 propoziții) la întrebare
2. Citate legale concrete (cu articol + alineat unde e cazul):
   - OG 27/2002 — petitii civice
   - Constituția României — art. 51 petitionare, art. 30 libertate exprimare
   - Legea 544/2001 — acces la informații publice
   - Legea 35/1997 — Avocatul Poporului
   - Legea 60/1991 — adunări publice / proteste
   - GDPR 2016/679 — protecție date personale
   - OUG 195/2002 — Cod Rutier
3. Pași practici (3-5 bullet-uri concrete)
4. Disclaimer obligatoriu: „Aceasta NU e consultanță juridică profesională. Pentru cazuri complexe, consultă un avocat."

Reguli:
- Diacritice complete (ă, â, î, ș, ț) obligatoriu
- NU inventa articole de lege. Dacă nu știi, spune clar.
- Răspuns max 400 cuvinte.
- Citează exact: „art. 8 alin. (1) din OG 27/2002" nu „articolul opt din OG".`,
        },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const answer = completion.choices[0]?.message.content?.trim() ?? "";
    if (!answer) {
      return NextResponse.json({ error: "AI nu a putut răspunde" }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      question,
      disclaimer: "Nu e consultanță juridică profesională. Pentru cazuri complexe, consultă un avocat.",
      model: "Groq Llama 3.3 70B",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI legal-qa failed" },
      { status: 500 },
    );
  }
}
