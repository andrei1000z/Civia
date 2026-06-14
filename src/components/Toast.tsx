"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toast durations centralizate (5/22/2026) — magic numbers scattered prin
 * codebase: 1800ms (AiSummary), 2000ms (Lightbox, SharePetitie), 2500ms
 * (cont/saved), 4000ms (default). Standardizat 3 niveluri tokens-based:
 */
export const TOAST_DURATION = {
  /** Confirmari quick (success, copied, saved). ~1.8s — sub pragul „abia
   *  am observat dar a disparut deja". */
  short: 1800,
  /** Default — confirmari + info. Suficient sa citesti 5-8 cuvinte. */
  medium: 4000,
  /** Mesaje cu actiune (undo, retry). Lung sa apuci sa apesi. */
  long: 6000,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info", duration: number = TOAST_DURATION.medium) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/*
        Toast stack — bottom-center on desktop, bottom-centered but
        respecting the iOS home-indicator safe area on mobile. The
        extra bottom offset keeps toasts clear of the MobileFab
        (which sits at bottom-right ~20px above the nav bar).

        role=status + aria-live=polite: new toasts are announced by
        screen readers without interrupting the current reading.
        We don't use aria-live=assertive because toasts here are
        confirmations, not critical warnings.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none lg:!bottom-4"
        style={{
          // z-toast = 200 → above modals (100/120) + nav (50). User feedback
          // (toast confirmation/error) trebuie să fie mereu vizibil.
          zIndex: "var(--z-toast, 200)",
          // Bottom offset respectă safe-area (notch/home-indicator) +
          // adaugă spațiu suplimentar dacă sunt prompts deschise (cookie/install)
          // pentru a evita overlap. Folosim `:has()` selector în CSS sub.
          // 2026-06-14 — pe mobil, deasupra barei BottomNav (~4.4rem). Pe desktop
          // (fără bară) revine la 1rem prin `lg:!bottom-4` de pe className.
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
        }}
        data-toast-stack
      >
        {toasts.map((t) => {
          const Icon =
            t.type === "success" ? CheckCircle2 :
            t.type === "error" ? AlertCircle :
            t.type === "warning" ? AlertCircle : Info;
          // Tokens-based — match cu design system, inheritable de la theme.
          // CSS vars sunt setate la root in globals.css.
          const color =
            t.type === "success" ? "var(--color-primary)" :
            t.type === "error" ? "var(--color-accent, #DC2626)" :
            t.type === "warning" ? "var(--color-warning, #F59E0B)" :
            "var(--color-info, #2563EB)";
          return (
            <div
              key={t.id}
              // Phase 3 v2: glass-surface-strong (85% bg + blur 16px) +
              // radius-lg (24px squircle) + shadow-4 (more diffused depth).
              // items-center pe rand, text-center pe paragraf — iconita,
              // textul si X sunt aliniate vertical perfect, plus text-ul
              // centrat orizontal in coloana lui.
              className="glass-surface-strong pointer-events-auto rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[420px] animate-toast-in"
              style={{ borderLeftWidth: 4, borderLeftColor: color }}
            >
              <Icon size={18} style={{ color }} className="shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm text-[var(--color-text)] text-center">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                aria-label="Închide notificarea"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Silent no-op when used outside ToastProvider (shouldn't happen in practice)
    return { toast: () => {} };
  }
  return ctx;
}
