import { useId, cloneElement, isValidElement } from "react";

/**
 * FormField — shared label+input wrapper pentru sesizari form (si alte
 * formulare interne). Extract din SesizareForm.tsx (era component intern,
 * acum reutilizabil cross-component).
 *
 * Convention: label deasupra, asterisc rosu pentru required, child = input.
 *
 * 2026-06-08 (audit) — asociere PROGRAMATICĂ label↔input: useId() + htmlFor pe
 * label, id injectat în child via cloneElement; hint/error legate prin
 * aria-describedby + aria-invalid. Înainte label-ul nu era asociat cu inputul →
 * screen-readerele nu citeau eticheta pe NICIUN câmp al formularului.
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
  const autoId = useId();
  // Respectă un id existent pe child (ex. input cu id propriu); altfel generăm.
  const childProps = (isValidElement(children) ? (children.props as Record<string, unknown>) : {}) || {};
  const fieldId = (typeof childProps.id === "string" && childProps.id) || autoId;
  const hintId = hint && !error ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  const describedBy =
    [childProps["aria-describedby"] as string | undefined, errId, hintId].filter(Boolean).join(" ") || undefined;

  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: fieldId,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true } : {}),
      })
    : children;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
        {label}
        {required && (
          <span className="text-[var(--color-accent,#DC2626)] ml-0.5" aria-label="câmp obligatoriu">
            *
          </span>
        )}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-xs text-[var(--color-accent,#DC2626)]" role="alert">
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
