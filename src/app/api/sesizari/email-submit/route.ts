import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/sesizari/email-submit — Email-to-sesizare webhook.
 *
 * Pattern: cetățeanul trimite email la submit@civia.ro cu:
 *   - SUBJECT: titlu sesizare
 *   - BODY: descriere problemă + locație
 *   - ATTACHMENT: poză(e)
 * Resend inbound forward → POST aici → auto-create sesizare ca anonim.
 *
 * (P3.831 — 2026-05-24)
 *
 * Notă: pentru cetățean comod care nu vrea form web. Mai puțin flexibil
 * (n-avem AI tip detection live, geocoding etc.) dar low-friction.
 * Sesizarea creată are status „nou" + nu pleacă automat la primărie —
 * cetățeanul primește un email de confirmare cu link la /sesizari/[code]
 * unde poate edita + apăsa „Trimite cu Civia".
 *
 * Webhook auth: Svix HMAC (Resend default) — același pattern ca inbox/reply.
 */
interface InboundEmailPayload {
  data: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename?: string; content_type?: string; url?: string }>;
  };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;

  // Verify Svix HMAC dacă secret e setat (same pattern ca inbox/reply).
  if (secret) {
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTs = req.headers.get("svix-timestamp") ?? "";
    const svixSig = req.headers.get("svix-signature") ?? "";
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 401 });
    }
    const tsNum = Number(svixTs);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return NextResponse.json({ error: "Timestamp too old" }, { status: 401 });
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
      Sentry.captureMessage("email-submit: signature mismatch", { level: "warning" });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: InboundEmailPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromHeader = payload.data?.from ?? "";
  const subject = (payload.data?.subject ?? "").trim().slice(0, 200);
  const body = (payload.data?.text ?? payload.data?.html ?? "").trim().slice(0, 3000);

  // Parse „Name <email@host>" din From
  const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([\w.+-]+@[\w.-]+)/);
  const senderEmail = emailMatch?.[1] ?? null;
  const senderNameMatch = fromHeader.match(/^([^<]+)</);
  const senderName = (senderNameMatch?.[1] ?? senderEmail?.split("@")[0] ?? "Cetățean").trim();

  if (!senderEmail || !subject || body.length < 30) {
    // Anti-spam — emailuri scurte sau fără subject, ignorăm tăcut
    return NextResponse.json({ ok: true, skipped: "insufficient_content" });
  }

  // Rate limit: max 3 sesizări/zi per email
  const admin = createSupabaseAdmin();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count: recentCount } = await admin
    .from("sesizari")
    .select("*", { count: "exact", head: true })
    .eq("author_email", senderEmail)
    .gte("created_at", dayAgo);

  if ((recentCount ?? 0) >= 3) {
    Sentry.captureMessage(`email-submit: rate limit exceeded for ${senderEmail}`, { level: "info" });
    return NextResponse.json({ ok: true, skipped: "rate_limit_3_per_day" });
  }

  // Generate code
  const { generateUniqueCode } = await import("@/lib/sesizari/codes");
  const code = await generateUniqueCode();

  // Default location — placeholder, user va edita după
  const titlu = subject;
  const descriere = body;

  // Insert sesizare ca pending review (moderation_status = pending)
  const { error: insErr } = await admin.from("sesizari").insert({
    code,
    user_id: null,
    author_name: senderName,
    author_email: senderEmail,
    tip: "altele", // user va schimba după review
    titlu,
    locatie: "(necompletat — adăugați locația în pagina sesizării)",
    sector: null,
    lat: null,
    lng: null,
    descriere,
    formal_text: null,
    status: "nou",
    imagini: [], // TODO: extract attachments
    publica: false, // user opt-in după review
    moderation_status: "pending", // admin review înainte de publish
  });

  if (insErr) {
    Sentry.captureException(insErr, { tags: { kind: "email_submit_insert_fail" }, extra: { senderEmail, code } });
    return NextResponse.json({ error: "Could not create sesizare" }, { status: 500 });
  }

  // Trimitem confirmation email cu link la /sesizari/[code]/edit
  // (TODO: implement edit page; pentru moment link la /sesizari/[code])
  try {
    const { sendEmail, emailTemplate } = await import("@/lib/email/resend");
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro"}/sesizari/${code}`;
    await sendEmail({
      to: senderEmail,
      subject: `📨 Ai pornit o sesizare prin email — cod ${code}`,
      html: emailTemplate({
        title: "Sesizarea ta a fost creată",
        kicker: `SESIZARE ${code}`,
        icon: "📨",
        preheader: "Verifică și completează detaliile lipsă (locație, poze).",
        body: `
          <p>Salut ${senderName.split(" ")[0]},</p>
          <p>Am primit emailul tău la <strong>submit@civia.ro</strong> și am creat un draft de sesizare:</p>
          <p style="background:#f8fafc;padding:12px 16px;border-radius:8px;margin:16px 0">
            <strong>${escapeHtml(titlu)}</strong>
          </p>
          <p>Pentru a o trimite oficial la primărie, trebuie să completezi câteva detalii:</p>
          <ul>
            <li>📍 Locația exactă (stradă, număr, sector)</li>
            <li>📸 Poze (dacă nu le-ai atașat la email)</li>
            <li>🏷️ Tipul problemei (parcare / groapă / iluminat / etc.) — AI sugerează</li>
          </ul>
          <p>Apasă butonul de jos ca să continui:</p>
        `,
        ctaText: "Completează sesizarea →",
        ctaUrl: url,
      }),
    });
  } catch {
    // Non-fatal — sesizarea e creată, user vede în /cont eventual
  }

  return NextResponse.json({ ok: true, code, status: "pending_completion" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
