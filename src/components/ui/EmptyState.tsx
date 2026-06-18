import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";

/**
 * EmptyState — shared component pentru toate surfacele care altfel returnează
 * null când nu există date. Audit Wave B 2026-05-24 a identificat 10+ surfaces
 * silent (TopVotedWidget tracking gol, SimilarSesizari null, etc.).
 *
 * 3 variante:
 *   - "no-data" (first-time UX): „Încă nimic. Fii primul." motivator
 *   - "no-results" (search/filter): „Nimic cu aceste filtre"
 *   - "no-permission" (auth wall): „Loghează-te ca să vezi"
 *
 * Folosire:
 *   <EmptyState
 *     variant="no-data"
 *     title="Nicio sesizare publică încă"
 *     description="Fii primul cetățean care raportează ceva."
 *     cta={{ label: "Fă o sesizare", href: "/sesizari" }}
 *   />
 */

export type EmptyStateVariant = "no-data" | "no-results" | "no-permission";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Pentru mini-rendering (e.g. sidebar widget) — fără padding mare. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  variant = "no-data",
  title,
  description,
  icon,
  cta,
  compact = false,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? Inbox;
  const tint =
    variant === "no-results"
      ? "text-amber-500/70"
      : variant === "no-permission"
        ? "text-violet-500/70"
        : "text-[var(--color-text-muted)]";

  return (
    <div
      role={variant === "no-permission" ? "alert" : "status"}
      aria-live="polite"
      className={`text-center ${compact ? "py-6 px-4" : "py-10 px-6"} ${className ?? ""}`}
    >
      <div
        className={`mx-auto ${compact ? "w-10 h-10 mb-2" : "w-12 h-12 mb-3"} rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center`}
      >
        <Icon
          size={compact ? 18 : 22}
          aria-hidden="true"
          className={tint}
        />
      </div>
      <p className={`font-semibold ${compact ? "text-sm" : "text-base"} text-[var(--color-text)]`}>
        {title}
      </p>
      {description && (
        <p className={`mt-1.5 ${compact ? "text-xs" : "text-sm"} text-[var(--color-text-muted)] leading-relaxed max-w-md mx-auto`}>
          {description}
        </p>
      )}
      {cta && (
        <div className="mt-4">
          {cta.href ? (
            <Link
              href={cta.href}
              className="inline-flex items-center justify-center h-10 sm:h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="inline-flex items-center justify-center h-10 sm:h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
