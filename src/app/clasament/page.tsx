import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, TrendingUp, MapPin, Users, ArrowUpRight, Building2 } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { leaderboardAuthorName } from "@/lib/sesizari/display-name";
import { extractLocality } from "@/lib/sesizari/extract-locality";
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
  // 2026-05-27 — try/catch defensiv. /clasament e public; Supabase outage
  // NU trebuie sa crash-eze pagina (return [] → leaderboard gol cu PageHero).
  const admin = createSupabaseAdmin();
  let data: Array<{ county: string | null; status: string | null }> | null = null;
  try {
    const res = await admin
      .from("sesizari")
      .select("county, status")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .not("county", "is", null);
    data = res.data;
  } catch {
    return [];
  }

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

type CityStats = { city: string; total: number; resolved: number; fixScore: number };

/**
 * Leaderboard pe ORAȘ (Faza 2 — hiper-localizare). Grupează sesizările publice
 * pe localitate via extractLocality(locatie) — sesizari n-are coloană locality,
 * deci derivăm orașul din textul liber. Prag minim 4 sesizări/oraș ca să fie
 * semnificativ statistic.
 */
async function fetchCityStats(): Promise<CityStats[]> {
  const admin = createSupabaseAdmin();
  let data: Array<{ locatie: string | null; status: string | null }> | null = null;
  try {
    const res = await admin
      .from("sesizari")
      .select("locatie, status")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .not("locatie", "is", null);
    data = res.data;
  } catch {
    return [];
  }

  const buckets = new Map<string, { total: number; resolved: number }>();
  for (const row of data ?? []) {
    const city = extractLocality(row.locatie);
    if (!city) continue; // doar orașe recunoscute (extractLocality e conservator)
    let b = buckets.get(city);
    if (!b) {
      b = { total: 0, resolved: 0 };
      buckets.set(city, b);
    }
    b.total += 1;
    if (row.status === "rezolvat") b.resolved += 1;
  }

  const stats: CityStats[] = [];
  for (const [city, b] of buckets.entries()) {
    if (b.total < 4) continue;
    stats.push({ city, total: b.total, resolved: b.resolved, fixScore: Math.round((b.resolved / b.total) * 100) });
  }
  return stats.sort((a, b) => b.fixScore - a.fixScore || b.total - a.total).slice(0, 12);
}

async function fetchTopUsers(): Promise<Array<{ name: string; resolved: number; total: number; rank: number }>> {
  const admin = createSupabaseAdmin();
  let data: Array<{ author_name: string | null; author_display_name: string | null; status: string | null }> | null = null;
  try {
    const res = await admin
      .from("sesizari")
      .select("author_name, author_display_name, status")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .not("author_name", "is", null);
    data = res.data;
  } catch {
    return [];
  }

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

/**
 * Top ambasadori (Faza 1) — cetățeni care au adus cei mai mulți alți cetățeni
 * pe Civia prin link-ul de referral. Privacy-safe: îi numim public DOAR pe cei
 * care au activat profilul public (opt-in) — restul rămân necelebrați nominal.
 */
async function fetchTopAmbassadors(): Promise<
  Array<{ name: string; slug: string; count: number; rank: number }>
> {
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

function scoreTint(score: number): { color: string; bg: string; label: string } {
  if (score >= 60) return { color: "var(--color-success)", bg: "var(--color-success-soft)", label: "Bun" };
  if (score >= 30) return { color: "var(--color-warning)", bg: "var(--color-warning-soft)", label: "Mediu" };
  return { color: "var(--color-error)", bg: "var(--color-error-soft)", label: "Slab" };
}

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

export default async function ClasamentPage() {
  const [counties, cities, topUsers, topAmbassadors] = await Promise.all([
    fetchCountyStats(),
    fetchCityStats(),
    fetchTopUsers(),
    fetchTopAmbassadors(),
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

      {/* Top orașe (Faza 2 — hiper-localizare). Rata de rezolvare pe localitate. */}
      {cities.length > 0 && (
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-1 flex items-center gap-2">
            <Building2 size={20} aria-hidden="true" className="text-sky-500" />
            Top orașe
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Rata de rezolvare pe localitate (minim 4 sesizări). Vezi cum se compară orașul tău.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {cities.map((c, i) => {
              const t = scoreTint(c.fixScore);
              return (
                <div
                  key={c.city}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-6 text-center text-sm font-bold text-[var(--color-text-muted)] tabular-nums">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.city}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {c.resolved} rezolvate · {c.total} total
                    </div>
                    <div className="mt-1.5 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.fixScore}%`, backgroundColor: t.color }} />
                    </div>
                  </div>
                  <div className="text-lg font-extrabold tabular-nums shrink-0" style={{ color: t.color }}>
                    {c.fixScore}%
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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

      {/* Top ambasadori (Faza 1) — cetățeni care activează cartierul. Apare
          doar când avem ambasadori cu profil public opt-in. */}
      {topAmbassadors.length > 0 && (
        <section className="mb-8">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-1 flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🤝</span>
            Ambasadori — cetățeni care activează cartierul
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Cei care au adus cei mai mulți cetățeni noi pe Civia. Distribuie o
            sesizare sau o petiție și apari și tu aici.
          </p>
          <div className="grid gap-2">
            {topAmbassadors.map((u) => (
              <Link
                key={u.slug}
                href={`/u/${u.slug}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-4 hover:shadow-[var(--shadow-2)] hover:border-[var(--color-primary)]/30 transition-all group"
              >
                <div className="w-8 text-center font-bold tabular-nums">
                  {u.rank <= 3 ? (
                    <span className="text-xl" aria-hidden="true">{MEDAL_EMOJI[u.rank - 1]}</span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">{u.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">
                    {u.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {u.count === 1 ? "1 cetățean adus" : `${u.count} cetățeni aduși`}
                  </div>
                </div>
                <Badge variant="neutral" style={{ color: "var(--color-warning)", backgroundColor: "var(--color-warning-soft)" }}>
                  <Users size={11} aria-hidden="true" />
                  {u.count}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
