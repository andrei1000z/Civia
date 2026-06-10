import { NextResponse } from "next/server";
import { decryptField, encryptField } from "@/lib/crypto/field";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { randomUUID } from "crypto";
import { replyToAddress, makeReplyToken } from "@/lib/inbox/reply-token";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { buildFormalText } from "@/lib/sesizari/mailto";
import { ENV } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";
import { escapeHtml } from "@/lib/sanitize";

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

  // 2026-05-28 — Anonimii pot trimite dacă:
  //   1. Sesizarea există + are nume + adresă populate
  //   2. NU a fost deja trimisă (sent_via_civia=false)
  //   3. Created < 24h ago (anti-abuse: nu trigger sends pe sesizari vechi)
  //   4. Rate limit IP 5/h deja aplicat sus
  // Logat-ii păstrează ownership check (sigur că trimit DOAR sesizarea lor).

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
  // Decriptează adresa (criptată la nivel de câmp în DB) LOCAL — nu în repo,
  // ca să n-o expunem altor consumatori ai getSesizareByCode (ex: pagina
  // publică). Tot codul de mai jos lucrează pe text simplu.
  sesizare.author_address = decryptField(sesizare.author_address);

  // 5/22/2026 — daca lipsesc nume/adresa pe sesizare DAR userul le-a
  // furnizat in body, update sesizare inainte de trimitere.
  const needsNameUpdate = !sesizare.author_name && bodyNume;
  const needsAddressUpdate = !sesizare.author_address && bodyAdresa;
  if (needsNameUpdate || needsAddressUpdate) {
    const admin = createSupabaseAdmin();
    const updates: Record<string, string> = {};
    if (needsNameUpdate && bodyNume) updates.author_name = bodyNume;
    // Criptează adresa nouă înainte de a o stoca (rămâne text simplu în memorie
    // pentru email, vezi mai jos).
    if (needsAddressUpdate && bodyAdresa) updates.author_address = encryptField(bodyAdresa) ?? bodyAdresa;
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

  // 2026-05-26 — Content moderation pre-send (raportat dkrandu pe Reddit).
  // Verificăm nume + descriere + locație înainte ca emailul să plece la
  // primărie de la sesizari@civia.ro. La acest stadiu sesizarea există în
  // DB; nu o ștergem, doar blocăm sendul (user-ul vede mesaj de eroare).
  const { moderateSesizareContent } = await import("@/lib/sesizari/content-moderation");
  const mod = moderateSesizareContent({
    author_name: sesizare.author_name,
    titlu: sesizare.titlu,
    descriere: sesizare.descriere ?? "",
    locatie: sesizare.locatie,
  });
  if (mod.block) {
    return NextResponse.json(
      {
        error: `Trimitere blocată: ${mod.reason}. Modifică textul sesizării — emailul pleacă în numele tău către autoritate.`,
      },
      { status: 400 },
    );
  }

  // 2026-05-28 — Ownership check ADAPTAT pentru anonimi:
  //   - Logat: trebuie să fie owner (user.id sau email match)
  //   - Anonim: sesizarea trebuie să fie CREATĂ RECENT (<24h) ca anti-abuse
  //     pe sesizari vechi pe care nu ești autor. Combinat cu rate-limit
  //     5/h/IP + sent_via_civia check, securitate practică.
  if (user) {
    const isOwner =
      sesizare.user_id === user.id ||
      sesizare.author_email?.toLowerCase().trim() === user.email?.toLowerCase().trim();
    if (!isOwner) {
      return NextResponse.json(
        { error: "Doar autorul sesizarii poate trimite via Civia." },
        { status: 403 },
      );
    }
  } else {
    // Anonim: verifică sesizarea e recentă (autorul probabil)
    const sesizareAge = Date.now() - new Date(sesizare.created_at).getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (sesizareAge > ONE_DAY_MS) {
      return NextResponse.json(
        {
          error: "Pentru a trimite o sesizare mai veche de 24h, autentifică-te.",
          needs_login: true,
        },
        { status: 401 },
      );
    }
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

  // 2026-05-26 — Fallback county detection când DB are county=null.
  // Bug 00049: sesizare din Cluj-Napoca avea county null → routing
  // default București. Derive din `locatie` ca fallback + persist back.
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

  // Rezolva destinatarii — primary + cc. 2026-05-29: pasam si descriere
  // pentru auto-escalation politie cand contextul este rutier (vehicul
  // pe trotuar, inactiune politie, plate raportata, etc.).
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
    author_email: user?.email ?? sesizare.author_email ?? null,
    author_address: sesizare.author_address ?? null,
    imagini: sesizare.imagini ?? [],
    code: sesizare.code,
  });

  const userEmail = user?.email ?? sesizare.author_email ?? "";
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
  // 2026-05-27 — Subaddressing pe Cloudflare Email Routing ACTIVAT (audit
  // a clarificat: cu Subaddressing toggle ON în settings, replies la
  // sesizari+CODE@civia.ro ajung tot la Worker, NU drop). Folosim
  // plus-addressing pe Reply-To ca să maximizăm code extraction confidence
  // (worker găsește codul direct în To: header, 99% accuracy).
  // 2026-06-08 — Reply-To cu TOKEN opac (HMAC) în loc de cod brut, + Message-ID
  // RFC propriu pentru threading. Ambele alimentează matching-ul automat
  // reply→sesizare (match-reply.ts, N1+N2). Codul rămâne în subiect (N3, plasă).
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = `<sesizare-${sesizare.code}-${randomUUID().slice(0, 12)}@civia.ro>`;

  // From: doar numele user-ului + adresa sesizari@civia.ro (fără +CODE,
  // ca să rămână clean în signature către primărie).
  const fromHeader = buildFromHeader(sesizare.author_name, "sesizari@civia.ro");

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
    headers: { "Message-ID": outboundMessageId },
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

  // 5/22/2026 — STRICT check: result.ok=true DAR result.id missing înseamnă
  // Resend a returnat success fără ID — semn de configurare gresita (FROM
  // sandbox, domain neverificat, etc.). Astea sunt „ghost sends" — primăria
  // nu primește real, dar DB e marcată ca trimisă. Fix: respinge + log.
  if (!result.id) {
    Sentry.captureMessage("send-via-civia: Resend returned no message_id (ghost send)", {
      level: "error",
      tags: { kind: "resend_no_id", code: sesizare.code },
      extra: {
        primary_emails: primaryEmails,
        from_header: fromHeader,
        result,
      },
    });
    return NextResponse.json(
      {
        error: "Email-ul a fost trimis dar fără confirmare de livrare. Verifică configurarea Resend (FROM email + domain DKIM) sau încearcă din nou.",
        code: "ghost_send",
      },
      { status: 502 },
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
  // 2026-06-10 (audit statusuri) — RETRY pe update (max 3, backoff). Emailul a
  // plecat deja; dacă update-ul eșuează, sent_via_civia rămâne false → o re-tentativă
  // ar RETRIMITE la primărie (dublă trimitere). Retry-ul micșorează drastic fereastra
  // de eșec. Update-ul e idempotent (re-setarea acelorași flag-uri e fără efecte adverse).
  const sentUpdatePayload = {
    sent_via_civia: true,
    sent_at: now,
    sent_to_emails: [...primaryEmails, ...ccEmails],
    resend_message_id: result.id ?? null,
    outbound_message_id: outboundMessageId,
    reply_token: makeReplyToken(sesizare.code),
    // Marcam status ca „trimis" daca era „nou".
    ...(sesizare.status === "nou" ? { status: "trimis" } : {}),
  };
  let updateError: { message: string; code?: string; details?: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await admin.from("sesizari").update(sentUpdatePayload).eq("id", sesizare.id);
    updateError = error;
    if (!error) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt));
  }

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
    created_by: user?.id ?? null,
  });
  if (tlError) {
    Sentry.captureMessage("send-via-civia: timeline insert failed", {
      level: "warning",
      tags: { kind: "send_civia_timeline_fail", code: sesizare.code },
      extra: { sesizare_id: sesizare.id, tl_error: tlError.message, tl_code: tlError.code },
    });
  }

  // 5/22/2026 — Auto-ack către cetățean. Independent de BCC (BCC nu garantează
  // livrare la user; multe Gmail-uri filtrează BCC-uri ca spam). Email separat
  // cu link la pagina sesizării + termen 30 zile + ce să facă dacă nu răspund.
  // Failure aici nu blochează succes — emailul către primării a plecat deja.
  if (userEmail) {
    try {
      const { emailTemplate } = await import("@/lib/email/resend");
      const sesizareUrl = `${ENV.SITE_URL()}/sesizari/${sesizare.code}`;
      const ackBody = `
        <p>${escapeHtml(sesizare.author_name.split(" ")[0] ?? "Salut")},</p>
        <p>Sesizarea ta <strong>${escapeHtml(sesizare.titlu)}</strong> a plecat oficial la <strong>${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"}</strong>:</p>
        <ul style="margin:12px 0;padding-left:20px;color:#475569">
          ${primaryEmails.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}
        </ul>
        <p>Conform <strong>OG 27/2002 art. 8</strong>, primăria are <strong>30 de zile</strong> să răspundă. Civia urmărește automat:</p>
        <ul>
          <li>📬 Primim răspunsul lor pe <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sesizari@civia.ro</code> → te notificăm imediat</li>
          <li>📋 Numărul de înregistrare îl extragem automat și-l vezi pe pagina sesizării</li>
          <li>⏰ Dacă nu răspund: la 7/14/30 zile primești reminder + sugestii escaladare</li>
        </ul>
        <p style="background:#ecfdf5;padding:12px 16px;border-radius:8px;border-left:3px solid #059669;font-size:13px;color:#065f46;margin:20px 0">
          💡 <strong>Bună de știut:</strong> Primăriile NU au sistem automat de auto-reply. Funcționarii umani înregistrează manual în 1-5 zile lucrătoare. Lipsa răspunsului imediat e normală.
        </p>
        <p style="margin-top:24px"><strong>Cod sesizare:</strong> ${sesizare.code}</p>
      `;
      await sendEmail({
        to: userEmail,
        subject: `✅ Sesizarea ${sesizare.code} a plecat la primărie`,
        html: emailTemplate({
          title: "Sesizarea ta a plecat oficial",
          kicker: `SESIZARE ${sesizare.code}`,
          icon: "✅",
          preheader: `Trimisă la ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"}. Termen răspuns: 30 zile.`,
          body: ackBody,
          ctaText: "Vezi sesizarea + status",
          ctaUrl: sesizareUrl,
        }),
      });
    } catch (ackErr) {
      // Non-fatal — emailul către primării a plecat OK. Doar log.
      Sentry.captureMessage("send-via-civia: auto-ack email failed", {
        level: "info",
        tags: { kind: "ack_fail", code: sesizare.code },
        extra: { err: ackErr instanceof Error ? ackErr.message : String(ackErr) },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sent_at: now,
    to: primaryEmails,
    cc: ccEmails,
    message_id: result.id,
  });
}
