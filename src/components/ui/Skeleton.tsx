import { cn } from "@/lib/utils";

interface SkeletonProps {
  /** Variant control. */
  variant?: "rect" | "text" | "circle" | "card";
  className?: string;
}

/**
 * Liquid Civic Skeleton — single-source loading placeholder.
 *
 * Variants:
 *   - rect: default block (use w/h via className)
 *   - text: single-line text height (h-4)
 *   - circle: square aspect (use w-N for size)
 *   - card: pre-styled card with padding + radius-md
 *
 * Uses `.skeleton-shimmer` from globals.css (emerald → aqua gradient
 * sweep, respects prefers-reduced-motion).
 */
export function Skeleton({ variant = "rect", className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Se încarcă"
      className={cn(
        "skeleton-shimmer",
        variant === "text" && "h-4 rounded-[var(--radius-xs)]",
        variant === "circle" && "rounded-full aspect-square",
        variant === "rect" && "rounded-[var(--radius-xs)]",
        variant === "card" && "rounded-[var(--radius-md)] p-4 h-32",
        className,
      )}
    />
  );
}

/**
 * SkeletonList — multiple stacked skeletons, used for lists.
 */
export function SkeletonList({ count = 3, variant = "card", gap = 3, className }: {
  count?: number;
  variant?: SkeletonProps["variant"];
  gap?: number;
  className?: string;
}) {
  return (
    <div className={cn(`space-y-${gap}`, className)} role="status" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
