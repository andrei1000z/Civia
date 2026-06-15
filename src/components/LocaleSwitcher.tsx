"use client";

import { useState, useEffect } from "react";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from "@/lib/i18n/messages";

/**
 * 🎁 MEDIUM #17 — Locale Switcher dropdown.
 *
 * Salvează preferința în cookie `civia-locale` (1 an). Reload la schimbare
 * pentru server re-render cu noul locale.
 */
export function LocaleSwitcher() {
  const [current, setCurrent] = useState<Locale>("ro");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("civia-locale="))
      ?.split("=")[1];
    if (cookie && (LOCALES as string[]).includes(cookie)) {
      setCurrent(cookie as Locale);
    }
  }, []);

  const switchTo = (locale: Locale) => {
    document.cookie = `civia-locale=${locale}; path=/; max-age=${365 * 86400}; samesite=lax`;
    setCurrent(locale);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Schimbă limba"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-full)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <Languages size={14} aria-hidden="true" />
        <span>{LOCALE_FLAGS[current]} {LOCALE_NAMES[current]}</span>
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[160px] py-1 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-3)] z-50"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => switchTo(l)}
                role="menuitem"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors flex items-center gap-2 ${
                  l === current ? "font-semibold text-[var(--color-primary)]" : ""
                }`}
              >
                <span>{LOCALE_FLAGS[l]}</span>
                <span>{LOCALE_NAMES[l]}</span>
                {l === current && <span aria-hidden="true" className="ml-auto">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
