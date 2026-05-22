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
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { buildFormalText } from "@/lib/sesizari/mailto";
import { extractLocality } from "@/lib/sesizari/extract-locality";

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

  // Lookup sesizare
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, tip, locatie, sector, county, descriere, formal_text, imagini")
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

  // Resolve authorities
  const recipients = getAuthoritiesFor(
    sesizare.tip,
    sesizare.sector,
    sesizare.county,
    sesizare.locatie,
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

  // Subject — explicit „Co-semnătură" prefix ca primăriile să nu confunde
  // cu o sesizare nouă duplicate. Rămâne pe același cod ca să se grupeze.
  const subject = `Co-semnătură — Sesizare ${sesizare.code} — ${sesizare.titlu}`;

  // Reply-To rămâne sesizari@civia.ro (Worker → /api/inbox/reply pipeline)
  const replyTo = `sesizari@civia.ro`;
  // From = numele co-semnatarului <sesizari@civia.ro>
  const fromHeader = `${nume} <sesizari@civia.ro>`;

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

  // Timeline event — vizibil pe pagina sesizării
  try {
    await admin.from("sesizare_timeline").insert({
      sesizare_id: sesizare.id,
      event_type: "cosign_send",
      description: `${nume} a co-semnat și a trimis email separat către autorități prin Civia.`,
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
