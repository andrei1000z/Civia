"use client";

import Link from "next/link";
import { Newspaper, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function StireError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 md:py-24 max-w-lg text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <Newspaper size={36} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2">
        Articolul nu se poate încărca
      </h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        Sursa poate fi temporar indisponibilă. Încearcă mai târziu sau vezi alte știri.
      </p>
      <div className="flex gap-3 justify-center">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={reset}
          leftIcon={<RotateCcw size={16} aria-hidden="true" />}
        >
          Reîncearcă
        </Button>
        <Link
          href="/stiri"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Toate știrile
        </Link>
      </div>
    </div>
  );
}
