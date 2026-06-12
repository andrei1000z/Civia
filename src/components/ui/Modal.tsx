"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Tab-focusable elements inside the modal. Used to build the ring the
// focus-trap rotates through.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, size = "md", className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Stash the latest `onClose` in a ref so the mount-effect doesn't
  // re-run every time the parent re-renders and produces a new
  // function reference. Without this, every keystroke in the auth
  // modal's email field invalidated the effect → cleanup ran →
  // re-mount put the focus back on the close button → user lost
  // their input focus mid-typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Remember who had focus so we can restore it on close. Screen-reader
    // users rely on this to land back in the surrounding page instead of
    // on <body>.
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap — cycle Tab / Shift+Tab between first and last
      // focusable element inside the dialog so keyboard users can't
      // drift back to controls behind the overlay.
      if (e.key === "Tab" && dialogRef.current) {
        const nodes = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => !el.hasAttribute("aria-hidden"));
        if (nodes.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    // Give focus to the first non-close focusable on the next frame.
    // We deliberately skip the close button — landing on "X" the moment
    // the dialog opens is hostile UX (one stray Enter and the dialog
    // closes). Prefer the first input/textarea when available; fall
    // back to the first focusable, then the dialog itself.
    const raf = requestAnimationFrame(() => {
      const dlg = dialogRef.current;
      if (!dlg) return;
      const inputLike = dlg.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])',
      );
      if (inputLike) {
        inputLike.focus();
        return;
      }
      const all = Array.from(dlg.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first =
        all.find((el) => el.getAttribute("aria-label") !== "Închide") ?? all[0];
      (first ?? dlg).focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
      previouslyFocusedRef.current?.focus?.();
    };
    // Intentional: only `open` belongs in the deps. `onClose` is
    // stashed in a ref above so its identity changes on every parent
    // render don't re-trigger the focus-trap mount logic — that was
    // the source of the "focus jumps to X every keystroke" bug.
  }, [open]);

  if (!open) return null;

  // 2026-05-19: responsive sizing — pe mobile (sub 640px) toate dimensiunile
  // sunt strânse la max-w-full ca să nu se taie pe iPhone SE (360px viewport).
  // De la sm: in sus revin la dimensiunile original.
  const sizeClass = {
    sm: "max-w-full sm:max-w-md",
    md: "max-w-full sm:max-w-lg md:max-w-2xl",
    lg: "max-w-full sm:max-w-xl md:max-w-4xl",
  }[size];

  return (
    <div
      // 2026-05-19 Liquid Civic: backdrop blur-xl + emerald tint subtle.
      // Safe-area top/bottom pentru iPhone notch (landscape).
      className="fixed inset-0 z-[var(--z-modal)] flex items-start md:items-center justify-center px-2 py-4 sm:p-4 backdrop-blur-xl overflow-y-auto animate-fade-in"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        background: "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.04), rgba(0, 0, 0, 0.55))",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? undefined}
        tabIndex={-1}
        className={cn(
          // Liquid Civic glass-3 — premium floating surface.
          // flex-col + max-h + overflow-hidden: header rămâne fix, conținutul
          // derulează intern → pe modale înalte partea de sus NU mai iese din
          // ecran (bug flex-center+overflow, raportat 2026-06-12).
          "w-full lc-glass-3 rounded-[var(--radius-lg)] my-8 outline-none animate-modal-pop flex flex-col max-h-[calc(100dvh-4rem)] overflow-hidden",
          sizeClass,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--color-border)]">
            {/* 2026-05-24 (P1.366) line-clamp-2 pentru long titles ca să nu
                rupă layout-ul cu close button. */}
            <h2 className="text-xl font-semibold text-[var(--color-text)] line-clamp-2 min-w-0">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              aria-label="Închide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
