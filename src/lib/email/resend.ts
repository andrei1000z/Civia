import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";
import { ENV, isProd } from "@/lib/env";
import { sanitizeSubject } from "@/lib/sanitize";

let client: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = ENV.RESEND_API_KEY();
  if (!key) return null;
  if (!client) {
    client = new Resend(key);
  }
  return client;
}

// Production-default: sesizari@civia.ro. Sandbox fallback (onboarding@resend.dev)
// se activează DOAR în dev — în prod, fail-loud dacă env-ul lipsește.
const FROM = (() => {
  const raw = process.env.RESEND_FROM_EMAIL?.trim();
  if (raw) return raw;
  if (isProd()) {
    // Default sigur prod (sesizari@civia.ro). Loggat la primul send dacă env lipsește.
    return "Civia <sesizari@civia.ro>";
  }
  return "Civia <onboarding@resend.dev>";
})();

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
  /** URL one-click de dezabonare per-destinatar (newsletter) — header
   *  List-Unsubscribe RFC 8058. Default: pagina globală /cont?unsubscribe=1. */
  listUnsubscribe?: string;
  /** Headere custom (ex. Message-ID propriu pentru threading reply→sesizare). */
  headers?: Record<string, string>;
}): Promise<{ ok: boolean; id?: string }> {
  // audit #26 — sanitizare centrală a subiectului (toate email-urile trec pe aici).
  const subject = sanitizeSubject(params.subject);
  const resend = getResendClient();
  if (!resend) {
    if (isProd()) {
      // CRITIC: în prod, client null = RESEND_API_KEY lipsă → outage TOTAL de
      // email (înainte: tăcut). Semnalăm ca să fie detectabil imediat.
      Sentry.captureMessage("Resend client null in PROD — RESEND_API_KEY lipsă (email outage)", {
        level: "error",
        tags: { kind: "resend_no_client" },
        extra: { subject: params.subject },
      });
    } else {
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
      subject,
      html: params.html,
      text: params.text ?? `${subject}\n\n—\nVezi conținutul complet pe civia.ro`,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.attachments ? { attachments: params.attachments } : {}),
      headers: {
        ...(params.headers ?? {}),
        // audit fix: `List-Unsubscribe-Post: One-Click` (RFC 8058) cere un
        // endpoint care acceptă POST — îl emitem DOAR când există un
        // listUnsubscribe real. Pe tranzacționale punem doar mailto (fără -Post
        // care pointa la /cont?unsubscribe=1, o pagină GET → one-click pica).
        ...(params.listUnsubscribe
          ? {
              "List-Unsubscribe": `<${params.listUnsubscribe}>, <mailto:unsubscribe@civia.ro?subject=Unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : {
              "List-Unsubscribe": `<mailto:unsubscribe@civia.ro?subject=Unsubscribe>`,
            }),
      },
    });
    if (error) {
      if (isProd()) {
        Sentry.captureMessage("Resend send error în PROD", {
          level: "error",
          tags: { kind: "resend_send_error" },
          extra: { subject: params.subject, error: typeof error === "object" ? JSON.stringify(error).slice(0, 500) : String(error) },
        });
      } else {
        console.error("[email] Resend error:", error);
      }
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    if (isProd()) {
      Sentry.captureException(e, { tags: { kind: "resend_send_exception" }, extra: { subject: params.subject } });
    } else {
      console.error("[email] Send failed:", e);
    }
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
  return `<p style="font-size:16px;margin:0 0 6px;font-weight:600;color:#1d1d1f;letter-spacing:-0.2px">${escapeAttr(salutation)}</p>${
    sub
      ? `<p style="margin:0 0 24px;color:#86868b;font-size:14px;line-height:1.6">${sub}</p>`
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
  const accent = tone === "primary" ? "#059669" : "#86868b";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 8px">
      <tr><td style="background:#f5f5f7;border-radius:14px;padding:14px 18px">
        <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:${accent};letter-spacing:0.8px;text-transform:uppercase">${escapeAttr(opts.label)}</p>
        <p style="margin:0;font-size:14px;line-height:1.65;color:#3a3a3c;white-space:pre-wrap">${escapeAttr(opts.text)}</p>
      </td></tr>
    </table>`;
}

/** Titlu de secțiune mic, caps, muted — Apple-style eyebrow pentru digest-uri. */
export function emailSectionTitle(text: string): string {
  return `<p style="margin:28px 0 10px;font-size:11px;font-weight:700;color:#86868b;letter-spacing:1.2px;text-transform:uppercase">${escapeAttr(text)}</p>`;
}

/** Linie subțire de separare (hairline) — folosită între secțiuni. */
export function emailDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="border-top:1px solid #e8e8ed;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
}

/**
 * Rând de statistici „carduri" (2–3) pentru digest-uri — valoare mare + etichetă
 * + delta opțional. Table-based, sigure în Gmail/Outlook.
 */
export function emailStatCards(
  stats: Array<{ value: string; label: string; delta?: string; deltaTone?: "up" | "down" | "flat" }>,
): string {
  const cells = stats
    .slice(0, 3)
    .map((s) => {
      const deltaColor = s.deltaTone === "down" ? "#d70015" : s.deltaTone === "flat" ? "#86868b" : "#059669";
      return `<td valign="top" width="${Math.floor(100 / Math.min(stats.length, 3))}%" style="padding:4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#f5f5f7;border-radius:16px;padding:18px 16px;text-align:center">
            <p style="margin:0;font-size:28px;font-weight:700;color:#1d1d1f;letter-spacing:-0.8px;line-height:1.1">${escapeAttr(s.value)}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#86868b;font-weight:500">${escapeAttr(s.label)}</p>
            ${s.delta ? `<p style="margin:4px 0 0;font-size:11.5px;font-weight:600;color:${deltaColor}">${escapeAttr(s.delta)}</p>` : ""}
          </td>
        </tr></table>
      </td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr>${cells}</tr></table>`;
}

/**
 * Listă „inset grouped" (stil iOS Settings) — rânduri cu titlu + meta + link,
 * separate de hairline, în container rotunjit. Pentru topuri/digest-uri.
 */
export function emailListCard(
  items: Array<{ title: string; meta?: string; url?: string; badge?: string; badgeColor?: string }>,
): string {
  if (!items.length) return "";
  const rows = items
    .map((it, i) => {
      const titleHtml = it.url
        ? `<a href="${escapeAttr(it.url)}" style="color:#1d1d1f;text-decoration:none;font-weight:600">${escapeAttr(it.title)}</a>`
        : `<span style="color:#1d1d1f;font-weight:600">${escapeAttr(it.title)}</span>`;
      const badge = it.badge
        ? `<span style="display:inline-block;padding:3px 9px;border-radius:980px;background:${it.badgeColor ?? "#059669"}14;color:${it.badgeColor ?? "#059669"};font-size:10.5px;font-weight:700;letter-spacing:0.3px;white-space:nowrap">${escapeAttr(it.badge)}</span>`
        : it.url
          ? `<span style="color:#c7c7cc;font-size:15px">›</span>`
          : "";
      return `<tr>
        <td style="padding:13px 18px;${i > 0 ? "border-top:1px solid #e8e8ed" : ""}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:14px;line-height:1.45">${titleHtml}${it.meta ? `<br><span style="font-size:12px;color:#86868b">${escapeAttr(it.meta)}</span>` : ""}</td>
            <td align="right" valign="middle" style="padding-left:12px">${badge}</td>
          </tr></table>
        </td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e8ed;border-radius:16px;margin:6px 0 10px"><tbody>${rows}</tbody></table>`;
}

/**
 * A small status pill showing the live status of a sesizare. Inlined
 * styles so Gmail/Outlook render correctly without external CSS.
 */
export function emailStatusPill(opts: { label: string; emoji: string; color: string }): string {
  return `<span style="display:inline-block;padding:6px 14px;border-radius:980px;background:${opts.color}14;border:1px solid ${opts.color}26;color:${opts.color};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">${escapeAttr(opts.emoji)} ${escapeAttr(opts.label)}</span>`;
}

/**
 * Întunecă un hex #rrggbb cu `amount` (0..1). Folosit pentru gradientul de hero
 * care se adaptează la culoarea semantică a emailului (`accent`).
 */
export function darkenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const f = Math.max(0, Math.min(1, 1 - amount));
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Galerie de poze inline pentru email (1–3 imagini, table-based ca să meargă
 * în Gmail/Outlook/iOS Mail). URL-uri publice Supabase. Folosit pentru pozele
 * sesizării (dovada problemei) în emailuri.
 */
export function emailPhotoBlock(opts: { images: string[]; label?: string; max?: number }): string {
  const imgs = opts.images.filter(Boolean).slice(0, opts.max ?? 3);
  if (!imgs.length) return "";
  const cells = imgs
    .map(
      (u) =>
        `<td valign="top" style="padding:4px"><img src="${escapeAttr(u)}" alt="" width="100%" style="width:100%;max-width:280px;border-radius:14px;border:1px solid #e8e8ed;display:block" /></td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 18px">
    ${opts.label ? `<tr><td colspan="${imgs.length}" style="padding:0 4px 7px;font-size:11px;font-weight:700;color:#86868b;letter-spacing:0.8px;text-transform:uppercase">${escapeAttr(opts.label)}</td></tr>` : ""}
    <tr>${cells}</tr>
  </table>`;
}

/**
 * Comparație „Înainte / După" pentru emailurile de sesizare rezolvată — pozele
 * raportate (înainte) lângă pozele primăriei de la rezolvare (după). Dacă există
 * doar o latură, randăm o singură imagine etichetată corespunzător.
 */
export function emailBeforeAfter(opts: { before?: string[] | null; after?: string[] | null }): string {
  const before = (opts.before ?? []).filter(Boolean)[0];
  const after = (opts.after ?? []).filter(Boolean)[0];
  if (!before && !after) return "";
  const col = (url: string, label: string, accent: string) =>
    `<td width="50%" valign="top" style="padding:4px">
       <p style="margin:0 0 7px;font-size:11px;font-weight:700;color:${accent};letter-spacing:0.8px;text-transform:uppercase">${label}</p>
       <img src="${escapeAttr(url)}" alt="${label}" width="100%" style="width:100%;border-radius:14px;border:1px solid #e8e8ed;display:block" />
     </td>`;
  if (before && after) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 18px"><tr>${col(before, "Înainte", "#d70015")}${col(after, "După", "#059669")}</tr></table>`;
  }
  const single = (before ?? after) as string;
  return emailPhotoBlock({ images: [single], label: before ? "Înainte" : "După" });
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
  /** Optional semantic accent color (#rrggbb) for hero + CTA. Defaults to
   *  brand emerald. Status emails pass the status color so a „Respins" email
   *  nu mai e verde-festiv, ci roșu/gri — corect emoțional. */
  accent?: string;
}): string {
  // Defense-in-depth: escape toate atributele/text-urile non-body
  const title = escapeAttr(params.title);
  const preheader = params.preheader ? escapeAttr(params.preheader) : undefined;
  const kicker = params.kicker ? escapeAttr(params.kicker) : undefined;
  const icon = params.icon ? escapeAttr(params.icon) : undefined;
  const ctaText = params.ctaText ? escapeAttr(params.ctaText) : undefined;
  const ctaUrl = params.ctaUrl ? escapeAttr(params.ctaUrl) : undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  // 2026-06-12 — redesign „liquid glass" (Apple-style): fundal #f5f5f7, card alb
  // cu colțuri mari, hero = spălătură de accent translucidă (nu bloc saturat),
  // chip de icon „frosted", CTA pastilă, share minimal, footer centrat.
  // Email clients ignoră backdrop-filter → sticla e simulată cu straturi
  // translucide + gradiente fine (sigur în Gmail/Outlook/iOS Mail).
  const PRIMARY = "#059669";
  const PRIMARY_DARKER = "#065f46";
  const BG = "#f5f5f7"; // Apple gray
  const SURFACE = "#ffffff";
  const HAIR = "#e8e8ed"; // hairline
  const INK = "#1d1d1f"; // Apple ink
  const BODY_TX = "#424245";
  const MUTED = "#86868b";
  const DIM = "#a1a1a6";
  // Accent semantic — hero-ul + butonul CTA se adaptează la culoarea emailului.
  const ACCENT = params.accent && /^#[0-9a-fA-F]{6}$/.test(params.accent) ? params.accent : PRIMARY;
  const ACCENT_D = darkenHex(ACCENT, 0.18);

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
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;color:${INK};-webkit-font-smoothing:antialiased">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:48px 16px 40px">
<tr><td align="center">

<!-- Wordmark -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin-bottom:20px">
  <tr><td align="center">
    <a href="${siteUrl}" style="text-decoration:none">
      <span style="display:inline-block;width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,${PRIMARY},${PRIMARY_DARKER});color:#fff;font-weight:800;font-size:15px;line-height:28px;text-align:center;vertical-align:middle">C</span>
      <span style="font-weight:700;font-size:17px;color:${INK};letter-spacing:-0.4px;vertical-align:middle;margin-left:8px">Civia</span>
    </a>
  </td></tr>
</table>

<!-- Card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${SURFACE};border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.07);max-width:600px;border:1px solid rgba(0,0,0,0.05)">

  <!-- Hero — liquid-glass wash în culoarea accentului -->
  <tr><td style="background:linear-gradient(180deg,${ACCENT}1c 0%,${ACCENT}0a 60%,rgba(255,255,255,0) 100%);padding:44px 40px 26px;text-align:center">
    ${icon ? `<div style="width:64px;height:64px;line-height:64px;border-radius:18px;background:linear-gradient(145deg,#ffffff,${ACCENT}12);border:1px solid ${ACCENT}2e;box-shadow:0 6px 20px ${ACCENT}1f;font-size:30px;text-align:center;margin:0 auto 18px;display:inline-block">${icon}</div><br>` : ""}
    ${kicker ? `<p style="color:${ACCENT};font-size:11px;margin:0 0 10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">${kicker}</p>` : ""}
    <h1 style="color:${INK};font-size:27px;margin:0;font-weight:700;letter-spacing:-0.6px;line-height:1.18">${title}</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:10px 44px 8px;color:${BODY_TX};font-size:15px;line-height:1.7">
    ${params.body}
    ${ctaText && ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 12px">
      <tr><td align="center">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,${ACCENT},${ACCENT_D});color:#fff;padding:14px 38px;border-radius:980px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:-0.1px;box-shadow:0 4px 16px ${ACCENT}38">${ctaText}</a>
      </td></tr>
    </table>` : ""}
  </td></tr>

  <!-- Share — minimal, hairline + text links (nudge de viralitate, discret) -->
  <tr><td style="padding:22px 44px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid ${HAIR};padding-top:20px;text-align:center">
        <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:${INK};letter-spacing:-0.1px">Cunoști pe cineva care s-ar bate cu primăria?</p>
        <p style="margin:0 0 10px;font-size:12px;color:${MUTED};line-height:1.5">Cu cât suntem mai mulți, cu atât autoritățile răspund mai repede.</p>
        <a href="https://wa.me/?text=${encodeURIComponent(`Am descoperit Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul. ${siteUrl}`)}" style="color:${PRIMARY};text-decoration:none;font-size:12.5px;font-weight:600">WhatsApp</a>
        <span style="color:${HAIR};margin:0 8px">·</span>
        <a href="https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent("Am descoperit Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul.")}" style="color:${PRIMARY};text-decoration:none;font-size:12.5px;font-weight:600">Telegram</a>
        <span style="color:${HAIR};margin:0 8px">·</span>
        <a href="https://bsky.app/intent/compose?text=${encodeURIComponent(`Civia — sesizezi gratis la primărie cu AI și urmărești răspunsul. ${siteUrl}`)}" style="color:${PRIMARY};text-decoration:none;font-size:12.5px;font-weight:600">Bluesky</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer — centrat, minimal -->
  <tr><td style="padding:22px 44px 28px;text-align:center">
    <p style="margin:0 0 4px;font-size:12px;color:${MUTED}">
      <a href="${siteUrl}" style="color:${PRIMARY};text-decoration:none;font-weight:600">civia.ro</a> — platforma civică a României
    </p>
    <p style="margin:0 0 8px;font-size:11px;color:${DIM}">Gratuit · Fără reclame · Open-source · 🇪🇺 GDPR</p>
    <p style="margin:0;font-size:11px">
      <a href="${siteUrl}/cont" style="color:${MUTED};text-decoration:none">Contul meu</a>
      <span style="color:${HAIR};margin:0 6px">·</span>
      <a href="${siteUrl}/legal/confidentialitate" style="color:${MUTED};text-decoration:none">Confidențialitate</a>
    </p>
  </td></tr>
</table>

<!-- Meta line under the card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin-top:18px">
  <tr><td align="center" style="color:${DIM};font-size:11px;line-height:1.6;padding:0 16px">
    Primești acest email pentru că ai trimis o sesizare, te-ai abonat la newsletter, sau ai acțiuni în contul Civia.<br>
    Dacă nu mai vrei mesaje de la noi, <a href="${siteUrl}/cont?unsubscribe=1" style="color:${MUTED};text-decoration:underline">dezabonează-te</a>.
  </td></tr>
</table>

</td></tr>
</table>

</body></html>`;
}
