import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { extractSesizareCode } from "@/lib/inbox/extract-code";
import { identifySender } from "@/lib/inbox/sender-identity";
import { classifyReply, shouldAutoApply } from "@/lib/inbox/classify";
import { sendPushToUsers } from "@/lib/push/web-push-client";
import { getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function logDebug(opts: {
  admin: ReturnType<typeof createSupabaseAdmin>;
  req: Request;
  http_status: number;
  rawBody: string | null;
  error_message?: string | null;
}) {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of opts.req.headers.entries()) {
      const kl = k.toLowerCase();
      // Skip cookies. Keep authorization but redact value (we want to
      // see if it was sent + whether it had a Bearer prefix).
      if (kl === "cookie") continue;
      if (kl === "authorization") {
        headers[k] = v.startsWith("Bearer ")
          ? `Bearer [${v.length - 7} chars]`
          : `[${v.length} chars, no Bearer prefix]`;
        continue;
      }
      headers[k] = v;
    }
    await opts.admin.from("inbox_debug_log").insert({
      endpoint: "reply",
      source: opts.req.headers.get("user-agent") ?? "unknown",
      http_status: opts.http_status,
      request_headers: headers,
      request_body: opts.rawBody?.slice(0, 50_000) ?? null,
      source_ip: getClientIp(opts.req),
      error_message: opts.error_message ?? null,
    });
  } catch {
    // best-effort
  }
}

/**
 * POST /api/inbox/reply
 *
 * Webhook called by the Cloudflare Email Worker when an inbound email
 * arrives at sesizari@civia.ro (with optional +CODE plus-addressing).
 *
 * Auth: Bearer ${INBOX_WEBHOOK_SECRET} (shared secret with Worker)
 *
 * Pipeline:
 *   1. Validate auth header
 *   2. Parse payload (from, to, subject, body_text, body_html)
 *   3. Extract sesizare code (plus-addressing > subject > body)
 *   4. Identify sender authority (trusted/unknown)
 *   5. Classify with AI (Groq Llama 3.3 70B)
 *   6. Save reply row (always, even if unmatched)
 *   7. Auto-apply status if confidence high + trusted sender
 *   8. Push notification to sesizare owner
 *   9. Return 200 (always, so Worker doesn't retry)
 */

