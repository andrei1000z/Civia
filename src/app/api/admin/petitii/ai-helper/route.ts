import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  type: z.enum(["slug", "summary"]),
  title: z.string().min(3).max(300),
  body: z.string().max(10_000).optional(),
});

const SLUG_PROMPT = (title: string) => `Generează un slug URL pentru această petiție civică în limba română.

TITLU: "${title}"

REGULI:
- doar lowercase ASCII (fără diacritice — „ț"→"t", „ș"→"s", „ă"→"a", „î"→"i", „â"→"a")
- doar litere, cifre, cratimă „-"
- maxim 8 cuvinte / 70 caractere
- elimini cuvinte de umplutură (pentru, dar, sau, către, în, la, mai, etc.)
- prima cuvintele esențiale (subiect + acțiune)
- nu repeta „petitie" / „cerem" / „semnatura"

Răspunde DOAR cu slug-ul. Nimic altceva.

Exemple:
- „Salvarea pădurilor din Munții Făgăraș" → "salvarea-padurilor-fagaras"
- „Reducerea vitezei pe DN1" → "reducere-viteza-dn1"
- „Mai multe parcuri pentru București" → "mai-multe-parcuri-bucuresti"`;

const SUMMARY_PROMPT = (title: string, body: string) => `Generează un sumar pentru această petiție civică în limba română.

TITLU: "${title}"

CONȚINUT COMPLET:
${body.slice(0, 4000)}

REGULI:
- 2-3 propoziții, total 200-400 caractere
- limba română corectă cu diacritice
- prima propoziție: ce cere petiția (acțiunea concretă)
- a doua propoziție: de ce contează (impactul / urgenta)
- ton civic, factual, nu sentimental
- nu folosi „noi" / „eu" / „dvs"
- nu repeta titlul cuvânt cu cuvânt

Răspunde DOAR cu sumarul. Nimic altceva, fără ghilimele.`;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    let prompt: string;
    let maxTokens: number;
    if (parsed.type === "slug") {
      prompt = SLUG_PROMPT(parsed.title);
      maxTokens = 60;
    } else {
      if (!parsed.body || parsed.body.length < 50) {
        return NextResponse.json(
          { error: "Body prea scurt — completează conținutul petiției înainte de AI summary" },
          { status: 400 },
        );
      }
      prompt = SUMMARY_PROMPT(parsed.title, parsed.body);
      maxTokens = 200;
    }

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: "Ești un asistent care generează metadata pentru petiții civice românești. Răspunzi exact ce ți se cere, nimic mai mult." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    let text = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip wrapping quotes / markdown if AI ignored instruction
    text = text.replace(/^["'„`]+|["'"`]+$/g, "").trim();

    if (parsed.type === "slug") {
      // Sanity: enforce slug rules even if AI hallucinates
      text = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100);
      if (text.length < 3) {
        return NextResponse.json({ error: "AI couldn't generate a valid slug" }, { status: 502 });
      }
    } else {
      // Summary: cap la 500 ca să se potrivească cu schema petiții
      text = text.slice(0, 500);
    }

    return NextResponse.json({ data: { text } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation", details: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
