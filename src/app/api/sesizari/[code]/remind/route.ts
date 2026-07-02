import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { replyToAddress } from "@/lib/inbox/reply-token";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { evaluateOverdue } from "@/lib/sesizari/overdue";
import { stripPrivateAddress } from "@/lib/privacy";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/sanitize";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/sesizari/[code]/remind
 *
 * Trimite o REAMINTIRE formală (art. 14 OG 27/2002) către autorități DIRECT
 * de pe sesizari@civia.ro, pentru o sesizare cu termenul depășit. Spre
 * deosebire de vechiul flux `mailto` (care deschidea clientul de email al
 * userului), asta pleacă server-side, ca send-via-civia.
 *
 * Design (cerut de owner 2026-07-01):
 *   - o poate declanșa ORICINE (nudge comunitar), nu doar autorul;
 *   - conținut IMPERSONAL + ANONIM (fără „Mă numesc / locuiesc", fără nume);
 *   - Reply-To = token opac → răspunsul autorității ajunge în inbox-ul Civia.
 * Anti-abuz: rate-limit pe IP (5/h) + cooldown pe sesizare (1 / 3 zile) ca să
 * nu spamăm autoritatea, și DOAR pe sesizări cu termen depășit.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = getClientIp(req);
  const { code } = await params;

  const rlIp = await rateLimitAsync(`remind-ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rlIp.success) {
    return NextResponse.json({ error: "Prea multe reamintiri. Încearcă mai târziu." }, { status: 429 });
  }

  const sesizare = await getSesizareByCode(code);
  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare negăsită." }, { status: 404 });
  }

  // Doar sesizări deja trimise + cu termenul legal depășit.
  if (sesizare.status === "nou" && !sesizare.sent_via_civia) {
    return NextResponse.json({ error: "Sesizarea nu a fost încă trimisă." }, { status: 400 });
  }
  const overdue = evaluateOverdue({
    created_at: sesizare.created_at,
    status: sesizare.status,
    official_response_at: sesizare.official_response_at ?? null,
  });
  if (!overdue.isOverdue) {
    return NextResponse.json({ error: "Sesizarea nu are termenul de răspuns depășit." }, { status: 400 });
  }

  // Cooldown pe sesizare — nu spamăm autoritatea cu reamintiri.
  const rlCode = await rateLimitAsync(`remind-code:${code}`, { limit: 1, windowMs: 3 * 24 * 60 * 60_000 });
  if (!rlCode.success) {
    return NextResponse.json(
      { error: "S-a trimis deja o reamintire recent pentru această sesizare. Reîncearcă peste câteva zile." },
      { status: 429 },
    );
  }

  // Destinatari (aceleași autorități ca la trimiterea inițială).
  const effectiveCounty = sesizare.county ?? detectCountyFromLocatie(sesizare.locatie) ?? null;
  const recipients = getAuthoritiesFor(
    sesizare.tip,
    sesizare.sector,
    effectiveCounty,
    sesizare.locatie,
    undefined,
    sesizare.descriere,
  );
  const primaryEmails = (recipients.primary ?? []).map((a) => a.email).filter(Boolean);
  const ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);
  if (primaryEmails.length === 0) {
    return NextResponse.json({ error: "Nu am putut determina destinatarii." }, { status: 422 });
  }

  // Corpul sesizării inițiale, ANONIMIZAT (scoate „Mă numesc/locuiesc" +
  // semnătura, la fel ca afișarea publică). Fallback la descriere.
  const anonOriginal = (sesizare.formal_text
    ? stripPrivateAddress(sesizare.formal_text, sesizare.author_name)
    : (sesizare.descriere ?? "")
  ).trim();
  const filed = formatDate(sesizare.created_at);
  const n = overdue.daysOverdue;
  const zile = n === 1 ? "zi" : "zile";

  const reminderText = `Bună ziua,

Vă reamintim că, pentru sesizarea depusă pe ${filed}, termenul legal de 30 de zile prevăzut de art. 14 alin. (1) din OG 27/2002 privind soluționarea petițiilor a fost depășit cu ${n} ${zile}.

Vă rugăm respectuos să comunicați:
1. Stadiul actual al sesizării și măsurile concrete luate;
2. Termenul estimat de finalizare;
3. Numărul de înregistrare alocat (dacă nu a fost deja comunicat).

Reiau mai jos textul sesizării inițiale pentru claritate:

──────────────────────────

${anonOriginal}

──────────────────────────

În lipsa unui răspuns în 10 zile de la prezenta reamintire, sesizarea poate fi escaladată la Avocatul Poporului și la instanța de contencios administrativ, conform legii.

${filed}`;

  const paragraphs = reminderText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const htmlBody = paragraphs
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`;

  const subject = `Reamintire — Sesizare ${sesizare.code} — ${sesizare.titlu}`;
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = `<reamintire-${sesizare.code}-${randomUUID().slice(0, 12)}@civia.ro>`;
  // Expeditor NEUTRAL (impersonal — oricine poate trimite reamintirea), legat de
  // sesizare pentru context/threading, fără numele cetățeanului.
  const fromHeader = buildFromHeader(`Sesizare ${sesizare.code}`, "sesizari@civia.ro");

  const result = await sendEmail({
    to: primaryEmails,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    subject,
    html,
    text: reminderText,
    replyTo,
    from: fromHeader,
    headers: { "Message-ID": outboundMessageId },
  });

  if (!result.ok || !result.id) {
    Sentry.captureMessage("remind: send failed", {
      level: "error",
      tags: { kind: "remind_send_fail", code: sesizare.code },
      extra: { primaryEmails, result },
    });
    return NextResponse.json({ error: "Reamintirea nu a putut fi trimisă. Încearcă din nou." }, { status: 500 });
  }

  // Timeline (best-effort).
  try {
    const admin = createSupabaseAdmin();
    await appendTimelineEvent({
      admin,
      sesizareId: sesizare.id,
      eventType: "reamintire",
      description: `Reamintire formală trimisă către ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"} (termen depășit cu ${n} ${zile}).`,
      createdBy: null,
      sentryTags: { kind: "remind_timeline_fail", code: sesizare.code },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, to: primaryEmails, count: primaryEmails.length });
}
