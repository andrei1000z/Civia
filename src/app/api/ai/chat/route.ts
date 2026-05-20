import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(2000),
});

const schema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

const SYSTEM_PROMPT = `Esti Civia Assistant — un asistent civic pentru cetateni romani.

Misiune: ajuti utilizatorii sa inteleaga drepturile lor civice si sa depuna sesizari catre primarii.

CUNOSTINTE PRINCIPALE:
- OG 27/2002 (petitii): orice cetatean poate depune o petitie; primaria trebuie sa raspunda in 30 zile (extensibil cu 15 zile in cazuri complexe)
- Legea 544/2001 (acces info publice): cetatenii au dreptul la informatii detinute de autoritati publice, raspuns in 10 zile (sau 30 in cazuri complexe)
- GDPR Reg. UE 2016/679: cetatenii pot cere ca datele lor sa nu fie divulgate persoanelor vizate
- Legea 52/2003 (dezbatere publica): cetatenii pot participa la elaborarea actelor normative locale
- Constitutia Romaniei art. 51: dreptul la petitionare

PLATFORMA CIVIA OFERA:
- /sesizari — depune sesizare AI-formalizata cu poza + locatie, trimite la primarie
- /sesizari-publice — vezi sesizari ale altor cetateni, voteaza, cosemnatura
- /petitii — semnaturi petitii civice
- /proteste — proteste programate
- /ghiduri — ghiduri practice (cum contesti amenda, cum scrii sesizare, etc.)
- /intreruperi — apa, gaz, curent, lucrari programate
- /clasament-primarii — rata raspuns primarii
- /[judet] — pagina dedicata fiecarui judet (ex: /b pentru Bucuresti)

STIL RASPUNS:
- Romana standard, profesional dar prietenos
- Max 4 paragrafe (concis e mai bun)
- Foloseste bullet points cand listezi pasi
- Includ link-uri Civia relevante cand e cazul (format: [text](/path))
- Nu inventa numere de telefon sau emailuri primarii — directioneaza la /[judet]/autoritati

REFUZURI:
- Nu da sfaturi medicale, financiare, juridice complexe — directioneaza la specialist
- Nu raspunde la intrebari off-topic (cooking, sport, etc.) — readu la subiectul civic
- Nu lua pozitii politice partizane — ramai factual + civic`;

/**
 * POST /api/ai/chat — Civia Assistant conversation endpoint.
 *
 * Cost: Groq free tier (Llama 3.1 8B instant). Zero buget.
 * Limita: 10 mesaje per IP/15min. 2000 chars/mesaj. Max 20 mesaje per
 * conversatie (system + user + assistant alternating).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-chat:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Prea multe mesaje. Asteapta 15 minute.",
        resetIn: Math.ceil(rl.resetIn / 1000),
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 400 },
    );
  }

  // Strip system messages from input (we set our own)
  const userMessages = parsed.data.messages.filter((m) => m.role !== "system");
  if (userMessages.length === 0) {
    return NextResponse.json({ error: "Niciun mesaj" }, { status: 400 });
  }

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...userMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.5,
      max_tokens: 600,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return NextResponse.json(
        { error: "Raspuns gol de la AI. Reincearca." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare AI" },
      { status: 500 },
    );
  }
}
