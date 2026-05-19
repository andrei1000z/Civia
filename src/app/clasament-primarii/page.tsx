import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Trophy, Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ALL_COUNTIES } from "@/data/counties";
import { STATUS_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Clasament primării — care primării răspund cel mai bine?",
  description:
    "Rata reală de răspuns a primăriilor din România la sesizările cetățenilor. Cine răspunde, cine ignoră, în cât timp. Date publice, agregat automat.",
  alternates: { canonical: "/clasament-primarii" },
  openGraph: {
    title: "Clasament primării — Civia",
    description: "Care primării răspund cel mai bine la sesizările cetățenilor.",
    type: "website",
  },
};

// 2026-05-19: ISR 6h. Statistici agregate, schimbari lente (status updates
// vin pe parcursul a zile/saptamani).
export const revalidate = 21600;

interface CountyScore {
  countyId: string;
  countyName: string;
  countySlug: string;
  total: number;
  responded: number; // status in lucru / actiune / rezolvat / respins / amanat
  resolved: number; // status rezolvat
  responseRate: number; // %
  resolveRate: number; // %
  avgResponseDays: number | null;
}

async function loadScores(): Promise<CountyScore[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("sesizari")
      .select("county, status, created_at, official_response_at")
      .eq("moderation_status", "approved")
      .not("county", "is", null);

    if (error || !data) return [];

    // Aggregate per county
    const byCounty = new Map<string, {
      total: number;
      responded: number;
      resolved: number;
      respDays: number[];
    }>();

    const RESPONDED_STATUSES = new Set([
      "in-lucru", "actiune_autoritate", "rezolvat", "respins", "amanat",
    ]);

    for (const row of data as Array<{ county: string; status: string; created_at: string; official_response_at: string | null }>) {
      const c = row.county;
      if (!c) continue;
      const bucket = byCounty.get(c) ?? { total: 0, responded: 0, resolved: 0, respDays: [] };
      bucket.total += 1;
      if (RESPONDED_STATUSES.has(row.status)) bucket.responded += 1;
      if (row.status === "rezolvat") bucket.resolved += 1;
      if (row.official_response_at && row.created_at) {
        const ms = new Date(row.official_response_at).getTime() - new Date(row.created_at).getTime();
        if (ms > 0) bucket.respDays.push(ms / 86_400_000);
      }
      byCounty.set(c, bucket);
    }

    const scores: CountyScore[] = [];
    for (const [countyId, b] of byCounty.entries()) {
      // Doar judete cu cel putin 5 sesizari — sub asta zgomot statistic.
      if (b.total < 5) continue;
      const county = ALL_COUNTIES.find((c) => c.id === countyId);
      if (!county) continue;
      const responseRate = Math.round((b.responded / b.total) * 100);
      const resolveRate = Math.round((b.resolved / b.total) * 100);
      const avgResponseDays = b.respDays.length > 0
        ? Math.round(b.respDays.reduce((a, x) => a + x, 0) / b.respDays.length)
        : null;
      scores.push({
        countyId,
        countyName: county.name,
        countySlug: county.slug,
        total: b.total,
        responded: b.responded,
        resolved: b.resolved,
        responseRate,
        resolveRate,
        avgResponseDays,
      });
    }

    // Sortat descrescator pe responseRate, secondary pe resolveRate.
    scores.sort((a, b) => {
      if (b.responseRate !== a.responseRate) return b.responseRate - a.responseRate;
      return b.resolveRate - a.resolveRate;
    });

    return scores;
  } catch {
    return [];
  }
}

