import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, TrendingUp, MapPin, FileText, Download, ExternalLink } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { DatasetJsonLd, FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const revalidate = 21600; // 6h

export const metadata: Metadata = {
  title: "Statistici sesizări România 2026 — Date live + dataset deschis | Civia",
  description:
    "Statistici live sesizări civice România: total raportate, rezolvate, rata răspuns primării, top tipuri probleme, distribuție pe județe. Date deschise CC BY 4.0.",
  alternates: { canonical: "/statistici-sesizari-romania" },
  keywords: [
    "statistici sesizari romania",
    "date deschise civic",
    "open data romania",
    "rata raspuns primarii",
    "transparenta administratie",
    "ce probleme se raporteaza",
  ],
};

interface StatsData {
  total: number;
  resolved: number;
  in_progress: number;
  by_type: Record<string, number>;
  by_county: Record<string, number>;
}

async function getStats(): Promise<StatsData | null> {
  try {
    const admin = createSupabaseAdmin();
    const [total, rezolvate, inLucru, byType, byCounty] = await Promise.all([
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "rezolvat"),
      admin.from("sesizari").select("*", { count: "exact", head: true }).eq("moderation_status", "approved").eq("status", "in-lucru"),
      admin.from("sesizari").select("tip").eq("moderation_status", "approved").limit(5000),
      admin.from("sesizari").select("county").eq("moderation_status", "approved").limit(5000),
    ]);

    const typeMap = new Map<string, number>();
    for (const r of (byType.data ?? []) as { tip: string }[]) {
      typeMap.set(r.tip, (typeMap.get(r.tip) ?? 0) + 1);
    }
    const countyMap = new Map<string, number>();
    for (const r of (byCounty.data ?? []) as { county: string | null }[]) {
      if (!r.county) continue;
      countyMap.set(r.county, (countyMap.get(r.county) ?? 0) + 1);
    }

    return {
      total: total.count ?? 0,
      resolved: rezolvate.count ?? 0,
      in_progress: inLucru.count ?? 0,
      by_type: Object.fromEntries(typeMap),
      by_county: Object.fromEntries(countyMap),
    };
  } catch {
    return null;
  }
}

const TIP_LABELS: Record<string, string> = {
  groapa: "Gropi & drumuri",
  parcare: "Parcare ilegală",
  gunoi: "Gunoi & salubritate",
  iluminat: "Iluminat stradal",
  trafic: "Trafic & semnalizare",
  stalpisori: "Stâlpișori & blocuri",
  trotuar: "Trotuare deteriorate",
  apa_canal: "Apă & canalizare",
  zgomot: "Zgomot & poluare fonică",
  abandon: "Mașini abandonate",
  spatiu_verde: "Spațiu verde",
  altele: "Alte probleme",
};

const FAQ = [
  {
    question: "De unde provin datele?",
    answer:
      "Din baza de date publică Civia.ro — toate sesizările aprobate de moderare, anonimizate (fără nume, adresă, contacte). Sub licență CC BY 4.0.",
  },
  {
    question: "Pot folosi datele într-un articol / cercetare?",
    answer:
      `Da, gratuit, cu atribuire: „Sursa: Civia.ro, licență CC BY 4.0”. Pentru extragere bulk: API public la /api/v1/stats sau /dezvoltatori.`,
  },
  {
    question: "Cât de des se actualizează?",
    answer:
      "Datele se reîmprospătează la 6 ore. Pentru date live (sub 6 ore) folosește API-ul direct: /api/v1/stats.",
  },
  {
    question: "Datele includ sesizările trimise pe alte platforme?",
    answer:
      "Nu. Statisticile aici reflectă DOAR sesizările făcute prin Civia. Pentru date naționale agregate, consultă Avocatul Poporului (avp.ro/raport-anual).",
  },
  {
    question: "Pot vedea date pe județul meu?",
    answer:
      `Da, în secțiunea „Top județe” + pagini per județ: /[judet]/sesizari.`,
  },
];

