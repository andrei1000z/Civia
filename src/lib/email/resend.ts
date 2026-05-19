import { Resend } from "resend";
import { ENV, isProd } from "@/lib/env";

let client: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = ENV.RESEND_API_KEY();
  if (!key) return null;
  if (!client) {
    client = new Resend(key);
  }
  return client;
}

const FROM = process.env.RESEND_FROM_EMAIL || "Civia <onboarding@resend.dev>";

/**
 * Send email via Resend. Returns { ok, id? } pe succes / failure.
 * Silently fails if Resend is not configured (no API key).
 *
 * 2026-05-19: extins cu suport pentru:
 *   - to multi-recipient (array)
 *   - cc / bcc
 *   - attachments via URL (Resend trage automat din URL-uri publice)
 *   - from override (pentru flow „trimite via Civia" cu Reply-To user)
 */
export async function sendEmail(params: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback for clients that block HTML. */
  text?: string;
  /** Optional Reply-To override (default: same as FROM). */
  replyTo?: string;
  /** Override sender — keep brand consistent dar with custom display name. */
  from?: string;
  /** Atașamente — array de URL-uri publice (Resend fetch-uieste automat). */
  attachments?: Array<{ filename: string; path?: string; content?: string }>;
}): Promise<{ ok: boolean; id?: string }> {
  const resend = getResendClient();
  if (!resend) {
    if (!isProd()) {
      console.log("[email] Resend not configured, skipping:", params.subject);
    }
    return { ok: false };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: params.from ?? FROM,
      to: params.to,
      ...(params.cc ? { cc: params.cc } : {}),
      ...(params.bcc ? { bcc: params.bcc } : {}),
      subject: params.subject,
      html: params.html,
      text: params.text ?? `${params.subject}\n\n—\nVezi conținutul complet pe civia.ro`,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.attachments ? { attachments: params.attachments } : {}),
      headers: {
        "List-Unsubscribe": `<${ENV.SITE_URL()}/cont?unsubscribe=1>, <mailto:unsubscribe@civia.ro?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error) {
      if (!isProd()) console.error("[email] Resend error:", error);
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    if (!isProd()) console.error("[email] Send failed:", e);
    return { ok: false };
  }
}

/**
 * Escape HTML — folosit intern de emailTemplate ca să prevină XSS dacă
 * cineva apelează emailTemplate({ title: <user-input> }) fără sanitize.
 * `body` rămâne raw fiindcă caller-ii compun HTML structurat (table, p, a).
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Public alias — callers compose body HTML and need the same
 *  escaper for any user-supplied substring they paste in. */
export const escapeEmailHtml = escapeAttr;

/**
 * Bold + clean salutation paragraph used at the top of every
 * transactional email. `salutation` should already be the polished
 * line from `buildSalutation()` (e.g. „Salut, Eduard," or „Bună!").
 */
export function emailGreeting(salutation: string, sub?: string): string {
  return `<p style="font-size:16px;margin:0 0 8px;font-weight:600;color:#0f172a">${escapeAttr(salutation)}</p>${
    sub
      ? `<p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6">${sub}</p>`
      : ""
  }`;
}

/**
 * Render a structured "Notă admin" / "Notă propunător" callout block.
 * Use a small left-border accent so the note is visually distinct from
 * regular paragraphs — clearer than the previous inline „<em>…</em>"
 * which read as throwaway commentary.
 */
export function emailNoteCallout(opts: {
  label: string;
  text: string;
  /** "primary" → emerald accent (default); "muted" → slate. */
  tone?: "primary" | "muted";
}): string {
  const tone = opts.tone ?? "primary";
  const accent = tone === "primary" ? "#059669" : "#94a3b8";
  const bg = tone === "primary" ? "#ecfdf5" : "#f1f5f9";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
      <tr><td style="background:${bg};border-left:3px solid ${accent};border-radius:0 8px 8px 0;padding:12px 16px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${accent};letter-spacing:0.6px;text-transform:uppercase">${escapeAttr(opts.label)}</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap">${escapeAttr(opts.text)}</p>
      </td></tr>
    </table>`;
}

/**
 * A small status pill showing the live status of a sesizare. Inlined
 * styles so Gmail/Outlook render correctly without external CSS.
 */
export function emailStatusPill(opts: { label: string; emoji: string; color: string }): string {
  const tint = `${opts.color}1a`;
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${tint};color:${opts.color};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">${escapeAttr(opts.emoji)} ${escapeAttr(opts.label)}</span>`;
}

/**
 * HTML email template with Civia branding.
 *
 * SECURITY: title/preheader/kicker/icon/ctaText/ctaUrl sunt escape-uite
 * automat. body e raw HTML (callers compun structura). NU pasa input
 * user în body fără să-l escape-uiești cu escapeHtml() din ./sanitize.
 */
export function emailTemplate(params: {
  title: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  /** Optional kicker line above title (e.g. "SESIZARE · BUCURESTI"). */
  kicker?: string;
  /** Optional emoji / status icon displayed large in the header. */
  icon?: string;
}): string {
  // Defense-in-depth: escape toate atributele/text-urile non-body
  const title = escapeAttr(params.title);
  const preheader = params.preheader ? escapeAttr(params.preheader) : undefined;
  const kicker = params.kicker ? escapeAttr(params.kicker) : undefined;
  const icon = params.icon ? escapeAttr(params.icon) : undefined;
  const ctaText = params.ctaText ? escapeAttr(params.ctaText) : undefined;
  const ctaUrl = params.ctaUrl ? escapeAttr(params.ctaUrl) : undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  // Brand palette. Kept in sync with globals.css (light mode). Email
  // clients generally ignore prefers-color-scheme so we commit to the
  // light-mode palette — good enough for both Gmail + Outlook + iOS Mail.
  const PRIMARY = "#059669";
  const PRIMARY_DARK = "#047857";
  const PRIMARY_DARKER = "#065f46";
  const PRIMARY_SOFT = "#ecfdf5";
  const SURFACE = "#ffffff";
  const BG = "#f8fafc";
  const BORDER = "#e5e7eb";
  const TEXT = "#0f172a";
  const TEXT_MUTED = "#64748b";
  const TEXT_DIM = "#94a3b8";

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
${preheader ? `<span style="display:none;max-height:0;overflow:hidden;visibility:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:${TEXT};-webkit-font-smoothing:antialiased">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px">
<tr><td align="center">

<!-- Wordmark -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin-bottom:16px">
  <tr><td align="center">
    <a href="${siteUrl}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,${PRIMARY},${PRIMARY_DARKER});vertical-align:middle"></span>
      <span style="font-weight:800;font-size:18px;color:${TEXT};letter-spacing:-0.3px;vertical-align:middle;margin-left:8px">Civia</span>
    </a>
  </td></tr>
</table>

<!-- Card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${SURFACE};border-radius:16px;overflow:hidden;box-shadow:0 2px 4px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.06);max-width:600px;border:1px solid ${BORDER}">

  <!-- Hero header -->
  <tr><td style="background:linear-gradient(135deg,${PRIMARY} 0%,${PRIMARY_DARK} 60%,${PRIMARY_DARKER} 100%);padding:40px 40px 44px;text-align:center;position:relative">
    ${icon ? `<div style="font-size:44px;line-height:1;margin-bottom:14px">${icon}</div>` : ""}
    ${kicker ? `<p style="color:${PRIMARY_SOFT};font-size:11px;margin:0 0 6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;opacity:0.9">${kicker}</p>` : ""}
    <h1 style="color:#fff;font-size:26px;margin:0;font-weight:800;letter-spacing:-0.5px;line-height:1.2">${title}</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:36px 40px 24px;color:${TEXT};font-size:15px;line-height:1.7">
    ${params.body}
    ${ctaText && ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 8px">
      <tr><td align="center">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,${PRIMARY},${PRIMARY_DARK});color:#fff;padding:15px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(5,150,105,0.3);transition:all 0.2s">${ctaText} →</a>
      </td></tr>
    </table>` : ""}
  </td></tr>

  <!-- Share CTA — virality nudge in every email Civia trimite. User
       already cares (they engaged enough to get an email), so this is
       the highest-conversion moment to ask for a friend share. -->
  <tr><td style="padding:0 40px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PRIMARY_SOFT};border:1px solid #a7f3d0;border-radius:12px;padding:18px 20px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${PRIMARY_DARKER}">Cunoști pe cineva care s-ar bate cu primăria?</p>
        <p style="margin:0 0 12px;font-size:12px;color:${TEXT_MUTED};line-height:1.5">Distribuie Civia. Cu cât suntem mai mulți, cu atât răspund mai repede.</p>
        <a href="https://wa.me/?text=${encodeURIComponent(`Am descoperit Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul. ${siteUrl}`)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;margin-right:6px">WhatsApp</a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent("Am descoperit Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul.")}" style="display:inline-block;background:#0088cc;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;margin-right:6px">Telegram</a>
        <a href="https://bsky.app/intent/compose?text=${encodeURIComponent(`Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul. ${siteUrl}`)}" style="display:inline-block;background:#0085ff;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600">Bluesky</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer (inside card) -->
  <tr><td style="padding:24px 40px 28px;border-top:1px solid ${BORDER};background:${BG}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:${TEXT_MUTED};line-height:1.5">
          <a href="${siteUrl}" style="color:${PRIMARY};text-decoration:none;font-weight:600">civia.ro</a> · platforma civică a României
          <br><span style="color:${TEXT_DIM};font-size:11px">Gratuit · Fără reclame · Open-source · 🇪🇺 GDPR</span>
        </td>
        <td align="right" style="font-size:11px;color:${TEXT_DIM}">
          <a href="${siteUrl}/cont" style="color:${TEXT_MUTED};text-decoration:none">Contul meu</a>
          <span style="color:${BORDER};margin:0 6px">·</span>
          <a href="${siteUrl}/legal/confidentialitate" style="color:${TEXT_MUTED};text-decoration:none">Confidențialitate</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<!-- Meta line under the card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin-top:20px">
  <tr><td align="center" style="color:${TEXT_DIM};font-size:11px;line-height:1.6;padding:0 16px">
    Primești acest email pentru că ai trimis o sesizare, te-ai abonat la newsletter, sau ai acțiuni în contul Civia.<br>
    Dacă nu mai vrei mesaje de la noi, <a href="${siteUrl}/cont?unsubscribe=1" style="color:${TEXT_MUTED};text-decoration:underline">dezabonează-te</a>.
  </td></tr>
</table>

</td></tr>
</table>

</body></html>`;
}
