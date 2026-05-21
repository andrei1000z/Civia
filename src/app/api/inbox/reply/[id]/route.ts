import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  user_confirmed: z.boolean(),
  user_corrected_status: z
    .enum([
      "inregistrata", "in-lucru", "rezolvat",
      "redirectionata", "respins", "cerere_informatii",
    ])
    .optional()
    .nullable(),
});

/**
 * PATCH /api/inbox/reply/[id]
 *
 * Owner can confirm or correct an AI classification on a received reply.
 *   { user_confirmed: true }                              → marchez ca ok
 *   { user_confirmed: false, user_corrected_status: X }   → corectat
 *
 * Side-effects:
 *   - Dacă a corectat, update sesizari.status la noua valoare + timeline event.
 *   - Salvăm corectarea în DB pentru a îmbunătăți AI ulterior (training data).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const rl = await rateLimitAsync(`reply-patch:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe modificări" }, { status: 429 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalid" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Confirm ownership of the sesizare attached to this reply
  const { data: replyRow, error: rerr } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, ai_status, ai_nr_inregistrare")
    .eq("id", id)
    .maybeSingle();
  if (rerr || !replyRow) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }
  const { data: ses } = await admin
    .from("sesizari")
    .select("id, user_id, status")
    .eq("id", replyRow.sesizare_id)
    .maybeSingle();
  if (!ses || ses.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {
    user_confirmed: parsed.data.user_confirmed,
  };
  if (parsed.data.user_corrected_status !== undefined) {
    updates.user_corrected_status = parsed.data.user_corrected_status;
  }
  const { error: upErr } = await admin
    .from("sesizare_replies")
    .update(updates)
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // If user corrected to a new status, apply it on sesizari + timeline
  const finalStatus = parsed.data.user_corrected_status ?? (parsed.data.user_confirmed ? replyRow.ai_status : null);
  if (finalStatus && finalStatus !== ses.status) {
    const sesUpdates: Record<string, unknown> = { status: finalStatus };
    if (replyRow.ai_nr_inregistrare) sesUpdates.nr_inregistrare = replyRow.ai_nr_inregistrare;
    await admin.from("sesizari").update(sesUpdates).eq("id", ses.id);
    await admin.from("sesizare_timeline").insert({
      sesizare_id: ses.id,
      event_type: finalStatus as string,
      description: `Status actualizat de utilizator dupa confirmarea unui raspuns oficial.`,
      created_by: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
