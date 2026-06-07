/**
 * POST /api/sesizari/[code]/cosign-send
 *
 * 5/22/2026 — User cere: la „Trimite și tu", emailul să plece DIRECT
 * prin sesizari@civia.ro (Resend), zero mailto extern / Gmail / atașări
 * manuale de poze. Co-semnatarul completează nume + adresa în modal,
 * apasă „Trimite", și emailul ajunge la primării ca al lui (cu identitatea
 * lui, nu a autorului original).
 *
 * Diferențe față de send-via-civia:
 *  - Nu necesită ownership (oricine poate co-semna + trimite)
 *  - NU marchează `sent_via_civia` pe sesizarea originală (doar autorul
 *    face asta). Salvăm cosignul în `sesizare_cosigners` + trimitem emailul.
 *  - Identitatea = co-semnatarul, nu autorul.
 *  - Subject prefix: „Co-semnătură — Sesizare CODE — Titlu" ca primăriile
 *    să vadă că e o altă persoană care susține aceeași sesizare.
 *  - Rate-limit: max 3 cosign-send-uri pe sesizare per IP per oră
 *    (anti-spam vs autori autentici).
 */

import { NextResponse } from "next/server";
import { safeTitlu } from "@/lib/sesizari/titlu";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { replyToAddress, authorityOutboundMessageId } from "@/lib/inbox/reply-token";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { buildFormalText } from "@/lib/sesizari/mailto";
import { extractLocality } from "@/lib/sesizari/extract-locality";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  nume: z.string().min(2, "Numele e prea scurt").max(100),
  adresa: z.string().min(3, "Adresa e prea scurtă").max(300),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v ?? null)),
  /** Honeypot — bot-ii completează acest câmp; respinge silent. */
  _honey: z.string().optional(),
});

interface SesizareRow {
  id: string;
  code: string;
  titlu: string;
  tip: string;
  locatie: string;
  sector: string;
  county: string | null;
  descriere: string;
  formal_text: string | null;
  imagini: string[] | null;
  status: string;
  sent_via_civia: boolean | null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const ip = getClientIp(req);

