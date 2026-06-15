"use client";

import Link from "next/link";
import { FileX, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function SesizareError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 md:py-24 max-w-lg text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <FileX size={36} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2">
        Sesizarea nu se poate încărca
      </h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        Codul poate fi invalid sau serviciul e temporar indisponibil.
      </p>
      <div className="flex gap-3 justify-center">
        <Button
          type="button"
          onClick={reset}
          variant="primary"
          size="md"
          leftIcon={<RotateCcw size={16} aria-hidden="true" />}
        >
          Reîncearcă
        </Button>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Toate sesizările
        </Link>
      </div>
    </div>
  );
}
