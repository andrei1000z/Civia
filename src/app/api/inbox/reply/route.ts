import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { extractSesizareCode } from "@/lib/inbox/extract-code";
import { matchReply, type MatchMethod, type MatchConfidence } from "@/lib/inbox/match-reply";
import { decodeEmailSubject, repairMojibake } from "@/lib/inbox/decode-mime";
import { computeStatusUpdate } from "@/lib/inbox/status-from-reply";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { timelineEventForStatus, type SesizareStatus } from "@/lib/sesizari/status";
import { identifySender } from "@/lib/inbox/sender-identity";
import { classifyReply } from "@/lib/inbox/classify";
import { scoreAuthenticity, shouldAutoApplyEnhanced } from "@/lib/inbox/authenticity";
import { sendPushToUsers } from "@/lib/push/web-push-client";
import { getClientIp } from "@/lib/ratelimit";
import { fetchR2Object } from "@/lib/inbox/r2-client";
import { extractAttachment, type AttachmentExtractionResult } from "@/lib/inbox/attachment-extractors";

export const dynamic = "force-dynamic";
// 2026-05-27 — bump 30s → 60s pentru attachment extraction (OCR PDF scanat
// poate dura 5-15s per atașament; cu 3 atașamente atingem 45s).
export const maxDuration = 60;

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
        // 2026-05-27 — Cloudflare Worker v4 încarcă conținutul în R2 și
        // trimite cheia. Backend-ul fetch-uiește bytes pentru extracție.
        r2_key: z.string().max(500).optional().nullable(),
      }),
    )
    .optional()
    .default([]),
  // 2026-05-27 v3 — worker now sends Message-ID + threading headers explicit
  message_id: z.string().max(1000).optional().nullable(),
  in_reply_to: z.string().max(1000).optional().nullable(),
  references: z.string().max(5000).optional().nullable(),
  auth_results: z.string().max(2000).optional().nullable(),
});

// Route version marker (helps confirm which build is deployed)
// v2 = with authenticity scoring (5/21/2026)
// v3 = with dedup + threading + auto-reply guard (5/27/2026)
const ROUTE_VERSION = "inbox-reply-v3";

/** Normalize Message-ID — strip <>, lowercase domain part, RFC 5322 §3.6.4. */
function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^<|>$/g, "");
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

/** RFC 3834 auto-reply detection. Returnează motivul sau null. */
function detectAutoReply(headers: Record<string, string>, from: string): string | null {
  const h = (k: string) => (headers[k] || headers[k.toLowerCase()] || "").toLowerCase();
  // Auto-Submitted ≠ no (RFC 3834)
  const autoSubmitted = h("auto-submitted").trim();
  if (autoSubmitted && autoSubmitted !== "no") return `auto-submitted:${autoSubmitted}`;
  // Precedence: bulk|list|junk|auto_reply
  if (/(bulk|list|junk|auto_reply)/.test(h("precedence"))) return `precedence:${h("precedence")}`;
  if (/(bulk|list|junk|auto_reply)/.test(h("x-precedence"))) return `x-precedence:${h("x-precedence")}`;
  // X-Auto-Response-Suppress (Exchange)
  if (/\b(all|autoreply|oof|dr)\b/.test(h("x-auto-response-suppress"))) {
    return "x-auto-response-suppress";
  }
  // X-Autorespond / X-Autoreply (Exim/cPanel)
  if (headers["x-autorespond"] || headers["x-autoreply"]) return "x-autorespond";
  // From: mailer-daemon | postmaster | noreply
  if (/mailer-daemon|postmaster|^noreply@|^no-reply@|bounce[s]?@/i.test(from)) {
    return "mailer-daemon";
  }
  // Return-Path: <> (bounce envelope)
  if (/<>/.test(h("return-path"))) return "return-path-empty";
  return null;
}

