import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Mail, ArrowRight, Megaphone } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Petiție trimisă — în verificare",
  description: "Petiția ta a fost trimisă cu succes. Echipa Civia o verifică în câteva ore.",
  // Pagina de confirmare nu trebuie indexată — slug-ul e personal,
  // nu vrem să apară în search rezultate.
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <div className="container-narrow py-8 md:py-12 max-w-2xl">
      <PageHero
        title="Petiția ta a fost trimisă!"
        icon={CheckCircle2}
        gradient={HERO_GRADIENT.success}
        backHref="/petitii"
        backLabel="Toate petițiile"
        description={
          <>
            Mulțumim că ai inițiat o cauză pe Civia. Echipa noastră o verifică în
            <strong> 1-2 ore</strong> (în timpul zilei) și apoi devine publică pentru
            semnături.
          </>
        }
      />

      {/* Timeline ce urmează */}
      <ol className="space-y-3 mb-8">
        <TimelineStep
          icon={CheckCircle2}
          title="Trimisă (acum)"
          desc="Petiția ta e în coada de moderare. Apare la admin imediat."
          color="emerald"
          done
        />
        <TimelineStep
          icon={Clock}
          title="În verificare (1-2 ore)"
          desc='Echipa citește și verifică criteriile (cerere clară, fără ură, verificabilă). Vezi „Reguli de moderare" pe pagina de inițiere.'
          color="amber"
        />
        <TimelineStep
          icon={Mail}
          title="Te contactăm dacă e nevoie"
          desc="Dacă avem întrebări sau propunem ajustări de claritate, primești un email pe adresa contului."
          color="blue"
        />
        <TimelineStep
          icon={Megaphone}
          title="Live la civia.ro/petitii"
          desc="După aprobare, devine publică, primește URL permanent, apare în listing și poate fi semnată + share-uită."
          color="purple"
        />
      </ol>

      {/* Slug preview - când e aprobată, asta va fi URL-ul */}
      {slug && (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-6 text-xs">
          <p className="text-[var(--color-text-muted)] mb-1">După aprobare, petiția va fi la:</p>
          <code className="font-mono text-[var(--color-primary)] break-all">
            civia.ro/petitii/{slug}
          </code>
        </div>
      )}

      {/* CTA-uri */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/petitii"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Megaphone size={16} aria-hidden="true" />
          Vezi alte petiții
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
        >
          Pagina principală
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] mt-8 leading-relaxed text-center">
        Dacă petiția e respinsă (foarte rar — doar dacă încalcă regulile), primești
        un email cu motivul și o poți rescrie.
      </p>
    </div>
  );
}

function TimelineStep({
  icon: Icon,
  title,
  desc,
  color,
  done = false,
}: {
  icon: typeof Clock;
  title: string;
  desc: string;
  color: "emerald" | "amber" | "blue" | "purple";
  done?: boolean;
}) {
  const ringMap = {
    emerald: "ring-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    amber: "ring-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    blue: "ring-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    purple: "ring-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300",
  };
  return (
    <li className="flex items-start gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <span
        className={`shrink-0 w-9 h-9 rounded-full grid place-items-center ring-2 ${ringMap[color]} ${done ? "" : "opacity-90"}`}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm mb-0.5">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
      </div>
    </li>
  );
}
