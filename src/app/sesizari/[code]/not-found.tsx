import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion, ArrowRight, PlusCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Sesizare negăsită — Civia",
  description:
    "Sesizarea pe care o cauți nu a fost găsită. S-ar putea să fi fost ștearsă sau să nu existe niciodată.",
  robots: { index: false, follow: false },
};

/**
 * Not-found pentru /sesizari/[code] — apare cand codul nu mai e in DB
 * (sesizare stearsa de user, moderare respinsa, sau cod inventat).
 */
export default function SesizareNotFound() {
  return (
    <div className="container-narrow py-12 md:py-16 max-w-2xl">
      <div className="text-center">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-surface-2)] grid place-items-center"
          aria-hidden="true"
        >
          <FileQuestion size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-3">
          Sesizarea nu a fost găsită
        </h1>
        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-lg mx-auto">
          Codul nu corespunde niciunei sesizări active. Poate că a fost
          ștearsă de autor sau respinsă la moderare. Verifică linkul sau
          deschide o sesizare nouă.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <PlusCircle size={16} aria-hidden="true" />
            Fă o sesizare
          </Link>
          <Link
            href="/sesizari-publice"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
          >
            Vezi sesizările publice
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
