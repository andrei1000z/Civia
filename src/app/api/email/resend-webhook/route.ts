/**
 * POST /api/email/resend-webhook — Resend webhook handler.
 *
 * Tracks delivery lifecycle: sent → delivered / bounced / complained.
 * Updates sesizari.delivery_status pe baza resend_message_id.
 *
 * Configurare Resend dashboard: Webhooks → endpoint URL + secret.
 * https://resend.com/docs/dashboard/webhooks/introduction
 *
 * Plan 5/22/2026 — fără asta, nu știm dacă emailurile către primării
 * au ajuns real sau au făcut bounce. „Ghost sends" rămân invisible.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Resend webhook event types relevante
const EVENT_SCHEMAS = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().optional(),
    // Bounce details (when type=email.bounced)
    bounce: z
      .object({
        type: z.string().optional(),
        message: z.string().optional(),
      })
      .optional()
      .nullable(),
    // Complaint details
    complaint: z.unknown().optional().nullable(),
  }),
});

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify signature (Svix-style HMAC-SHA256) — fără svix lib, raw Node crypto.
  // Format Svix: `v1,base64(hmac_sha256(svix_id + "." + svix_ts + "." + raw_body, base64_decode(secret)))`
  // Resend webhook secret e prefixat cu `whsec_` — îl strip.
  if (secret) {
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTs = req.headers.get("svix-timestamp") ?? "";
    const svixSig = req.headers.get("svix-signature") ?? "";
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 401 });
    }
    // Anti-replay: timestamp <= 5 min
    const tsNum = Number(svixTs);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return NextResponse.json({ error: "Timestamp too old/skewed" }, { status: 401 });
    }
    const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    let secretBuf: Buffer;
    try {
      secretBuf = Buffer.from(cleanSecret, "base64");
    } catch {
      secretBuf = Buffer.from(cleanSecret, "utf8");
    }
    const signedPayload = `${svixId}.${svixTs}.${rawBody}`;
    const expectedSig = createHmac("sha256", secretBuf).update(signedPayload).digest("base64");
    // Svix-signature header: "v1,<sig> v1,<sig> …" — accept oricare match
    const provided = svixSig.split(" ").map((s) => s.split(",")[1]).filter(Boolean) as string[];
    const match = provided.some((p) => {
      try {
        const a = Buffer.from(p, "base64");
        const b = Buffer.from(expectedSig, "base64");
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
    if (!match) {
      Sentry.captureMessage("resend-webhook: signature mismatch", {
        level: "warning",
        extra: { svix_id: svixId },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = EVENT_SCHEMAS.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = parsed.data;
  const messageId = event.data.email_id;
  const eventType = event.type; // email.sent, email.delivered, email.bounced, email.complained, email.opened, email.clicked

  const admin = createSupabaseAdmin();

  // Lookup sesizare by resend_message_id
  const { data: sesizare } = await admin
    .from("sesizari")
    .select("id, code, delivery_status, user_id, author_email")
    .eq("resend_message_id", messageId)
    .maybeSingle();

  if (!sesizare) {
    // Could be other transactional email (newsletter, auth) — not an error
    return NextResponse.json({ ok: true, note: "no_matching_sesizare" });
  }

  // Map event type → status
  // 5/22/2026 v2 — adăugate email.failed (eroare la nivel API înainte de
  // send, ex: domain neverificat) + email.suppressed (Resend a refuzat
  // trimiterea pentru că destinatarul e pe bounce-list global). Ambele
  // sunt critice pentru sesizări — emailul NU a plecat → trebuie retrimitere.
  const statusMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
    "email.failed": "bounced", // map la „bounced" — UI arată Retrimit button
    "email.suppressed": "bounced",
  };
  const newStatus = statusMap[eventType];
  if (!newStatus) {
    return NextResponse.json({ ok: true, note: "event_ignored", type: eventType });
  }

  // Update sesizare with new delivery_status + log timeline event
  const updates: Record<string, unknown> = { delivery_status: newStatus };
  if (eventType === "email.delivered") {
    updates.delivered_at = event.created_at;
  } else if (eventType === "email.bounced") {
    updates.bounced_at = event.created_at;
    updates.bounce_reason = event.data.bounce?.message?.slice(0, 500) ?? null;
  }

  await admin.from("sesizari").update(updates).eq("id", sesizare.id);

  // Timeline event pentru evenimente importante (bounce, complaint, failed, suppressed)
  if (
    eventType === "email.bounced" ||
    eventType === "email.complained" ||
    eventType === "email.failed" ||
    eventType === "email.suppressed"
  ) {
    const desc =
      eventType === "email.bounced"
        ? `Email respins de server destinatar: ${event.data.bounce?.message ?? "no reason"}`
        : eventType === "email.complained"
        ? `Destinatarul a marcat email-ul ca spam. Investigați configurarea.`
        : eventType === "email.failed"
        ? `Resend nu a putut trimite emailul (eroare API). Verifică configurarea FROM domain + DKIM.`
        : `Resend a refuzat trimiterea (destinatar pe bounce-list global). Adresa primăriei e problematică — verifică /autoritati.`;
    await admin.from("sesizare_timeline").insert({
      sesizare_id: sesizare.id,
      event_type: "delivery_problem",
      description: desc,
    });
    // Sentry alert pentru bounce/complaint — necesită acțiune
    Sentry.captureMessage(`Email delivery problem on ${sesizare.code}`, {
      level: "warning",
      tags: { kind: eventType, code: sesizare.code },
      extra: { message_id: messageId, event_data: event.data },
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
