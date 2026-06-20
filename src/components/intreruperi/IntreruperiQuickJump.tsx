"use client";

import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/Button";

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

  // 2026-06-20 — content-first: păstrăm DOAR CTA-ul cu valoare (alerte pe adresă).
  // „Raportează" trăiește în secțiunea proprie de jos (cu header + formular), deci
  // butonul-jump duplicat de sus a fost scos ca pagina să nu mai pară aglomerată.
  return (
    <div className="flex justify-center -mt-2 mb-6">
      <Button
        type="button"
        variant="primary"
        size="sm"
        shape="pill"
        leftIcon={<span aria-hidden="true">🔔</span>}
        onClick={(e) => {
          e.preventDefault();
          scrollTo("alerts-form");
        }}
      >
        Anunță-mă pe adresa mea
      </Button>
    </div>
  );
}
