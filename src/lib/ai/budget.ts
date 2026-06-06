/**
 * AI cost circuit breaker + per-user daily quota.
 *
 * Plan items #74, #81, #91 (5/22/2026):
 *   - Track AI calls per user_id (sau IP daca anonim) zilnic
 *   - Daily budget global (toate userii) ca safety net
 *   - Daca user atins quota → return 429 cu mesaj clar
 *
 * 2026-06-06 — MIGRAT Upstash → Cloudflare D1 (Upstash suspendat billing, ca
 * restul: rate-limit, cache, analytics). Storage: D1 kv cu TTL 24h (auto-reset
 * zilnic). Increment NON-atomic (get + set) — quota e SOFT, micile race-uri sub
 * concurență sunt acceptabile. Fail-open peste tot: dacă D1 lipsește/pică,
 * permitem call-ul (NU blocăm funcționalitatea).
 */

import { analyticsD1 } from "@/lib/analytics/d1-client";

const QUOTA_PREFIX = "ai-quota";
const DAILY_TTL_SECONDS = 24 * 60 * 60;

// Defaults — pot fi overridate via env vars la deploy.
const USER_DAILY_LIMIT = Number(process.env.AI_USER_DAILY_LIMIT ?? 50);
const GLOBAL_DAILY_BUDGET = Number(process.env.AI_GLOBAL_DAILY_BUDGET ?? 5000);

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

const ALLOW_ALL: QuotaCheck = {
  allowed: true,
  userUsed: 0,
  userLimit: USER_DAILY_LIMIT,
  globalUsed: 0,
  globalLimit: GLOBAL_DAILY_BUDGET,
};

/**
 * Check + increment AI quota pentru user/IP. Idempotent: apelat înainte de AI
 * call ca să decidă allow/block. Fail-open dacă D1 nu e disponibil.
 */
export async function checkAndIncrementQuota(args: {
  /** user_id (Supabase) sau IP fallback. */
  identifier: string;
  /** Feature pentru tagging (improve / vision / chat / classify / severity). */
  feature: string;
}): Promise<QuotaCheck> {
  const store = analyticsD1;
  if (!store) return ALLOW_ALL; // D1 neconfigurat (dev) → zero cost, allow-all.

  const day = todayKey();
  const userKey = `${QUOTA_PREFIX}:user:${day}:${args.identifier}`;
  const globalKey = `${QUOTA_PREFIX}:global:${day}`;

  // Fail-open: outage D1 NU trebuie să blocheze AI calls.
  let userCurrent = 0;
  let globalCurrent = 0;
  try {
    const [u, g] = await Promise.all([
      store.get<string>(userKey),
      store.get<string>(globalKey),
    ]);
    userCurrent = Number(u ?? 0) || 0;
    globalCurrent = Number(g ?? 0) || 0;
  } catch {
    return ALLOW_ALL;
  }

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

  // Increment NON-atomic (get-then-set). Best-effort; AI call continuă oricum.
  try {
    const featureKey = `${QUOTA_PREFIX}:feature:${day}:${args.feature}`;
    const fCur = Number((await store.get<string>(featureKey)) ?? 0) || 0;
    await Promise.all([
      store.set(userKey, String(userCurrent + 1), { ex: DAILY_TTL_SECONDS }),
      store.set(globalKey, String(globalCurrent + 1), { ex: DAILY_TTL_SECONDS }),
      store.set(featureKey, String(fCur + 1), { ex: DAILY_TTL_SECONDS }),
    ]);
  } catch {
    /* increment best-effort */
  }

  return {
    allowed: true,
    userUsed: userCurrent + 1,
    userLimit: USER_DAILY_LIMIT,
    globalUsed: globalCurrent + 1,
    globalLimit: GLOBAL_DAILY_BUDGET,
  };
}

/** Snapshot pentru admin dashboard sau debug. */
export async function getQuotaSnapshot(): Promise<{
  day: string;
  globalUsed: number;
  globalLimit: number;
  perFeature: Record<string, number>;
}> {
  const store = analyticsD1;
  const day = todayKey();
  if (!store) {
    return { day, globalUsed: 0, globalLimit: GLOBAL_DAILY_BUDGET, perFeature: {} };
  }
  try {
    const globalUsed = Number((await store.get<string>(`${QUOTA_PREFIX}:global:${day}`)) ?? 0) || 0;
    const features = ["improve", "vision", "chat", "classify", "severity"];
    const featureCounts = await Promise.all(
      features.map((f) => store.get<string>(`${QUOTA_PREFIX}:feature:${day}:${f}`)),
    );
    const perFeature: Record<string, number> = {};
    features.forEach((f, i) => {
      perFeature[f] = Number(featureCounts[i] ?? 0) || 0;
    });
    return { day, globalUsed, globalLimit: GLOBAL_DAILY_BUDGET, perFeature };
  } catch {
    return { day, globalUsed: 0, globalLimit: GLOBAL_DAILY_BUDGET, perFeature: {} };
  }
}
