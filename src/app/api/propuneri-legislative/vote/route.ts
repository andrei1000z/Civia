/**
 * POST /api/propuneri-legislative/vote
 *
 * Susține o propunere legislativă.
 * - User autentificat: 1 vot per propunere (unique constraint pe user_id)
 * - Anonim: 1 vot per IP hash per propunere (rate limit strict)
 *
 * La atingerea VOTE_THRESHOLD_SEND → trimitere automată email la autoritate.
 *
 * Returns: { ok, new_count, sent? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import {
  AUTHORITIES,
  VOTE_THRESHOLD_SEND,
  VOTE_THRESHOLD_PRESS,
} from "@/lib/propuneri-legislative/authorities";
import {
  buildAuthorityEmail,
} from "@/lib/propuneri-legislative/email-template";
import { sendEmail } from "@/lib/email/resend";
import type { LegislativeFormalResult } from "@/lib/propuneri-legislative/prompts";

export const dynamic = "force-dynamic";

const schema = z.object({
  propunere_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`prop-leg-vote:${ip}`, { limit: 20, windowMs: 3_600_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe voturi" }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalid" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  const { propunere_id } = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createSupabaseAdmin();

  // ── Verifică propunerea ─────────────────────────────────────────────────────
  const { data: propunere } = await admin
    .from("propuneri_legislative")
    .select("id, titlu, status, votes_count, destinatar_key, ai_formal_text, author_display_name, sent_at")
    .eq("id", propunere_id)
    .eq("status", "active")
    .maybeSingle();

  if (!propunere) {
    return NextResponse.json({ error: "Propunere inexistentă sau inactivă" }, { status: 404 });
  }

  // ── Insert vot (cu dedup) ───────────────────────────────────────────────────
  const anonHash = createHash("sha256")
    .update((process.env.PHONE_HASH_SALT ?? "civia-salt") + ip)
    .digest("hex");

  const votePayload: Record<string, string | null> = {
    propunere_id,
    user_id: user?.id ?? null,
    anon_hash: user ? null : anonHash,
  };

  const { error: voteError } = await admin
    .from("propuneri_votes")
    .insert(votePayload);

  if (voteError) {
    // Unique constraint violation = deja votat
    if (voteError.code === "23505") {
      return NextResponse.json({ error: "Ai susținut deja această propunere" }, { status: 409 });
    }
    return NextResponse.json({ error: "Eroare vot" }, { status: 500 });
  }

  // Re-fetch count după trigger
  const { data: updated } = await admin
    .from("propuneri_legislative")
    .select("votes_count")
    .eq("id", propunere_id)
    .single();

  const newCount = (updated as { votes_count: number } | null)?.votes_count ?? 0;

  // ── Trimitere automată la autoritate la prag ────────────────────────────────
  let sent = false;
  const prop = propunere as {
    id: string; titlu: string; votes_count: number; destinatar_key: string;
    ai_formal_text: string | null; author_display_name: string | null; sent_at: string | null;
  };

  if (newCount >= VOTE_THRESHOLD_SEND && !prop.sent_at) {
    const authority = AUTHORITIES[prop.destinatar_key];
    if (authority && prop.ai_formal_text) {
      try {
        const formal = JSON.parse(prop.ai_formal_text) as LegislativeFormalResult;
        const { subject, html, text } = buildAuthorityEmail({
          propunereId: prop.id,
          authority,
          titlu: prop.titlu,
          formal,
          votesCount: newCount,
          authorName: prop.author_display_name ?? undefined,
        });

        const emailResult = await sendEmail({
          to: authority.email,
          ...(authority.emailCC ? { cc: authority.emailCC } : {}),
          subject,
          html,
          text,
          replyTo: "sesizari@civia.ro",
        });

        if (emailResult.ok) {
          await admin
            .from("propuneri_legislative")
            .update({ sent_at: new Date().toISOString(), status: "sent" })
            .eq("id", propunere_id);
          sent = true;
        }
      } catch (e) {
        console.error("[propuneri-legislative] Auto-send error:", e);
      }
    }
  }

  // La 500 voturi → notificare presă (placeholder — log pentru acum)
  if (newCount >= VOTE_THRESHOLD_PRESS && !prop.sent_at) {
    console.log(`[propuneri-legislative] 🗞️ ${prop.id} a atins ${newCount} voturi — notificare presă TODO`);
  }

  return NextResponse.json({ ok: true, new_count: newCount, sent });
}
