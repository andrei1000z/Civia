"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Auto-retry cu exponential backoff. Raport analytics 5/8/2026 a arătat
 * 8 rage clicks pe „Reîncarcă" pe această pagină — utilizatorii dădeau
 * retry repetat când DB-ul era jos. Acum retry-ul se face automat în
 * fundal (3 încercări, 2s/4s/8s spacing) înainte să mai vadă user-ul
 * eroarea, plus și „Reîncarcă" manual rămâne pentru cazuri persistente.
 */
// Auto-retry DISABLED 5/21/2026 — Firefox renderer crash raportat user
// la orice retry rapid. Dacă pagina aruncă, ARATĂM eroarea imediat și
// userul apasă „Reîncearcă" manual. Zero render loops.
const AUTO_RETRY_DELAYS_MS: number[] = [];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);

  useEffect(() => {
    console.error("[sesizari-publice]", error);
    // Log la server pentru ca dev-ul sa vada eroarea reala fara
    // sa fie nevoie de Sentry sau client-side console access.
    fetch("/api/inbox/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "page-error",
        page: "/sesizari-publice",
        message: error?.message ?? String(error),
        digest: error?.digest ?? null,
        stack: error?.stack?.slice(0, 2000) ?? null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        href: typeof location !== "undefined" ? location.href : null,
      }),
    }).catch(() => { /* silent */ });
  }, [error]);

  // Auto-retry cu backoff -- ruleaza in fundal pe primele 3 erori,
  // apoi ne dam batuti si lasam user-ul sa decida.
  useEffect(() => {
    if (autoRetryAttempt >= AUTO_RETRY_DELAYS_MS.length) return;
    const delay = AUTO_RETRY_DELAYS_MS[autoRetryAttempt] ?? 0;
    const t = setTimeout(() => {
      setAutoRetryAttempt((n) => n + 1);
      reset();
    }, delay);
    return () => clearTimeout(t);
  }, [autoRetryAttempt, reset]);

  const stillRetrying = autoRetryAttempt < AUTO_RETRY_DELAYS_MS.length;

  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 text-center">
      {stillRetrying ? (
        <>
          <Loader2 size={40} className="mx-auto mb-4 text-[var(--color-primary)] animate-spin" aria-hidden="true" />
          <h1 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
            Reîncerc automat...
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Conexiunea cu baza de date e momentan instabilă. Aștept câteva secunde
            și reîncerc — încercarea {autoRetryAttempt + 1} din {AUTO_RETRY_DELAYS_MS.length}.
          </p>
        </>
      ) : (
        <>
          <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" aria-hidden="true" />
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mb-2">
            Sesizările publice nu se pot încărca
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            {AUTO_RETRY_DELAYS_MS.length === 0
              ? `Pagina nu se poate încărca momentan. Apasă „Reîncearcă” sau verifică conexiunea. Dacă persistă, trimite o sesizare nouă.`
              : `Am încercat de ${AUTO_RETRY_DELAYS_MS.length} ori automat — pare o problemă persistentă a conexiunii. Reîncearcă manual mai târziu sau trimite o sesizare nouă.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={() => { setAutoRetryAttempt(0); reset(); }}
            >
              Reîncearcă
            </Button>
            <Link
              href="/sesizari"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Trimite o sesizare
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
