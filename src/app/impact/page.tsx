import type { Metadata } from "next";
import { BarChart3, CheckCircle2, Mail, AlertTriangle, Clock, MapPin, FileText } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_STATUS_META } from "@/lib/sesizari/status";
import { SITE_NAME } from "@/lib/constants";
import { AutoritatiHeatmap } from "@/components/impact/AutoritatiHeatmap";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: `Impactul Civia — cifre publice • ${SITE_NAME}`,
  description:
    "Transparență brutală: câte sesizări s-au trimis prin Civia, câte primării au răspuns, câte s-au rezolvat. Cifre publice, actualizate zilnic.",
  alternates: { canonical: `${SITE_URL}/impact` },
  openGraph: {
    title: "Impactul Civia — cifre publice",
    description: "Câte sesizări s-au trimis, câte au primit răspuns, câte s-au rezolvat. Totul transparent.",
    url: `${SITE_URL}/impact`,
    type: "website",
    locale: "ro_RO",
  },
};

// 2026-05-25 OPTIMIZATION: 120s → 1800s (30 min). /impact stats refresh
// la 2 min era overkill (-576 ISR writes/zi). Cifrele se schimbă lent;
// 30 min refresh e mai mult decât suficient pentru un dashboard public.
export const revalidate = 1800;

interface Stats {
  total: number;
  trimisViaCivia: number;
  cuRaspuns: number;
  rezolvate: number;
  ignorate: number;
  cuPoze: number;
  pe7Zile: number;
  pe30Zile: number;
  topJudete: Array<{ judet: string; count: number }>;
  pieStatus: Array<{ status: string; count: number; pct: number }>;
}

