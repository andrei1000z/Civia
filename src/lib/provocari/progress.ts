import type { SupabaseClient } from "@supabase/supabase-js";
import { sectorFromLocality } from "@/lib/area/subscriptions";
import { monthBounds, type Provocare } from "@/data/provocari";

/**
 * Progresul COLECTIV al unei provocări lunare + participarea unui cetățean
 * (pentru badge-ul ediție-limitată). Fără tabel nou — numărăm direct pe
 * `sesizari` (public+approved) pe temă+oraș+lună, ca în clasament/digest-local.
 *
 * Numărăm SESIZĂRI, nu cetățeni unici — un cetățean cu 3 sesizări pe temă
 * contribuie cu 3 la progresul colectiv (e progres pe temă, nu competiție).
 */

// Regex diacritic-tolerant (ca la /api/search) — „Iasi" prinde „Iași". Doar
// [a-z0-9] în pattern → zero injection. Folosit pentru filtrul de localitate.
const DIACRITIC_CLASS: Record<string, string> = { a: "[aăâ]", i: "[iî]", s: "[sșş]", t: "[tțţ]" };
function diacriticRegex(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split("")
    .filter((c) => /[a-z0-9]/.test(c))
    .map((c) => DIACRITIC_CLASS[c] ?? c)
    .join("");
}

type Admin = SupabaseClient;

/** Aplică filtrele temă+oraș+lună pe un query head-count. */
function applyChallengeFilters<T>(q: T, p: Provocare): T {
  const { startIso, endIso } = monthBounds(p.month);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = q;
  query = query
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .eq("tip", p.tip)
    .eq("county", p.county)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  const sector = sectorFromLocality(p.locality);
  if (sector) {
    query = query.eq("sector", sector);
  } else if (p.locality) {
    const re = diacriticRegex(p.locality);
    if (re) query = query.imatch("locatie", re);
  }
  return query as T;
}

export interface ProvocareProgress {
  count: number;
  prag: number;
  pct: number; // 0-100 (cap)
  atins: boolean;
}

export async function countProvocareProgress(
  admin: Admin,
  p: Provocare,
): Promise<ProvocareProgress> {
  const base = admin.from("sesizari").select("id", { count: "exact", head: true });
  const { count, error } = await applyChallengeFilters(base, p);
  const total = error ? 0 : count ?? 0;
  const prag = p.pragColectiv;
  return {
    count: total,
    prag,
    pct: prag > 0 ? Math.min(100, Math.round((total / prag) * 100)) : 0,
    atins: total >= prag,
  };
}

/**
 * A participat cetățeanul la provocare? (≥1 sesizare publică pe temă+oraș+lună).
 * Ownership ca în repository: match pe user_id SAU author_email (guest→logat).
 */
export async function userHasParticipated(
  admin: Admin,
  p: Provocare,
  viewer: { userId: string | null; email: string | null },
): Promise<boolean> {
  if (!viewer.userId && !viewer.email) return false;
  const base = admin.from("sesizari").select("id", { count: "exact", head: true });
  let q = applyChallengeFilters(base, p);
  const ors: string[] = [];
  if (viewer.userId) ors.push(`user_id.eq.${viewer.userId}`);
  if (viewer.email) ors.push(`author_email.eq.${viewer.email.toLowerCase().trim()}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q = (q as any).or(ors.join(","));
  const { count, error } = await q;
  return !error && (count ?? 0) > 0;
}
