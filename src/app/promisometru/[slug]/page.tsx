import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge } from "lucide-react";
import { PROMISIUNE_STATUS_META } from "@/data/promisiuni";
import { getAutoritati, getAutoritateBySlug } from "@/lib/promisiuni/autoritati";
import { PromisometruList } from "@/components/promisiuni/PromisometruList";
import { CountUp } from "@/components/ui/CountUp";

export const revalidate = 86400;

export function generateStaticParams() {
  return getAutoritati().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const prof = getAutoritateBySlug(slug);
  if (!prof) return { title: "Profil negăsit" };
  return {
    title: `${prof.autoritate} — promisiuni urmărite | Promisometru`,
    description: `${prof.items.length} promisiuni publice ale ${prof.autoritate} (${prof.functie}), urmărite cu sursă, termen și verdict factual pe Civia.`,
    alternates: { canonical: `/promisometru/${prof.slug}` },
  };
}

export default async function AutoritatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prof = getAutoritateBySlug(slug);
  if (!prof) notFound();

  const { stats } = prof;

  return (
    <div className="container-narrow py-8 md:py-12">
      <Link
        href="/promisometru"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 py-3 -my-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Promisometru
      </Link>

      {/* Header de profil — același limbaj vizual ca PageHero (gradient
          authority + chip), dar cu avatar de inițiale + scor personal. */}
      <header className="relative mb-6 overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-slate-700 via-emerald-800 to-emerald-900 px-4 py-5 sm:p-7 text-white shadow-[var(--shadow-3)]">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/15 grid place-items-center shrink-0 text-xl sm:text-2xl font-extrabold animate-scale-in"
            style={{
              backdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
            aria-hidden="true"
          >
            {prof.initiale}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-sora)] text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight hero-enter-1">
              {prof.autoritate}
            </h1>
            <p className="text-sm text-white/80 mt-0.5 hero-enter-2">{prof.functie}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/85 hero-enter-3">
              <span>
                <strong className="tabular-nums">{prof.items.length}</strong>{" "}
                {prof.items.length === 1 ? "promisiune urmărită" : "promisiuni urmărite"}
              </span>
              {(Object.keys(PROMISIUNE_STATUS_META) as Array<keyof typeof PROMISIUNE_STATUS_META>)
                .filter((st) => stats.perStatus[st] > 0)
                .map((st) => (
                  <span key={st} className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: PROMISIUNE_STATUS_META[st].color }}
                      aria-hidden="true"
                    />
                    {stats.perStatus[st]} {PROMISIUNE_STATUS_META[st].label.toLowerCase()}
                  </span>
                ))}
            </div>
          </div>
          {stats.rataRespectare !== null && (
            <div className="text-center shrink-0 hero-enter-3">
              <p className="text-3xl font-extrabold leading-none">
                <CountUp value={stats.rataRespectare} />%
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/70 inline-flex items-center gap-1">
                <Gauge size={11} aria-hidden="true" /> respectare
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Toate promisiunile — cele mai noi primele (filtrabile pe status). */}
      <PromisometruList items={prof.items} defaultSort="noi" />

      <p className="mt-8 text-xs text-[var(--color-text-muted)]">
        Verdictele sunt factuale, cu link la sursă pentru fiecare intrare. O promisiune în curs nu e
        judecată înainte de termen. Corecturi:{" "}
        <a href="mailto:contact@civia.ro" className="font-semibold text-[var(--color-primary)] underline">
          contact@civia.ro
        </a>
        .
      </p>
    </div>
  );
}