function tier(rate: number): { label: string; color: string; bg: string } {
  if (rate >= 70) return { label: "Excelent", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950/40" };
  if (rate >= 50) return { label: "OK", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950/40" };
  if (rate >= 30) return { label: "Slab", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-950/40" };
  return { label: "Foarte slab", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-950/40" };
}

export default async function ClasamentPrimariiPage() {
  const scores = await loadScores();
  const totalSesizari = scores.reduce((a, s) => a + s.total, 0);
  const totalResponded = scores.reduce((a, s) => a + s.responded, 0);
  const overallRate = totalSesizari > 0 ? Math.round((totalResponded / totalSesizari) * 100) : 0;

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Clasament primării"
        icon={Trophy}
        gradient={HERO_GRADIENT.warning}
        description={
          <>
            Care primării răspund cel mai bine la sesizările cetățenilor? Procent
            de răspuns + procent rezolvate, calculate automat din toate
            sesizările publice de pe Civia.
          </>
        }
        tagline={
          <>
            {scores.length} {scores.length === 1 ? "județ" : "județe"} cu date
            relevante · {totalSesizari} sesizări analizate · medie națională{" "}
            <strong>{overallRate}% răspuns</strong>
          </>
        }
      />

      {scores.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-[var(--color-text-muted)]" aria-hidden="true" />
          <h2 className="font-semibold text-lg mb-1">Date insuficiente momentan</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4 max-w-md mx-auto">
            Avem nevoie de cel puțin 5 sesizări per județ pentru a calcula o
            rată de răspuns relevantă. Ajută-ne — depune sesizare.
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Fă o sesizare <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {scores.length >= 3 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Top 3 cei mai responsivi
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {scores.slice(0, 3).map((s, i) => (
                  <Link
                    key={s.countyId}
                    href={`/${s.countySlug}`}
                    className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900 rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-2)] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-3xl" aria-hidden="true">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Locul {i + 1}
                      </span>
                    </div>
                    <h3 className="font-[family-name:var(--font-sora)] font-bold text-xl mb-2 text-[var(--color-text)]">
                      {s.countyName}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {s.responseRate}%
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">răspuns</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {s.responded}/{s.total} sesizări
                      {s.avgResponseDays != null && ` · ${s.avgResponseDays} zile medie`}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Full table */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)]">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <th className="py-3 px-4 font-semibold">#</th>
                    <th className="py-3 px-4 font-semibold">Județ</th>
                    <th className="py-3 px-4 font-semibold text-right tabular-nums">Sesizări</th>
                    <th className="py-3 px-4 font-semibold text-right tabular-nums">Răspuns</th>
                    <th className="py-3 px-4 font-semibold text-right tabular-nums">Rezolvate</th>
                    <th className="py-3 px-4 font-semibold text-right tabular-nums hidden md:table-cell">Zile medie</th>
                    <th className="py-3 px-4 font-semibold">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => {
                    const t = tier(s.responseRate);
                    return (
                      <tr key={s.countyId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-[var(--color-text-muted)] tabular-nums">
                          {i + 1}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/${s.countySlug}`}
                            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                          >
                            {s.countyName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[var(--color-text-muted)]">
                          {s.total}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--color-text)]">
                          {s.responseRate}%
                          <span className="text-[10px] text-[var(--color-text-muted)] ml-1 font-normal">
                            ({s.responded})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[var(--color-text)]">
                          {s.resolveRate}%
                          <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
                            ({s.resolved})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[var(--color-text-muted)] hidden md:table-cell">
                          {s.avgResponseDays != null ? `${s.avgResponseDays} zile` : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${t.bg} ${t.color}`}>
                            {t.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Methodology */}
          <section className="mt-8 bg-[var(--color-primary-soft)] rounded-[var(--radius-md)] p-5">
            <h2 className="font-semibold mb-2 inline-flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" />
              Cum se calculează?
            </h2>
            <ul className="text-sm text-[var(--color-text-muted)] space-y-1.5 leading-relaxed">
              <li>
                <strong>Rata de răspuns</strong>: procent sesizări cu status{" "}
                <em>{Object.values(STATUS_LABELS).filter((l) => ["În lucru", "Acțiune autoritate", "Rezolvat", "Respins", "Amânat"].includes(l)).join(", ")}</em>{" "}
                — adică sesizări la care primăria a reacționat oficial.
              </li>
              <li>
                <strong>Rata de rezolvare</strong>: procent sesizări marcate drept{" "}
                <em>rezolvat</em>.
              </li>
              <li>
                <strong>Zile medie</strong>: timpul mediu între depunerea
                sesizării și primul răspuns oficial.
              </li>
              <li>
                <strong>Minim 5 sesizări</strong> pentru a fi inclus în clasament
                — sub asta este zgomot statistic.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
