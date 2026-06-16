import type { Metadata } from "next";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Award,
  MapPin,
  Users,
  ArrowUpRight,
  Building2,
  TrendingUp,
  ChevronDown,
  ScrollText,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BottomActionBar } from "@/components/ui/BottomActionBar";
import { leaderboardAuthorName } from "@/lib/sesizari/display-name";
import { extractLocality } from "@/lib/sesizari/extract-locality";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";
import { wilsonLowerBound } from "@/lib/clasament/wilson";
import { scoreTint, rankInfo } from "@/lib/clasament/score";
import { getAutoritati } from "@/lib/promisiuni/autoritati";
import { PROMISIUNE_STATUS_META } from "@/data/promisiuni";
import { ClasamentTabs } from "./ClasamentTabs";

// 2026-06-16 — REBUILD: 7 secțiuni stivuite → SegmentedControl [Primării · Zone
//   · Cetățeni] + bară sticky glass cu KPI național. Sortare CORECTĂ via Wilson
//   lower bound (adjScore) — „67% din 3" nu mai sare peste „55% din 80"; numărul
//   afișat rămâne fix-rate-ul brut. Fairness: preliminare în acordeon, fără roșu
//   de shaming. + bandă „Promisometru" (clasament PRIMARI pe date REALE de
//   promisiuni respectate, nu rating subiectiv). Glyph tokenizat, nu emoji.

export const metadata: Metadata = {
  title: "Clasament — răspuns primării pe județe",
  description:
    "Cât de prompt răspund primăriile la sesizările cetățenilor pe Civia. Procent rezolvate per județ + zonă, primari după promisiuni respectate, top cetățeni activi.",
  alternates: { canonical: "/clasament" },
};

export const revalidate = 21600;

// ─── Tipuri ────────────────────────────────────────────────────────
type BoardRow = {
  key: string;
  name: string;
  href: string | null;
  total: number;
  resolved: number;
  fixScore: number;
  adjScore: number; // Wilson — DOAR pentru sortare
};

interface CountyStatsResult {
  stats: BoardRow[];
  preliminary: BoardRow[];
  nationalTotal: number;
  nationalResolved: number;
}

// ─── Fetch-uri (logica Supabase păstrată; + adjScore pentru sortare dreaptă) ──
async function fetchCountyStats(): Promise<CountyStatsResult> {
  const admin = createSupabaseAdmin();
  const res = await admin
    .from("sesizari")
    .select("county, status")
    .eq("moderation_status", "approved")
    .eq("publica", true);
  if (res.error || !res.data) {
    return { stats: [], preliminary: [], nationalTotal: 0, nationalResolved: 0 };
  }
  const data = res.data;

  let nationalTotal = 0;
  let nationalResolved = 0;
  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of data) {
    nationalTotal += 1;
    if (row.status === "rezolvat") nationalResolved += 1;
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

  const stats: BoardRow[] = [];
  const preliminary: BoardRow[] = [];
  for (const [countyId, b] of buckets.entries()) {
    const c = ALL_COUNTIES.find((x) => x.id === countyId);
    if (!c) continue;
    const row: BoardRow = {
      key: countyId,
      name: c.name,
      href: `/${c.slug}/sesizari`,
      total: b.total,
      resolved: b.resolved,
      fixScore: Math.round((b.resolved / b.total) * 100),
      adjScore: wilsonLowerBound(b.resolved, b.total),
    };
    (b.total >= 3 ? stats : preliminary).push(row);
  }

  return {
    stats: stats.sort(byAdj),
    preliminary: preliminary.sort((a, b) => b.total - a.total),
    nationalTotal,
    nationalResolved,
  };
}

const byAdj = (a: BoardRow, b: BoardRow) => b.adjScore - a.adjScore || b.total - a.total;

