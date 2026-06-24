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
  escapeEmailHtml,
} from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";
import { rateLimitAsync } from "@/lib/ratelimit";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Verify admin role
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

  // Each approve/reject triggers a Resend email — cap per-admin moderate
  // rate to stop a runaway script (or stolen admin session) from
  // flooding user inboxes.
  const rl = await rateLimitAsync(`admin-moderate:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe acțiuni de moderare. Așteaptă un minut." },
      { status: 429 }
    );
  }

  const admin = createSupabaseAdmin();
  // 2026-06-24 — citim direct din tabela `sesizari` (RLS-bypass), NU din
  // getSesizareByCode → view-ul sesizari_feed filtrează moderation_status='approved',
  // deci o sesizare PENDING (exact ce trebuie moderat) întorcea null → 404.
  const { data: sesizare } = await admin
    .from("sesizari")
    .select("id, code, titlu, author_email, author_name, moderation_status")
    .eq("code", code)
    .maybeSingle<{
      id: string; code: string; titlu: string;
      author_email: string | null; author_name: string | null; moderation_status: string;
    }>();
  if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { error } = await admin
    .from("sesizari")
    .update({
      moderation_status: parsed.data.action === "approve" ? "approved" : "rejected",
    })
    .eq("id", sesizare.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateSesizariCache();

  // 2026-05-24 Faza 5: audit log moderation action.
  await logAdminAction({
    req,
    actorId: user.id,
    action: `sesizare.${parsed.data.action}`,
    targetType: "sesizare",
    targetId: sesizare.id,
    before: { moderation_status: sesizare.moderation_status },
    after: { moderation_status: parsed.data.action === "approve" ? "approved" : "rejected" },
    metadata: { code: sesizare.code },
  });

  // Best-effort: email the author with the moderation outcome. Silent if
  // Resend isn't configured or the sesizare has no contact email.
  const recipient = sesizare.author_email;
  if (recipient) {
    const approved = parsed.data.action === "approve";
    const sesizareUrl = `${SITE_URL}/sesizari/${sesizare.code}`;
    const trackUrl = `${SITE_URL}/urmareste?code=${sesizare.code}`;
    const salutation = buildSalutation({
      fullName: sesizare.author_name,
      email: recipient,
    });
    const lead = approved
      ? `Sesizarea ta <strong>${escapeEmailHtml(sesizare.code)}</strong> a fost aprobată și este acum vizibilă public pe Civia.`
      : `Sesizarea ta <strong>${escapeEmailHtml(sesizare.code)}</strong> a fost respinsă de moderare.`;
    const body = approved
      ? `${emailGreeting(salutation, lead)}
         <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a"><strong>${escapeEmailHtml(sesizare.titlu)}</strong></p>
         <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">Poți urmări statusul, votul comunității și comentariile oricând.</p>`
      : `${emailGreeting(salutation, lead)}
         <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a"><strong>${escapeEmailHtml(sesizare.titlu)}</strong></p>
         <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">Motive frecvente: limbaj inadecvat, conținut duplicat, date personale sensibile sau informații insuficiente. Poți trimite o sesizare nouă cu detalii clare.</p>`;
    // sendEmail e best-effort — Resend down nu trebuie să blocheze
    // răspunsul către admin (DB update deja a avut succes).
    try {
      await sendEmail({
        to: recipient,
        subject: approved
          ? `✓ Sesizarea ${sesizare.code} a fost aprobată · Civia`
          : `Sesizarea ${sesizare.code} a fost respinsă · Civia`,
        html: emailTemplate({
          title: approved ? "Sesizare aprobată" : "Sesizare respinsă",
          preheader: sesizare.titlu,
          kicker: approved ? "MODERARE · APROBAT" : "MODERARE · RESPINS",
          icon: approved ? "✅" : "⚠️",
          body,
          ctaText: approved ? "Vezi sesizarea" : "Urmărește codul",
          ctaUrl: approved ? sesizareUrl : trackUrl,
        }),
      });
    } catch (emailErr) {
      // Log la Sentry dar continuă — DB-ul e deja consistent.
      // Sentry surface = dashboard alert pentru email delivery failures.
      Sentry.captureException(emailErr, {
        tags: { kind: "moderate_email" },
        extra: { code: sesizare.code, action: parsed.data.action },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
