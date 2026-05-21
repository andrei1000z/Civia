/**
 * FormField — shared label+input wrapper pentru sesizari form (si alte
 * formulare interne). Extract din SesizareForm.tsx (era component intern,
 * acum reutilizabil cross-component).
 *
 * Convention: label deasupra, asterisc rosu pentru required, child = input.
 */
export function FormField({
  label,
  required,
  children,
  hint,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string | null;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
        {label}
        {required && (
          <span className="text-[var(--color-accent,#DC2626)] ml-0.5" aria-label="câmp obligatoriu">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-[var(--color-accent,#DC2626)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Shared input classes pentru consistent UI cross-formulare:
 * - h-11 mobile (44px touch target WCAG) / sm:h-10 desktop
 * - text-base mobile (16px previne zoom iOS) / sm:text-sm desktop
 * - focus ring tokens-based
 */
export const FORM_INPUT_CLASS =
  "w-full h-11 sm:h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus:border-transparent";