const payloadSchema = z.object({
  from: z.string().min(1).max(500),
  to: z.string().min(1).max(500).optional().default(""),
  subject: z.string().max(1000).optional().default(""),
  body_text: z.string().max(50000).optional().default(""),
  body_html: z.string().max(200000).optional().default(""),
  headers: z.record(z.string(), z.string()).optional().default({}),
  attachments: z
    .array(
      z.object({
        filename: z.string().max(500).optional(),
        content_type: z.string().max(200).optional(),
        size: z.number().optional(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: Request) {
  // Capture body upfront so we can log it even if downstream fails.
  let rawBody: string | null = null;
  try {
    rawBody = await req.text();
  } catch {
    /* network reset */
  }
  const admin = createSupabaseAdmin();

  // ─── 1. Auth ────────────────────────────────────────────────────
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) {
    Sentry.captureMessage("INBOX_WEBHOOK_SECRET not configured", { level: "error" });
    await logDebug({
      admin, req, http_status: 500, rawBody,
      error_message: "INBOX_WEBHOOK_SECRET missing on server",
    });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    await logDebug({
      admin, req, http_status: 401, rawBody,
      error_message: `Auth header mismatch. Got: ${auth ? `${auth.slice(0, 7)}...` : "MISSING"}`,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── 2. Parse payload ───────────────────────────────────────────
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    await logDebug({ admin, req, http_status: 400, rawBody, error_message: "Invalid JSON in body" });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    Sentry.captureMessage("inbox/reply payload invalid", {
      level: "warning",
      extra: { issues: parsed.error.issues },
    });
    await logDebug({
      admin, req, http_status: 400, rawBody,
      error_message: `Schema validation failed: ${JSON.stringify(parsed.error.issues).slice(0, 500)}`,
    });
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const { from, to, subject, body_text, body_html, headers, attachments } = parsed.data;

  // Success path — log at the end (after processing) with status 200.

  // ─── 3. Extract code ────────────────────────────────────────────
  const extraction = extractSesizareCode({
    to,
    subject,
    body: body_text || stripHtml(body_html),
  });

  // ─── 4. Identify sender ─────────────────────────────────────────
  const sender = identifySender(from);
  const senderEmail = sender?.email ?? from.toLowerCase();

  // ─── 5. Look up sesizare ────────────────────────────────────────
  let sesizareId: string | null = null;
  let sesizareUserId: string | null = null;
  let sesizareTitlu: string | null = null;
  if (extraction.code) {
    const { data: ses } = await admin
      .from("sesizari")
      .select("id, user_id, titlu, status")
      .eq("code", extraction.code)
      .maybeSingle();
    if (ses) {
      sesizareId = ses.id as string;
      sesizareUserId = (ses.user_id as string | null) ?? null;
      sesizareTitlu = (ses.titlu as string | null) ?? null;
    }
  }

  // ─── 6. Classify with AI ────────────────────────────────────────
  const cleanBody = body_text || stripHtml(body_html) || "";
  const classification = await classifyReply({
    subject,
    body: cleanBody,
    sender_name: sender?.authority_name ?? sender?.email,
    authority_hint: sender?.authority_name,
  });

  // ─── 7. Save reply row ──────────────────────────────────────────
  const autoApply = sesizareId !== null && shouldAutoApply({
    classification,
    trusted_sender: sender?.trusted ?? false,
  });

  const { data: replyRow, error: insertErr } = await admin
    .from("sesizare_replies")
    .insert({
      sesizare_id: sesizareId,
      from_email: senderEmail,
      from_name: extractFromName(from),
      authority_id: sender?.authority_id ?? null,
      authority_name: sender?.authority_name ?? null,
      subject: subject || null,
      body_text: cleanBody || null,
      body_html: body_html || null,
      raw_headers: headers,
      attachments: attachments.length > 0 ? attachments : null,
      ai_status: classification.status,
      ai_confidence: classification.confidence,
      ai_summary: classification.summary,
      ai_nr_inregistrare: classification.nr_inregistrare,
      ai_deadline: classification.deadline,
      ai_suggested_action: classification.suggested_action,
      ai_raw_response: classification.raw ?? null,
      auto_applied: autoApply,
      trusted_sender: sender?.trusted ?? false,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    Sentry.captureMessage("inbox/reply: failed to insert", {
      level: "error",
      extra: { error: insertErr.message, code: extraction.code, from: senderEmail },
    });
    // Return 200 anyway — Cloudflare Worker would retry if we 5xx,
    // creating duplicate processing risk.
    return NextResponse.json({ ok: false, error: "DB insert failed" });
  }

  // ─── 8. Auto-apply status if eligible ───────────────────────────
  if (autoApply && sesizareId) {
    const newStatus = classification.status === "inregistrata" ? "inregistrata"
      : classification.status === "in-lucru" ? "in-lucru"
      : classification.status === "rezolvat" ? "rezolvat"
      : classification.status === "redirectionata" ? "redirectionata"
      : null;

    if (newStatus) {
      const updates: Record<string, string | null> = { status: newStatus };
      if (classification.nr_inregistrare) {
        updates.nr_inregistrare = classification.nr_inregistrare;
      }
      const { error: updateErr } = await admin
        .from("sesizari")
        .update(updates)
        .eq("id", sesizareId);
      if (updateErr) {
        Sentry.captureMessage("inbox/reply: status auto-apply failed", {
          level: "warning",
          extra: { error: updateErr.message, sesizare_id: sesizareId, newStatus },
        });
      } else {
        // Timeline event
        await admin.from("sesizare_timeline").insert({
          sesizare_id: sesizareId,
          event_type: newStatus,
          description: `${sender?.authority_name ?? "Autoritatea"}: ${classification.summary}`,
        });
      }
    }
  }

  // ─── 9. Push notification ───────────────────────────────────────
  if (sesizareUserId && sesizareId && !classification.is_spam) {
    const emoji = classification.status === "rezolvat" ? "🎉"
      : classification.status === "inregistrata" ? "✅"
      : classification.status === "in-lucru" ? "🛠️"
      : classification.status === "respins" ? "⚠️"
      : "📬";
    try {
      await sendPushToUsers([sesizareUserId], {
        title: `${emoji} Răspuns primit la sesizarea ${extraction.code}`,
        body: classification.summary,
        url: `/sesizari/${extraction.code}`,
        tag: `reply-${extraction.code}-${replyRow?.id ?? "x"}`,
      });
    } catch (e) {
      Sentry.captureException(e, {
        tags: { route: "inbox.reply", kind: "push_failed" },
        extra: { user_id: sesizareUserId, code: extraction.code },
      });
    }
  }

  await logDebug({
    admin, req, http_status: 200, rawBody,
    error_message: `OK | code=${extraction.code ?? "NULL"} | source=${extraction.source} | sesizare=${sesizareId?.slice(0, 8) ?? "NOMATCH"} | ai=${classification.status} | conf=${classification.confidence} | auto=${autoApply}`,
  });

  return NextResponse.json({
    ok: true,
    code: extraction.code,
    code_source: extraction.source,
    sesizare_id: sesizareId,
    classification: {
      status: classification.status,
      confidence: classification.confidence,
      auto_applied: autoApply,
    },
    sender: {
      trusted: sender?.trusted ?? false,
      authority_id: sender?.authority_id ?? null,
    },
    reply_id: replyRow?.id ?? null,
  });
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractFromName(fromHeader: string): string | null {
  // "Name <email>" → "Name"; bare email → null
  const m = fromHeader.match(/^([^<]+?)\s*<[^>]+>$/);
  if (m?.[1]) return m[1].trim().replace(/^"|"$/g, "");
  return null;
}
