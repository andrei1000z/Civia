import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import { sendEmail } from "@/lib/email/resend";
import { buildStatusUpdateEmail } from "@/lib/email/status-update";
import { rateLimitAsync } from "@/lib/ratelimit";
import { logAdminAction } from "@/lib/audit";
import {
  SESIZARE_STATUS_META,
  SESIZARE_STATUS_VALUES,
  timelineEventForStatus,
  type SesizareStatus,
} from "@/lib/sesizari/status";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { isBlockedRegression, blockedRegressionMessage } from "@/lib/sesizari/state-machine";
import { sendPushToUsers } from "@/lib/push/web-push-client";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

const schema = z.object({
  status: z.enum(SESIZARE_STATUS_VALUES),
  official_response: z.string().trim().max(5000).optional(),
  /**
   * Optional admin-typed note shown next to the timeline label. If
   * omitted we fall back to a generic "Status actualizat" string,
   * which the timeline UI hides via `isRedundantEventDescription`.
   */
  note: z.string().trim().max(500).optional(),
  /**
   * 2026-05-25 — opțional, URL-ul pozei „după" când admin marchează
   * status=rezolvat. Apare în secțiunea Before/After pe pagina
   * publică a sesizării. Validăm URL https să prevenim insert
   * arbitrar de strings.
   */
  resolved_photo_url: z.string().url().nullable().optional(),
  /**
   * 2026-05-26 — multi-photo support. Până la 5 poze „după rezolvare"
   * stocate în coloana nouă resolved_photos (text[]). Prima poză e
   * automat copiată în resolved_photo_url pentru backwards compat
   * cu BeforeAfter component + image-sitemap + alte consumeri.
   */
  resolved_photos: z.array(z.string().url()).max(5).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // ─── Auth: admin only ───────────────────────────────────────
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

  // ─── Rate limit ──────────────────────────────────────────────
  const rl = await rateLimitAsync(`admin-status:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe acțiuni. Așteaptă un minut." },
      { status: 429 },
    );
  }

  // ─── Validate input + load record ────────────────────────────
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input invalid" }, { status: 400 });
  }

  const sesizare = await getSesizareByCode(code);
  if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = parsed.data.status as SesizareStatus;
  const statusChanged = newStatus !== sesizare.status;

  // 2026-06-10 (audit statusuri) — blochează regresia PERICULOASĂ (revenire la
  // nou/trimis dintr-un status avansat) care reseta timeline + eligibilitatea AVP
  // cu 1 click. Reopen-urile legitime (rezolvat→in-lucru) rămân permise.
  if (statusChanged && isBlockedRegression(sesizare.status, newStatus)) {
    return NextResponse.json(
      { error: blockedRegressionMessage(sesizare.status, newStatus) },
      { status: 400 },
    );
  }

  // ─── Update status + optional official response ──────────────
  const admin = createSupabaseAdmin();
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
  };
  if (parsed.data.official_response) {
    updatePayload.official_response = parsed.data.official_response;
    updatePayload.official_response_at = new Date().toISOString();
  }
  // 2026-06-10 (audit statusuri) — orice status care înseamnă că autoritatea
  // S-A IMPLICAT (≠ nou/trimis/ignorat) setează official_response_at dacă încă e
  // NULL, chiar fără text de răspuns. Codifică „autoritatea a fost auzită" o
  // singură dată, indiferent de canal (inbox/admin/ticket) → overdue + eligibilitatea
  // AVP rămân corecte (o sesizare deja tratată de admin nu mai apare ca escaladabilă).
  const RESPONSE_STATUSES = new Set<string>([
    "inregistrata", "in-lucru", "redirectionata", "actiune-autoritate", "interventie", "amanata", "rezolvat", "respins",
  ]);
  if (RESPONSE_STATUSES.has(newStatus) && !updatePayload.official_response_at) {
    const { data: respRow } = await admin
      .from("sesizari")
      .select("official_response_at")
      .eq("id", sesizare.id)
      .maybeSingle();
    if (!(respRow as { official_response_at?: string | null } | null)?.official_response_at) {
      updatePayload.official_response_at = new Date().toISOString();
    }
  }
  // When the admin flips status to `rezolvat` outside the citizen-author
  // path, mirror the resolved_at timestamp so /sesizari-rezolvate and
  // before/after surfaces still compute durations correctly.
  if (newStatus === "rezolvat" && !sesizare.resolved_at) {
    updatePayload.resolved_at = new Date().toISOString();
  }
  // 2026-05-25 — admin poate ataşa poza „dupa" la marcare rezolvat.
  // Permitem set și pentru sesizari deja rezolvate (re-upload / fix).
  // null trimis explicit = șterge poza existentă.
  if (parsed.data.resolved_photo_url !== undefined) {
    updatePayload.resolved_photo_url = parsed.data.resolved_photo_url;
  }
  // 2026-05-26 — multi-photo. Dacă vine `resolved_photos` array,
  // overrides `resolved_photo_url` cu prima poză (backwards compat
  // pentru BeforeAfter etc). Array gol = șterge toate pozele.
  if (parsed.data.resolved_photos !== undefined) {
    const photos = parsed.data.resolved_photos;
    updatePayload.resolved_photos = photos;
    updatePayload.resolved_photo_url = photos[0] ?? null;
  }

  const { error } = await admin
    .from("sesizari")
    .update(updatePayload)
    .eq("id", sesizare.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Timeline row ───────────────────────────────────────────
  // Only when the status actually moved — re-saving the same status
  // shouldn't pollute the timeline. The trigger writes 'depusa' on
  // insert, so transitions FROM 'nou' INTO anything else need their
  // own row.
  if (statusChanged) {
    const eventType = timelineEventForStatus(newStatus);
    if (eventType) {
      // Dedup against the latest timeline row — if the same status was
      // already applied (e.g. via a citizen ticket) and the admin
      // re-applies without a fresh note, skip the insert so the
      // timeline doesn't show two visually identical rows.
      await appendTimelineEvent({
        admin,
        sesizareId: sesizare.id,
        eventType,
        description: parsed.data.note?.trim() ?? null,
        sentryTags: { source: "admin_status_route" },
        sentryExtra: { code: sesizare.code, status: newStatus },
      });
    }
  }

  // ─── Audit log (audit #94) ──────────────────────────────────
  // Schimbarea de status e cea mai frecventă acțiune admin sensibilă —
  // o persistăm în admin_audit_log (forensics + GDPR). Fire-and-forget.
  if (statusChanged) {
    await logAdminAction({
      req,
      actorId: user.id,
      action: "sesizare.status_change",
      targetType: "sesizare",
      targetId: sesizare.id,
      before: { status: sesizare.status },
      after: { status: newStatus },
      metadata: {
        code: sesizare.code,
        official_response: !!parsed.data.official_response,
      },
    });
  }

  invalidateSesizariCache();

  // ─── Push notification to author (fire-and-forget) ───────
  // 2026-06-04 — „Urmărește" eliminat → notificăm doar autorul sesizării.
  // Best-effort, nu blocăm response-ul admin-ului.
  if (statusChanged) {
    void (async () => {
      try {
        const userIds: string[] = [];
        if (sesizare.user_id) userIds.push(sesizare.user_id);
        if (userIds.length === 0) return;
        const meta = SESIZARE_STATUS_META[newStatus];
        await sendPushToUsers(userIds, {
          title: `Sesizare ${sesizare.code}: ${meta?.label ?? newStatus}`,
          body: sesizare.titlu ?? "Status actualizat",
          url: `/sesizari/${sesizare.code}`,
          tag: `sesizare-${sesizare.code}`,
          icon: "/icon-192.png",
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { source: "push_status_notify" } });
      }
    })();
  }

  // ─── Notify author by email (best-effort) ────────────────────
  const recipient = sesizare.author_email;
  if (recipient && statusChanged) {
    try {
      const { subject, html } = buildStatusUpdateEmail({
        code: sesizare.code,
        titlu: sesizare.titlu,
        newStatus,
        summary: parsed.data.official_response ?? null,
        note: parsed.data.note ?? null,
        authorName: sesizare.author_name,
        authorEmail: recipient,
        // poze înainte (raportate) + după (de la rezolvare) → comparație în email
        imagini: (sesizare as { imagini?: string[] | null }).imagini ?? null,
        resolvedPhotos:
          parsed.data.resolved_photos ??
          (parsed.data.resolved_photo_url ? [parsed.data.resolved_photo_url] : null),
      });
      await sendEmail({ to: recipient, subject, html });
    } catch (emailErr) {
      Sentry.captureException(emailErr, {
        tags: { kind: "status_email" },
        extra: { code: sesizare.code, status: newStatus },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
