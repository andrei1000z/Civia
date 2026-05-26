"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * 2026-05-26 — Light mode revine.
 *
 * Provider minimal, fără next-themes (sub 1 KB gzip, zero deps). Sursa
 * canonică = localStorage["civia-theme"] ∈ { "light" | "dark" | "system" }.
 * Default = "system" — respectă preferința OS-ului.
 *
 * Faza ANTI-FLASH: scriptul `theme-boot` din layout.tsx aplică `.dark` pe
 * <html> SYNCHRONOUS în <head>, înainte ca body-ul să paint-uiască. Aici
 * doar sincronizăm state-ul React cu DOM-ul + ascultăm schimbări la
 * matchMedia când theme-ul e "system".
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** Selecția user-ului: light / dark / system. */
  theme: ThemeChoice;
  /** Theme-ul efectiv aplicat acum (system → resolved la light sau dark). */
  resolved: ResolvedTheme;
  /** Switch la o alegere nouă. Persistă în localStorage + aplică pe <html>. */
  setTheme: (t: ThemeChoice) => void;
}

const STORAGE_KEY = "civia-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Citește system preference fără să spargă pe SSR. */
function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Citește theme-ul stocat (sau "system" default). */
function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* localStorage blocat (Safari private) — fallback la system */
  }
  return "system";
}

/** Aplică efectiv pe <html>: clasă `.dark` + `color-scheme` + `<meta theme-color>`. */
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  // Sincronizează <meta name="theme-color"> ca chrome-ul browserului (URL
  // bar mobile, taskbar PWA) să se potrivească cu mode-ul curent.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = resolved === "dark" ? "#0a0a0a" : "#FAFAFA";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: pe primul render (client), citim direct DOM + storage.
  // Pe SSR, default "system" — boot script-ul a setat deja `.dark` corect.
  const [theme, setThemeState] = useState<ThemeChoice>(() => readStoredTheme());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Re-aplică pe schimbare de selectie + ascultă media query când e „system".
  useEffect(() => {
    const next: ResolvedTheme = theme === "system" ? getSystemPreference() : theme;
    setResolved(next);
    applyTheme(next);

    // Marker pentru CSS transitions — adăugat în RAF ca să nu se aplice pe
    // prima paint și să producă flicker.
    requestAnimationFrame(() => {
      document.documentElement.classList.add("theme-ready");
    });

    if (theme !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const sys: ResolvedTheme = mql.matches ? "dark" : "light";
      setResolved(sys);
      applyTheme(sys);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignored */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook public — citește contextul. Returnează default safe dacă e folosit
 * în afara provider-ului (server components, teste), ca să nu crape.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    theme: "system",
    resolved: "dark",
    setTheme: () => {
      /* no-op — provider lipsă */
    },
  };
}
