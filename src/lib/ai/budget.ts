/**
 * AI cost circuit breaker + per-user daily quota.
 *
 * Plan items #74, #81, #91 (5/22/2026):
 *   - Track AI calls per user_id (sau IP daca anonim) zilnic
 *   - Daily budget global (toate userii) ca safety net
 *   - Daca atins → skip provider-i expensive (Gemini → Groq free fallback)
 *   - Daca user atins quota → return 429 cu mesaj clar
 *
 * Storage: Upstash Redis cu TTL 24h (auto-reset zilnic).
 *
 * NU blochează functionalitatea — doar previne abuse + runaway costs.
 */

import { Redis } from "@upstash/redis";

const QUOTA_PREFIX = "ai-quota";
const DAILY_TTL_SECONDS = 24 * 60 * 60;

// Defaults — pot fi overridate via env vars la deploy.
const USER_DAILY_LIMIT = Number(process.env.AI_USER_DAILY_LIMIT ?? 50);
const GLOBAL_DAILY_BUDGET = Number(process.env.AI_GLOBAL_DAILY_BUDGET ?? 5000);

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
}

export interface QuotaCheck {
  /** True = user are quota OK, poate face AI call. */
  allowed: boolean;
  /** Cate calls userul a făcut azi. */
  userUsed: number;
  /** Limita zilnică per user. */
  userLimit: number;
  /** Cate calls global s-au făcut azi (toate userii). */
  globalUsed: number;
  /** Budget zilnic global. */
  globalLimit: number;
  /** Mesaj user-friendly dacă blocat. */
  reason?: string;
}

/**
 * Check + increment AI quota pentru user/IP.
 * Idempotent: poate fi apelat înainte de AI call ca să decide allow/block.
 */
export async function checkAndIncrementQuota(args: {
  /** user_id (Supabase) sau IP fallback. */
  identifier: string;
  /** Feature pentru tagging Sentry / audit (improve / vision / chat / classify). */
  feature: string;
}): Promise<QuotaCheck> {
  const redis = getRedis();
  // Daca Upstash nu e configurat (dev), allow-all (zero cost). În prod
  // Vercel are env-urile setate.
  if (!redis) {
    return {
      allowed: true,
      userUsed: 0,
      userLimit: USER_DAILY_LIMIT,
      globalUsed: 0,
      globalLimit: GLOBAL_DAILY_BUDGET,
    };
  }

  const day = todayKey();
  const userKey = `${QUOTA_PREFIX}:user:${day}:${args.identifier}`;
  const globalKey = `${QUOTA_PREFIX}:global:${day}`;

  // 2026-05-27 — defensive try/catch. Upstash rate-limit (10k/day free tier)
  // sau API outage NU trebuie să blocheze AI calls (vision, chat, improve).
  // Fail-open: allow call, returnam counts = 0. Worst case: depasim quota
  // pe scurt; Vercel budget alert prinde abuse-ul real.
  let userCurrentRaw: number | null = null;
  let globalCurrentRaw: number | null = null;
  try {
    [userCurrentRaw, globalCurrentRaw] = await Promise.all([
      redis.get<number>(userKey),
      redis.get<number>(globalKey),
    ]);
  } catch {
    return {
      allowed: true,
      userUsed: 0,
      userLimit: USER_DAILY_LIMIT,
      globalUsed: 0,
      globalLimit: GLOBAL_DAILY_BUDGET,
    };
  }
  const userCurrent = Number(userCurrentRaw ?? 0);
  const globalCurrent = Number(globalCurrentRaw ?? 0);

  // Check limite înainte de increment.
  if (userCurrent >= USER_DAILY_LIMIT) {
    return {
      allowed: false,
      userUsed: userCurrent,
      userLimit: USER_DAILY_LIMIT,
      globalUsed: globalCurrent,
      globalLimit: GLOBAL_DAILY_BUDGET,
      reason: `Quota AI atinsă (${USER_DAILY_LIMIT}/zi). Reia mâine.`,
    };
  }
  if (globalCurrent >= GLOBAL_DAILY_BUDGET) {
    return {
      allowed: false,
      userUsed: userCurrent,
      userLimit: USER_DAILY_LIMIT,
      globalUsed: globalCurrent,
      globalLimit: GLOBAL_DAILY_BUDGET,
      reason: `Sistem AI temporar suspendat (budget global atins). Reia in cateva ore.`,
    };
  }

  // Increment atomic (pipeline). Pe failure Redis: allow oricum (fail-open).
  try {
    const pipe = redis.pipeline();
    pipe.incr(userKey);
    pipe.expire(userKey, DAILY_TTL_SECONDS);
    pipe.incr(globalKey);
    pipe.expire(globalKey, DAILY_TTL_SECONDS);
    // Per-feature counter pentru analytics (#92 din plan).
    const featureKey = `${QUOTA_PREFIX}:feature:${day}:${args.feature}`;
    pipe.incr(featureKey);
    pipe.expire(featureKey, DAILY_TTL_SECONDS);
    await pipe.exec();
  } catch {
    /* increment best-effort; AI call continues */
  }

  return {
    allowed: true,
    userUsed: userCurrent + 1,
    userLimit: USER_DAILY_LIMIT,
    globalUsed: globalCurrent + 1,
    globalLimit: GLOBAL_DAILY_BUDGET,
  };
}

/**
 * Snapshot pentru admin dashboard sau debug.
 */
export async function getQuotaSnapshot(): Promise<{
  day: string;
  globalUsed: number;
  globalLimit: number;
  perFeature: Record<string, number>;
}> {
  const redis = getRedis();
  const day = todayKey();
  if (!redis) {
    return { day, globalUsed: 0, globalLimit: GLOBAL_DAILY_BUDGET, perFeature: {} };
  }
  const globalKey = `${QUOTA_PREFIX}:global:${day}`;
  // 2026-05-27 — defensive try/catch. Admin dashboard nu trebuie sa
  // crash-eze daca Redis down.
  try {
    const globalUsed = Number((await redis.get<number>(globalKey)) ?? 0);
    // Feature counters — știm fixe (5 features) → bulk get.
    const features = ["improve", "vision", "chat", "classify", "severity"];
    const featureKeys = features.map((f) => `${QUOTA_PREFIX}:feature:${day}:${f}`);
    const featureCounts = await Promise.all(
      featureKeys.map((k) => redis.get<number>(k)),
    );
    const perFeature: Record<string, number> = {};
    features.forEach((f, i) => {
      perFeature[f] = Number(featureCounts[i] ?? 0);
    });
    return { day, globalUsed, globalLimit: GLOBAL_DAILY_BUDGET, perFeature };
  } catch {
    return { day, globalUsed: 0, globalLimit: GLOBAL_DAILY_BUDGET, perFeature: {} };
  }
}
