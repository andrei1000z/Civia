import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, TrendingUp, MapPin, Users } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { leaderboardAuthorName } from "@/lib/sesizari/display-name";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Clasament Fix Score — răspuns autorități pe județe",
  description:
    "Cât de prompt răspund primăriile la sesizările cetățenilor pe Civia. Fix Score per județ, top 10 cetățeni activi.",
  alternates: { canonical: "/clasament" },
};

// 2026-05-19: 1h → 6h. Leaderboard county-level, schimbari de pozitie rare.
export const revalidate = 21600;

type CountyStats = {
  countyId: string;
  countyName: string;
  countySlug: string;
  total: number;
  resolved: number;
  fixScore: number; // percent 0-100
};

async function fetchCountyStats(): Promise<CountyStats[]> {
  const admin = createSupabaseAdmin();
  // Fetch grouped count per county. Supabase JS doesn't support GROUP BY
  // in the query builder, so we pull rows and aggregate in JS. Acceptable
  // — sesizari count is in the low thousands.
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
    if (b.total < 3) continue; // need minimum sample to rank
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
  // Pull approved+publica sesizari cu author_display_name (preferat) sau
  // fallback la author_name → primul cuvant.
  const { data } = await admin
    .from("sesizari")
    .select("author_name, author_display_name, status")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .not("author_name", "is", null);

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of data ?? []) {
    // Privilegiaza display_name din profile (Google sign-in: prenume scurt).
    // Fallback la „Prenume X." (primul cuvant + initiala ultimului) pentru
    // sesizari anonime fara display_name.
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

function scoreColor(score: number): string {
  if (score >= 60) return "#059669"; // green
  if (score >= 30) return "#f59e0b"; // amber
  return "#dc2626"; // red
}

function scoreLabel(score: number): string {
  if (score >= 60) return "Bun";
  if (score >= 30) return "Mediu";
  return "Slab";
}

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
          { name: "Clasament Fix Score", url: `${SITE_URL}/clasament` },
        ]}
      />
      <PageHero
        title="Clasament Fix Score"
        icon={Trophy}
        gradient={HERO_GRADIENT.success}
        description={`Cât de prompt răspund primăriile la sesizările cetățenilor. Fix Score = procentul sesizărilor marcate „rezolvat" din totalul depus pe Civia. Sumă liber consultabilă, fără manipulare admin.`}
        tagline={`Național: ${nationalScore}% rezolvate (${totalResolved} din ${totalSesizari} sesizari)`}
      />

      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
          <MapPin size={20} aria-hidden="true" />
          Top județe
        </h2>
        {counties.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Inca nu avem date suficiente pe judete (minim 3 sesizari/judet ca sa intre in clasament).
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {counties.map((c, i) => (
              <Link
                key={c.countyId}
                href={`/${c.countySlug}/sesizari`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 hover:shadow-[var(--shadow-2)] hover:border-[var(--color-primary)]/30 transition-all flex items-center gap-4 group"
              >
                <div className="w-8 text-center text-sm font-bold text-[var(--color-text-muted)] tabular-nums">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">
                    {c.countyName}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {c.resolved} rezolvate · {c.total - c.resolved} in lucru · {c.total} total
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-xl font-extrabold tabular-nums"
                    style={{ color: scoreColor(c.fixScore) }}
                  >
                    {c.fixScore}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {scoreLabel(c.fixScore)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
          <Users size={20} aria-hidden="true" />
          Top 10 cetățeni activi
        </h2>
        {topUsers.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Inca nu avem cetateni cu 2+ sesizari rezolvate.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {topUsers.map((u) => (
              <div
                key={u.rank}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-4"
              >
                <div className="w-8 text-center text-sm font-bold text-[var(--color-text-muted)] tabular-nums">
                  {u.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{u.name}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {u.total} sesizari depuse · {u.resolved} rezolvate
                  </div>
                </div>
                <Badge variant="primary">
                  <TrendingUp size={11} aria-hidden="true" />
                  {u.resolved} fix
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
        <p className="mb-2">
          <strong className="text-[var(--color-text)]">Cum se calculeaza:</strong>{" "}
          Fix Score = (sesizari cu status „rezolvat" / total sesizari publice aprobate) × 100. Recalculat la fiecare ora.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Disclaimer:</strong>{" "}
          Cifrele reflecta DOAR sesizarile depuse pe Civia. O primarie cu Fix Score mic poate avea raspunsuri bune pe canale neoficiale.
          Numele cetatenilor sunt afisate pseudo-anonim (prenume + initiala numelui) — pentru anonimat complet, depune sesizari fara nume real in profil.
        </p>
      </div>
    </div>
  );
}
