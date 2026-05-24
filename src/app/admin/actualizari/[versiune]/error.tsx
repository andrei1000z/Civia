"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ActualizareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { kind: "admin_actualizare_error" } });
  }, [error]);

  return (
    <div className="container-narrow py-16 text-center">
      <h2 className="text-xl font-bold mb-2">Actualizarea n-a putut fi încărcată</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        {error.digest ? `Cod: ${error.digest}` : ""}
      </p>
      <button onClick={() => reset()} className="h-10 px-4 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold">
        Reîncarcă
      </button>
    </div>
  );
}
