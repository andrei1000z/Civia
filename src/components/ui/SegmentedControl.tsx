"use client";

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
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
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
