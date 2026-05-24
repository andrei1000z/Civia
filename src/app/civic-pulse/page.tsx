import type { Metadata } from "next";
import { Activity, TrendingUp, Users, MessageSquare, Vote, MapPin } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Civic Pulse — Activitate live • Civia",
  description:
    "Pulsul civic al României în timp real: acțiuni civice ultimele 24h, sesizări noi, voturi, semnături. Actualizat la fiecare 60 sec.",
  alternates: { canonical: `${SITE_URL}/civic-pulse` },
};

// Re-validate la fiecare minut — vrem date proaspete
export const revalidate = 60;
export const dynamic = "force-dynamic";

interface PulseData {
  newSesizari24h: number;
  newSesizari1h: number;
  resolvedToday: number;
  votesToday: number;
  cosignsToday: number;
  commentsToday: number;
  signsToday: number;
  newUsers24h: number;
  topCounty24h: { county: string; count: number } | null;
  topTip24h: { tip: string; count: number } | null;
}

async function getPulseData(): Promise<PulseData> {
  const admin = createSupabaseAdmin();
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const h1 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [s24, s1, resolved, votes, cosigns, comments, signs, users, county, tip] = await Promise.all([
    admin.from("sesizari").select("*", { count: "exact", head: true }).gte("created_at", h24),
    admin.from("sesizari").select("*", { count: "exact", head: true }).gte("created_at", h1),
    admin.from("sesizari").select("*", { count: "exact", head: true }).eq("status", "rezolvat").gte("resolved_at", today),
    admin.from("sesizare_votes").select("*", { count: "exact", head: true }).gte("created_at", today),
    admin.from("sesizare_cosigners").select("*", { count: "exact", head: true }).gte("created_at", today),
    admin.from("sesizare_comments").select("*", { count: "exact", head: true }).gte("created_at", today),
    admin.from("petitie_signatures").select("*", { count: "exact", head: true }).gte("signed_at", today),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", h24),
    admin.from("sesizari").select("county").gte("created_at", h24).not("county", "is", null),
    admin.from("sesizari").select("tip").gte("created_at", h24).not("tip", "is", null),
  ]);

  // Top county + tip aggregate
  function topCount<T extends string>(data: Array<{ [k: string]: T }> | null, key: string): { key: T; count: number } | null {
    if (!data) return null;
    const map = new Map<T, number>();
    for (const r of data) {
      const v = r[key];
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    if (map.size === 0) return null;
    let bestKey: T | null = null;
    let bestCount = 0;
    for (const [k, v] of map.entries()) {
      if (v > bestCount) { bestKey = k; bestCount = v; }
    }
    return bestKey ? { key: bestKey, count: bestCount } : null;
  }

  const countyTop = topCount<string>((county.data ?? []) as Array<{ county: string }>, "county");
  const tipTop = topCount<string>((tip.data ?? []) as Array<{ tip: string }>, "tip");

  return {
    newSesizari24h: s24.count ?? 0,
    newSesizari1h: s1.count ?? 0,
    resolvedToday: resolved.count ?? 0,
    votesToday: votes.count ?? 0,
    cosignsToday: cosigns.count ?? 0,
    commentsToday: comments.count ?? 0,
    signsToday: signs.count ?? 0,
    newUsers24h: users.count ?? 0,
    topCounty24h: countyTop ? { county: countyTop.key, count: countyTop.count } : null,
    topTip24h: tipTop ? { tip: tipTop.key, count: tipTop.count } : null,
  };
}

export default async function CivicPulsePage() {
  const data = await getPulseData();
  const updated = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" });

  return (
    <>
      <PageHero
        title="Civic Pulse"
        icon={Activity}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Pulsul civic al României în <strong>timp real</strong>. Actualizat la fiecare 60 sec.
          </>
        }
        tagline={`Verificat: ${updated}`}
      />

      <div className="container-narrow space-y-6 pb-16">
        {/* Heartbeat metric */}
        <section className="rounded-[var(--radius-md)] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-surface)] to-cyan-500/5 p-6 md:p-10 text-center">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">
            🔴 LIVE — Ultima oră
          </p>
          <p className="font-[family-name:var(--font-sora)] text-5xl md:text-7xl font-extrabold tabular-nums mb-2 text-emerald-600 dark:text-emerald-400">
            {data.newSesizari1h}
          </p>
          <p className="text-base text-[var(--color-text)] font-semibold">
            {data.newSesizari1h === 1 ? "sesizare nouă" : "sesizări noi"} în ultima oră
          </p>
        </section>

        {/* 24h activity grid */}
        <section>
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3">
            Activitate ultimele 24h
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PulseCard icon={TrendingUp} label="Sesizări noi" value={data.newSesizari24h} color="text-emerald-500" />
            <PulseCard icon={Users} label="Cetățeni noi" value={data.newUsers24h} color="text-violet-500" />
            <PulseCard icon={MessageSquare} label="Voturi azi" value={data.votesToday} color="text-cyan-500" />
            <PulseCard icon={Vote} label="Cosignaturi azi" value={data.cosignsToday} color="text-amber-500" />
            <PulseCard icon={MessageSquare} label="Comentarii azi" value={data.commentsToday} color="text-blue-500" />
            <PulseCard icon={Activity} label="Petiții semnate azi" value={data.signsToday} color="text-rose-500" />
            <PulseCard icon={TrendingUp} label="Rezolvate azi" value={data.resolvedToday} color="text-emerald-600" />
            <PulseCard
              icon={MapPin}
              label="Județ #1 azi"
              value={data.topCounty24h?.county ?? "—"}
              valueIsString
              color="text-indigo-500"
              sublabel={data.topCounty24h ? `${data.topCounty24h.count} sesizări` : ""}
            />
          </div>
        </section>

        {/* Trending */}
        {data.topTip24h && (
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-2">
              🔥 Trending acum
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Cea mai raportată problemă în ultimele 24h:
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-semibold">
                {data.topTip24h.tip}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                cu <strong>{data.topTip24h.count}</strong> sesizări
              </span>
            </div>
          </section>
        )}

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Datele sunt agregate din DB Civia. Pentru date raw cu agregate &amp; pe județ — vezi{" "}
          <a href="/api/v1/stats" className="text-[var(--color-primary)] hover:underline">/api/v1/stats</a>.
        </p>
      </div>
    </>
  );
}

function PulseCard({
  icon: Icon,
  label,
  value,
  valueIsString = false,
  sublabel,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  valueIsString?: boolean;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
      <Icon size={18} className={`mx-auto mb-2 ${color}`} aria-hidden="true" />
      <p className={`font-[family-name:var(--font-sora)] font-extrabold tabular-nums ${valueIsString ? "text-2xl" : "text-3xl"}`}>
        {typeof value === "number" ? value.toLocaleString("ro-RO") : value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1">{label}</p>
      {sublabel && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sublabel}</p>}
    </div>
  );
}
