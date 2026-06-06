// Privacy toggle: "hide my name on public sesizări".
// Stored in Upstash Redis as two SETs:
//   - hidden-users:    user IDs that opted in
//   - hidden-emails:   author_email values that opted in
// Both are needed because a sesizare submitted while logged out has
// user_id=NULL but a real author_email. Without the email path, those
// rows would still leak the user's name even after they enable the
// toggle on /cont.
// In-memory fallback keeps dev mode functional without Upstash.

import { Redis } from "@upstash/redis";

const KEY = "civia:privacy:hidden-users";
const EMAIL_KEY = "civia:privacy:hidden-emails";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        // 2026-06-06 — Upstash SUSPENDAT (billing) → smismember retry-uia de 5×
        // cu backoff = ~5s hang/request. Retry minim → fail RAPID (fallback gol).
        // Feed-ul nu mai apelează asta deloc; rămâne doar pt. comentarii.
        retry: { retries: 1, backoff: () => 0 },
      })
    : null;

// In-memory fallback (dev only) — persists for the process lifetime.
const memoryFallback = new Set<string>();
const memoryEmailFallback = new Set<string>();

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Toggle the hide-name flag for the given user. The email argument is
 * optional but strongly recommended — guests-then-signed-up users have
 * historical sesizari with `user_id=null`, and we need the email path
 * to anonymize those reliably.
 */
export async function setHideName(
  userId: string,
  hide: boolean,
  email?: string | null,
): Promise<void> {
  if (!userId) return;
  const normalizedEmail = normalizeEmail(email);
  if (!redis) {
    if (hide) {
      memoryFallback.add(userId);
      if (normalizedEmail) memoryEmailFallback.add(normalizedEmail);
    } else {
      memoryFallback.delete(userId);
      if (normalizedEmail) memoryEmailFallback.delete(normalizedEmail);
    }
    return;
  }
  // 2026-05-27 — defensive try/catch. Upstash rate-limit (10k/day free tier)
  // sau API outage NU trebuie să rupă PUT /api/profile (user nu poate
  // salva nimic). Hide-name toggle e best-effort; user poate retoggle.
  try {
    if (hide) {
      await redis.sadd(KEY, userId);
      if (normalizedEmail) await redis.sadd(EMAIL_KEY, normalizedEmail);
    } else {
      await redis.srem(KEY, userId);
      if (normalizedEmail) await redis.srem(EMAIL_KEY, normalizedEmail);
    }
  } catch {
    /* silent — celelalte profile updates trec OK */
  }
}

export async function getHideName(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!redis) return memoryFallback.has(userId);
  // 2026-05-27 — defensive try/catch (vezi getHiddenUserIds rationale).
  // /cont încarcă /api/profile la mount; dacă Redis 500-uiește, /cont rămâne
  // pe skeleton forever. Fail-open: assume nu e hidden.
  try {
    const res = await redis.sismember(KEY, userId);
    return Number(res) === 1;
  } catch {
    return false;
  }
}

/**
 * Batch variant — use when anonymizing a list of sesizări so we do one
 * round-trip instead of N. Returns the subset of userIds whose owners
 * opted into the flag.
 */
export async function getHiddenUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  if (!redis) {
    return new Set(userIds.filter((id) => memoryFallback.has(id)));
  }
  // 2026-05-27 — defensive try/catch. Upstash rate-limit (10k/day free tier)
  // sau API outage NU trebuie să taie listings. Fallback fail-open: nu
  // ascundem nimic (defensiv preferable la blank-page error 500).
  try {
    const flags = (await redis.smismember(KEY, userIds)) as number[];
    const hidden = new Set<string>();
    userIds.forEach((id, i) => {
      if (flags[i] === 1) hidden.add(id);
    });
    return hidden;
  } catch {
    return new Set();
  }
}

/**
 * Batch variant for emails. Used by the sesizare anonymizer to catch
 * historical rows submitted as a guest (user_id=null) but with the
 * user's email in author_email — without this, opting in to anonymity
 * would only hide future sesizari, not the existing ones.
 */
export async function getHiddenEmails(emails: string[]): Promise<Set<string>> {
  const normalized = Array.from(
    new Set(emails.map((e) => normalizeEmail(e)).filter((e): e is string => !!e)),
  );
  if (normalized.length === 0) return new Set();
  if (!redis) {
    return new Set(normalized.filter((e) => memoryEmailFallback.has(e)));
  }
  // 2026-05-27 — defensive try/catch (vezi getHiddenUserIds rationale).
  let flags: number[];
  try {
    flags = (await redis.smismember(EMAIL_KEY, normalized)) as number[];
  } catch {
    return new Set();
  }
  const hidden = new Set<string>();
  normalized.forEach((e, i) => {
    if (flags[i] === 1) hidden.add(e);
  });
  return hidden;
}
