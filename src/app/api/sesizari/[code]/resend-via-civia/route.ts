/**
 * POST /api/sesizari/[code]/resend-via-civia — re-trimite emailul către
 * primării.
 *
 * Caz de utilizare:
 *  1. Ghost send: `sent_via_civia=true` dar `resend_message_id=null` →
 *     emailul precedent n-a fost livrat real (Resend returnat success
 *     fără ID din cauza FROM sandbox / domain neverificat).
 *  2. Bounce: `delivery_status=bounced` → o adresă a respins emailul.
 *
 * Plan 5/22/2026.
 *
 * Auth: ownership check identic cu send-via-civia.
 * Rate limit: max 1 resend per sesizare per 10 minute (anti-abuse).
 */

import { NextResponse } from "next/server";
import { decryptField } from "@/lib/crypto/field";
import { safeTitlu } from "@/lib/sesizari/titlu";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { replyToAddress, authorityOutboundMessageId } from "@/lib/inbox/reply-token";
import { rateLimitAsync } from "@/lib/ratelimit";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { buildFormalText } from "@/lib/sesizari/mailto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SesizareRow {
  id: string;
  code: string;
  titlu: string;
  status: string;
  user_id: string | null;
  author_name: string;
  author_email: string | null;
  author_address: string | null;
  formal_text: string | null;
  descriere: string;
  locatie: string;
  sector: string;
  tip: string;
  county: string | null;
  imagini: string[] | null;
  sent_via_civia: boolean | null;
  resend_message_id: string | null;
  delivery_status: string | null;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  // Auth
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii autentificat" }, { status: 401 });
  }

  // Lookup sesizare
  const { data, error } = await supabase
    .from("sesizari")
    .select(
      "id, code, titlu, status, user_id, author_name, author_email, author_address, formal_text, descriere, locatie, sector, tip, county, imagini, sent_via_civia, resend_message_id, delivery_status",
    )
    .eq("code", code)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Sesizare negasita" }, { status: 404 });
  }
  const sesizare = data as SesizareRow;
  // Decriptează adresa de domiciliu (criptată la nivel de câmp în DB) ca tot
  // codul de mai jos — verificarea de lungime + textul formal — să lucreze pe
  // text simplu.
  sesizare.author_address = decryptField(sesizare.author_address);

  // Ownership check
  const isOwner =
    sesizare.user_id === user.id ||
    sesizare.author_email?.toLowerCase().trim() === user.email?.toLowerCase().trim();
  if (!isOwner) {
    return NextResponse.json(
      { error: "Doar autorul sesizarii poate retrimite." },
      { status: 403 },
    );
  }

  // Eligibility: NU retrimite dacă deja avem confirmed delivery
  if (sesizare.delivery_status === "delivered") {
    return NextResponse.json(
      {
        error: "Email-ul a fost deja livrat cu succes. Așteaptă răspunsul.",
        already_delivered: true,
      },
      { status: 409 },
    );
  }

  // Rate-limit per sesizare: 1 / 10 min
  const rl = await rateLimitAsync(`resend-sesizare:${sesizare.id}`, {
    limit: 1,
    windowMs: 10 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: `Ai retrimis recent. Așteaptă ${Math.ceil(rl.resetIn / 60_000)} minute.`,
        resetIn: rl.resetIn,
      },
      { status: 429 },
    );
  }

  // Validate identity (must still be present)
  if (!sesizare.author_name || sesizare.author_name.length < 2) {
    return NextResponse.json(
      { error: "Lipsește numele. Completează-l în profil." },
      { status: 400 },
    );
  }
  if (!sesizare.author_address || sesizare.author_address.length < 3) {
    return NextResponse.json(
      { error: "Lipsește adresa. Completează-o în profil." },
      { status: 400 },
    );
  }

  // 2026-05-26 — Fallback county detection când DB are county=null.
  let effectiveCounty = sesizare.county;
  if (!effectiveCounty) {
    const detected = detectCountyFromLocatie(sesizare.locatie);
    if (detected) {
      effectiveCounty = detected;
      const adminCounty = createSupabaseAdmin();
      await adminCounty
        .from("sesizari")
        .update({ county: detected })
        .eq("id", sesizare.id)
        .then(() => undefined, () => undefined);
    }
  }

  // Build text + recipients (cu descriere pentru auto-escalation politie)
  const recipients = getAuthoritiesFor(
    sesizare.tip,
    sesizare.sector,
    effectiveCounty,
    sesizare.locatie,
    undefined,
    sesizare.descriere,
  );
  if (!recipients.primary || recipients.primary.length === 0) {
    return NextResponse.json(
      { error: "Nu am putut determina destinatarii." },
      { status: 422 },
    );
  }

  const formalText =
    sesizare.formal_text ??
    buildFormalText({
      tip: sesizare.tip,
      titlu: sesizare.titlu,
      locatie: sesizare.locatie,
      sector: sesizare.sector,
      descriere: sesizare.descriere ?? "",
      formal_text: sesizare.formal_text,
      author_name: sesizare.author_name,
      author_email: user.email ?? null,
      author_address: sesizare.author_address,
      imagini: sesizare.imagini ?? [],
      code: sesizare.code,
    });

  const paragraphs = formalText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const htmlBody = paragraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 14px 0; line-height: 1.6;">${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`;

  const attachments = (sesizare.imagini ?? []).slice(0, 5).map((url, i) => ({
    filename: `${sesizare.code}-poza-${i + 1}.jpg`,
    path: url,
  }));

  const primaryEmails = recipients.primary.map((a) => a.email).filter(Boolean);
  const ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);

  // Subject prefix [RETRIMITERE] ca primăria să nu creadă că e duplicate spam
  const subject = `[RETRIMITERE] Sesizare ${sesizare.code} — ${safeTitlu(sesizare.titlu, { descriere: sesizare.descriere })}`;
  // 2026-06-08 — Reply-To cu token opac + Message-ID propriu (matching N1+N2).
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = authorityOutboundMessageId(sesizare.code);
  const fromHeader = buildFromHeader(sesizare.author_name, "sesizari@civia.ro");

  const result = await sendEmail({
    to: primaryEmails,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    bcc: user.email ? [user.email] : undefined,
    subject,
    html,
    text: formalText,
    replyTo,
    from: fromHeader,
    headers: { "Message-ID": outboundMessageId },
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (!result.ok || !result.id) {
    Sentry.captureMessage("resend-via-civia failed", {
      level: "error",
      tags: { kind: "resend_retry_failure", code: sesizare.code },
      extra: { result },
    });
    return NextResponse.json(
      { error: "Retrimiterea a eșuat. Verifică configurarea Resend." },
      { status: 502 },
    );
  }

  // Update DB
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  await admin
    .from("sesizari")
    .update({
      sent_via_civia: true,
      sent_at: now,
      sent_to_emails: [...primaryEmails, ...ccEmails],
      resend_message_id: result.id,
      delivery_status: "sent",
      delivered_at: null,
      bounced_at: null,
      bounce_reason: null,
    })
    .eq("id", sesizare.id);

  await admin.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "trimis_via_civia",
    description: `Email RETRIMIS automat de Civia către ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"}. Motiv: ${sesizare.delivery_status === "bounced" ? "email anterior a făcut bounce" : "fără confirmare delivery"}.`,
    created_by: user.id,
  });

  return NextResponse.json({
    ok: true,
    sent_at: now,
    to: primaryEmails,
    cc: ccEmails,
    message_id: result.id,
  });
}
