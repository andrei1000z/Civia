// Rate limiter — uses Upstash Redis in production, in-memory fallback for dev.
// Upstash free tier: 10k commands/day — more than enough for current scale.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash is configured
const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Upstash Redis rate limiter (production)
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(windowMs: number, limit: number): Ratelimit {
  const key = `${windowMs}:${limit}`;
  let rl = upstashLimiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
      analytics: false,
      prefix: "civia",
    });
    upstashLimiters.set(key, rl);
  }
  return rl;
}

// In-memory fallback (dev / missing Upstash config)
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

function memoryLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number } {
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
    return { success: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) return { success: false, remaining: 0 };
  bucket.count++;
  return { success: true, remaining: limit - bucket.count };
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
  if (hasUpstash) {
    try {
      const rl = getUpstashLimiter(windowMs, limit);
      const result = await rl.limit(key);
      return {
        success: result.success,
        remaining: result.remaining,
        resetIn: result.reset - Date.now(),
      };
    } catch {
      // 2026-05-27 — Upstash poate fi rate-limited (10k/day free tier) sau
      // outage. NU blocăm cereri când Redis pică — fallback la in-memory
      // ratelimit (mai laxe în serverless dar previne 500 cascade).
      const result = memoryLimit(key, limit, windowMs);
      return { ...result, resetIn: windowMs };
    }
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
