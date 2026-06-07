import { createHmac, timingSafeEqual, randomUUID } from "crypto";

/**
 * 2026-06-08 — Token opac pentru Reply-To (matching reply→sesizare, Nivel 1).
 *
 * În loc de `sesizari+{code}@civia.ro` (cod brut, ghicibil), trimitem cu
 * `sesizari+{token}@civia.ro` unde token = HMAC scurt(secret, code). Tokenul:
 *   - e nemodificabil fără secret (anti-spoof),
 *   - trăiește în envelope/To → supraviețuiește strip-ului de headere + editării
 *     body-ului (mai robust decât subiectul/threading-ul),
 *   - se verifică determinist la inbound.
 *
 * Secret: INBOX_TOKEN_SECRET (fallback INBOX_WEBHOOK_SECRET, deja setat backend).
 * Backend-only — worker-ul nu verifică tokenul (doar pasează `to`).
 */
function secret(): string {
  return process.env.INBOX_TOKEN_SECRET || process.env.INBOX_WEBHOOK_SECRET || "civia-inbox-token-dev";
}

/** Token determinist (10 hex chars) din codul sesizării. */
export function makeReplyToken(code: string): string {
  return createHmac("sha256", secret()).update(`sesizare:${code}`).digest("hex").slice(0, 10);
}

/** Adresa de Reply-To cu token opac. */
export function replyToAddress(code: string): string {
  return `sesizari+${makeReplyToken(code)}@civia.ro`;
}

/** Message-ID RFC propriu pentru threading (N2). Folosit de TOATE rutele care
 *  trimit la autorități (send-via-civia, cosign-send, resend, escalate). */
export function authorityOutboundMessageId(code: string): string {
  return `<sesizare-${code}-${randomUUID().slice(0, 12)}@civia.ro>`;
}

/** Verificare constant-time token↔cod. */
export function verifyReplyToken(token: string, code: string): boolean {
  const expected = makeReplyToken(code);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Extrage tokenul din adresa `to` (sesizari+{token}@civia.ro). Null dacă nu e. */
export function extractReplyToken(to: string | null | undefined): string | null {
  if (!to) return null;
  const m = to.match(/sesizari\+([a-f0-9]{10})@civia\.ro/i);
  return m ? m[1]!.toLowerCase() : null;
}
