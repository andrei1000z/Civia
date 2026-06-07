import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";
import { computeStatusUpdate } from "@/lib/inbox/status-from-reply";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * 2026-06-07 (audit P1) — review MANUAL admin pentru replies „necunoscut".
 *
 * Când AI clasifică greșit (sau „necunoscut" pe răspuns real în PDF), adminul
 * corectează aici clasificarea răspunsului ȘI, opțional, avansează statusul
 * sesizării. Refolosește computeStatusUpdate (forward-only — nu regresăm un
 * status mai avansat) + logAdminAction (audit).
 */
const schema = z.object({
  reply_status: z.enum([
    "inregistrata",
    "in-lucru",
    "rezolvat",
    "redirectionata",
    "respins",
    "cerere_informatii",
    "necunoscut",
  ]),
  apply_to_sesizare: z.boolean().default(false),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const rl = await rateLimitAsync(`admin-reply-review:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe modificări" }, { status: 429 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  const { reply_status, apply_to_sesizare } = parsed.data;

  const admin = createSupabaseAdmin();
  const { data: reply } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, ai_status, ai_nr_inregistrare, ai_summary")
    .eq("id", id)
    .maybeSingle();
  if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 });

  const prevStatus = (reply as { ai_status: string | null }).ai_status;

  // 1. Corectează clasificarea răspunsului (override admin).
  const { error: upErr } = await admin
    .from("sesizare_replies")
    .update({
      ai_status: reply_status,
      user_confirmed: true,
      user_corrected_status: reply_status,
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 2. Opțional: avansează statusul sesizării (forward-only via computeStatusUpdate).
  let sesizareStatus: string | null = null;
  const sesizareId = (reply as { sesizare_id: string | null }).sesizare_id;
  if (apply_to_sesizare && sesizareId) {
    const { data: ses } = await admin
      .from("sesizari")
      .select("id, code, status")
      .eq("id", sesizareId)
      .maybeSingle();
    if (ses) {
      const upd = computeStatusUpdate({
        currentStatus: (ses as { status: string }).status,
        aiStatus: reply_status,
        nrInregistrare: (reply as { ai_nr_inregistrare: string | null }).ai_nr_inregistrare,
        summary: (reply as { ai_summary: string | null }).ai_summary,
        at: new Date().toISOString(),
      });
      if (upd) {
        await admin.from("sesizari").update(upd).eq("id", (ses as { id: string }).id);
        await admin.from("sesizare_timeline").insert({
          sesizare_id: (ses as { id: string }).id,
          event_type: upd.status,
          description: "Status actualizat de admin după revizuirea manuală a unui răspuns oficial.",
          created_by: user.id,
        });
        sesizareStatus = upd.status;
      }
    }
  }

  await logAdminAction({
    req,
    actorId: user.id,
    action: "reply.manual_review",
    targetType: "sesizare_reply",
    targetId: id,
    before: { ai_status: prevStatus },
    after: { reply_status, sesizare_status: sesizareStatus },
    metadata: { applied_to_sesizare: apply_to_sesizare },
  });

  return NextResponse.json({ ok: true, sesizareStatus });
}