  // Rate-limit per IP+sesizare (3/oră)
  const rl = await rateLimitAsync(`cosign-send:${ip}:${code}`, {
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: `Ai trimis deja recent pentru această sesizare. Așteaptă ${Math.ceil(rl.resetIn / 60_000)} minute.`,
        resetIn: rl.resetIn,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }
  const { nume, adresa, email, _honey } = parsed.data;

  // Honeypot — bots completează → success fake.
  if (_honey) {
    return NextResponse.json({ ok: true, note: "bot_silent_drop" });
  }

  // 2026-05-26 — Content moderation pe numele co-semnatarului (raportat
  // dkrandu pe Reddit). La cosign, doar numele e user-input (descrierea
  // e a sesizării originale, deja moderată). Blocăm dacă numele conține
  // profanity/slur/caractere ciudate — ar ajunge în signature + subject
  // email către primărie cu reputația civia.ro.
  const { moderateSesizareContent } = await import("@/lib/sesizari/content-moderation");
  const mod = moderateSesizareContent({
    author_name: nume,
    descriere: "",
    locatie: "",
    isCosign: true,
  });
  if (mod.block) {
    return NextResponse.json(
      {
        error: `Cosign respins: ${mod.reason}. Folosește numele tău real — emailul pleacă de la sesizari@civia.ro către autoritate.`,
      },
      { status: 400 },
    );
  }

  // Lookup sesizare
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, tip, locatie, sector, county, descriere, formal_text, imagini, status, sent_via_civia")
    .eq("code", code)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: "Sesizare negăsită sau nepublică" },
      { status: 404 },
    );
  }
  const sesizare = data as SesizareRow;

  // 2026-05-26 — Fallback county detection când rândul DB are county=null.
  // Bug 00049: sesizare din Cluj-Napoca avea county null → routing default
  // București. Acum derivăm din `locatie` text dacă lipsește. Update inline
  // DB ca să fix permanent (next reads să vadă valoarea corectă).
  let effectiveCounty = sesizare.county;
  if (!effectiveCounty) {
    const detected = detectCountyFromLocatie(sesizare.locatie);
    if (detected) {
      effectiveCounty = detected;
      // Best-effort: persist back. Dacă eșuează (RLS, etc.), continuăm
      // cu valoarea derivată în-memory pentru routing-ul curent.
      await admin
        .from("sesizari")
        .update({ county: detected })
        .eq("id", sesizare.id)
        .then(() => undefined, () => undefined);
    }
  }

  // Resolve authorities (cu descriere pentru auto-escalation politie)
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

  // Build formal text cu identitatea CO-SEMNATARULUI (nume + adresa lui)
  const formalText = buildFormalText({
    tip: sesizare.tip,
    titlu: sesizare.titlu,
    locatie: sesizare.locatie,
    sector: sesizare.sector,
    descriere: sesizare.descriere ?? "",
    formal_text: sesizare.formal_text,
    author_name: nume,
    author_email: email,
    author_address: adresa,
    imagini: sesizare.imagini ?? [],
    code: sesizare.code,
  });

  // Construct HTML
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

  // Attach photos (max 5, like send-via-civia)
  const attachments = (sesizare.imagini ?? []).slice(0, 5).map((url, i) => ({
    filename: `${sesizare.code}-poza-${i + 1}.jpg`,
    path: url,
  }));

  const primaryEmails = recipients.primary.map((a) => a.email).filter(Boolean);
  const ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);

  // Subject — IDENTIC cu send-via-civia (sesizarea originală). User cere
  // explicit: fără prefix „Co-semnătură", emailul să arate ca o sesizare
  // nouă obișnuită, doar cu identitatea persoanei care trimite acum.
  const subject = `Sesizare ${sesizare.code} — ${safeTitlu(sesizare.titlu, { descriere: sesizare.descriere })}`;

  // 2026-06-08 — Reply-To cu TOKEN opac + Message-ID propriu (matching automat,
  // N1+N2; vezi match-reply.ts). Răspunsul co-semnării se leagă de aceeași
  // sesizare prin tokenul partajat (HMAC din cod).
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = authorityOutboundMessageId(sesizare.code);
  // From = numele co-semnatarului <sesizari@civia.ro>
  const fromHeader = buildFromHeader(nume, "sesizari@civia.ro");

  // Trimite real
  const result = await sendEmail({
    to: primaryEmails,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    bcc: email ? [email] : undefined, // copie la cosignar dacă a lăsat email
    subject,
    html,
    text: formalText,
    replyTo,
    from: fromHeader,
    headers: { "Message-ID": outboundMessageId },
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (!result.ok || !result.id) {
    Sentry.captureMessage("cosign-send failed", {
      level: "error",
      tags: { kind: "cosign_send_failure", code: sesizare.code },
      extra: { result, nume, ip },
    });
    return NextResponse.json(
      { error: "Email-ul nu a putut fi trimis. Reîncearcă în câteva minute." },
      { status: 502 },
    );
  }

  // 2026-06-03 — FIX: bump status "nou" → "trimis" când cosign-ul e
  // PRIMA trimitere reală către autoritate. Înainte cosign-send trimitea
  // emailul dar NU actualiza statusul → sesizarea rămânea „NOU" deși emailul
  // ajunsese la primărie (caz 00058: autorul n-a trimis via Civia, doar
  // co-semnatarul → status blocat pe „nou", confuz pentru cetățean).
  //
  // Logica: dacă sesizarea nu a fost încă trimisă via Civia (sent_via_civia
  // false/null) marcăm trimiterea — sent_via_civia, sent_at, resend_message_id
  // (ca webhook-ul de delivery să poată face match), sent_to_emails, și
  // bump status „nou" → „trimis". Nu suprascriem dacă autorul a trimis deja.
  const wasUntracked = !sesizare.sent_via_civia;
  if (wasUntracked) {
    const now = new Date().toISOString();
    try {
      await admin
        .from("sesizari")
        .update({
          sent_via_civia: true,
          sent_at: now,
          resend_message_id: result.id,
          sent_to_emails: [...primaryEmails, ...ccEmails],
          delivery_status: "sent",
          ...(sesizare.status === "nou" ? { status: "trimis" } : {}),
        })
        .eq("id", sesizare.id);
    } catch {
      // best-effort — emailul a plecat deja, statusul se poate corecta ulterior
    }
    // Timeline event vizibil „trimisă către autorități" (cosign_send e filtrat
    // din timeline-ul public; acesta apare ca etapă reală de trimitere).
    if (sesizare.status === "nou") {
      try {
        await admin.from("sesizare_timeline").insert({
          sesizare_id: sesizare.id,
          event_type: "trimis_via_civia",
          description: `Email trimis către ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"} prin Civia.`,
        });
      } catch {
        // best-effort
      }
    }
  }

  // Salvează cosignul în DB (best-effort — failure aici nu blochează succes,
  // emailul a plecat deja).
  try {
    await admin.from("sesizare_cosigners").insert({
      sesizare_id: sesizare.id,
      name: nume,
      email,
      city: extractLocality(adresa),
      ip_hash: ip ? Buffer.from(ip).toString("base64").slice(0, 16) : null,
    });
  } catch (cosignErr) {
    // 23505 = duplicate cosign (idempotent). OK.
    if (cosignErr instanceof Error && !cosignErr.message.includes("23505")) {
      Sentry.captureMessage("cosign-send: DB insert failed (email sent OK)", {
        level: "warning",
        tags: { kind: "cosign_db_fail", code: sesizare.code },
      });
    }
  }

  // Timeline event — INSERT cu description ANONIMĂ (PRIVACY FIX 2026-05-24).
  // Înainte includea numele cetățeanului care a co-semnat („X Y a trimis...")
  // → leak public pe /sesizari/[code]. Acum description e generică; oricum
  // pe timeline public eventul `cosign_send` e filtrat complet, dar păstrăm
  // descriere safe pentru audit + owner view + admin view.
  try {
    await admin.from("sesizare_timeline").insert({
      sesizare_id: sesizare.id,
      event_type: "cosign_send",
      description: "Un cetățean a co-semnat și a trimis acest email către autorități prin Civia.",
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({
    ok: true,
    message_id: result.id,
    sent_to: primaryEmails,
  });
}
