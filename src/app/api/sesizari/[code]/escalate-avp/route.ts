import { NextResponse } from "next/server";
import { decryptField } from "@/lib/crypto/field";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { buildAvpPlangere } from "@/lib/sesizari/avp-template";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import * as Sentry from "@sentry/nextjs";
import { escapeHtml } from "@/lib/sanitize";
import { evaluateAvpEligibility } from "@/lib/sesizari/escalation";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * POST /api/sesizari/[code]/escalate-avp
 *
 * Generează și trimite plângerea către Avocatul Poporului (avp@avp.ro)
 * pentru o sesizare cu status `ignorat` (60+ zile fără răspuns autoritate).
 *
 * Conform OG 27/2002 art. 8 + Legea 35/1997 (AVP), cetățeanul are dreptul
 * să sesizeze AVP când o autoritate publică nu respectă termenul legal.
 *
 * Reply-To = emailul cetățeanului (AVP răspunde direct la cetățean, NU la
 * civia.ro). BCC către cetățean ca să aibă copie. Sentry log pentru audit.
 *
 * Auth: doar autorul sesizării.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`escalate-avp:${ip}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe escaladări într-o oră" }, { status: 429 });
  }

  const { code } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Trebuie autentificat" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data: sesizare } = await admin
    .from("sesizari")
    .select("id, code, titlu, locatie, status, author_name, author_email, author_address, sent_to_emails, created_at, official_response_at, user_id")
    .eq("code", code)
    .maybeSingle();

  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare negăsită" }, { status: 404 });
  }

  // Ownership
  const isOwner =
    sesizare.user_id === user.id ||
    sesizare.author_email?.toLowerCase().trim() === user.email?.toLowerCase().trim();
  if (!isOwner) {
    return NextResponse.json({ error: "Doar autorul poate escalada la AVP" }, { status: 403 });
  }

  // Gate LEGAL centralizat în evaluateAvpEligibility (sursă unică de adevăr,
  // partajată cu UI-ul ca să nu diverge). Server-ul rămâne autoritatea finală:
  // chiar dacă cineva forțează POST-ul, aici se respinge. Co-semnăturile NU
  // intră în acest calcul — escaladarea e funcție pură de timp legal + răspuns.
  const elig = evaluateAvpEligibility({
    created_at: sesizare.created_at,
    status: sesizare.status,
    official_response_at: sesizare.official_response_at ?? null,
  });
  if (!elig.eligible) {
    const msg =
      elig.reason === "resolved"
        ? "Sesizarea a fost deja soluționată. Nu poți escalada o problemă închisă."
        : elig.reason === "responded"
          ? "Autoritatea a transmis deja un răspuns oficial — termenul legal a fost respectat."
          : `Termenul legal OG 27/2002 nu a expirat încă (${elig.daysSinceFiled}/45 zile). Poți escalada după 45+ zile fără răspuns.`;
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  if (!sesizare.author_name || !sesizare.author_email) {
    return NextResponse.json(
      { error: "Lipsesc datele de contact necesare pentru plângerea AVP. Completează profilul." },
      { status: 422 },
    );
  }

  const plangere = buildAvpPlangere({
    code: sesizare.code,
    titlu: sesizare.titlu,
    locatie: sesizare.locatie,
    nume: sesizare.author_name,
    adresa: decryptField(sesizare.author_address),
    email: sesizare.author_email,
    createdAt: new Date(sesizare.created_at),
    destinatari: sesizare.sent_to_emails ?? [],
  });

  const htmlBody = plangere.body
    .split("\n\n")
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`;

  const result = await sendEmail({
    to: plangere.to,
    bcc: sesizare.author_email ? [sesizare.author_email] : undefined,
    subject: plangere.subject,
    text: plangere.body,
    html,
    replyTo: plangere.replyTo,
    from: buildFromHeader(sesizare.author_name, "sesizari@civia.ro"),
  });

  if (!result.ok || !result.id) {
    Sentry.captureMessage("escalate-avp: send failed", {
      level: "error",
      tags: { kind: "avp_send_fail", code: sesizare.code },
      extra: { result },
    });
    return NextResponse.json({ error: "Emailul către AVP nu a putut fi trimis." }, { status: 500 });
  }

  // Log timeline event
  await admin.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "escaladat_avp",
    description: "Plângere automată trimisă către Avocatul Poporului (avp@avp.ro) pentru încălcarea OG 27/2002 art. 8 (termen legal expirat).",
    created_by: user.id,
  });

  return NextResponse.json({
    ok: true,
    sent_to: plangere.to,
    message_id: result.id,
  });
}
