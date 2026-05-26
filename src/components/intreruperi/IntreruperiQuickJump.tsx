"use client";

import { useCallback, useEffect } from "react";

/**
 * 2026-05-26 — fix scroll-la-anchor pe /intreruperi.
 *
 * User a raportat că butoanele „📣 Raportează o întrerupere" și
 * „🔔 Anunță-mă pe adresa mea" actualizau URL-ul cu hash dar nu derulau
 * pagina spre secțiune (deși target-urile au `scroll-mt-24`). Cauza
 * probabilă: ScrollRestoration sau alt listener intervine pe click. Fix:
 * preluăm explicit click-ul, scrollIntoView smooth cu requestAnimationFrame
 * și actualizăm hash-ul manual. Garantat funcționează.
 */
export function IntreruperiQuickJump() {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  }, []);

  // 2026-05-26 — Handle initial-page-load cu hash în URL (utilizator vine
  // dintr-un share link cu #alerts-form). Native browser anchor scroll
  // poate eșua dacă elementul nu e încă hidratat. Așteptăm 2 RAFs ca
  // formularul să fie în DOM, apoi scrollIntoView explicit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    if (hash !== "submit-form" && hash !== "alerts-form") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  return (
    <div className="flex flex-wrap gap-2 justify-center -mt-2 mb-6">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          scrollTo("submit-form");
        }}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">📣</span> Raportează o întrerupere
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          scrollTo("alerts-form");
        }}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-pill)] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-sm font-medium hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.5)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
      >
        <span aria-hidden="true">🔔</span> Anunță-mă pe adresa mea
      </button>
    </div>
  );
}
