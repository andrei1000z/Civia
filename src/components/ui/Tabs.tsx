"use client";

import { useState, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  variant?: "underline" | "pills" | "solid";
  className?: string;
}

export function Tabs({ items, defaultTab, variant = "underline", className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const activeItem = items.find((item) => item.id === active);
  // 2026-06-19 (audit #16) — semantica ARIA Tabs (tablist/tab/tabpanel) + roving
  // tabindex + Arrow/Home/End (lipseau complet).
  const idx = items.findIndex((i) => i.id === active);
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let ni = -1;
    if (e.key === "ArrowRight") ni = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") ni = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = items.length - 1;
    const nx = ni >= 0 ? items[ni] : undefined;
    if (!nx) return;
    e.preventDefault();
    setActive(nx.id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[ni]?.focus();
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        onKeyDown={onTabKey}
        className={cn(
          "flex gap-1 mb-6 overflow-x-auto no-scrollbar",
          variant === "underline" && "border-b border-[var(--color-border)]",
          variant === "pills" && "p-1 bg-[var(--color-surface-2)] rounded-[var(--radius-pill)] w-fit",
          variant === "solid" && "gap-2"
        )}
      >
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all",
                variant === "underline" && [
                  "border-b-2 -mb-px",
                  isActive
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                ],
                variant === "pills" && [
                  "rounded-[var(--radius-pill)]",
                  isActive
                    ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[var(--shadow-1)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                ],
                variant === "solid" && [
                  "rounded-[var(--radius-button)]",
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-2)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
                ]
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {activeItem?.content}
      </div>
    </div>
  );
}
