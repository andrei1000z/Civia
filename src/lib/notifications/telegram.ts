/**
 * Telegram bot notifications — pentru alerte critice admin.
 *
 * 2026-05-28 — Telegram bot API e GRATIS, fără rate limits practice.
 * Use case-uri: bounce email primărie, sesizare priority, deploy failures,
 * cron job errors, Sentry critical errors.
 *
 * Setup (one-time, ~2 min):
 *   1. Caută @BotFather pe Telegram → /newbot → primești TOKEN
 *   2. Trimite mesaj la bot-ul nou → caută @userinfobot să-ți afli chat_id
 *   3. Setează în Vercel:
 *        TELEGRAM_BOT_TOKEN = (de la BotFather)
 *        TELEGRAM_ADMIN_CHAT_ID = (chat-ul tău personal)
 *
 * NU folosim webhook (necesită endpoint public Telegram); apelăm
 * sendMessage direct.
 *
 * Cost: ZERO. Telegram nu rate-limits bots care trimit la chat-uri
 * cu care interacționezi.
 */

interface TelegramSendOpts {
  text: string;
  /** Optional: override default admin chat. */
  chatId?: string;
  /** Format: HTML | MarkdownV2 | undefined (plain). */
  parseMode?: "HTML" | "MarkdownV2";
  /** Disable link preview. */
  disablePreview?: boolean;
  /** Silent send (no sound notification). */
  silent?: boolean;
}

export async function sendTelegramAlert(opts: TelegramSendOpts): Promise<{
  ok: boolean;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const chatId = opts.chatId || defaultChat;

  if (!token || !chatId) {
    // Silent skip — alerts sunt nice-to-have, nu critical-path.
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing" };
  }

  // Cap text la 4096 chars (Telegram hard limit).
  const text = opts.text.length > 4096 ? opts.text.slice(0, 4090) + "…" : opts.text;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parseMode,
        disable_web_page_preview: opts.disablePreview ?? true,
        disable_notification: opts.silent ?? false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `Telegram HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "telegram fetch failed" };
  }
}

/**
 * Helper convenient pentru alerte tipice. Format consistent.
 */
export async function alertAdmin(opts: {
  level: "info" | "warning" | "error" | "critical";
  title: string;
  details?: string;
  link?: string;
}): Promise<void> {
  const emoji = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    critical: "🚨",
  }[opts.level];

  const lines = [`${emoji} <b>${escapeHtml(opts.title)}</b>`];
  if (opts.details) lines.push(escapeHtml(opts.details));
  if (opts.link) lines.push(`<a href="${opts.link}">Detalii</a>`);

  await sendTelegramAlert({
    text: lines.join("\n"),
    parseMode: "HTML",
    silent: opts.level === "info",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
