import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, TrendingUp, MapPin, Users, ArrowUpRight } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { leaderboardAuthorName } from "@/lib/sesizari/display-name";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

// 2026-05-25 — UI refresh major:
//   - Title scurt „Clasament" (era „Clasament Fix Score" — naming cleanup)
//   - Scoase „Cum se calculeaza" + „Disclaimer" lung
//   - National score în hero card vizual + podium top 3 grafic
//   - Cards cu medal pentru top 3 + barre vizuale fix rate
//   - Grid responsive cu hover lift

export const metadata: Metadata = {
  title: "Clasament — răspuns primării pe județe",
  description:
    "Cât de prompt răspund primăriile la sesizările cetățenilor pe Civia. Procent rezolvate per județ, top cetățeni activi.",
  alternates: { canonical: "/clasament" },
};

export const revalidate = 21600;

type CountyStats = {
  countyId: string;
  countyName: string;
  countySlug: string;
  total: number;
  resolved: number;
  fixScore: number;
};

async function fetchCountyStats(): Promise<CountyStats[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("sesizari")
    .select("county, status")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .not("county", "is", null);

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of data ?? []) {
    const id = row.county;
    if (!id) continue;
    let b = buckets.get(id);
    if (!b) {
      b = { total: 0, resolved: 0 };
      buckets.set(id, b);
    }
    b.total += 1;
    if (row.status === "rezolvat") b.resolved += 1;
  }

  const stats: CountyStats[] = [];
  for (const [countyId, b] of buckets.entries()) {
    const c = ALL_COUNTIES.find((x) => x.id === countyId);
    if (!c) continue;
    if (b.total < 3) continue;
    stats.push({
      countyId,
      countyName: c.name,
      countySlug: c.slug,
      total: b.total,
      resolved: b.resolved,
      fixScore: Math.round((b.resolved / b.total) * 100),
    });
  }

  return stats.sort((a, b) => b.fixScore - a.fixScore || b.total - a.total);
}

async function fetchTopUsers(): Promise<Array<{ name: string; resolved: number; total: number; rank: number }>> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("sesizari")
    .select("author_name, author_display_name, status")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .not("author_name", "is", null);

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of data ?? []) {
    const display = leaderboardAuthorName({
      display_name: row.author_display_name,
      author_name: row.author_name,
    });
    if (!display || display === "Cetățean") continue;
    let b = buckets.get(display);
    if (!b) {
      b = { total: 0, resolved: 0 };
      buckets.set(display, b);
    }
    b.total += 1;
    if (row.status === "rezolvat") b.resolved += 1;
  }

  const list = Array.from(buckets.entries())
    .filter(([, b]) => b.total >= 2)
    .map(([name, b]) => ({ name, total: b.total, resolved: b.resolved }))
    .sort((a, b) => b.resolved - a.resolved || b.total - a.total)
    .slice(0, 10);

  return list.map((u, i) => ({ ...u, rank: i + 1 }));
}

function scoreTint(score: number): { color: string; bg: string; label: string } {
  if (score >= 60) return { color: "var(--color-success)", bg: "var(--color-success-soft)", label: "Bun" };
  if (score >= 30) return { color: "var(--color-warning)", bg: "var(--color-warning-soft)", label: "Mediu" };
  return { color: "var(--color-error)", bg: "var(--color-error-soft)", label: "Slab" };
}

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

export default async function ClasamentPage() {
  const [counties, topUsers] = await Promise.all([
    fetchCountyStats(),
    fetchTopUsers(),
  ]);

  const totalSesizari = counties.reduce((acc, c) => acc + c.total, 0);
  const totalResolved = counties.reduce((acc, c) => acc + c.resolved, 0);
  const nationalScore = totalSesizari > 0 ? Math.round((totalResolved / totalSesizari) * 100) : 0;

  return (
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Clasament", url: `${SITE_URL}/clasament` },
        ]}
      />
      <PageHero
        title="Clasament primării"
        icon={Trophy}
        gradient={HERO_GRADIENT.success}
        tagline={`${totalResolved} din ${totalSesizari} sesizări rezolvate la nivel național`}
      />

      {/* National stat card mare — la blick clar */}
      <Card className="mb-10 p-6 sm:p-8 text-center">
        <p className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-2">
          Rata națională rezolvate
        </p>
        <p
          className="font-[family-name:var(--font-sora)] text-5xl sm:text-6xl font-extrabold tabular-nums"
          style={{ color: scoreTint(nationalScore).color }}
        >
          {nationalScore}%
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          din {totalSesizari.toLocaleString("ro-RO")} sesizări publice
        </p>
      </Card>

      {/* Podium top 3 (vizual) */}
      {counties.length >= 3 && (
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} aria-hidden="true" className="text-amber-500" />
            Top 3 județe
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {counties.slice(0, 3).map((c, i) => {
              const t = scoreTint(c.fixScore);
              return (
                <Link
                  key={c.countyId}
                  href={`/${c.countySlug}/sesizari`}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/30 hover:-translate-y-1 transition-all text-center group"
                >
                  <div className="text-4xl mb-2" aria-hidden="true">{MEDAL_EMOJI[i]}</div>
                  <p className="font-semibold text-base group-hover:text-[var(--color-primary)] transition-colors">
                    {c.countyName}
                  </p>
                  <p
                    className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums mt-2"
                    style={{ color: t.color }}
                  >
                    {c.fixScore}%
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {c.resolved}/{c.total} rezolvate
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Restul județelor */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
          <MapPin size={20} aria-hidden="true" />
          Toate județele {counties.length > 3 ? `(${counties.length - 3} restul)` : ""}
        </h2>
        {counties.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Încă nu avem date suficiente pe județe (minim 3 sesizări/județ).
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {counties.slice(3).map((c, i) => {
              const t = scoreTint(c.fixScore);
              return (
                <Link
                  key={c.countyId}
                  href={`/${c.countySlug}/sesizari`}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 hover:shadow-[var(--shadow-2)] hover:border-[var(--color-primary)]/30 transition-all flex items-center gap-4 group"
                >
                  <div className="w-8 text-center text-sm font-bold text-[var(--color-text-muted)] tabular-nums">
                    {i + 4}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">
                      {c.countyName}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {c.resolved} rezolvate · {c.total} total
                    </div>
                    {/* Vizual progres bar */}
                    <div className="mt-2 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${c.fixScore}%`, backgroundColor: t.color }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-xl font-extrabold tabular-nums"
                      style={{ color: t.color }}
                    >
                      {c.fixScore}%
                    </div>
                    <Badge
                      variant="neutral"
                      style={{ color: t.color, backgroundColor: t.bg }}
                    >
                      {t.label}
                    </Badge>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Cetățeni top 10 */}
      <section className="mb-8">
        <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
          <Users size={20} aria-hidden="true" />
          Cetățeni activi
        </h2>
        {topUsers.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Încă nu avem cetățeni cu 2+ sesizări rezolvate.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {topUsers.map((u) => (
              <div
                key={u.rank}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-4"
              >
                <div className="w-8 text-center font-bold tabular-nums">
                  {u.rank <= 3 ? (
                    <span className="text-xl" aria-hidden="true">{MEDAL_EMOJI[u.rank - 1]}</span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">{u.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{u.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {u.total} sesizări · {u.resolved} rezolvate
                  </div>
                </div>
                <Badge variant="primary">
                  <TrendingUp size={11} aria-hidden="true" />
                  {u.resolved}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
