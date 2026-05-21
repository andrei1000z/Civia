import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, ArrowRight, PenLine } from "lucide-react";

export const metadata: Metadata = {
  title: "Petiție negăsită — Civia",
  description:
    "Petiția pe care o cauți nu a fost găsită. Vezi petițiile active sau inițiază una nouă.",
  robots: { index: false, follow: false },
};

export default function PetitieNotFound() {
  return (
    <div className="container-narrow py-12 md:py-16 max-w-2xl">
      <div className="text-center">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-surface-2)] grid place-items-center"
          aria-hidden="true"
        >
          <ScrollText size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-3">
          Petiția nu a fost găsită
        </h1>
        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-lg mx-auto">
          Link-ul nu corespunde niciunei petiții publicate. Poate că a fost
          retrasă de inițiator. Vezi petițiile active sau inițiază una nouă.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/petitii"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <ScrollText size={16} aria-hidden="true" />
            Vezi petițiile
          </Link>
          <Link
            href="/petitii/initiaza"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
          >
            <PenLine size={14} aria-hidden="true" />
            Inițiază o petiție
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
