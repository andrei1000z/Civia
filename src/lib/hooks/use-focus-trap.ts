"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focus management + Tab-trap pentru modale (WCAG 2.4.3 / 4.1.2).
 *
 * La deschidere: salvează elementul focusat, mută focus pe rădăcina dialogului
 * (care trebuie să aibă `tabIndex={-1}`) ca screen-reader-ul să intre ÎN dialog.
 * Cât e deschis: Tab/Shift+Tab ciclează DOAR între controalele dialogului.
 * La închidere/unmount: readuce focus pe elementul dinainte (nu pe <body>).
 *
 * NU tratează Escape — modalele au deja propriul handler de Escape + scroll-lock.
 * Focus pe RĂDĂCINĂ (nu pe primul control) intenționat: sigur inclusiv pentru
 * dialoguri de confirmare distructive (nu auto-focusează „Șterge").
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    root.focus({ preventScroll: true });

    const SELECTOR =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("keydown", onKeydown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, ref]);
}
