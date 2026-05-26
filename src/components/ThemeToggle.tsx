"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type ThemeChoice } from "./ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * 2026-05-26 — Toggle light / dark / system.
 *
 * Două forme:
 *   - `variant="segmented"` (default): 3 buton-uri radio, vizibil în /cont
 *     ca un selector clar (light / system / dark). Fiecare cu icon + label.
 *   - `variant="compact"`: un singur buton ciclic (sun → moon → monitor →
 *     sun). Folosit în Footer ca pill discret.
 *
 * Tot button-ul gestionează SSR fără hydration mismatch: până la mount,
 * afișează un skeleton (segmented) sau un icon neutru (compact). După
 * mount, sincronizează cu state-ul ThemeProvider-ului.
 */

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Luminos", Icon: Sun },
  { value: "system", label: "Sistem", Icon: Monitor },
  { value: "dark", label: "Întunecat", Icon: Moon },
];

export function ThemeToggle({
  variant = "segmented",
  className,
}: {
  variant?: "segmented" | "compact";
  className?: string;
}) {
  const { theme, resolved, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (variant === "compact") {
    // Buton ciclic + label „Schimbă aspectul". Iconul reflectă theme-ul
    // ACTIV (resolved), nu alegerea (ca user-ul să vadă ce e în vigoare).
    const ActiveIcon = !mounted
      ? Monitor
      : theme === "system"
      ? Monitor
      : resolved === "dark"
      ? Moon
      : Sun;
    const label = !mounted
      ? "Aspect"
      : theme === "system"
      ? "Aspect: Sistem"
      : resolved === "dark"
      ? "Aspect: Întunecat"
      : "Aspect: Luminos";
    const next: ThemeChoice =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        title={mounted ? `Schimbă la ${OPTIONS.find((o) => o.value === next)?.label}` : "Schimbă aspectul"}
        aria-label={label}
        suppressHydrationWarning
        className={cn(
          "inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
          className,
        )}
      >
        <ActiveIcon size={14} aria-hidden="true" />
        <span suppressHydrationWarning>{label}</span>
      </button>
    );
  }

  // Segmented (default) — 3 opțiuni vizibile
  if (!mounted) {
    return (
      <div
        className={cn("grid grid-cols-3 gap-2", className)}
        aria-hidden="true"
      >
        {OPTIONS.map((o) => (
          <div
            key={o.value}
            className="h-20 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-3 gap-2", className)}
      role="radiogroup"
      aria-label="Aspect"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.Icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5 h-20 rounded-[var(--radius-xs)] border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]",
              isActive
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] shadow-[var(--shadow-1)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
            )}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="text-xs font-medium">{opt.label}</span>
            {isActive && (
              <Check
                size={12}
                className="absolute top-1.5 right-1.5 text-[var(--color-primary)]"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
