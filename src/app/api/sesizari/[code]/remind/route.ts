import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { replyToAddress, makeReplyToken } from "@/lib/inbox/reply-token";
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

const COOLDOWN_MS = 3 * 24 * 60 * 60_000; // o reamintire / 3 zile / sesizare

/**
 * POST /api/sesizari/[code]/remind
 *
 * Trimite o REAMINTIRE formală (art. 14 OG 27/2002) către autorități DIRECT
 * de pe sesizari@civia.ro, pentru o sesizare cu termenul depășit. Pleacă
 * server-side (ca send-via-civia), NU prin mailto-ul userului.
 *
 * Design (cerut de owner 2026-07-01):
 *   - o poate declanșa ORICINE (nudge comunitar), nu doar autorul;
 *   - conținut IMPERSONAL + ANONIM (fără nume/adresă);
 *   - Reply-To = token opac → răspunsul autorității ajunge în inbox-ul Civia.
 * Anti-abuz: DOAR pe sesizări chiar TRIMISE (sent_via_civia) și cu termen
 * depășit; rate-limit IP (5/h) + cooldown pe sesizare (1/3 zile, bazat pe
 * evenimentele reale de reamintire din timeline → un send eșuat NU blochează).
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

  // DOAR sesizări chiar trimise către autoritate. `sent_via_civia` e semnalul
  // canonic de „expediat" (setat de send-via-civia + cosign-send), independent
  // de status — altfel o sesizare nedispecerizată devenită „ignorat" de cron ar
  // permite reamintiri către autorități care n-au primit niciodată originalul.
  if (!sesizare.sent_via_civia) {
    return NextResponse.json({ error: "Sesizarea nu a fost încă trimisă către autoritate." }, { status: 400 });
  }
  const overdue = evaluateOverdue({
    created_at: sesizare.created_at,
    status: sesizare.status,
    official_response_at: sesizare.official_response_at ?? null,
  });
  if (!overdue.isOverdue) {
    return NextResponse.json({ error: "Sesizarea nu are termenul de răspuns depășit." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Cooldown pe sesizare — bazat pe evenimentele REALE de reamintire (scrise doar
  // pe send reușit), NU pe rate-limiter pre-consumat: un send eșuat nu blochează 3 zile.
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: recentRemind } = await admin
    .from("sesizare_timeline")
    .select("id")
    .eq("sesizare_id", sesizare.id)
    .eq("event_type", "reamintire")
    .gte("created_at", since)
    .limit(1);
  if (recentRemind && recentRemind.length > 0) {
    return NextResponse.json(
      { error: "S-a trimis deja o reamintire recent pentru această sesizare. Reîncearcă peste câteva zile.", cooldown: true },
      { status: 429 },
    );
  }

  // Destinatari: PREFERĂM lista reală la care a plecat originalul (sent_to_emails)
  // ca reamintirea să ajungă la ACELEAȘI autorități. Fallback la recompute doar
  // dacă lipsește (rutare posibil schimbată între timp).
  let toEmails = (sesizare.sent_to_emails ?? []).filter(Boolean);
  let ccEmails: string[] = [];
  if (toEmails.length === 0) {
    const effectiveCounty = sesizare.county ?? detectCountyFromLocatie(sesizare.locatie) ?? null;
    const recipients = getAuthoritiesFor(
      sesizare.tip,
      sesizare.sector,
      effectiveCounty,
      sesizare.locatie,
      undefined,
      sesizare.descriere,
    );
    toEmails = (recipients.primary ?? []).map((a) => a.email).filter(Boolean);
    ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);
  }
  if (toEmails.length === 0) {
    return NextResponse.json({ error: "Nu am putut determina destinatarii." }, { status: 422 });
  }

  // Corpul sesizării inițiale, ANONIMIZAT (scoate nume/adresă + semnătură). AMBELE
  // ramuri (formal_text ȘI fallback-ul descriere) trec prin scrub — descriere e
  // text liber al cetățeanului, poate conține „Mă numesc/telefon/adresă".
  const anonOriginal = stripPrivateAddress(
    sesizare.formal_text || sesizare.descriere || "",
    sesizare.author_name,
  ).trim();
  const filed = formatDate(sesizare.created_at);
  const today = formatDate(new Date());
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

În lipsa unui răspuns, sesizarea poate fi escaladată la Avocatul Poporului și la instanța de contencios administrativ, conform legii.

${today}`;

  const paragraphs = reminderText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const htmlBody = paragraphs
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`;

  const subject = `Reamintire — Sesizare ${sesizare.code} — ${sesizare.titlu}`;
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = `<sesizare-${sesizare.code}-remind-${randomUUID().slice(0, 8)}@civia.ro>`;
  // Expeditor NEUTRAL (impersonal — oricine poate trimite), legat de sesizare
  // pentru threading, fără numele cetățeanului.
  const fromHeader = buildFromHeader(`Sesizare ${sesizare.code}`, "sesizari@civia.ro");

  const result = await sendEmail({
    to: toEmails,
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
      extra: { toEmails, result },
    });
    return NextResponse.json({ error: "Reamintirea nu a putut fi trimisă. Încearcă din nou." }, { status: 500 });
  }

  // Persistă reply_token dacă lipsește (rânduri vechi trimise manual / înainte de
  // migrația 096) — ca matching-ul N1 al răspunsului la reamintire să funcționeze.
  // `.is(reply_token, null)` = update DOAR pe rândurile fără token (idempotent,
  // deterministic per cod; nu atingem thread-ul original deja tokenizat).
  try {
    await admin
      .from("sesizari")
      .update({ reply_token: makeReplyToken(sesizare.code) })
      .eq("id", sesizare.id)
      .is("reply_token", null);
  } catch { /* non-fatal */ }

  // Timeline (scris DOAR pe succes → alimentează și cooldown-ul de mai sus).
  try {
    await appendTimelineEvent({
      admin,
      sesizareId: sesizare.id,
      eventType: "reamintire",
      description: `Reamintire formală trimisă către ${toEmails.length} ${toEmails.length === 1 ? "autoritate" : "autorități"} (termen depășit cu ${n} ${zile}).`,
      createdBy: null,
      sentryTags: { kind: "remind_timeline_fail", code: sesizare.code },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, to: toEmails, count: toEmails.length });
}
