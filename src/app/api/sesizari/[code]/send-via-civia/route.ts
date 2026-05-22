import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/resend";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { buildFormalText } from "@/lib/sesizari/mailto";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/sesizari/[code]/send-via-civia
 *
 * Trimite sesizarea direct de pe server via Resend, in numele cetateanului.
 * Reply-To = email-ul user-ului → primaria raspunde direct la cetatean.
 * BCC = user (sa aibe copie) + civia (deliverability check).
 *
 * Asta rezolva bug-ul ~70% dropoff la mailto (Reddit feedback Tramagust):
 * dupa „Trimite", utilizatorii nu mai apasau pe trimite in app-ul de email.
 * Acum „Trimite" face POST aici → email pleaca instant, status marcat.
 *
 * Requires: user logat + ownership pe sesizare (sau email match).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`send-civia:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe trimiteri. Mai incearca peste o ora." },
      { status: 429 },
    );
  }

  const { code } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Trebuie sa te autentifici pentru a trimite via Civia. Foloseste optiunea cu emailul tau." },
      { status: 401 },
    );
  }

  // 5/22/2026 — accept optional body cu nume + adresa daca userul nu le-a
  // furnizat la submit. Backend update-eaza sesizarea + trimite email-ul
  // intr-un singur request → flow simplu pentru user.
  let bodyNume: string | null = null;
  let bodyAdresa: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { nume?: string; adresa?: string };
    if (typeof body.nume === "string" && body.nume.trim().length >= 2 && body.nume.trim().length <= 120) {
      bodyNume = body.nume.trim();
    }
    if (typeof body.adresa === "string" && body.adresa.trim().length >= 3 && body.adresa.trim().length <= 300) {
      bodyAdresa = body.adresa.trim();
    }
  } catch {
    // No body or invalid — proceed cu valorile din sesizare existing.
  }

  const sesizare = await getSesizareByCode(code);
  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare negasita" }, { status: 404 });
  }

  // 5/22/2026 — daca lipsesc nume/adresa pe sesizare DAR userul le-a
  // furnizat in body, update sesizare inainte de trimitere.
  const needsNameUpdate = !sesizare.author_name && bodyNume;
  const needsAddressUpdate = !sesizare.author_address && bodyAdresa;
  if (needsNameUpdate || needsAddressUpdate) {
    const admin = createSupabaseAdmin();
    const updates: Record<string, string> = {};
    if (needsNameUpdate && bodyNume) updates.author_name = bodyNume;
    if (needsAddressUpdate && bodyAdresa) updates.author_address = bodyAdresa;
    await admin.from("sesizari").update(updates).eq("id", sesizare.id);
    // Update in-memory ca sa folosim noile valori in email.
    if (needsNameUpdate && bodyNume) sesizare.author_name = bodyNume;
    if (needsAddressUpdate && bodyAdresa) sesizare.author_address = bodyAdresa;
  }

  // Block trimitere daca tot lipsesc nume sau adresa (validare strictă).
  if (!sesizare.author_name || sesizare.author_name.length < 2) {
    return NextResponse.json(
      {
        error: "Lipsește numele. Completează-l în formular pentru a trimite.",
        needs_identity: true,
        missing: { nume: !sesizare.author_name, adresa: !sesizare.author_address },
      },
      { status: 400 },
    );
  }
  if (!sesizare.author_address || sesizare.author_address.length < 3) {
    return NextResponse.json(
      {
        error: "Lipsește adresa. Completeaz-o în formular pentru a trimite.",
        needs_identity: true,
        missing: { nume: !sesizare.author_name, adresa: !sesizare.author_address },
      },
      { status: 400 },
    );
  }

  // Ownership check — doar autorul poate trimite via Civia. Alternativ
  // ar fi sa permitem cosignaturi sa trimita un email separate, dar
  // pentru moment limitam la owner sa nu confuzam primariile.
  const isOwner =
    sesizare.user_id === user.id ||
    sesizare.author_email?.toLowerCase().trim() === user.email?.toLowerCase().trim();
  if (!isOwner) {
    return NextResponse.json(
      { error: "Doar autorul sesizarii poate trimite via Civia." },
      { status: 403 },
    );
  }

  if (sesizare.sent_via_civia) {
    return NextResponse.json(
      {
        error: "Sesizarea a fost deja trimisa via Civia.",
        sent_at: sesizare.sent_at,
        already: true,
      },
      { status: 409 },
    );
  }

  // Rezolva destinatarii — primary + cc.
  const recipients = getAuthoritiesFor(
    sesizare.tip,
    sesizare.sector,
    sesizare.county,
    sesizare.locatie,
  );

  if (!recipients.primary || recipients.primary.length === 0) {
    return NextResponse.json(
      { error: "Nu am putut determina destinatarii pentru aceasta sesizare." },
      { status: 422 },
    );
  }

  // Construieste textul oficial (formal_text generat de AI deja in DB).
  const formalText = sesizare.formal_text ?? buildFormalText({
    tip: sesizare.tip,
    titlu: sesizare.titlu,
    locatie: sesizare.locatie,
    sector: sesizare.sector,
    descriere: sesizare.descriere ?? "",
    formal_text: sesizare.formal_text,
    author_name: sesizare.author_name,
    author_email: user.email ?? null,
    author_address: null,
    imagini: sesizare.imagini ?? [],
    code: sesizare.code,
  });

  const userEmail = user.email ?? sesizare.author_email ?? "";
  // Subject include codul sesizarii ca PRIMUL token. Bug raportat user
  // 5/21/2026: Cloudflare Email Routing nu onoreaza plus-addressing
  // (sesizari+CODE@civia.ro) cand destinatia rulei e Worker — toate
  // emailurile cu plus erau drop-uite in catch-all (6/6 dropped). Fix:
  // codul ajunge in subject in loc, Worker il extrage de acolo cand
  // primaria face Reply (subject devine „Re: Sesizare CODE — ...").
  const subject = `Sesizare ${sesizare.code} — ${sesizare.titlu}`;

  // Format HTML simplu cu paragrafe + atasamente menționate.
  const paragraphs = formalText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const htmlBody = paragraphs
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  // Quick Polish (5/21/2026 user feedback): scos brandingul Civia complet.
  // Email-ul arată ACUM exact ca un email personal — nicio mențiune
  // „via Civia", niciun footer cu trimitere la civia.ro. Singura urmă
  // (necesară din motive tehnice): adresa expeditor sesizari@civia.ro
  // (vizibilă doar dacă funcționarul apasă „expand from").
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`;

  // Atasamente — pozele sesizarii (URL-uri publice Supabase Storage).
  const attachments = (sesizare.imagini ?? []).slice(0, 5).map((url, i) => ({
    filename: `${sesizare.code}-poza-${i + 1}.jpg`,
    path: url,
  }));

  const primaryEmails = recipients.primary.map((a) => a.email).filter(Boolean);
  const ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);

  // Reply-To: sesizari@civia.ro (FĂRĂ plus-addressing). Răspunsul
  // primăriei ajunge aici → Cloudflare Email Routing → Worker → POST la
  // /api/inbox/reply → AI extrage codul DIN SUBJECT (e prefix in
  // „Re: Sesizare CODE — ...") → clasificare + status update + push.
  //
  // 5/21/2026: anterior aveam plus-addressing („sesizari+CODE@civia.ro")
  // dar Cloudflare drop-a toate emailurile (6/6 dropped) — sub-addressing
  // nu se onoreaza cand destinatia rulei e Worker, doar la simple forwards.
  // Subject-based code extraction merge la fel de bine si e robust si la
  // mail relays care strip-uiesc plus-addressing.
  const replyTo = `sesizari@civia.ro`;

  // From: doar numele user-ului + adresa sesizari@civia.ro.
  // Display name = nume cetățean ca primăria să vadă cine reclamă,
  // fără branding-ul „via Civia".
  const fromHeader = `${sesizare.author_name} <sesizari@civia.ro>`;

  // Trimite email-ul.
  const result = await sendEmail({
    to: primaryEmails,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    // BCC user-ul ca sa aibe copie in inbox.
    bcc: userEmail ? [userEmail] : undefined,
    subject,
    html,
    text: formalText,
    replyTo,
    from: fromHeader,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (!result.ok) {
    Sentry.captureMessage("send-via-civia failed", {
      level: "error",
      tags: { kind: "resend_failure", code: sesizare.code },
    });
    return NextResponse.json(
      { error: "Email-ul nu a putut fi trimis. Foloseste optiunea cu emailul tau." },
      { status: 500 },
    );
  }

  // Marcheaza sesizarea ca trimisa + log timeline event.
  //
  // CRITICAL fix 2026-05-21: anterior `.update()` era await-uit fara
  // sa-l checkam pentru error → daca esua silent (typo coloana, RLS
  // policy nepatchata, trigger violation), userul vedea „Trimis automat"
  // dar DB-ul ramanea sent_via_civia=false → la o re-tentativa,
  // ramaneam fara „already" check si trimiteam din nou emailul (sau
  // primaria primea duplicate). Acum: error→Sentry + 500 la client.
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("sesizari")
    .update({
      sent_via_civia: true,
      sent_at: now,
      sent_to_emails: [...primaryEmails, ...ccEmails],
      resend_message_id: result.id ?? null,
      // Marcam status ca „trimis" daca era „nou".
      ...(sesizare.status === "nou" ? { status: "trimis" } : {}),
    })
    .eq("id", sesizare.id);

  if (updateError) {
    Sentry.captureMessage("send-via-civia: DB update failed AFTER email sent", {
      level: "error",
      tags: { kind: "send_civia_db_update_fail", code: sesizare.code },
      extra: {
        sesizare_id: sesizare.id,
        message_id: result.id,
        primary_emails: primaryEmails,
        update_error: updateError.message,
        update_code: updateError.code,
        update_details: updateError.details,
      },
    });
    // Emailul a plecat real — nu putem da rollback. Returnam succes la
    // user (ar fi misleading sa-i spunem ca a esuat, primaria a primit).
    // Dar log-uim CRITICAL ca sa stim sa reparam DB manual + sa investigam
    // de ce update-ul nu trece.
    return NextResponse.json({
      ok: true,
      sent_at: now,
      to: primaryEmails,
      cc: ccEmails,
      message_id: result.id,
      warning: "Email trimis dar DB tracking partial — verifică /api/sesizari/[code] în câteva minute",
    });
  }

  const { error: tlError } = await admin.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "trimis_via_civia",
    description: `Email trimis automat de Civia către ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"} oficiale. Așteptăm răspunsul.`,
    created_by: user.id,
  });
  if (tlError) {
    Sentry.captureMessage("send-via-civia: timeline insert failed", {
      level: "warning",
      tags: { kind: "send_civia_timeline_fail", code: sesizare.code },
      extra: { sesizare_id: sesizare.id, tl_error: tlError.message, tl_code: tlError.code },
    });
  }

  return NextResponse.json({
    ok: true,
    sent_at: now,
    to: primaryEmails,
    cc: ccEmails,
    message_id: result.id,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
