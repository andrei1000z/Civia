import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, ExternalLink, CalendarClock, BadgeCheck } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { PROMISIUNI, PROMISIUNE_STATUS_META, type Promisiune } from "@/data/promisiuni";
import { promisiuniStats, sortPromisiuni } from "@/lib/promisiuni/stats";

export const metadata: Metadata = {
  title: "Promisometru — promisiunile primarilor, urmărite cu sursă și termen",
  description:
    "Civia urmărește promisiunile publice ale primarilor: ce s-a promis, cu ce termen, din ce sursă — și ce s-a întâmplat de fapt. Verdicte factuale, cu link la sursă.",
  alternates: { canonical: "/promisometru" },
};

// Datele sunt statice (curatoriat manual) — pagina poate fi complet statică.
export const revalidate = 86400;

function StatusBadge({ status }: { status: Promisiune["status"] }) {
  const meta = PROMISIUNE_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-bold text-white"
      style={{ background: meta.color }}
    >
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </span>
  );
}

function PromisiuneCard({ p }: { p: Promisiune }) {
  return (
    <article
      id={p.id}
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-1)] flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">
            {p.autoritate} · {p.functie}
          </p>
          <h3 className="mt-1 text-[15px] font-bold leading-snug text-[var(--color-text)]">
            {p.promisiune}
          </h3>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{p.nota}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CalendarClock size={13} aria-hidden="true" />
          Termen: <strong className="text-[var(--color-text)]">{p.termen}</strong>
        </span>
        <a
          href={p.sursaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Sursă: {p.publicatie}
        </a>
        <span className="inline-flex items-center gap-1">
          <BadgeCheck size={13} aria-hidden="true" />
          Verificat la {p.verificatLa}
        </span>
      </div>
    </article>
  );
}

export default function PromisometruPage() {
  const stats = promisiuniStats(PROMISIUNI);
  const sorted = sortPromisiuni(PROMISIUNI);

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
        {/* Statistici */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PROMISIUNE_STATUS_META) as Array<keyof typeof PROMISIUNE_STATUS_META>).map(
            (status) => {
              const meta = PROMISIUNE_STATUS_META[status];
              return (
                <div
                  key={status}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-1)]"
                >
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: meta.color }}>
                    {stats.perStatus[status]}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-muted)]">
                    {meta.icon} {meta.label}
                  </p>
                </div>
              );
            },
          )}
        </div>

        {stats.rataRespectare !== null && (
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">
            Din promisiunile ajunse la scadență,{" "}
            <strong className="text-[var(--color-text)] tabular-nums">{stats.rataRespectare}%</strong>{" "}
            au fost respectate. Promisiunile în curs nu intră în calcul — nu judecăm înainte de termen.
          </p>
        )}

        {/* Lista */}
        {sorted.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map((p) => (
              <PromisiuneCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
            Primele promisiuni verificate apar în curând. Fiecare intrare trece printr-o
            verificare a sursei înainte de publicare.
          </div>
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
