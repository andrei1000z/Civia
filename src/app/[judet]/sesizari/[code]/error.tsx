"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/Button";

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
        <Button type="button" variant="primary" size="md" onClick={() => reset()}>
          Reîncarcă
        </Button>
      </div>
    </div>
  );
}
