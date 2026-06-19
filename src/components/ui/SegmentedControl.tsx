"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — selector de opțiuni stil iOS/One UI (pilule într-un track
 * glass-thin). Pentru perioade (Lună/An), filtre scurte, vizualizări. Diferit
 * de <Tabs> (underline, pentru navigare de conținut). Tastatură: săgeți native
 * pe radiogroup. Touch target ≥40px.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  // 2026-06-19 (audit #17) — săgeți REALE pe radiogroup: role="radio" nu oferă
  // singur navigare cu săgeți. Roving tabindex + Arrow Left/Right/Up/Down.
  const currentIdx = options.findIndex((o) => o.value === value);
  const onKeyNav = (e: KeyboardEvent<HTMLDivElement>) => {
    let ni = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") ni = (currentIdx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") ni = (currentIdx - 1 + options.length) % options.length;
    const nv = ni >= 0 ? options[ni] : undefined;
    if (!nv) return;
    e.preventDefault();
    onChange(nv.value);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[ni]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyNav}
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-9 min-w-[2.5rem] rounded-[var(--radius-pill)] px-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
              active
                ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