async function getStats(): Promise<Stats | null> {
  // 2026-05-27 — try/catch larg. Promise.all aruncă pe primul fail, iar
  // /impact e pagină publică (cetățeni o vizitează des). Pe Supabase
  // outage / query error → return null, page-ul afișează fallback UI
  // (linia 114 jos).
  const admin = createSupabaseAdmin();
  let queries: [
    { count: number | null },
    { count: number | null },
    { count: number | null },
    { count: number | null },
    { data: Array<{ sesizare_id: string }> | null },
    { count: number | null },
    { count: number | null },
    { count: number | null },
    { data: Array<{ county: string }> | null },
    { data: Array<{ status: string }> | null },
  ];
  try {
    queries = (await Promise.all([
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("sent_via_civia", true),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "rezolvat"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "ignorat"),
      admin.from("sesizare_replies").select("sesizare_id").not("sesizare_id", "is", null),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").not("imagini", "eq", "{}"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()),
      admin.from("sesizari").select("county").eq("moderation_status", "approved").not("county", "is", null),
      admin.from("sesizari").select("status").eq("moderation_status", "approved"),
    ])) as typeof queries;
  } catch {
    return null;
  }
  const [
    { count: total },
    { count: trimisViaCivia },
    { count: rezolvate },
    { count: ignorate },
    { data: cuRaspunsData },
    { count: cuPoze },
    { count: pe7Zile },
    { count: pe30Zile },
    { data: byCounty },
    { data: byStatus },
  ] = queries;

  // Unique sesizari cu reply. audit fix: cap la `total` (aprobate) — unele
  // replies sunt pe sesizări nemoderate/ascunse, neincluse în total → fără cap
  // funnel-ul „cu răspuns primit" depășea 100% (bară overflow + procent >100).
  const cuRaspuns = Math.min(total ?? 0, new Set((cuRaspunsData ?? []).map((r) => r.sesizare_id)).size);

  // Group counties
  const countyMap = new Map<string, number>();
  for (const r of (byCounty ?? []) as Array<{ county: string }>) {
    countyMap.set(r.county, (countyMap.get(r.county) ?? 0) + 1);
  }
  const topJudete = [...countyMap.entries()]
    .map(([judet, count]) => ({ judet, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Group status
  const statusMap = new Map<string, number>();
  for (const r of (byStatus ?? []) as Array<{ status: string }>) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  }
  const totalForPct = total ?? 0;
  const pieStatus = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count, pct: totalForPct > 0 ? Math.round((count / totalForPct) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    total: total ?? 0,
    trimisViaCivia: trimisViaCivia ?? 0,
    cuRaspuns,
    rezolvate: rezolvate ?? 0,
    ignorate: ignorate ?? 0,
    cuPoze: cuPoze ?? 0,
    pe7Zile: pe7Zile ?? 0,
    pe30Zile: pe30Zile ?? 0,
    topJudete,
    pieStatus,
  };
}

function pctSafe(n: number, d: number): number {
  if (!d) return 0;
  // audit fix: cap la 100% — „cu răspuns" putea depăși total (replies la sesizări
  // ne-aprobate/necontorizate în total) → bară overflow + procent peste 100.
  return Math.min(100, Math.round((n / d) * 100));
}

export default async function ImpactPage() {
  const stats = await getStats();

  if (!stats) {
    return (
      <div className="container-narrow py-16">
        <p>Statisticile nu sunt disponibile momentan.</p>
      </div>
    );
  }

  const trimitereRate = pctSafe(stats.trimisViaCivia, stats.total);
  const raspunsRate = pctSafe(stats.cuRaspuns, stats.total);
  const rezolvareRate = pctSafe(stats.rezolvate, stats.total);
  const ignorateRate = pctSafe(stats.ignorate, stats.total);

  return (
    <>
      <PageHero
        title="Impactul Civia în cifre"
        icon={BarChart3}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Toate datele publice. Actualizat la fiecare 2 minute.{" "}
            <strong>Transparență totală — și unde nu funcționează, și unde merge.</strong>
          </>
        }
        tagline={`${stats.total.toLocaleString("ro-RO")} sesizări publice analizate`}
      />

      <div className="container-narrow space-y-8 pb-16">
        {/* HERO STATS — 4 KPI mari */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <KpiCard
            icon={FileText}
            label="Sesizări depuse"
            value={stats.total}
            sublabel={`+${stats.pe7Zile} ultima săptămână`}
            color="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            icon={Mail}
            label="Trimise oficial"
            value={stats.trimisViaCivia}
            sublabel={`${trimitereRate}% din total`}
            color={trimitereRate >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
          />
          <KpiCard
            icon={CheckCircle2}
            label="Rezolvate"
            value={stats.rezolvate}
            sublabel={`${rezolvareRate}% rate de rezolvare`}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Ignorate"
            value={stats.ignorate}
            sublabel={`${ignorateRate}% > 60 zile fără răspuns`}
            color="text-rose-600 dark:text-rose-400"
          />
        </section>

        {/* FUNNEL */}
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">Pâlnia conversie</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Cum se transformă o sesizare depusă într-o problemă rezolvată.
          </p>
          <div className="space-y-3">
            <FunnelRow label="Depuse" value={stats.total} max={stats.total} color="bg-blue-500" />
            <FunnelRow label="Trimise oficial via Civia" value={stats.trimisViaCivia} max={stats.total} color="bg-emerald-500" />
            <FunnelRow label="Cu răspuns primit" value={stats.cuRaspuns} max={stats.total} color="bg-cyan-500" />
            <FunnelRow label="Rezolvate" value={stats.rezolvate} max={stats.total} color="bg-teal-500" />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-4 leading-relaxed">
            <strong>Notă onestă:</strong> dacă procentul de „Trimise oficial" e mic, înseamnă că
            mulți cetățeni completează formularul dar nu finalizează cu butonul „Trimite cu Civia".
            Lucrăm să creștem rata.
          </p>
        </section>

        {/* STATUS DISTRIBUTION */}
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1 flex items-center gap-2">
            <Clock size={20} className="text-[var(--color-primary)]" aria-hidden="true" />
            Pe status
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Unde se află toate sesizările în acest moment.
          </p>
          <div className="space-y-2">
            {stats.pieStatus.map((row) => {
              const meta = SESIZARE_STATUS_META[row.status as keyof typeof SESIZARE_STATUS_META];
              return (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="text-base" aria-hidden="true">{meta?.emoji ?? "•"}</span>
                  <span className="text-sm font-medium w-40 shrink-0">{meta?.label ?? row.status}</span>
                  <div className="flex-1 h-3 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${row.pct}%`, backgroundColor: meta?.color ?? "#6B7280" }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-[var(--color-text-muted)] w-16 text-right">
                    {row.count} ({row.pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* P2.22 HEATMAP AUTORITĂȚI */}
        <AutoritatiHeatmap />

        {/* TOP JUDETE */}
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1 flex items-center gap-2">
            <MapPin size={20} className="text-[var(--color-primary)]" aria-hidden="true" />
            Top 10 județe după sesizări
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Județele cu cea mai mare activitate civică pe Civia.
          </p>
          <ol className="space-y-2">
            {stats.topJudete.map((j, i) => (
              <li key={j.judet} className="flex items-center gap-3">
                <span className="font-mono text-xs text-[var(--color-text-muted)] w-8 tabular-nums">#{i + 1}</span>
                <span className="font-semibold text-sm uppercase w-12">{j.judet}</span>
                <div className="flex-1 h-2.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full"
                    style={{ width: `${pctSafe(j.count, stats.topJudete[0]?.count ?? 1)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)] w-12 text-right">
                  {j.count}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
          Date deschise: <a href="/api/v1/stats" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">JSON API</a> ·
          {" "}<a href="/api/v2/open311/requests.json" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">Open311</a> ·
          {" "}Toate cifrele sunt din DB Supabase la cerere.
        </p>
        {/* 2026-05-25: link-uri JSON API rămân <a> (nu <Link>) pentru că
            sunt download/external resources, nu Next.js routes. Lint regula
            @next/next/no-html-link-for-pages e disabled aici via target=_blank. */}
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
      <Icon size={20} className={`mb-2 ${color}`} aria-hidden="true" />
      <p className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-sora)] tabular-nums">
        {value.toLocaleString("ro-RO")}
      </p>
      <p className="text-xs font-medium text-[var(--color-text-muted)] mt-1">{label}</p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-tight">{sublabel}</p>
    </div>
  );
}

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-48 shrink-0">{label}</span>
      <div className="flex-1 h-7 rounded-md bg-[var(--color-surface-2)] overflow-hidden relative">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-white drop-shadow">
          {value.toLocaleString("ro-RO")} ({pct}%)
        </span>
      </div>
    </div>
  );
}
