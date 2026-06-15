"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="container-narrow py-16 md:py-24 max-w-lg text-center"
    >
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertTriangle size={36} className="text-red-600 dark:text-red-400" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-4xl font-extrabold mb-2">
        Ceva nu a mers bine
      </h1>
      <p className="text-[var(--color-text-muted)] mb-1">
        Pagina a întâmpinat o eroare neașteptată. Nu e nimic pierdut — apasă „Reîncarcă" și încerci din nou. Dacă se repetă, scrie-ne din footer și ne uităm la ce s-a întâmplat.
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] mt-2 mb-6" title="Cod de eroare — util dacă ne scrii">
          Cod eroare: {error.digest}
        </p>
      )}
      <div className="flex gap-3 justify-center mt-6">
        <Button
          type="button"
          onClick={reset}
          variant="primary"
          size="md"
          leftIcon={<RotateCcw size={16} aria-hidden="true" />}
        >
          Reîncarcă pagina
        </Button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <Home size={16} aria-hidden="true" />
          Înapoi acasă
        </Link>
      </div>
    </div>
  );
}