async function fetchCityStats(): Promise<BoardRow[]> {
  const admin = createSupabaseAdmin();
  const res = await admin
    .from("sesizari")
    .select("locatie, county, status")
    .eq("moderation_status", "approved")
    .eq("publica", true);
  if (res.error || !res.data) return [];

  const zoneOf = (locatie: string | null, county: string | null): string | null => {
    const loc = extractLocality(locatie);
    if (county === "B") return loc ?? "București (altă zonă)";
    if (loc && !loc.startsWith("Sector")) return loc;
    const name = county ? ALL_COUNTIES.find((c) => c.id === county)?.name : null;
    return name ?? loc ?? null;
  };

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of res.data) {
    const zone = zoneOf(row.locatie, row.county);
    if (!zone) continue;
    let b = buckets.get(zone);
    if (!b) {
      b = { total: 0, resolved: 0 };
      buckets.set(zone, b);
    }
    b.total += 1;
    if (row.status === "rezolvat") b.resolved += 1;
  }

  const stats: BoardRow[] = [];
  for (const [city, b] of buckets.entries()) {
    if (b.total < 2) continue;
    stats.push({
      key: city,
      name: city,
      href: null,
      total: b.total,
      resolved: b.resolved,
      fixScore: Math.round((b.resolved / b.total) * 100),
      adjScore: wilsonLowerBound(b.resolved, b.total),
    });
  }
  return stats.sort(byAdj).slice(0, 12);
}

async function fetchTopUsers(): Promise<Array<{ name: string; resolved: number; total: number; rank: number }>> {
  const admin = createSupabaseAdmin();
  const res = await admin
    .from("sesizari")
    .select("author_name, author_display_name, status")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .not("author_name", "is", null);
  if (res.error || !res.data) return [];

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of res.data) {
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
    .filter(([, b]) => b.total >= 2 || b.resolved >= 1)
    .map(([name, b]) => ({ name, total: b.total, resolved: b.resolved }))
    .sort((a, b) => b.resolved - a.resolved || b.total - a.total)
    .slice(0, 10);

  return list.map((u, i) => ({ ...u, rank: i + 1 }));
}

