import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { detectPromptInjection } from "@/lib/ai/pii-mask";
import { checkAndIncrementQuota } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(2000),
});

const schema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
  // Batch 4 (5/22/2026) — context injection pentru chat county-aware.
  // Cand userul e pe /[judet]/* sau o sesizare specifica, frontend-ul
  // poate trimite context ca AI sa raspunda personalizat (Prefect-ul
  // judetului, autoritatile locale, statusul sesizarii).
  context: z.object({
    countyCode: z.string().max(3).optional(),
    countyName: z.string().max(80).optional(),
    sesizareCode: z.string().max(20).optional(),
    sesizareTitlu: z.string().max(200).optional(),
    sesizareStatus: z.string().max(40).optional(),
    page: z.string().max(120).optional(),
  }).optional(),
});

/**
 * Batch 4 (5/22/2026) — Generate 3 suggested follow-up prompts după
 * un răspuns AI. Heuristic-based (zero cost), pattern matching pe topic.
 */
function generateFollowupSuggestions(
  lastUserMsg: string,
  ctx?: NonNullable<z.infer<typeof schema>["context"]>,
): string[] {
  const msg = lastUserMsg.toLowerCase();

  // Topic-based suggestions
  if (msg.includes("sesizar") || msg.includes("plang")) {
    return [
      "Cum aleg autoritatea potrivită pentru sesizarea mea?",
      "Ce fac dacă primăria nu răspunde în 30 de zile?",
      "Pot să-mi ascund numele pe sesizarea publică?",
    ];
  }
  if (msg.includes("petit")) {
    return [
      "Cum inițiez o petiție pe Civia?",
      "De câte semnături am nevoie pentru impact?",
      "Pot semna anonim?",
    ];
  }
  if (msg.includes("amend") || msg.includes("contest")) {
    return [
      "Care e termenul pentru contestare?",
      "Ce documente îmi trebuie?",
      "Pot contesta și online?",
    ];
  }
  if (msg.includes("avocat") || msg.includes("ombudsman") || msg.includes("escala")) {
    return [
      "Cum trimit petiție la Avocatul Poporului?",
      "Când contactez Prefectul?",
      "Pot acționa autoritatea în instanță?",
    ];
  }
  if (msg.includes("og 27") || msg.includes("544")) {
    return [
      "Cum cer informații publice (Legea 544/2001)?",
      "Ce e diferit între petiție și sesizare?",
      "Care e termenul de răspuns?",
    ];
  }

  // County-aware default
  if (ctx?.countyCode) {
    return [
      `Care sunt autoritățile competente în ${ctx.countyName ?? "județ"}?`,
      "Cum aleg primăria potrivită pentru sesizare?",
      "Ce drepturi am ca cetățean local?",
    ];
  }

  // Sesizare-aware default
  if (ctx?.sesizareCode) {
    return [
      "Pot escalada sesizarea la Prefect?",
      "Cât timp aștept până la răspuns?",
      "Cum verific statusul oficial?",
    ];
  }

  // Generic fallback
  return [
    "Cum depun o sesizare pe Civia?",
    "Care sunt drepturile mele constituționale?",
    "Cum mă pot implica civic?",
  ];
}

function buildContextPrompt(ctx: NonNullable<z.infer<typeof schema>["context"]> | undefined): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.countyName) {
    lines.push(`USERUL ESTE PE PAGINA JUDETULUI ${ctx.countyName.toUpperCase()} (${ctx.countyCode ?? ""}).`);
    lines.push(`- Cand răspunzi despre escaladare/autoritati, mentioneaza specific Prefectul ${ctx.countyName} si autoritatile locale.`);
    lines.push(`- Pentru detalii contact: directioneaza la /${(ctx.countyCode ?? "").toLowerCase()}/autoritati.`);
  }
  if (ctx.sesizareCode) {
    lines.push(``);
    lines.push(`USERUL ARE INTREBARI DESPRE SESIZAREA #${ctx.sesizareCode}.`);
    if (ctx.sesizareTitlu) lines.push(`- Titlu: ${ctx.sesizareTitlu}`);
    if (ctx.sesizareStatus) lines.push(`- Status curent: ${ctx.sesizareStatus}`);
    lines.push(`- Daca intreaba „de ce nu s-a rezolvat?" → explica statusul si pasul urmator din workflow.`);
  }
  if (ctx.page && !ctx.countyCode && !ctx.sesizareCode) {
    lines.push(`USERUL ESTE PE PAGINA: ${ctx.page}.`);
  }
  return lines.length > 0
    ? `\n\nCONTEXT ACTUAL UTILIZATOR:\n${lines.join("\n")}\n`
    : "";
}

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
- /clasament — rata raspuns primarii
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

  // Batch 5 (5/22/2026) — daily quota check (plan item #74).
  // Chat e cel mai accesibil endpoint AI → cel mai abuzat. Default
  // 50 calls/zi/IP + global 5000/zi. Reset zilnic via TTL Redis.
  const quota = await checkAndIncrementQuota({ identifier: ip, feature: "chat" });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason ?? "Quota AI atinsa" },
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

  // Bug fix #72 (5/22/2026) — Prompt injection prevention.
  // Detect „Ignore previous instructions" / „You are now..." in user
  // messages. Daca match → block + log Sentry pentru pattern analysis.
  const lastUser = userMessages[userMessages.length - 1];
  if (lastUser && detectPromptInjection(lastUser.content)) {
    return NextResponse.json(
      {
        error: "Mesaj suspect detectat (prompt injection). Reformuleaza intrebarea ta fara instructiuni de sistem.",
      },
      { status: 400 },
    );
  }

  // Cap total tokens (~4 chars/token) ca sa nu epuizam budget pe un mesaj
  // enorm de la un user single.
  const totalChars = userMessages.reduce((acc, m) => acc + m.content.length, 0);
  if (totalChars > 8000) {
    return NextResponse.json(
      { error: "Conversație prea lungă. Sterge mesajele vechi si reia." },
      { status: 400 },
    );
  }

  try {
    const client = getGroqClient();
    // Batch 4 — context injection (county-aware + page-aware).
    const contextPrompt = buildContextPrompt(parsed.data.context);
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextPrompt },
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

    // Batch 4 — Generate „suggested follow-ups" pe baza ultimei intrebari
    // + raspuns AI. 3 sugestii prompts contextual. Heuristic local (zero
    // cost extra AI call) — pattern matching pe topics frecvente.
    const lastUserMsg = userMessages[userMessages.length - 1]?.content.toLowerCase() ?? "";
    const suggestions = generateFollowupSuggestions(lastUserMsg, parsed.data.context);

    return NextResponse.json({ ok: true, reply, suggestions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare AI" },
      { status: 500 },
    );
  }
}
