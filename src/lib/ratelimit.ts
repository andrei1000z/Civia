// Rate limiter — 2026-05-31 MIGRATED Upstash → D1 + in-memory.
//
// Upstash a fost suspendat billing failure → folosim:
//   1. D1 pentru persistent cross-instance (kv table cu counter + TTL)
//   2. In-memory fallback per-instance (rapid, dar leaky pe cold starts)
//
// Pentru analytics tracker + sesizari submission ambele OK. Pentru abuse
// real-time defense (login bruteforce), D1 path e preferat.

import { analyticsD1 } from "./analytics/d1-client";

// D1 path — persistent + cross-instance. Uses kv table cu key = ratelimit
// prefix + identity. Counter stored ca incrementing INTEGER cu expires_at.
async function d1Limit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  if (!analyticsD1) return memoryLimit(key, limit, windowMs);
  try {
    const fullKey = `rl:${key}`;
    const now = Date.now();
    const windowEnd = now + windowMs;
    // Get current count (cu TTL check inclus in get)
    const current = await analyticsD1.get<string>(fullKey);
    if (current === null) {
      // Set initial cu TTL
      await analyticsD1.set(fullKey, "1", { ex: Math.ceil(windowMs / 1000) });
      return { success: true, remaining: limit - 1, resetIn: windowMs };
    }
    const count = parseInt(current, 10) || 0;
    if (count >= limit) {
      return { success: false, remaining: 0, resetIn: windowMs };
    }
    // Increment via hincrby (treat as hash counter — simpler than UPDATE SET v = v+1)
    // Fallback la SET cu new value
    await analyticsD1.set(fullKey, String(count + 1), { ex: Math.ceil(windowMs / 1000) });
    return { success: true, remaining: limit - count - 1, resetIn: windowEnd - now };
  } catch {
    return memoryLimit(key, limit, windowMs);
  }
}

// In-memory fallback (dev / D1 outage / cold start)
interface Bucket { count: number; resetAt: number; }
const BUCKETS = new Map<string, Bucket>();

// Eager TTL eviction every 5 min ca sa nu ramana bucket-uri vechi pana
// se ating cei 5000 (memory leak in dev cu rute frecvente). In prod cu
// Upstash, niciodata nu ajungem aici, deci e fix pentru dev local.
let lastSweep = 0;
function sweepExpiredBuckets(now: number) {
  if (now - lastSweep < 5 * 60_000) return;
  lastSweep = now;
  for (const [k, b] of BUCKETS) {
    if (b.resetAt < now) BUCKETS.delete(k);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  sweepExpiredBuckets(now);
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    if (BUCKETS.size > 5000) {
      for (const [k, b] of BUCKETS) {
        if (b.resetAt < now) BUCKETS.delete(k);
        if (BUCKETS.size <= 2500) break;
      }
    }
    return { success: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (bucket.count >= limit) return { success: false, remaining: 0, resetIn: bucket.resetAt - now };
  bucket.count++;
  return { success: true, remaining: limit - bucket.count, resetIn: bucket.resetAt - now };
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

export async function rateLimitAsync(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  // 2026-05-31: prefer D1 (persistent cross-instance) → fallback in-memory.
  if (analyticsD1) {
    return d1Limit(key, limit, windowMs);
  }
  const result = memoryLimit(key, limit, windowMs);
  return { ...result, resetIn: windowMs };
}

// Sync version (backwards compat — uses in-memory only)
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const result = memoryLimit(key, limit, windowMs);
  return { ...result, resetIn: windowMs };
}

/**
 * Cheie identitate pentru rate-limit: prefera user_id daca e logat (nu
 * poate fi ocolit prin rotire IP), altfel IP. Folosit prin
 * `rateLimitAsync` ca: rateLimitAsync(identityKey(user, ip), ...).
 */
export function identityKey(userId: string | null | undefined, ip: string): string {
  return userId ? `u:${userId}` : `ip:${ip}`;
}

export function getClientIp(req: Request): string {
  // Prefer Vercel-injected header (not spoofable from client).
  const vercelFwd = req.headers.get("x-vercel-forwarded-for");
  if (vercelFwd) return vercelFwd.split(",")[0]?.trim() || "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}
