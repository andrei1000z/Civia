"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";

/**
 * Auto-retry cu exponential backoff. Raport analytics 5/8/2026 a aratat
 * 8 rage clicks pe „Reincearca" pe aceasta pagina — utilizatorii dadeau
 * retry repetat cand DB-ul era jos. Acum retry-ul se face automat in
 * fundal (3 incercari, 2s/4s/8s spacing) inainte sa mai vada user-ul
 * eroarea, plus si „Reincearca" manual ramane pentru cazuri persistente.
 */
// Retry cu backoff conservator. Anterior aveam 500ms prima retry, dar
// asta cauza render loop care omora renderer-ul Firefox („This page
// couldn't load" — raportat user 5/21/2026). Acum: 1.5s/3s/6s — destul
// timp pentru react reconciliation + microtasks intre retry-uri.
const AUTO_RETRY_DELAYS_MS = [1500, 3000, 6000];

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
            Am încercat de 3 ori automat — pare o problemă persistentă a conexiunii.
            Reîncearcă manual mai târziu sau trimite o sesizare nouă.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => { setAutoRetryAttempt(0); reset(); }}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              <RefreshCw size={14} aria-hidden="true" /> Reîncearcă
            </button>
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
