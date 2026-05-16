"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Theme picker — light / dark only. The "system" option was removed at
 * user request (2026-04-29) since explicit choice is clearer. If the
 * stored theme is "system", we treat the user's resolved preference as
 * the active visual.
 */
export function ThemeSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // If user previously had "system", visually highlight whichever resolved
  // theme is currently in effect — but explicit choice still requires a click.
  const effective = theme === "system" ? resolvedTheme : theme;

  const options = [
    { value: "light", label: "Luminos", icon: Sun },
    { value: "dark", label: "Întunecat", icon: Moon },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = effective === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={isActive}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5 h-20 rounded-[var(--radius-xs)] border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              isActive
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]",
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
