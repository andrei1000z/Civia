import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { PROMISIUNI, PROMISIUNE_STATUS_META } from "@/data/promisiuni";
import { promisiuniStats, groupByAutoritate } from "@/lib/promisiuni/stats";
import { PromisometruList } from "@/components/promisiuni/PromisometruList";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = {
  title: "Promisometru — promisiunile primarilor, urmărite cu sursă și termen",
  description:
    "Civia urmărește promisiunile publice ale primarilor: ce s-a promis, cu ce termen, din ce sursă — și ce s-a întâmplat de fapt. Verdicte factuale, cu link la sursă.",
  alternates: { canonical: "/promisometru" },
};

// Datele sunt statice (curatoriat manual) — pagina poate fi complet statică.
export const revalidate = 86400;

export default function PromisometruPage() {
  const stats = promisiuniStats(PROMISIUNI);
  const grupuri = groupByAutoritate(PROMISIUNI);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHero
        title="Promisometru"
        description="Promisiunile publice ale primarilor, urmărite cu sursă, termen și verdict factual. Ce s-a promis vs. ce s-a livrat — totul verificabil, cu link la sursă."
        icon={Gauge}
        gradient={HERO_GRADIENT.authority}
        tagline="Memoria civică nu expiră"
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        {/* Statistici pe status — stagger + count-up */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-children">
          {(Object.keys(PROMISIUNE_STATUS_META) as Array<keyof typeof PROMISIUNE_STATUS_META>).map(
            (status) => {
              const meta = PROMISIUNE_STATUS_META[status];
              return (
                <div
                  key={status}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-1)]"
                >
                  <p className="text-2xl font-extrabold" style={{ color: meta.color }}>
                    <CountUp value={stats.perStatus[status]} />
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-muted)]">
                    {meta.icon} {meta.label}
                  </p>
                </div>
              );
            },
          )}
        </div>

        {/* Gauge — rata de respectare (doar din promisiunile scadente).
            Bara „crește" la intrarea în viewport (Reveal + bar-grow). */}
        {stats.rataRespectare !== null && (
          <Reveal className="mb-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-sm font-bold text-[var(--color-text)]">
                Rata de respectare a promisiunilor scadente
              </p>
              <p className="text-xl font-extrabold text-[var(--color-text)]">
                <CountUp value={stats.rataRespectare} />%
              </p>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-2)]"
              role="progressbar"
              aria-valuenow={stats.rataRespectare}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Rata de respectare: ${stats.rataRespectare}%`}
            >
              <div
                className="h-full rounded-[var(--radius-full)] bar-grow"
                style={{
                  width: `${Math.max(stats.rataRespectare, 2)}%`,
                  background:
                    stats.rataRespectare >= 60 ? "#059669" : stats.rataRespectare >= 30 ? "#D97706" : "#DC2626",
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Calculată doar din promisiunile ajunse la scadență — cele în curs nu intră; nu judecăm
              înainte de termen.
            </p>
          </Reveal>
        )}

        {/* Lista interactivă (filtre status + autoritate, countdown, share) */}
        <PromisometruList items={PROMISIUNI} />

        {/* Fișa pe autoritate */}
        {grupuri.length > 1 && (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-bold text-[var(--color-text)]">Pe scurt, pe primării</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grupuri.map((g) => {
                const s = promisiuniStats(g.items);
                return (
                  <div
                    key={g.autoritate}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]"
                  >
                    <p className="text-sm font-bold text-[var(--color-text)]">{g.autoritate}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{g.functie}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {(Object.keys(PROMISIUNE_STATUS_META) as Array<keyof typeof PROMISIUNE_STATUS_META>)
                        .filter((st) => s.perStatus[st] > 0)
                        .map((st) => (
                          <span key={st} className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: PROMISIUNE_STATUS_META[st].color }}
                              aria-hidden="true"
                            />
                            {s.perStatus[st]} {PROMISIUNE_STATUS_META[st].label.toLowerCase()}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Metodologie — transparență (protecție legală + încredere) */}
        <section className="mt-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 text-sm text-[var(--color-text-muted)]">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-text)]">Cum funcționează</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Includem doar promisiuni <strong>publice</strong>, cu <strong>sursă verificabilă</strong>{" "}
              (presă sau comunicate oficiale) — linkul e mereu afișat.
            </li>
            <li>
              Verdictele sunt <strong>factuale</strong>: „termenul anunțat a trecut, nu există anunț de
              finalizare" — nu speculăm intenții.
            </li>
            <li>
              O promisiune <strong>în curs</strong> nu e judecată înainte de termen.
            </li>
            <li>
              Ai o corecție sau o promisiune de adăugat (cu sursă)? Scrie-ne la{" "}
              <a href="mailto:contact@civia.ro" className="font-semibold text-[var(--color-primary)] underline">
                contact@civia.ro
              </a>
              .
            </li>
          </ul>
          <p className="mt-3">
            Vezi și{" "}
            <Link href="/clasament" className="font-semibold text-[var(--color-primary)] underline">
              Clasamentul primăriilor
            </Link>{" "}
            — cum răspund la sesizările cetățenilor.
          </p>
        </section>
      </main>
    </div>
  );
}
