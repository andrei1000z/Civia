"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 2026-06-18 — Primitive stil „Setări de telefon" (iOS Settings) pentru /setari.
 * SettingsGroup = card rotunjit cu titlu de secțiune deasupra + rânduri separate
 * de divider. SettingsRow = un rând: chip-icon stânga + label/sublabel + dreapta
 * (valoare / chevron / toggle / control). Liquid-glass clean, minimalist.
 */

export function SettingsGroup({
  title,
  footer,
  children,
  className,
}: {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {title && (
        <h2 className="px-1 sm:px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-1)] divide-y divide-[var(--color-border)]/70">
        {children}
      </div>
      {footer && (
        <p className="px-1 sm:px-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{footer}</p>
      )}
    </section>
  );
}

type RowBase = {
  icon?: React.ReactNode;
  iconClass?: string;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  right?: React.ReactNode;
  danger?: boolean;
  /** conținut sub label (input, descriere, control wide) */
  children?: React.ReactNode;
};

function RowInner({ icon, iconClass, label, sublabel, right, danger, children, interactive }: RowBase & { interactive?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 min-h-[52px]", interactive && "transition-colors")}>
      {icon && (
        <span
          className={cn(
            "shrink-0 w-7 h-7 rounded-[9px] grid place-items-center",
            iconClass ?? "bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)]",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium leading-snug", danger ? "text-[var(--color-error)]" : "text-[var(--color-text)]")}>
          {label}
        </div>
        {sublabel && <div className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{sublabel}</div>}
        {children}
      </div>
      {right !== undefined && right !== null && (
        <div className="shrink-0 text-sm text-[var(--color-text-muted)] flex items-center gap-1.5 max-w-[55%] truncate">{right}</div>
      )}
    </div>
  );
}

/** Rând static / cu conținut (input, descriere). */
export function SettingsRow(props: RowBase) {
  return <RowInner {...props} />;
}

/** Rând clicabil — link sau onClick — cu chevron iOS implicit. */
export function SettingsLinkRow({
  href,
  onClick,
  showChevron = true,
  ...row
}: RowBase & { href?: string; onClick?: () => void; showChevron?: boolean }) {
  const right =
    row.right ?? (showChevron ? <ChevronRight size={16} className="text-[var(--color-text-muted)]/70" aria-hidden="true" /> : null);
  const cls =
    "block w-full text-left hover:bg-[var(--color-surface-2)] focus:outline-none focus-visible:bg-[var(--color-surface-2)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] transition-colors";
  const inner = <RowInner {...row} right={right} interactive />;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
