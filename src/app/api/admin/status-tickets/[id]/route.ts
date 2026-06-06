import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import {
  sendEmail,
  emailTemplate,
  emailGreeting,
  emailNoteCallout,
  emailStatusPill,
  escapeEmailHtml,
} from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";
import { rateLimitAsync } from "@/lib/ratelimit";
import { logAdminAction } from "@/lib/audit";
import {
  SESIZARE_STATUS_META,
  SESIZARE_STATUS_VALUES,
  timelineEventForStatus,
  type SesizareStatus,
} from "@/lib/sesizari/status";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decision_note: z.string().trim().max(500).optional(),
  /** Admin-applied overrides (only consumed on `approved`). When omitted
   *  we fall back to the ticket's proposed values. */
  applied_status: z.enum(SESIZARE_STATUS_VALUES).optional(),
  applied_note: z.string().trim().min(1).max(500).optional(),
  /** ISO 8601 timestamp at which the event actually happened in the
   *  real world. Used as the timeline row's `created_at` so the
   *  citizen-visible chronology reflects reality, not "moment of
   *  approval". When omitted the trigger uses now(). */
  event_at: z.string().datetime().optional(),
});

/**
 * Admin decides a citizen-submitted status ticket.
 *
 * On `approved`: flips the parent sesizare's status to the proposed
 * value, writes a timeline row using the proposer's note, marks the
 * ticket decided, and emails the proposer + sesizare author.
 *
 * On `rejected`: marks the ticket decided + emails the proposer (so
 * they know it wasn't lost in a queue).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const rl = await rateLimitAsync(`admin-ticket-decide:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe acțiuni. Așteaptă un minut." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input invalid" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Load the ticket (must still be pending).
  const { data: ticket, error: fetchErr } = await admin
    .from("sesizare_status_tickets")
    .select("id, sesizare_id, user_id, proposed_status, note, decision")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.decision !== "pending") {
    return NextResponse.json(
      { error: `Ticket-ul a fost deja ${ticket.decision === "approved" ? "aprobat" : "respins"}.` },
      { status: 409 },
    );
  }

  // Stamp the decision first — even if the side-effects below fail,
  // we never want a ticket flickering between pending and decided.
  const decidedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("sesizare_status_tickets")
    .update({
      decision: parsed.data.decision,
      decision_note: parsed.data.decision_note ?? null,
      decided_by: user.id,
      decided_at: decidedAt,
    })
    .eq("id", ticket.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // audit #94 — log decizia de moderare a ticket-ului de status (aprobă/respinge).
  await logAdminAction({
    req,
    actorId: user.id,
    action: "status_ticket.decide",
    targetType: "sesizare_status_ticket",
    targetId: ticket.id,
    before: { decision: "pending" },
    after: { decision: parsed.data.decision },
    metadata: {
      sesizare_id: ticket.sesizare_id,
      proposed_status: ticket.proposed_status,
    },
  });

  // Pre-fetch the sesizare for emails + status side-effect. Pull
  // `author_name` so the status-change email to the author has a
  // proper salutation („Salut, Eduard,") instead of „Bună,".
  const { data: sesizare } = await admin
    .from("sesizari")
    .select("id, code, titlu, status, author_email, author_name, resolved_at")
    .eq("id", ticket.sesizare_id)
    .maybeSingle();

  // Track the author email for the status-change notification at the
  // bottom of the handler. Captured before mutating the row so we always
  // see the original author_email even if the update reshapes the record.
  const authorEmail = sesizare?.author_email ?? null;
  const previousStatus = sesizare?.status ?? null;

  // Approve path — apply the (possibly admin-edited) status to the sesizare.
  // The admin can override the proposed status, the description that ends
  // up in the timeline, and the timestamp at which the event happened in
  // the real world. Defaults preserve the original proposer's intent.
  const appliedStatus = (parsed.data.applied_status ?? ticket.proposed_status) as SesizareStatus;
  const appliedNote = parsed.data.applied_note?.trim() || ticket.note;
  const eventAt = parsed.data.event_at ?? decidedAt;

  if (parsed.data.decision === "approved" && sesizare) {
    if (appliedStatus !== sesizare.status) {
      const updatePayload: Record<string, unknown> = { status: appliedStatus };
      if (appliedStatus === "rezolvat" && !sesizare.resolved_at) {
        // Mirror the admin-stamped event time, not the moment of click,
        // so /sesizari-rezolvate ranks by when it actually got fixed.
        updatePayload.resolved_at = eventAt;
      }
      const { error: sErr } = await admin
        .from("sesizari")
        .update(updatePayload)
        .eq("id", sesizare.id);
      if (sErr) {
        Sentry.captureException(sErr, {
          tags: { kind: "ticket_apply_status" },
          extra: { ticketId: ticket.id, code: sesizare.code },
        });
      }

      const eventType = timelineEventForStatus(appliedStatus);
      if (eventType) {
        // Dedup vs. the latest existing timeline row — if the admin
        // already applied this status manually, the citizen ticket
        // shouldn't add a second visually identical row. The shared
        // helper stamps the row at `eventAt` so the timeline still
        // reflects when the action actually happened in real life.
        await appendTimelineEvent({
          admin,
          sesizareId: sesizare.id,
          eventType,
          description: appliedNote?.trim() ?? null,
          createdAt: eventAt,
          sentryTags: { source: "ticket_approve_route" },
          sentryExtra: { ticketId: ticket.id, code: sesizare.code },
        });
      }

      invalidateSesizariCache();
    }
  }

  // Notify the proposer (best-effort). The author of the parent
  // sesizare gets a separate email through the status-change flow if
  // they're not the same person. Pull `full_name` too so the
  // salutation prefers a real name over the auto-generated email
  // local-part display_name.
  const { data: proposerProfile } = await admin
    .from("profiles")
    .select("id, display_name, full_name")
    .eq("id", ticket.user_id)
    .maybeSingle();

  // Pull the proposer's email from auth.users via the admin API.
  let proposerEmail: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(ticket.user_id);
    proposerEmail = data.user?.email ?? null;
  } catch {
    proposerEmail = null;
  }

  // Notify the parent sesizare's author about the status change too —
  // mirrors the email the admin status endpoint sends. Skip when the
  // proposer IS the author (the proposer email already covers it) or
  // when there's no email on file or the status didn't actually move.
  if (
    parsed.data.decision === "approved" &&
    sesizare &&
    authorEmail &&
    authorEmail !== proposerEmail &&
    previousStatus !== appliedStatus
  ) {
    const meta = SESIZARE_STATUS_META[appliedStatus];
    const sesizareUrl = `${SITE_URL}/sesizari/${sesizare.code}`;
    const authorSalutation = buildSalutation({
      // sesizare.author_name is what the citizen typed at submit time
      // — the most reliable signal of their actual first name.
      fullName: (sesizare as { author_name?: string | null }).author_name ?? null,
      email: authorEmail,
    });
    const noteCallout = appliedNote?.trim()
      ? emailNoteCallout({
          label: "Update raportat de comunitate",
          text: appliedNote,
          tone: "primary",
        })
      : "";
    try {
      await sendEmail({
        to: authorEmail,
        subject: `${meta.emoji} ${meta.label} · Sesizarea ${sesizare.code} · Civia`,
        html: emailTemplate({
          title: meta.label,
          preheader: sesizare.titlu,
          kicker: `STATUS · ${meta.label.toUpperCase()}`,
          icon: meta.emoji,
          body: `${emailGreeting(
            authorSalutation,
            `Statusul sesizării tale <strong>${escapeEmailHtml(sesizare.code)}</strong> a fost actualizat în urma unei propuneri verificate de comunitate.`,
          )}
                 <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600">Status nou</p>
                 <p style="margin:0 0 16px">${emailStatusPill({ label: meta.label, emoji: meta.emoji, color: meta.color })}</p>
                 <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a"><strong>${escapeEmailHtml(sesizare.titlu)}</strong></p>
                 ${noteCallout}`,
          ctaText: "Vezi sesizarea",
          ctaUrl: sesizareUrl,
        }),
      });
    } catch (emailErr) {
      Sentry.captureException(emailErr, {
        tags: { kind: "ticket_author_email" },
        extra: { ticketId: ticket.id, code: sesizare.code },
      });
    }
  }

  if (proposerEmail && sesizare) {
    const approved = parsed.data.decision === "approved";
    // Email the proposer with the FINAL applied status — if the admin
    // overrode the proposal, the proposer should see what actually
    // landed, not what they guessed.
    const meta = SESIZARE_STATUS_META[
      (approved ? appliedStatus : ticket.proposed_status) as SesizareStatus
    ];
    const sesizareUrl = `${SITE_URL}/sesizari/${sesizare.code}`;
    const proposerSalutation = buildSalutation({
      fullName:
        (proposerProfile as { full_name?: string | null } | null)?.full_name ?? null,
      displayName:
        (proposerProfile as { display_name?: string | null } | null)?.display_name ?? null,
      email: proposerEmail,
    });
    const decisionNoteCallout = parsed.data.decision_note
      ? emailNoteCallout({
          label: "Notă admin",
          text: parsed.data.decision_note,
          tone: approved ? "primary" : "muted",
        })
      : "";
    const lead = approved
      ? `Propunerea ta pentru sesizarea <strong>${escapeEmailHtml(sesizare.code)}</strong> a fost aprobată. Mulțumim că ții comunitatea informată.`
      : `Propunerea ta pentru sesizarea <strong>${escapeEmailHtml(sesizare.code)}</strong> nu a fost aprobată — nu am putut verifica suficient datele primite. Poți încerca din nou cu o dovadă mai clară.`;
    const statusLabel = approved
      ? "Status aplicat"
      : "Status propus de tine";
    const body = `
      ${emailGreeting(proposerSalutation, lead)}
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600">${statusLabel}</p>
      <p style="margin:0 0 16px">${emailStatusPill({ label: meta?.label ?? ticket.proposed_status, emoji: meta?.emoji ?? "🏷️", color: meta?.color ?? "#64748b" })}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a"><strong>${escapeEmailHtml(sesizare.titlu)}</strong></p>
      ${decisionNoteCallout}
    `;
    try {
      await sendEmail({
        to: proposerEmail,
        subject: approved
          ? `✅ Propunerea ta a fost aprobată · Sesizarea ${sesizare.code} · Civia`
          : `Propunerea ta nu a fost aprobată · Sesizarea ${sesizare.code} · Civia`,
        html: emailTemplate({
          title: approved ? "Propunere aprobată" : "Propunere respinsă",
          preheader: sesizare.titlu,
          kicker: approved ? "TICKET · APROBAT" : "TICKET · RESPINS",
          icon: approved ? "✅" : "ℹ️",
          body,
          ctaText: "Vezi sesizarea",
          ctaUrl: sesizareUrl,
        }),
      });
    } catch (emailErr) {
      Sentry.captureException(emailErr, {
        tags: { kind: "ticket_decision_email" },
        extra: { ticketId: ticket.id, decision: parsed.data.decision },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
