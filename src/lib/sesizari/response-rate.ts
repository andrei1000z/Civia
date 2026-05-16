import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface ResponseRateStats {
  county: string;
  total: number;
  resolved: number;
  responseRate: number; // 0-100
  avgDaysToResponse: number | null;
  sample: number;
}

const CACHE_TTL_MS = 30 * 60_000; // 30 min
let cached: { ts: number; data: Map<string, ResponseRateStats> } | null = null;

/**
 * Aggregata in-memory pe Lambda: pentru fiecare county, ce procent din
 * sesizari au primit raspuns. Heuristic, nu ML adevarat — dar suficient
 * pentru a putea afisa „aceasta primarie raspunde la 34% din sesizari".
 */
export async function getResponseRates(): Promise<Map<string, ResponseRateStats>> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("sesizari")
    .select("county, status, created_at, resolved_at")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .not("county", "is", null);

  const map = new Map<string, ResponseRateStats>();
  for (const row of data ?? []) {
    if (!row.county) continue;
    let s = map.get(row.county);
    if (!s) {
      s = { county: row.county, total: 0, resolved: 0, responseRate: 0, avgDaysToResponse: null, sample: 0 };
      map.set(row.county, s);
    }
    s.total += 1;
    if (row.status === "rezolvat") {
      s.resolved += 1;
      if (row.resolved_at && row.created_at) {
        const days = Math.floor(
          (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / (24 * 60 * 60_000),
        );
        s.avgDaysToResponse = ((s.avgDaysToResponse ?? 0) * s.sample + days) / (s.sample + 1);
        s.sample += 1;
      }
    }
  }

  for (const s of map.values()) {
    s.responseRate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
    if (s.avgDaysToResponse !== null) s.avgDaysToResponse = Math.round(s.avgDaysToResponse);
  }

  cached = { ts: Date.now(), data: map };
  return map;
}

/**
 * Predicted likelihood-to-resolve pentru o sesizare noua. Heuristic:
 *  - Baseline = response rate pe county
 *  - +5% bonus daca tip e in „top responded" (parcare, gunoi rapide la primarii)
 *  - -10% penalty daca tip rar raspuns (sistemic: ex „transport public")
 */
const TIP_BONUS: Record<string, number> = {
  groapa: 0,
  gunoi: 8,
  iluminat: 5,
  parcare: -3,
  trotuar: 0,
  stalpisori: -8,
  copac: 3,
  canalizare: -5,
  transport: -10,
  zgomot: -8,
};

export async function predictResolveLikelihood(
  county: string | null,
  tip: string,
): Promise<{ likelihood: number; label: "high" | "medium" | "low"; sample: number }> {
  if (!county) return { likelihood: 50, label: "medium", sample: 0 };
  const rates = await getResponseRates();
  const stats = rates.get(county);
  if (!stats || stats.total < 5) {
    // Sample prea mic → returnez national average.
    let nationalTotal = 0;
    let nationalResolved = 0;
    for (const s of rates.values()) {
      nationalTotal += s.total;
      nationalResolved += s.resolved;
    }
    const nationalRate = nationalTotal > 0 ? Math.round((nationalResolved / nationalTotal) * 100) : 50;
    return {
      likelihood: Math.max(5, Math.min(95, nationalRate)),
      label: nationalRate >= 60 ? "high" : nationalRate >= 30 ? "medium" : "low",
      sample: nationalTotal,
    };
  }

  const baseline = stats.responseRate;
  const bonus = TIP_BONUS[tip] ?? 0;
  const likelihood = Math.max(5, Math.min(95, baseline + bonus));
  return {
    likelihood,
    label: likelihood >= 60 ? "high" : likelihood >= 30 ? "medium" : "low",
    sample: stats.total,
  };
}