async function fetchTopAmbassadors(): Promise<Array<{ name: string; slug: string; count: number; rank: number }>> {
  const admin = createSupabaseAdmin();
  let data: Array<{ referred_by: string | null }> | null = null;
  try {
    const res = await admin.from("profiles").select("referred_by").not("referred_by", "is", null);
    data = res.data;
  } catch {
    return [];
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.referred_by;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id]) => id);

  const { data: profs } = await admin
    .from("profiles")
    .select("id, display_name, public_profile_slug, public_profile_enabled")
    .in("id", topIds);

  const list = ((profs ?? []) as Array<{
    id: string;
    display_name: string | null;
    public_profile_slug: string | null;
    public_profile_enabled: boolean;
  }>)
    .filter((p) => p.public_profile_enabled && p.public_profile_slug)
    .map((p) => ({
      name: p.display_name ?? "Cetățean Civia",
      slug: p.public_profile_slug as string,
      count: counts.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return list.map((u, i) => ({ ...u, rank: i + 1 }));
}

/** Clasament PRIMARI pe date REALE de promisiuni (rataRespectare), nu rating
 *  subiectiv din primari.ts. Doar cei cu promisiuni ajunse la scadență. */
function topMayors() {
  return getAutoritati()
    .filter((a) => a.stats.rataRespectare !== null)
    .map((a) => ({
      slug: a.slug,
      name: a.autoritate,
      functie: a.functie,
      initiale: a.initiale,
      rata: a.stats.rataRespectare as number,
      nrPromisiuni: a.items.length,
    }))
    .sort((a, b) => b.rata - a.rata || b.nrPromisiuni - a.nrPromisiuni)
    .slice(0, 6);
}

// ─── Sub-render: glyph de rang tokenizat ───────────────────────────
function RankBadge({ rank }: { rank: number }) {
  const { iconKey, tint } = rankInfo(rank);
  const Icon = iconKey === "trophy" ? Trophy : iconKey === "medal" ? Medal : iconKey === "award" ? Award : null;
  if (Icon) {
    return (
      <span className={`inline-flex items-center justify-center ${tint}`} aria-label={`Locul ${rank}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="w-8 text-center text-sm font-bold text-[var(--color-text-muted)] tabular-nums" aria-label={`Locul ${rank}`}>
      {rank}
    </span>
  );
}

// ─── Sub-render: board rankat (podium top-3 + tabel) ───────────────
function RankedBoard({ rows, headingIcon }: { rows: BoardRow[]; headingIcon: React.ReactNode }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">
          Încă nu avem date suficiente aici (minim 3 sesizări).{" "}
          <Link href="/sesizari" className="text-[var(--color-primary)] font-medium hover:underline">
            Fă prima sesizare
          </Link>
          .
        </p>
      </Card>
    );
  }
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-3">
      {/* Podium top 3 */}
      {top3.length >= 1 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {top3.map((r, i) => {
            const t = scoreTint(r.fixScore);
            const inner = (
              <>
                <div className="mb-2 flex justify-center">
                  <RankBadge rank={i + 1} />
                </div>
                <p className="font-semibold text-base group-hover:text-[var(--color-primary)] transition-colors">{r.name}</p>
                <p
                  className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums mt-1"
                  style={{ color: t.color }}
                >
                  {r.fixScore}%
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {r.resolved}/{r.total} rezolvate
                </p>
              </>
            );
            const cls =
              "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 text-center card-lift hover:border-[var(--color-primary)]/30 group block";
            return r.href ? (
              <Link key={r.key} href={r.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={r.key} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
      {/* Tabel 4+ */}
      {rest.length > 0 && (
        <div className="grid gap-2" role="list">
          {rest.map((r, i) => {
            const t = scoreTint(r.fixScore);
            const inner = (
              <>
                <div className="w-8 shrink-0 flex justify-center">
                  <RankBadge rank={i + 4} />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {headingIcon}
                  <span className="font-semibold text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">
                    {r.name}
                  </span>
                </div>
                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden shrink-0">
                  <div className="h-full rounded-full" style={{ width: `${r.fixScore}%`, background: t.color }} />
                </div>
                <span className="font-bold tabular-nums text-sm w-12 text-right shrink-0" style={{ color: t.color }}>
                  {r.fixScore}%
                </span>
                <Badge variant="neutral" className="hidden md:inline-flex shrink-0">
                  n={r.total}
                </Badge>
                {r.href && <ArrowUpRight size={15} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />}
              </>
            );
            const cls =
              "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 hover:shadow-[var(--shadow-2)] hover:border-[var(--color-primary)]/30 transition-all flex items-center gap-3 group";
            return r.href ? (
              <Link key={r.key} role="listitem" href={r.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={r.key} role="listitem" className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MAYOR_TINT = (rata: number) =>
  rata >= 60 ? PROMISIUNE_STATUS_META.respectata.color : rata >= 30 ? PROMISIUNE_STATUS_META.intarziata.color : PROMISIUNE_STATUS_META.incalcata.color;

export default async function ClasamentPage() {
  const [countyData, cities, topUsers, topAmbassadors] = await Promise.all([
    fetchCountyStats(),
    fetchCityStats(),
    fetchTopUsers(),
    fetchTopAmbassadors(),
  ] as const);
  const mayors = topMayors();

  const counties = countyData.stats;
  const preliminaryCounties = countyData.preliminary;
  const { nationalTotal, nationalResolved } = countyData;
  const nationalScore = nationalTotal > 0 ? Math.round((nationalResolved / nationalTotal) * 100) : 0;

  // ── Panou Primării: board județe + acordeon preliminare ──
  const primariiPanel = (
    <section className="space-y-4">
      <RankedBoard rows={counties} headingIcon={<MapPin size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />} />
      {preliminaryCounties.length > 0 && (
        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden group">
          <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer text-sm font-medium list-none">
            <span className="flex items-center gap-2">
              <Badge variant="info">Date preliminare</Badge>
              <span className="text-[var(--color-text-muted)]">{preliminaryCounties.length} județe cu 1-2 sesizări</span>
            </span>
            <ChevronDown size={16} className="text-[var(--color-text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {preliminaryCounties.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs">
                <span className="font-medium">{c.name}</span>
                <span className="text-[var(--color-text-muted)] tabular-nums">{c.resolved}/{c.total}</span>
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );

  // ── Panou Zone ──
  const zonePanel = (
    <RankedBoard rows={cities} headingIcon={<Building2 size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />} />
  );

  // ── Panou Cetățeni: eroi + ambasadori ──
  const cetateniPanel = (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold flex items-center gap-2">
          <TrendingUp size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
          Cetățeni cu impact
        </h2>
        {topUsers.length === 0 ? (
          <Card><p className="text-sm text-[var(--color-text-muted)]">Încă niciun cetățean în clasament.</p></Card>
        ) : (
          <div className="grid gap-2" role="list">
            {topUsers.map((u) => (
              <div key={u.name} role="listitem" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-3">
                <div className="w-8 shrink-0 flex justify-center"><RankBadge rank={u.rank} /></div>
                <span className="flex-1 min-w-0 font-semibold text-sm truncate">{u.name}</span>
                <span className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">{u.total} sesizări</span>
                <Badge variant="success" className="shrink-0">{u.resolved} rezolvate</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
      {topAmbassadors.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold flex items-center gap-2">
            <Users size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
            Ambasadori
          </h2>
          <div className="grid gap-2" role="list">
            {topAmbassadors.map((a) => (
              <Link key={a.slug} role="listitem" href={`/u/${a.slug}`} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-3 hover:border-[var(--color-primary)]/30 transition-colors group">
                <div className="w-8 shrink-0 flex justify-center"><RankBadge rank={a.rank} /></div>
                <span className="flex-1 min-w-0 font-semibold text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">{a.name}</span>
                <Badge variant="warning" className="shrink-0">{a.count} aduși</Badge>
                <ArrowUpRight size={15} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="container-narrow py-8 md:py-12 pb-24 sm:pb-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Clasament", url: `${SITE_URL}/clasament` },
        ]}
      />
      <PageHero
        title="Clasament"
        icon={Trophy}
        gradient={HERO_GRADIENT.success}
        tagline={
          nationalTotal === 0
            ? "Așteptăm primele sesizări publice…"
            : `${nationalResolved} din ${nationalTotal} sesizări rezolvate la nivel național`
        }
      />

      <ClasamentTabs
        nationalScore={nationalScore}
        nationalScoreColor={scoreTint(nationalScore).color}
        nationalDeltaPct={null}
        nationalCaption={`${nationalResolved.toLocaleString("ro-RO")} din ${nationalTotal.toLocaleString("ro-RO")} sesizări publice rezolvate`}
        primarii={primariiPanel}
        zone={zonePanel}
        cetateni={cetateniPanel}
      />

      {/* Bandă Promisometru — clasament PRIMARI pe promisiuni respectate (date reale) */}
      {mayors.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold flex items-center gap-2">
            <ScrollText size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
            Primari · promisiuni respectate
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] -mt-1">
            Procent din promisiunile ajunse la scadență care au fost respectate. Date din Promisometru.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {mayors.map((m) => {
              const color = MAYOR_TINT(m.rata);
              return (
                <Link
                  key={m.slug}
                  href={`/promisometru/${m.slug}`}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-3 hover:border-[var(--color-primary)]/30 transition-colors group"
                >
                  <span
                    className="w-9 h-9 shrink-0 rounded-full grid place-items-center text-xs font-bold"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                  >
                    {m.initiale}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">{m.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{m.functie}</p>
                  </div>
                  <span className="font-[family-name:var(--font-sora)] font-extrabold tabular-nums text-lg shrink-0" style={{ color }}>
                    {m.rata}%
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="hidden sm:block mt-10">
        <Link href="/sesizari">
          <Button variant="primary" size="lg" shape="pill" leftIcon={<TrendingUp size={16} aria-hidden="true" />}>
            Fă o sesizare — pune presiune
          </Button>
        </Link>
      </div>
      <BottomActionBar>
        <Link href="/sesizari" className="flex-1">
          <Button variant="primary" size="md" className="w-full">Fă o sesizare</Button>
        </Link>
      </BottomActionBar>

      {/* Notă de metodă */}
      <details className="mt-10 text-xs text-[var(--color-text-muted)]">
        <summary className="cursor-pointer font-medium hover:text-[var(--color-text)] transition-colors">Cum se calculează</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p><strong>Procentul afișat</strong> = sesizări rezolvate / total sesizări publice (per județ / zonă).</p>
          <p><strong>Ordinea</strong> nu e pe procentul brut, ci pe un interval de încredere (Wilson) — așa „2 din 3" nu sare nedrept peste „44 din 80". Eșantioanele mici sunt penalizate la sortare, dar numărul rămâne cel real.</p>
          <p>Prag: minim 3 sesizări/județ (restul în „date preliminare"). Rata națională numără TOATE sesizările publice, indiferent de județ.</p>
          <p>Clasamentul de primari folosește promisiunile reale ajunse la scadență (Promisometru), nu un rating subiectiv.</p>
        </div>
      </details>
    </div>
  );
}
