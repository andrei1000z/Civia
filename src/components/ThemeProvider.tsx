"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * 5/22/2026 — DARK MODE FOREVER. User a eliminat light mode complet.
 * Nu mai folosim next-themes — adăugăm pur și simplu `dark` class pe
 * <html> și asta e tot. Niciun toggle, nicio sync cross-device pentru
 * theme (theme nu mai e o preferință user).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    // Pastram theme-ready ca sa nu rupem CSS transitions defined în globals.css.
    requestAnimationFrame(() => {
      root.classList.add("theme-ready");
    });
  }, []);

  return <>{children}</>;
}