/** Self-forward detection — email is one of OUR sent emails forwarded back. */
function detectSelfForward(subject: string, body: string, from: string): boolean {
  const isFwd = /^(fw|fwd|re:\s*fw|re:\s*fwd):/i.test(subject);
  const containsCiviaMailto = /mailto:sesizari@civia\.ro|sesizari@civia\.ro/i.test(body);
  if (isFwd && containsCiviaMailto) return true;
  // Echo from civia.ro domain
  if (/@civia\.ro\b/i.test(from)) return true;
  return false;
}

export async function POST(req: Request) {
  void ROUTE_VERSION;
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
  if (!verifyBearer(auth, secret)) {
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
  const { from, to, headers, attachments } = parsed.data;
  // 2026-06-05 — Decodare CORECTĂ inbound (bug raportat: subiecte + body
  // corupte de la autorități). Subiectul: RFC 2047 din raw header (recuperabil
  // 100%). Body: reparare mojibake „UTF-8 citit ca Latin-1". Tot ce urmează
  // (extract-code, classify, store) folosește versiunile curate.
  const subject = decodeEmailSubject(parsed.data.subject, headers);
  const body_text = repairMojibake(parsed.data.body_text);
  const body_html = repairMojibake(parsed.data.body_html);

  // 2026-05-27 v3 — Extract Message-ID din payload OR headers fallback
  const messageId = normalizeMessageId(parsed.data.message_id || headers["message-id"]);
  const inReplyTo = normalizeMessageId(parsed.data.in_reply_to || headers["in-reply-to"]);
  const referencesChain = (parsed.data.references || headers["references"] || "").toLowerCase().trim() || null;

  // ─── 2.5 PRE-INGEST GUARDS (v3 hardening) ──────────────────────
  // Worker-ul deja filtrează, dar avem aici defense-in-depth în caz că
  // worker-ul nu se updateaza (backward compat) sau cineva apelează direct.

  // A. Auto-reply guard (RFC 3834)
  const autoReplyReason = detectAutoReply(headers, from);
  if (autoReplyReason) {
    try {
      await admin.from("inbox_filter_log").insert({
        from_email: from.toLowerCase().slice(0, 200),
        subject: subject?.slice(0, 500) ?? null,
        filter_reason: `auto-reply:${autoReplyReason}`,
        worker_version: req.headers.get("user-agent") ?? null,
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, note: "auto-reply-filtered", reason: autoReplyReason });
  }

  // B. Self-forward guard
  const cleanBodyForFilter = body_text || body_html || "";
  if (detectSelfForward(subject || "", cleanBodyForFilter, from)) {
    try {
      await admin.from("inbox_filter_log").insert({
        from_email: from.toLowerCase().slice(0, 200),
        subject: subject?.slice(0, 500) ?? null,
        filter_reason: "self-forward",
        worker_version: req.headers.get("user-agent") ?? null,
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, note: "self-forward-filtered" });
  }

  // B2. 2026-06-05 — Răspuns la o PROPUNERE legislativă (sesizari+prop@) — nu e
  // răspuns la o sesizare. Îl filtrăm ca să nu apară ca „necunoscut" în inbox-ul
  // de sesizări.
  if (/sesizari\+prop@/i.test(to)) {
    try {
      await admin.from("inbox_filter_log").insert({
        from_email: from.toLowerCase().slice(0, 200),
        subject: subject?.slice(0, 500) ?? null,
        filter_reason: "propunere-reply",
        worker_version: req.headers.get("user-agent") ?? null,
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, note: "propunere-reply-filtered" });
  }

  // C. Dedup pe Message-ID (RFC 5322 §3.6.4)
  if (messageId) {
    const { data: existing } = await admin
      .from("sesizare_replies")
      .select("id")
      .eq("message_id", messageId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, note: "duplicate-message-id", existing_id: existing.id });
    }
  }

  // Success path — log at the end (after processing) with status 200.

  // ─── 3. Extract code ────────────────────────────────────────────
  // 2026-05-24: include headers — In-Reply-To / References permite recover-ul
  // codului când subject e generic („Informare", „Confirmare primire").
  const extraction = extractSesizareCode({
    to,
    subject,
    body: body_text || stripHtml(body_html),
    headers,
  });

  // ─── 4. Identify sender ─────────────────────────────────────────
  const sender = identifySender(from);
  const senderEmail = sender?.email ?? from.toLowerCase();

  // ─── 5. Match reply → sesizare ──────────────────────────────────
  // Matching-ul (cascadă 4 niveluri, match-reply.ts) rulează DUPĂ extracția
  // atașamentelor (OCR-ul alimentează Nivelul 4 de scoring). Aici doar declarăm.
  let sesizareId: string | null = null;
  let sesizareUserId: string | null = null;
  let matchMethod: MatchMethod = null;
  let matchConfidence: MatchConfidence = null;
  let matchedCode: string | null = null; // codul sesizării matchuite (pt. push/URL)

  // ─── 5.5 Extract text din atașamente (PDF, DOCX, imagini) ──────
  // 2026-05-27 — Înainte primăriile răspundeau cu PDF atașat și body
  // email gol → AI nu vedea nimic → confidence mică, status „necunoscut".
  // Acum: pentru fiecare atașament fetch-uim bytes din R2 + rulăm
  // extractor specializat (unpdf pentru PDF text-native, Gemini Vision
  // pentru PDF scanat / imagini, mammoth pentru DOCX). Concat la body.
  //
  // Concurrency: Promise.all paralel per atașament. Timeout 30s/file
  // gestionat în extractor. Pe failure individual marcăm și continuăm.
  const cleanBody = body_text || stripHtml(body_html) || "";
  const extractionResults: Array<{
    filename: string;
    content_type: string;
    size: number;
    r2_key: string | null;
    result: AttachmentExtractionResult;
  }> = [];

  if (attachments.length > 0) {
    const extractedTexts = await Promise.all(
      attachments.map(async (att) => {
        const filename = att.filename ?? "unknown";
        const contentType = att.content_type ?? "application/octet-stream";
        const size = att.size ?? 0;
        const r2Key = att.r2_key ?? null;

        if (!r2Key) {
          return {
            filename,
            content_type: contentType,
            size,
            r2_key: null,
            result: {
              extracted_text: null,
              extraction_method: "skipped" as const,
              extraction_ms: 0,
              extraction_error: "no r2_key — worker did not upload content",
            },
          };
        }

        const bytes = await fetchR2Object(r2Key);
        if (!bytes) {
          return {
            filename,
            content_type: contentType,
            size,
            r2_key: r2Key,
            result: {
              extracted_text: null,
              extraction_method: "failed" as const,
              extraction_ms: 0,
              extraction_error: "R2 fetch failed (network or 404)",
            },
          };
        }

        const result = await extractAttachment({
          bytes,
          contentType,
          filename,
        });

        return {
          filename,
          content_type: contentType,
          size,
          r2_key: r2Key,
          result,
        };
      }),
    );

    extractionResults.push(...extractedTexts);
  }

  // Concat textele extrase la cleanBody → ai_input_text trimis la classifyReply.
  const attachmentTextParts: string[] = [];
  for (const e of extractionResults) {
    if (e.result.extracted_text) {
      attachmentTextParts.push(
        `\n\n[ATAȘAT: ${e.filename}]\n${e.result.extracted_text}`,
      );
    }
  }
  const aiInputText = cleanBody + attachmentTextParts.join("");

  // ─── 5b. Match reply → sesizare (cascadă 4 niveluri, vezi match-reply.ts) ──
  // N1 token (Reply-To) → N2 threading (Message-ID) → N3 cod → N4 domeniu/
  // conținut/AI (DOAR pe candidați eligibili). replyText include OCR + nume
  // fișiere pentru scoringul de adresă.
  {
    const filenames = extractionResults.map((e) => e.filename).join(" ");
    const m = await matchReply({
      to,
      extractedCode: extraction.code,
      inReplyTo,
      referencesChain,
      fromEmail: senderEmail,
      replyText: `${subject || ""} ${aiInputText} ${filenames}`,
      receivedAt: new Date().toISOString(),
      admin,
    });
    sesizareId = m.sesizareId;
    matchMethod = m.method;
    matchConfidence = m.confidence;
    matchedCode = m.code;
    if (sesizareId) {
      const { data: ses } = await admin.from("sesizari").select("user_id").eq("id", sesizareId).maybeSingle();
      sesizareUserId = (ses?.user_id as string | null) ?? null;
    }
  }

  // ─── 6. Classify + authenticity score (parallel for latency) ────
  // 2026-05-29 — trusted_sender pasat la classifier ca să poată folosi
  // signals de tip „subject Sesizare X de la PMB = inregistrata cu 85%"
  // chiar și fără pattern explicit în body.
  const trustedSender = sender !== null;
  const [classification, authenticity] = await Promise.all([
    classifyReply({
      subject,
      body: aiInputText, // ← acum include textele extrase din atașamente
      sender_name: sender?.authority_name ?? sender?.email,
      authority_hint: sender?.authority_name,
      trusted_sender: trustedSender,
    }),
    scoreAuthenticity({
      from,
      subject: subject || "",
      body_text: cleanBody, // authenticity rămâne pe body original (semnale tehnice)
      headers,
      received_at: new Date().toISOString(),
    }),
  ]);

  // ─── 7. Decide auto-apply with combined signals ─────────────────
  // Enhanced 5/21/2026: nu mai depindem doar de trusted_sender (whitelist
  // de domenii) — folosim authenticity_score care combina semnale tehnice
  // (AUTH catalog, DKIM/SPF, gov TLD) cu analiza semantica AI (formal
  // limbaj, semnatura institutionala, referinte juridice).
  // Auto-apply pe status DOAR la matching ÎNALTĂ (determinist: token/threading/
  // cod, sau fuzzy clar: domeniu unic / scor adresă ≥3). MEDIE = sugestie: reply
  // legat de sesizare dar statusul NU se schimbă automat (intră în review).
  const autoApply = sesizareId !== null && matchConfidence === "high" && shouldAutoApplyEnhanced({
    classification_confidence: classification.confidence,
    classification_status: classification.status,
    authenticity_score: authenticity.score,
    is_spam: classification.is_spam,
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
      // 2026-05-27 — attachments JSONB îmbogățit cu extracted_text, method, ms.
      // Format vechi (filename, content_type, size) pentru emailuri fără
      // atașamente sau în lipsa extracției (fallback la schema 057).
      attachments: extractionResults.length > 0
        ? extractionResults.map((e) => ({
            filename: e.filename,
            content_type: e.content_type,
            size: e.size,
            r2_key: e.r2_key,
            extracted_text: e.result.extracted_text,
            extraction_method: e.result.extraction_method,
            extraction_ms: e.result.extraction_ms,
            extraction_error: e.result.extraction_error,
          }))
        : (attachments.length > 0 ? attachments : null),
      // 2026-05-27 — ai_input_text: textul exact pasat la classifyReply
      // (body + textele extrase). Permite re-classify fără re-extract.
      ai_input_text: aiInputText || null,
      // 2026-05-27 v3 — RFC 5322 §3.6.4 headers extras pentru dedup + threading
      message_id: messageId,
      in_reply_to: inReplyTo,
      references_chain: referencesChain,
      match_method: matchMethod,
      ai_status: classification.status,
      ai_confidence: classification.confidence,
      ai_summary: classification.summary,
      ai_nr_inregistrare: classification.nr_inregistrare,
      ai_deadline: classification.deadline,
      ai_suggested_action: classification.suggested_action,
      ai_raw_response: classification.raw ?? null,
      ai_authenticity_score: authenticity.score,
      ai_authenticity_reasoning: authenticity.reasoning,
      ai_authenticity_signals: {
        signals: authenticity.signals,
        ai_score: authenticity.ai_score,
        technical_score: authenticity.technical_score,
      },
      auto_applied: autoApply,
      trusted_sender: sender?.trusted ?? false,
      // user_confirmed=true cand auto-applied (skip confirmation step
      // pentru ca AI a verificat deja autenticitatea). User poate
      // CORRIGE clasificarea daca crede ca AI a greșit.
      user_confirmed: autoApply ? true : null,
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
    // Citim statusul curent pentru guard-ul forward-only.
    const { data: cur } = await admin
      .from("sesizari")
      .select("status, author_email, titlu")
      .eq("id", sesizareId)
      .maybeSingle();
    const updates = computeStatusUpdate({
      currentStatus: (cur?.status as string | undefined) ?? "nou",
      aiStatus: classification.status,
      nrInregistrare: classification.nr_inregistrare,
      summary: classification.summary,
      at: new Date().toISOString(),
    });

    if (updates) {
      const { error: updateErr } = await admin
        .from("sesizari")
        .update(updates)
        .eq("id", sesizareId);
      if (updateErr) {
        Sentry.captureMessage("inbox/reply: status auto-apply failed", {
          level: "warning",
          extra: { error: updateErr.message, sesizare_id: sesizareId, newStatus: updates.status },
        });
      } else {
        // 2026-06-10 — FIX (audit statusuri): scrie eventul de status în
        // timeline. Înainte, codul se baza pe un trigger DB „on status update"
        // care NU EXISTĂ → statusurile aplicate de AI (inregistrata/in-lucru/
        // rezolvat/redirectionata) nu produceau niciun rând în timeline
        // (00057/00056/00055/00054 aveau status dar timeline gol). appendTimelineEvent
        // face dedup pe ultimul rând, deci nu reintroduce spam-ul de duplicate care
        // a motivat ștergerea originală. Notificările rămân separate (push + email mai jos).
        try {
          const tlEvent = timelineEventForStatus(updates.status as SesizareStatus);
          if (tlEvent) {
            await appendTimelineEvent({
              admin,
              sesizareId,
              eventType: tlEvent,
              description: classification.summary?.slice(0, 200) ?? null,
              sentryTags: { source: "inbox_reply_status" },
            });
          }
        } catch (e) {
          Sentry.captureException(e, { tags: { route: "inbox.reply", kind: "timeline_write_failed" } });
        }

        // 2026-06-08 — Notificare EMAIL către autor când statusul avansează
        // (pe lângă push). Best-effort, nu blochează răspunsul webhook-ului.
        const authorEmail = (cur as { author_email?: string | null } | null)?.author_email;
        if (authorEmail) {
          try {
            const { buildStatusUpdateEmail } = await import("@/lib/email/status-update");
            const { sendEmail } = await import("@/lib/email/resend");
            const { subject, html } = buildStatusUpdateEmail({
              code: matchedCode ?? extraction.code ?? "",
              titlu: (cur as { titlu?: string | null } | null)?.titlu ?? null,
              newStatus: updates.status,
              summary: classification.summary,
              authorName: (cur as { author_name?: string | null } | null)?.author_name ?? null,
              authorEmail,
              imagini: (cur as { imagini?: string[] | null } | null)?.imagini ?? null,
              resolvedPhotos: (cur as { resolved_photos?: string[] | null } | null)?.resolved_photos ?? null,
            });
            await sendEmail({ to: authorEmail, subject, html });
          } catch (e) {
            Sentry.captureException(e, { tags: { route: "inbox.reply", kind: "status_email_failed" } });
          }
        }

        // roadmap Faza 0 — CELEBRAREA VICTORIEI: la rezolvare, email festiv către
        // co-semnatari („Ai contribuit — problema e gata"). Best-effort.
        if (updates.status === "rezolvat") {
          try {
            const { buildVictoryEmail } = await import("@/lib/email/status-update");
            const { sendEmail } = await import("@/lib/email/resend");
            const { data: cosigns } = await admin
              .from("sesizare_cosigners")
              .select("email, user_id")
              .eq("sesizare_id", sesizareId);
            const emails = new Set<string>();
            for (const c of (cosigns ?? []) as { email: string | null }[]) {
              if (c.email) emails.add(c.email.toLowerCase());
            }
            const uids = ((cosigns ?? []) as { user_id: string | null }[]).map((c) => c.user_id).filter((u): u is string => !!u);
            if (uids.length > 0) {
              const { data: profs } = await admin.from("profiles").select("email").in("id", uids);
              for (const p of (profs ?? []) as { email: string | null }[]) if (p.email) emails.add(p.email.toLowerCase());
            }
            const authorEmailLc = (cur as { author_email?: string | null } | null)?.author_email?.toLowerCase();
            if (authorEmailLc) emails.delete(authorEmailLc); // autorul a primit deja emailul de status
            if (emails.size > 0) {
              const { subject: vSubject, html: vHtml } = buildVictoryEmail({
                code: matchedCode ?? extraction.code ?? "",
                titlu: (cur as { titlu?: string | null } | null)?.titlu ?? null,
                imagini: (cur as { imagini?: string[] | null } | null)?.imagini ?? null,
                resolvedPhotos: (cur as { resolved_photos?: string[] | null } | null)?.resolved_photos ?? null,
              });
              await Promise.allSettled([...emails].slice(0, 100).map((e) => sendEmail({ to: e, subject: vSubject, html: vHtml })));
            }
          } catch (e) {
            Sentry.captureException(e, { tags: { route: "inbox.reply", kind: "victory_email_failed" } });
          }
        }
      }
      // Eventul de status în timeline e scris mai sus (după update reușit),
      // prin appendTimelineEvent (cu dedup). AI summary cu detalii rămâne și în
      // sesizare_replies.ai_summary, vizibil pe pagina detail în secțiunea
      // „Răspunsuri primite". (Istoric 5/21/2026: scrierea fără dedup cauza spam
      // de event-uri duplicate — dedup-ul din appendTimelineEvent rezolvă asta.)
    }
  }

  // ─── 9. Push notification — autor + cosigners ───────────────────
  // 2026-05-25 — Extins la cosigners: cei care au „trimis și ei" sesizarea
  // (sesizare_cosigners cu user_id NOT NULL) primesc același push.
  if (sesizareId && !classification.is_spam) {
    const emoji = classification.status === "rezolvat" ? "🎉"
      : classification.status === "inregistrata" ? "📨"
      : classification.status === "in-lucru" ? "🛠️"
      : classification.status === "respins" ? "⚠️"
      : "📬";

    // Construiesc lista de destinatari: autor + cosigners autentificați.
    const recipients = new Set<string>();
    if (sesizareUserId) recipients.add(sesizareUserId);
    try {
      const { data: cosigns } = await admin
        .from("sesizare_cosigners")
        .select("user_id")
        .eq("sesizare_id", sesizareId)
        .not("user_id", "is", null);
      for (const c of (cosigns ?? []) as { user_id: string | null }[]) {
        if (c.user_id) recipients.add(c.user_id);
      }
    } catch {
      // Best-effort — fallback la doar autor.
    }

    if (recipients.size > 0) {
      try {
        // audit fix: folosește codul sesizării MATCHUITE (matchedCode), nu
        // extraction.code care e deseori null când match-ul vine din token/
        // threading/conținut → înainte „Sesizarea null" + URL /sesizari/null.
        const pushCode = matchedCode ?? extraction.code;
        await sendPushToUsers([...recipients], {
          title: `${emoji} Sesizarea ${pushCode} — ${classification.status === "rezolvat" ? "Rezolvată" : classification.status === "inregistrata" ? "Înregistrată" : classification.status === "in-lucru" ? "În lucru" : "Răspuns primit"}`,
          body: classification.summary,
          url: `/sesizari/${pushCode}`,
          tag: `reply-${pushCode}-${replyRow?.id ?? "x"}`,
        });
      } catch (e) {
        Sentry.captureException(e, {
          tags: { route: "inbox.reply", kind: "push_failed" },
          extra: { recipients_count: recipients.size, code: extraction.code },
        });
      }
    }
  }

  await logDebug({
    admin, req, http_status: 200, rawBody,
    error_message: `OK | code=${extraction.code ?? "NULL"} | match=${matchMethod ?? "none"}/${matchConfidence ?? "-"} | sesizare=${sesizareId?.slice(0, 8) ?? "NOMATCH"} | ai=${classification.status} | conf=${classification.confidence} | auto=${autoApply}`,
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
