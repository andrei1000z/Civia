/**
 * POST /api/admin/inbox/reclassify
 *
 * 2026-05-29 — Re-clasifică TOATE răspunsurile existente din sesizare_replies
 * folosind noua logică din classify.ts (deterministic pre-classifier +
 * mojibake recovery + extended patterns).
 *
 * Toate intrările cu ai_status='necunoscut' și ai_confidence=0 sunt
 * candidați primari, dar opțional `--all` re-rulează pe toate.
 *
 * Admin-only. Body: { all?: boolean, limit?: number }.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { classifyReply } from "@/lib/inbox/classify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReplyRow {
  id: string;
  subject: string | null;
  body_text: string | null;
  from_email: string | null;
  from_name: string | null;
  authority_name: string | null;
  trusted_sender: boolean | null;
  ai_input_text: string | null;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { all?: boolean; limit?: number };
  const all = body.all === true;
  const limit = Math.min(200, Math.max(1, body.limit ?? 100));

  const admin = createSupabaseAdmin();
  let q = admin
    .from("sesizare_replies")
    .select("id, subject, body_text, from_email, from_name, authority_name, trusted_sender, ai_input_text")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (!all) {
    q = q.or("ai_status.eq.necunoscut,ai_confidence.eq.0");
  }
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (rows ?? []) as ReplyRow[];
  const results = {
    total: items.length,
    reclassified: 0,
    changed: 0,
    by_status: {} as Record<string, number>,
    by_source: {} as Record<string, number>,
    errors: 0,
  };

  // Process serial — Groq has rate limits and we want predictable cost
  for (const row of items) {
    try {
      const cls = await classifyReply({
        subject: row.subject,
        body: row.ai_input_text || row.body_text,
        sender_name: row.authority_name ?? row.from_name ?? row.from_email,
        authority_hint: row.authority_name,
        trusted_sender: row.trusted_sender === true,
      });
      results.reclassified++;
      results.by_status[cls.status] = (results.by_status[cls.status] ?? 0) + 1;
      results.by_source[cls.source ?? "unknown"] = (results.by_source[cls.source ?? "unknown"] ?? 0) + 1;

      const { error: upErr } = await admin
        .from("sesizare_replies")
        .update({
          ai_status: cls.status,
          ai_confidence: cls.confidence,
          ai_nr_inregistrare: cls.nr_inregistrare,
          ai_summary: cls.summary,
          ai_deadline: cls.deadline,
          ai_suggested_action: cls.suggested_action,
          ai_raw_response: cls.raw ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) {
        results.errors++;
      } else {
        results.changed++;
      }
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
