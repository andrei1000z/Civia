"use client";

import Link from "next/link";
import { Scale, RotateCcw, ArrowLeft } from "lucide-react";

export default function CompareError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 md:py-24 max-w-lg text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <Scale size={36} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2">
        Comparația nu se poate încărca
      </h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        Unul dintre județe poate fi invalid. Alege din nou două județe.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reîncearcă
        </button>
        <Link
          href="/compara"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Alege județe
        </Link>
      </div>
    </div>
  );
}
