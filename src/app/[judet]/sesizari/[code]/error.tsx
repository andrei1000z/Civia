"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SesizareDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { kind: "judet_sesizare_detail_error" },
    });
  }, [error]);

  return (
    <div className="container-narrow py-16 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
          <span className="text-2xl" aria-hidden="true">⚠️</span>
        </div>
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
          Sesizarea n-a putut fi încărcată
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Ceva n-a mers cum trebuie. Sentry e notificat.
          {error.digest ? ` (cod: ${error.digest})` : ""}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center h-11 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Reîncarcă
        </button>
      </div>
    </div>
  );
}
