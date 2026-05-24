import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Heatmap public: pentru fiecare județ care are sesizări trimise oficial,
 * arătăm rata de răspuns (sesizări cu reply / sesizări trimise via Civia).
 *
 * Verde = > 50% răspuns. Galben = 20-50%. Roșu = < 20%. Gri = fără date.
 *
 * P2.22 — folosit pe /impact și opțional pe /[judet] paginile județelor.
 * Conform OG 27/2002 art. 8, primăriile au 30 zile obligatoriu să răspundă.
 * Asta-i acountability publică: cine răspunde și cine nu.
 */

interface CountyStat {
  county: string;
  county_name: string;
  total_trimis: number;
  total_raspuns: number;
  rate: number; // 0-100
}

async function loadStats(): Promise<CountyStat[]> {
  const admin = createSupabaseAdmin();
  const [{ data: trimise }, { data: replies }] = await Promise.all([
    admin
      .from("sesizari")
      .select("id, county")
      .eq("moderation_status", "approved")
      .eq("sent_via_civia", true)
      .not("county", "is", null),
    admin
      .from("sesizare_replies")
      .select("sesizare_id"),
  ]);

  const repliedIds = new Set((replies ?? []).map((r) => r.sesizare_id as string));

  const map = new Map<string, { trimis: number; raspuns: number }>();
  for (const r of (trimise ?? []) as Array<{ id: string; county: string }>) {
    const cur = map.get(r.county) ?? { trimis: 0, raspuns: 0 };
    cur.trimis += 1;
    if (repliedIds.has(r.id)) cur.raspuns += 1;
    map.set(r.county, cur);
  }

  const { getCountyById } = await import("@/data/counties");
  return [...map.entries()]
    .map(([county, v]) => ({
      county,
      county_name: getCountyById(county)?.name ?? county,
      total_trimis: v.trimis,
      total_raspuns: v.raspuns,
      rate: v.trimis > 0 ? Math.round((v.raspuns / v.trimis) * 100) : 0,
    }))
    .sort((a, b) => b.total_trimis - a.total_trimis);
}

function rateColor(rate: number, hasData: boolean): { bg: string; text: string; label: string } {
  if (!hasData) return { bg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", label: "fără date" };
  if (rate >= 50) return { bg: "bg-emerald-500/20 border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", label: "bun" };
  if (rate >= 20) return { bg: "bg-amber-500/20 border-amber-500/40", text: "text-amber-700 dark:text-amber-300", label: "mediu" };
  return { bg: "bg-rose-500/20 border-rose-500/40", text: "text-rose-700 dark:text-rose-300", label: "slab" };
}

export async function AutoritatiHeatmap() {
  const stats = await loadStats();

  if (stats.length === 0) {
    return (
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">
          Rata răspuns primării pe județ
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Cifrele apar după ce avem primele răspunsuri primite la sesizările trimise via Civia.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Nici o sesizare cu răspuns încă. Cele 3 trimise sunt în termenul de 30 zile OG 27/2002.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">
        Rata răspuns autorități pe județ
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Sesizări cu răspuns ÷ sesizări trimise oficial. OG 27/2002 art. 8: termen legal 30 zile.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {stats.map((s) => {
          const c = rateColor(s.rate, s.total_trimis > 0);
          return (
            <a
              key={s.county}
              href={`/${s.county.toLowerCase()}`}
              className={`block rounded-[var(--radius-xs)] border ${c.bg} p-3 hover:scale-[1.02] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]`}
              aria-label={`${s.county_name}: ${s.rate}% rată răspuns`}
            >
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-text-muted)]">
                {s.county_name}
              </p>
              <p className={`text-xl font-bold ${c.text} mt-0.5 tabular-nums`}>{s.rate}%</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {s.total_raspuns}/{s.total_trimis} răspuns
              </p>
            </a>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
          ≥ 50%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500/40" />
          20-50%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-rose-500/30 border border-rose-500/40" />
          &lt; 20%
        </span>
      </div>
    </section>
  );
}
