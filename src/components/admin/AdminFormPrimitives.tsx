import type { LucideIcon } from "lucide-react";

/**
 * Shared admin form primitives — extracted from admin/proteste/page.tsx
 * (and reusable elsewhere) to reduce that file's line count and let
 * other admin surfaces follow the same conventions.
 *
 * Field: labeled wrapper for inputs. Renders the label on top with the
 *   admin micro-label styling (11px uppercase tracking, muted color).
 *
 * Section: fieldset + legend with an icon chip. Used for grouping
 *   related form fields with a visual heading.
 */

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-[family-name:var(--font-sora)] font-bold text-sm inline-flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
