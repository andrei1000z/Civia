import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp, identityKey } from "@/lib/ratelimit";
import { createSupabaseServer } from "@/lib/supabase/server";
import { repairAndParseJson } from "@/lib/groq/json-repair";
import { restoreDiacritics } from "@/lib/sesizari/diacritice";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  descriere: z.string().min(10).max(2000),
  titlu: z.string().max(200).optional(),
});

/**
 * Apelat cand userul alege tip="altele" — AI propune o eticheta scurta
 * pentru categoria custom, ca admin sa vada in dashboard grupari.
 *
 * Returneaza:
 *   { category: "Coș de gunoi vandalizat", confidence: 75 }
 *
 * Eticheta:
 *   - max 50 caractere
 *   - in romana, Title Case (cuvant principal cu majuscula)
 *   - fara „altele" sau categorii existente (avoid colision)
 */
const SYSTEM_PROMPT = `Esti un sistem de clasificare a sesizarilor civice care NU se incadreaza in tipurile standard.

SARCINA: Citesti descrierea + titlul sesizarii si propui o eticheta CURTA de categorie (max 50 caractere) in romana.

REGULI:
- Title Case in romana (primele litere mari): „Coș de gunoi vandalizat", „Lipsă bancă în stație", „Inundație periodică pe stradă"
- max 50 caractere, ideal 2-5 cuvinte
- DESCRIPTIV — categoria sa fie clara la prima vedere, nu generica
- NU folosi categoriile existente (acestea sunt deja gestionate cu tipul standard):
  groapă, trotuar, iluminat, copac, gunoi, parcare, stâlpișori, canalizare,
  semafor, graffiti, mobilier, transport, afișaj, bandă transport, trecere pietoni,
  rampă acces, colectare selectivă
  → daca descrierea CLAR se potriveste cu unul dintre acestea, NU genera categorie noua,
  returneaza confidence sub 30 si lasa admin-ul sa re-clasifice manual
- Confidence 0-100 — cat de sigur esti ca eticheta e potrivita

RASPUNDE DOAR CU JSON VALID:
{"category": "...", "confidence": ...}`;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const rl = await rateLimitAsync(`autocat:${identityKey(user?.id ?? null, ip)}`, {
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe categorisări. Asteapta o ora." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalid" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const { descriere, titlu } = parsed.data;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Titlu: ${titlu ?? "(lipsa)"}\nDescriere: ${descriere}\n\nGenereaza eticheta de categorie:`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const result = repairAndParseJson<{ category?: string; confidence?: number }>(
      raw,
      ["category", "confidence"],
    );

    if (!result?.category) {
      return NextResponse.json({
        category: "Necategorisat",
        confidence: 0,
        fallback: true,
      });
    }

    // Sanitize: diacritice deterministe + max 50 chars. AI-ul lăsa uneori
    // categoria fără diacritice („Cosuri pe stalpii") → o reparăm aici.
    const category = restoreDiacritics(result.category.trim()).slice(0, 50);
    const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 50));

    return NextResponse.json({ category, confidence });
  } catch {
    return NextResponse.json({
      category: "Necategorisat",
      confidence: 0,
      fallback: true,
    });
  }
}
