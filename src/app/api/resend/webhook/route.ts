/**
 * POST /api/resend/webhook
 *
 * Receive Resend email delivery events: email.sent, email.delivered,
 * email.bounced, email.complained, email.opened, email.clicked,
 * email.delivery_delayed.
 *
 * 2026-05-27 — Activează tracking real-time pe sesizari.delivery_status.
 * Permite UI să arate „📬 livrat la 14:32" sau „❌ bounce: mailbox full".
 *
 * Setup necesar (user):
 *   Resend dashboard → Webhooks → Add Endpoint
 *     URL: https://www.civia.ro/api/resend/webhook
 *     Events: email.sent, email.delivered, email.bounced, email.complained
 *     → primești webhook secret → setezi RESEND_WEBHOOK_SECRET în Vercel
 *
 * Resend folosește Svix pentru webhooks. Verificăm signature cu HMAC-SHA256
 * pe payload + headers svix-id + svix-timestamp + svix-signature.
 *
 * Schema events (Resend docs 2026):
 *   {
 *     "type": "email.delivered",
 *     "created_at": "2026-05-27T20:04:16Z",
 *     "data": {
 *       "email_id": "uuid",
 *       "from": "noreply@civia.ro",
 *       "to": ["sesizari@autoritate.ro"],
 *       "subject": "...",
 *       "tags": [...]
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type ResendEvent = {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    bounce?: { type?: string; sub_type?: string; message?: string };
    tags?: Array<{ name: string; value: string }>;
  };
};

/**
 * Verifică semnătura Svix pe payload. Resend webhook secrets încep cu
 * `whsec_` urmat de base64-encoded random bytes.
 */
function verifySvixSignature(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = opts;
  // Extract bytes din whsec_BASE64
  const secretBytes = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64",
  );
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest("base64");

  // svix-signature format: "v1,base64sig v1,base64sig" (space-separated, multiple versions)
  const signatures = svixSignature.split(" ").map((s) => s.trim());
  for (const sig of signatures) {
    if (!sig.startsWith("v1,")) continue;
    const sigVal = sig.slice(3);
    try {
      const a = Buffer.from(sigVal, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // continue checking other signatures
    }
  }
  return false;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Step 1: verify Svix signature
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    Sentry.captureMessage("RESEND_WEBHOOK_SECRET not configured", { level: "error" });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Step 2: parse event
  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Step 3: update sesizari.delivery_status based on event type
  // Resend `email_id` = `resend_message_id` în sesizari table.
  const messageId = event.data?.email_id;
  if (!messageId) {
    return NextResponse.json({ ok: true, note: "no email_id" });
  }

  const admin = createSupabaseAdmin();

  // Map event.type → delivery_status enum
  let deliveryStatus: string | null = null;
  let extraFields: Record<string, string | null> = {};

  switch (event.type) {
    case "email.sent":
      deliveryStatus = "sent";
      break;
    case "email.delivered":
      deliveryStatus = "delivered";
      extraFields.delivered_at = new Date(event.created_at).toISOString();
      break;
    case "email.bounced":
      deliveryStatus = "bounced";
      extraFields.bounced_at = new Date(event.created_at).toISOString();
      extraFields.bounce_reason =
        event.data?.bounce?.message?.slice(0, 200) ||
        event.data?.bounce?.sub_type ||
        event.data?.bounce?.type ||
        "unknown bounce";
      break;
    case "email.complained":
      deliveryStatus = "complained";
      break;
    case "email.delivery_delayed":
      deliveryStatus = "delayed";
      break;
    default:
      // email.opened / email.clicked etc. — not tracked în delivery_status
      return NextResponse.json({ ok: true, note: `event ${event.type} not tracked` });
  }

  try {
    const { error } = await admin
      .from("sesizari")
      .update({ delivery_status: deliveryStatus, ...extraFields })
      .eq("resend_message_id", messageId);

    if (error) {
      Sentry.captureMessage("Resend webhook update failed", {
        level: "warning",
        extra: { error: error.message, event_type: event.type, message_id: messageId },
      });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "resend.webhook", event_type: event.type } });
  }

  return NextResponse.json({ ok: true, event: event.type, status: deliveryStatus });
}
