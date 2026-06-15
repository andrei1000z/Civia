"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/Button";

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { kind: "admin_session_error" } });
  }, [error]);

  return (
    <div className="container-narrow py-16 text-center">
      <h2 className="text-xl font-bold mb-2">Sesiunea n-a putut fi încărcată</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        {error.digest ? `Cod: ${error.digest}` : ""}
      </p>
      <Button variant="primary" size="sm" onClick={() => reset()}>
        Reîncarcă
      </Button>
    </div>
  );
}
