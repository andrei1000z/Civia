/**
 * POST /api/propuneri-legislative/submit
 *
 * Submit o propunere legislativă nouă.
 * Flow:
 *   1. Validare input (zod)
 *   2. Rate limit (3 propuneri per user per zi)
 *   3. AI formalizare via Groq (JSON structured)
 *   4. Salvare în DB
 *   5. Email confirmare propunător
 *
 * Returns: { ok, id, ai_result }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { getGroqClient } from "@/lib/groq/client";
import {
  SYSTEM_PROMPT_LEGISLATIVE,
  USER_PROMPT_LEGISLATIVE,
  type LegislativeFormalResult,
} from "@/lib/propuneri-legislative/prompts";
import {
  AUTHORITIES,
  VOTE_THRESHOLD_SEND,
} from "@/lib/propuneri-legislative/authorities";
import {
  buildConfirmationEmail,
} from "@/lib/propuneri-legislative/email-template";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  titlu: z.string().min(10).max(200),
  problema: z.string().min(50).max(5000),
  solutia: z.string().min(50).max(5000),
  categorie: z.enum([
    "trafic_rutier", "mobilitate", "urbanism", "mediu",
    "siguranta", "sanatate", "educatie", "administrativ", "altele",
  ]),
  destinatar_key: z.enum([
    "MAI", "IGPR", "MT", "MDLPA", "CAMERA_DEPUTATILOR",
    "SENAT", "ANAP", "CNAIR", "PRIMARIA_GENERALA",
  ]),
  is_anonymous: z.boolean().default(false),
  author_display_name: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`prop-leg-submit:${ip}`, { limit: 3, windowMs: 86_400_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Maxim 3 propuneri pe zi per IP" }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalid" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Date invalide", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Auth (optional — poate posta și fără cont)
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const authority = AUTHORITIES[data.destinatar_key];
  if (!authority) {
    return NextResponse.json({ error: "Autoritate necunoscută" }, { status: 400 });
  }

  // ── AI formalizare ──────────────────────────────────────────────────────────
  let formalResult: LegislativeFormalResult | null = null;
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT_LEGISLATIVE },
        {
          role: "user",
          content: USER_PROMPT_LEGISLATIVE({
            titlu: data.titlu,
            problema: data.problema,
            solutia: data.solutia,
            categorie: data.categorie,
            destinatar: authority.name,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    formalResult = JSON.parse(raw) as LegislativeFormalResult;
  } catch (e) {
    console.error("[propuneri-legislative] AI formalizare error:", e);
    // Continua fara AI — user poate edita manual
  }

  // ── Salvare DB ──────────────────────────────────────────────────────────────
  const admin = createSupabaseAdmin();
  const { data: inserted, error: dbError } = await admin
    .from("propuneri_legislative")
    .insert({
      user_id: user?.id ?? null,
      titlu: data.titlu,
      problema: data.problema,
      solutia: data.solutia,
      categorie: data.categorie,
      destinatar_key: data.destinatar_key,
      ai_formal_text: formalResult ? JSON.stringify(formalResult) : null,
      ai_temei_legal: formalResult?.temei_legal ?? null,
      ai_impact: formalResult?.impact_estimat ?? null,
      ai_precedente: formalResult?.precedente ?? null,
      ai_generated_at: formalResult ? new Date().toISOString() : null,
      status: "active",
      is_anonymous: data.is_anonymous,
      author_display_name: data.is_anonymous ? null : (data.author_display_name ?? user?.email?.split("@")[0] ?? null),
    })
    .select("id")
    .single();

  if (dbError || !inserted) {
    console.error("[propuneri-legislative] DB insert error:", dbError);
    return NextResponse.json({ error: "Eroare salvare" }, { status: 500 });
  }

  // ── Email confirmare ────────────────────────────────────────────────────────
  if (user?.email) {
    const { subject, html } = buildConfirmationEmail({
      propunereId: inserted.id as string,
      titlu: formalResult?.titlu_formal ?? data.titlu,
      destinatarName: authority.name,
      votesThreshold: VOTE_THRESHOLD_SEND,
    });
    await sendEmail({ to: user.email, subject, html });
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    ai_result: formalResult,
  });
}
