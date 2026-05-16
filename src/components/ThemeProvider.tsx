"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";
import { writeRemotePreferences, type UserPreferences } from "@/lib/preferences/sync";

/**
 * Bridge intre next-themes si /lib/preferences/sync. Cand userul schimba
 * tema, dam push catre DB (debounced 500ms). Cand civia:prefs-hydrated
 * apare cu un theme remote diferit, setam tema local.
 */
function ThemeBridge() {
  const { theme, setTheme } = useTheme();

  // Pe schimbare locala → push catre DB.
  useEffect(() => {
    if (!theme) return;
    if (theme !== "light" && theme !== "dark" && theme !== "system") return;
    writeRemotePreferences({ theme });
  }, [theme]);

  // Pe hydrate de la login → preia tema remote daca difera.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UserPreferences>).detail;
      if (!detail?.theme) return;
      if (detail.theme === theme) return;
      setTheme(detail.theme);
    };
    window.addEventListener("civia:prefs-hydrated", handler as EventListener);
    return () => window.removeEventListener("civia:prefs-hydrated", handler as EventListener);
  }, [theme, setTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Add theme-ready class after hydration so CSS transitions activate.
  // This prevents the flash-of-wrong-theme on initial load.
  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add("theme-ready");
    });
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeBridge />
      {children}
    </NextThemesProvider>
  );
}
