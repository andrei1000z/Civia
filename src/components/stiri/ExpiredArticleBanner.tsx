"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Info, X } from "lucide-react";

/**
 * Banner ephemer pentru cazul cand utilizatorul ajunge pe /stiri via
 * redirect-ul de pe articol expirat (gen `/stiri?from=expired` din
 * src/app/stiri/[id]/page.tsx).
 *
 * Inainte: 28 hits/luna pe Google → /stiri/{uuid-articol-sters} → 404
 * (raportat de analytics 5/8/2026). Acum redirect graceful + acest
 * banner explica de ce nu mai e articolul.
 */
export function ExpiredArticleBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("from") !== "expired") return;
    const t = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-[var(--radius-xs)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 flex items-start gap-2"
    >
      <Info size={14} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-xs text-amber-900 dark:text-amber-300 flex-1 leading-relaxed">
        Articolul căutat nu mai este disponibil — RSS feed-ul îl arhivează după o
        perioadă. Vezi mai jos cele mai recente știri.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
        aria-label="Închide notificarea"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
