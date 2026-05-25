/**
 * Broadcast notificări civice (petiție nouă / protest aprobat) către
 * subscribers via 3 canale: push (deja făcut prin broadcastToAllSubscribers
 * din web-push-client), email, SMS.
 *
 * Per canal:
 *   Email: query profiles.notify_{petitii|proteste}_email = true
 *          + email NOT NULL → sendEmail batch via Resend.
 *   SMS:   query profiles.notify_{petitii|proteste}_sms = true
 *          + phone NOT NULL → sendSmsBatch via Twilio.
 *
 * GDPR: doar useri cu opt-in explicit primesc. Niciun broadcast la
 * useri fără consimțământ explicit. Verificarea pe DB la fiecare send
 * (nu cache static — preferințele se schimbă în timp real).
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { sendSmsBatch } from "@/lib/sms/send-sms";
import { SITE_URL } from "@/lib/constants";

type CivicKind = "petitie" | "protest";

interface BroadcastArgs {
  kind: CivicKind;
  title: string;
  /** Optional short context shown in email body / SMS. */
  subtitle?: string | null;
  /** Path către pagina specifică pe Civia (fără origin). */
  path: string;
}

/**
 * Trimite email + SMS la subscribers cu opt-in explicit pentru kind-ul dat.
 * Returnează stats per canal. Folosit din `/api/admin/petitii` (POST) și
 * `/api/admin/proteste/[id]` (PATCH la transition → approved).
 */
export async function broadcastNewCivicContent(
  args: BroadcastArgs,
): Promise<{
  email: { sent: number; failed: number; skipped: number };
  sms: { sent: number; failed: number; skipped: number };
}> {
  const admin = createSupabaseAdmin();
  const url = `${SITE_URL}${args.path}`;

  const emailCol =
    args.kind === "petitie" ? "notify_petitii_email" : "notify_proteste_email";
  const smsCol =
    args.kind === "petitie" ? "notify_petitii_sms" : "notify_proteste_sms";

  // Fetch toți subscribers opt-in. Service role bypassează RLS.
  const [emailRes, smsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("email")
      .eq(emailCol, true)
      .not("email", "is", null),
    admin
      .from("profiles")
      .select("phone")
      .eq(smsCol, true)
      .not("phone", "is", null),
  ]);

  const emails =
    ((emailRes.data ?? []) as Array<{ email: string | null }>)
      .map((r) => r.email)
      .filter((e): e is string => !!e && e.includes("@"));

  const phones =
    ((smsRes.data ?? []) as Array<{ phone: string | null }>)
      .map((r) => r.phone)
      .filter((p): p is string => !!p && p.trim().length >= 6);

  // ─── Email ─────────────────────────────────────────────────────────
  const emojiLead = args.kind === "petitie" ? "📣" : "✊";
  const labelRO =
    args.kind === "petitie" ? "Petiție nouă pe Civia" : "Protest nou anunțat";
  const ctaText =
    args.kind === "petitie" ? "Vezi petiția" : "Vezi protestul";
  const explainer =
    args.kind === "petitie"
      ? "O cauză civică pe care o poți semna direct pe Civia sau pe site-ul oficial."
      : "O manifestare publică anunțată. Informează-te despre dată, loc și obiective.";

  const subject = `${emojiLead} ${labelRO}: ${args.title}`;
  const optInLabel = args.kind === "petitie" ? "petiții" : "proteste";
  const bodyHtml = emailTemplate({
    kicker: labelRO.toUpperCase(),
    icon: emojiLead,
    title: args.title,
    preheader: explainer,
    body: `
      <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.6">
        ${escapeHtml(explainer)}
      </p>
      ${
        args.subtitle
          ? `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5">${escapeHtml(args.subtitle)}</p>`
          : ""
      }
      <p style="margin:24px 0 8px;color:#94a3b8;font-size:12px;line-height:1.5">
        Primești emailul ăsta pentru că ai opt-in pentru notificări „${optInLabel}” în <a href="${SITE_URL}/cont" style="color:#059669">/cont</a> pe Civia.
        Poți dezactiva oricând cu un click.
      </p>
    `,
    ctaText,
    ctaUrl: url,
  });

  const emailStats = { sent: 0, failed: 0, skipped: 0 };
  if (emails.length > 0) {
    // Trimit individual ca să respectăm Resend rate-limit (~10 emails/sec).
    // Loop simplu — pentru >100 subscribers fă-o serial cu mic delay.
    for (const e of emails) {
      const res = await sendEmail({
        to: e,
        subject,
        html: bodyHtml,
      });
      if (res.ok) emailStats.sent += 1;
      else emailStats.failed += 1;
      if (emailStats.sent + emailStats.failed >= 200) break; // safety cap
    }
  }

  // ─── SMS ───────────────────────────────────────────────────────────
  // SMS sub 160 chars (1 SMS = 1 cost unit). Scurt + URL Civia scurtat.
  const smsBody = `${emojiLead} ${labelRO}: ${truncate(args.title, 80)}\n${url}`;
  const smsStats =
    phones.length > 0
      ? await sendSmsBatch(
          phones.map((p) => ({ phone: p })),
          smsBody,
        )
      : { sent: 0, failed: 0, skipped: 0 };

  return { email: emailStats, sms: smsStats };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
