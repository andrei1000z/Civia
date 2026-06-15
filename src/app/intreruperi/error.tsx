"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error("[intreruperi]", error);
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 text-center">
      <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" aria-hidden="true" />
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mb-2">
        Nu putem încărca întreruperile acum
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
        Catalogul are o problemă temporară. Încearcă din nou — cele mai multe
        greșeli se rezolvă la reîncărcare.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={reset}
          leftIcon={<RefreshCw size={14} aria-hidden="true" />}
        >
          Încearcă din nou
        </Button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Pagina principală
        </Link>
      </div>
    </div>
  );
}
