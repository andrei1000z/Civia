import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, ArrowRight, Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Protest negăsit — Civia",
  description:
    "Protestul pe care îl cauți nu a fost găsit. Vezi protestele active sau propune unul.",
  robots: { index: false, follow: false },
};

export default function ProtestNotFound() {
  return (
    <div className="container-narrow py-12 md:py-16 max-w-2xl">
      <div className="text-center">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-surface-2)] grid place-items-center"
          aria-hidden="true"
        >
          <Megaphone size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-3">
          Protestul nu a fost găsit
        </h1>
        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-lg mx-auto">
          Link-ul nu corespunde niciunui protest activ. Poate s-a încheiat și
          arhivat. Vezi protestele curente sau propune unul nou.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/proteste"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Megaphone size={16} aria-hidden="true" />
            Vezi protestele
          </Link>
          <Link
            href="/proteste/propune"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
          >
            <Plus size={14} aria-hidden="true" />
            Propune un protest
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
