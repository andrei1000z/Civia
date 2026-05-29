/**
 * POST /api/cron/sesizari-retry-bounce
 *
 * 2026-05-29 — Auto-retry pe sesizari cu delivery_status='partial_bounced'.
 *
 * Context: Webhook Resend captează per-recipient bounce. Cand 1-2 din 4
 * destinatari fac bounce dar restul primesc, sesizarea e marked
 * 'partial_bounced'. Cetateanul e informat dar emailul NU se retrimite
 * automat. Acest cron rezolva asta.
 *
 * Flow:
 *  1. Query sesizari WHERE delivery_status='partial_bounced'
 *     AND retry_count < 3 AND last_retry_at < NOW() - INTERVAL '4 hours'
 *  2. Pentru fiecare: calculate `pendingRecipients` =
 *     sent_to_emails - bounced_recipients
 *  3. Skip daca pendingRecipients e gol (everyone bounced) sau full
 *     (nimic bounce raportat)
 *  4. Trimite Resend la pendingRecipients
 *  5. Update sesizari.retry_count++ + last_retry_at = NOW()
 *  6. Log retry in scrap tabel sesizari_retries (audit trail)
 *
 * Bearer auth: CRON_SECRET.
 *
 * Schedule: pg_cron `0 / *4 / * / * / *` (la 4h).
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildFromHeader, sanitizeSubject } from "@/lib/email/sanitize-headers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_RETRIES = 3;
const RETRY_COOLDOWN_HOURS = 4;

export async function POST(req: Request) {
  // Bearer auth
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - RETRY_COOLDOWN_HOURS * 3600_000).toISOString();

  // Query candidate sesizari
  const { data: candidates, error } = await admin
    .from("sesizari")
    .select(
      "id, code, titlu, formal_text, author_name, author_email, sent_to_emails, bounced_recipients, retry_count, last_retry_at",
    )
    .eq("delivery_status", "partial_bounced")
    .lt("retry_count", MAX_RETRIES)
    .or(`last_retry_at.is.null,last_retry_at.lt.${cutoff}`)
    .limit(50);

  if (error) {
    Sentry.captureException(error, { tags: { cron: "sesizari-retry-bounce" } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (candidates ?? []) as Array<{
    id: string;
    code: string;
    titlu: string;
    formal_text: string | null;
    author_name: string | null;
    author_email: string | null;
    sent_to_emails: string[] | null;
    bounced_recipients: string[] | null;
    retry_count: number | null;
  }>;

  const resendKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_DEV;
  if (!resendKey) {
    return NextResponse.json({ error: "Resend key missing" }, { status: 500 });
  }
  const resend = new Resend(resendKey);

  const results = {
    total_candidates: items.length,
    retried: 0,
    skipped_no_pending: 0,
    skipped_full_bounce: 0,
    errors: 0,
  };

  for (const sez of items) {
    const sent = new Set((sez.sent_to_emails ?? []).map((e) => e.toLowerCase()));
    const bounced = new Set((sez.bounced_recipients ?? []).map((e) => e.toLowerCase()));
    const pending = [...sent].filter((e) => !bounced.has(e));

    if (pending.length === 0) {
      // Everyone bounced — abandon
      results.skipped_full_bounce++;
      continue;
    }
    if (bounced.size === 0) {
      // No bounce raportat (probabil status update race) — skip
      results.skipped_no_pending++;
      continue;
    }

    // Build retry email
    const fromHeader = buildFromHeader(sez.author_name, "sesizari@civia.ro");
    const subject = sanitizeSubject(
      `[REAMINTIRE / RETRIMITERE] Sesizare ${sez.code} — ${sez.titlu}`,
    );

    try {
      const resendResp = await resend.emails.send({
        from: fromHeader,
        to: pending,
        bcc: sez.author_email ? [sez.author_email] : undefined,
        replyTo: `sesizari+${sez.code}@civia.ro`,
        subject,
        text:
          (sez.formal_text ?? "Sesizare retrimisa.") +
          "\n\n[Aceasta este o retrimitere automata. Initial unele dintre adresele dvs au returnat bounce: " +
          [...bounced].join(", ") +
          " — am exclus aceste adrese din retrimitere.]",
      });

      const messageId =
        typeof resendResp === "object" && resendResp && "data" in resendResp
          ? (resendResp.data as { id?: string } | null)?.id ?? null
          : null;

      // Update retry_count
      await admin
        .from("sesizari")
        .update({
          retry_count: (sez.retry_count ?? 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", sez.id);

      // Log audit trail
      await admin.from("sesizari_retries").insert({
        sesizare_id: sez.id,
        retry_count: (sez.retry_count ?? 0) + 1,
        retried_to: pending,
        excluded_bounced: [...bounced],
        resend_message_id: messageId,
        retried_at: new Date().toISOString(),
      });

      results.retried++;
    } catch (e) {
      Sentry.captureException(e, {
        tags: { cron: "sesizari-retry-bounce", code: sez.code },
      });
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
