/**
 * 2026-06-05 — Dezabonare newsletter STATELESS (HMAC), GDPR one-click.
 *
 * Bug raportat: dezabonarea actualiza tabela GREȘITĂ (newsletter_subscriptions,
 * neutilizată la trimitere) în loc de `newsletter_subscribers` (de unde pleacă
 * digestul) → cetățeanul rămânea abonat = încălcare GDPR (art. 21 / ePrivacy).
 *
 * Token = HMAC(email, secret) — nu necesită coloană în DB, e stabil între
 * deploy-uri (secret fix), deci link-urile din emailuri vechi rămân valide.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET =
  process.env.NEWSLETTER_UNSUB_SECRET ||
  process.env.CRON_SECRET ||
  process.env.PHONE_HASH_SALT ||
  "civia-newsletter-unsub-salt";

const normalize = (email: string) => email.toLowerCase().trim();

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", SECRET).update(normalize(email)).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** URL one-click de dezabonare pentru un destinatar. */
export function newsletterUnsubscribeUrl(email: string, baseUrl: string): string {
  const e = Buffer.from(normalize(email), "utf8").toString("base64url");
  return `${baseUrl}/api/newsletter/unsubscribe?e=${e}&t=${unsubscribeToken(email)}`;
}

/** Decodează emailul din parametrul `e` (base64url). */
export function decodeUnsubscribeEmail(e: string): string | null {
  try {
    const email = Buffer.from(e, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

// ─── Dezabonare GRANULARĂ pe arie (Faza 2 — „Urmărește zona") ──────────
// Token legat de (email + subId) ca să dezaboneze DOAR acea arie, nu
// newsletter-ul global. Stateless (HMAC), one-click din digestul local.

export function areaUnsubscribeToken(email: string, subId: string): string {
  return createHmac("sha256", SECRET).update(`area:${normalize(email)}:${subId}`).digest("hex").slice(0, 32);
}

export function verifyAreaUnsubscribeToken(email: string, subId: string, token: string): boolean {
  const expected = areaUnsubscribeToken(email, subId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** URL one-click de dezabonare de la O SINGURĂ arie. */
export function areaUnsubscribeUrl(email: string, subId: string, baseUrl: string): string {
  const e = Buffer.from(normalize(email), "utf8").toString("base64url");
  return `${baseUrl}/api/newsletter/unsubscribe?scope=area&id=${subId}&e=${e}&t=${areaUnsubscribeToken(email, subId)}`;
}