export default async function StatisticiPage() {
  const stats = await getStats();
  const resolvedPct = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const inProgressPct = stats && stats.total > 0 ? Math.round((stats.in_progress / stats.total) * 100) : 0;
  const topTypes = stats
    ? Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).slice(0, 10)
    : [];
  const topCounties = stats
    ? Object.entries(stats.by_county).sort((a, b) => b[1] - a[1]).slice(0, 10)
    : [];
  const maxTypeCount = topTypes[0]?.[1] ?? 1;
  const maxCountyCount = topCounties[0]?.[1] ?? 1;
  const lastUpdated = new Date().toISOString();

  return (
    <div className="container-narrow py-8 md:py-12 max-w-5xl">
      <DatasetJsonLd
        name="Statistici sesizări civice România — Civia"
        description={`Set deschis de date: ${stats?.total ?? 0} sesizări civice raportate de cetățeni români prin Civia.ro. Distribuție pe tipuri și județe. Licență CC BY 4.0.`}
        url={`${SITE_URL}/statistici-sesizari-romania`}
        keywords={["sesizari", "romania", "civic", "open data", "primarii", "transparenta"]}
        lastUpdated={lastUpdated}
      />
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Statistici sesizări România", url: `${SITE_URL}/statistici-sesizari-romania` },
        ]}
      />

      <PageHero
        title="Statistici sesizări România"
        icon={BarChart3}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Date live despre <strong>{stats?.total.toLocaleString("ro-RO") ?? "..."}</strong> sesizări
            civice raportate de cetățeni români prin Civia. Distribuție pe
            tipuri, județe, rată de rezolvare.
          </>
        }
        tagline="Open Data CC BY 4.0 · Actualizat la 6 ore · API public /api/v1/stats"
      />

      {/* KPI Cards */}
      <section aria-labelledby="kpi" className="mb-12">
        <h2 id="kpi" className="sr-only">Indicatori cheie</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <FileText size={20} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
              Total sesizări
            </p>
            <p className="text-3xl font-bold font-[family-name:var(--font-sora)]">
              {stats?.total.toLocaleString("ro-RO") ?? "—"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">aprobate de moderare</p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <TrendingUp size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
              Rezolvate
            </p>
            <p className="text-3xl font-bold font-[family-name:var(--font-sora)] text-emerald-500">
              {resolvedPct}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {stats?.resolved.toLocaleString("ro-RO") ?? "—"} sesizări
            </p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <TrendingUp size={20} className="text-amber-500 mb-2" aria-hidden="true" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
              În lucru
            </p>
            <p className="text-3xl font-bold font-[family-name:var(--font-sora)] text-amber-500">
              {inProgressPct}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {stats?.in_progress.toLocaleString("ro-RO") ?? "—"} sesizări
            </p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <MapPin size={20} className="text-violet-500 mb-2" aria-hidden="true" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
              Județe acoperite
            </p>
            <p className="text-3xl font-bold font-[family-name:var(--font-sora)] text-violet-500">
              {stats ? Object.keys(stats.by_county).length : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">din 42 + București</p>
          </div>
        </div>
      </section>

      {/* Top tipuri */}
      <section aria-labelledby="top-tipuri" className="mb-12">
        <h2
          id="top-tipuri"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
        >
          🏆 Top 10 tipuri de probleme raportate
        </h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 space-y-3">
          {topTypes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
              Datele se încarcă… reîncearcă în câteva momente.
            </p>
          ) : (
            topTypes.map(([tip, count], i) => {
              const pct = Math.round((count / maxTypeCount) * 100);
              const totalPct = stats && stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={tip}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      {TIP_LABELS[tip] ?? tip}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs">
                      {count.toLocaleString("ro-RO")} ({totalPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Top județe */}
      <section aria-labelledby="top-judete" className="mb-12">
        <h2
          id="top-judete"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
        >
          🗺️ Top 10 județe active
        </h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 space-y-3">
          {topCounties.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
              Datele se încarcă…
            </p>
          ) : (
            topCounties.map(([county, count], i) => {
              const pct = Math.round((count / maxCountyCount) * 100);
              return (
                <div key={county}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500 text-white text-[10px] font-bold"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={`/${county.toLowerCase()}`}
                        className="hover:text-[var(--color-primary)] transition-colors"
                      >
                        {county}
                      </Link>
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs">
                      {count.toLocaleString("ro-RO")} sesizări
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Open Data callout */}
      <section className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-12">
        <div className="flex items-start gap-3 mb-3">
          <Download size={24} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">
              Date deschise — folosește-le
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
              Toate datele sunt sub licență <strong>CC BY 4.0</strong> — gratuite
              pentru jurnaliști, cercetători, ONG-uri, dezvoltatori. Atribuire:{" "}
              <em>„Sursa: Civia.ro, CC BY 4.0”.</em>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/api/v1/stats"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Download size={14} aria-hidden="true" />
            JSON live (/api/v1/stats)
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-stats" className="mb-12">
        <h2 id="faq-stats" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          🤔 Despre date
        </h2>
        <div className="space-y-3">
          {FAQ.map((q) => (
            <details
              key={q.question}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] group"
            >
              <summary className="cursor-pointer p-4 font-semibold text-sm flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors rounded-[var(--radius-md)]">
                {q.question}
                <span
                  className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </summary>
              <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">
                {q.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Ultima actualizare: {new Date(lastUpdated).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
        {" · "}
        Datele se reîmprospătează la 6 ore.
      </p>
    </div>
  );
}
