"use client";

import { useEffect, useState } from "react";

const KONAMI_SEQUENCE = [
  "ArrowUp", "ArrowUp",
  "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight",
  "ArrowLeft", "ArrowRight",
  "b", "a",
];

const RAINBOW_KEY = "civia:rainbow-until";
const RAINBOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Konami easter egg — ↑↑↓↓←→←→ B A → unlocks rainbow mode for 24h.
 *
 * Persistat in localStorage cu timestamp expirare. Body primeste class
 * `lc-rainbow-mode` cand activ → CSS hue-rotate 8s infinite.
 *
 * Shows a celebratory toast pe activate. Auto-removes la expirare.
 */
export function KonamiEasterEgg() {
  const [progress, setProgress] = useState<string[]>([]);
  const [celebrating, setCelebrating] = useState(false);

  // Reapply rainbow mode on mount if not yet expired
  useEffect(() => {
    try {
      const until = parseInt(localStorage.getItem(RAINBOW_KEY) || "0", 10);
      if (until > Date.now()) {
        document.body.classList.add("lc-rainbow-mode");
        const remaining = until - Date.now();
        const expireTimer = setTimeout(() => {
          document.body.classList.remove("lc-rainbow-mode");
          localStorage.removeItem(RAINBOW_KEY);
        }, remaining);
        return () => clearTimeout(expireTimer);
      }
    } catch {
      // localStorage blocked
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const key = e.key;
      setProgress((prev) => {
        const next = [...prev, key];
        // Match up to KONAMI_SEQUENCE
        let i = 0;
        while (i < next.length && i < KONAMI_SEQUENCE.length) {
          if (next[i]?.toLowerCase() !== KONAMI_SEQUENCE[i]?.toLowerCase()) {
            // Restart matching — keep the last char if it matches start
            return next[next.length - 1]?.toLowerCase() === KONAMI_SEQUENCE[0]?.toLowerCase()
              ? [next[next.length - 1]!]
              : [];
          }
          i++;
        }
        if (next.length >= KONAMI_SEQUENCE.length) {
          // ACTIVATE
          activateRainbow();
          return [];
        }
        return next;
      });
    };

    const activateRainbow = () => {
      const until = Date.now() + RAINBOW_DURATION_MS;
      try {
        localStorage.setItem(RAINBOW_KEY, String(until));
      } catch {
        // localStorage blocked — still works for current session
      }
      document.body.classList.add("lc-rainbow-mode");
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 4000);
      // Auto-expire after 24h
      setTimeout(() => {
        document.body.classList.remove("lc-rainbow-mode");
        try {
          localStorage.removeItem(RAINBOW_KEY);
        } catch { /* noop */ }
      }, RAINBOW_DURATION_MS);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!celebrating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-none"
      style={{
        animation: "lc-konami-pop 4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <div
        className="lc-glass-3 px-6 py-4 rounded-2xl text-center"
        style={{ borderRadius: "20px", minWidth: "280px" }}
      >
        <div className="text-3xl mb-1" aria-hidden="true">🌈</div>
        <div
          className="font-bold text-base lc-text-gradient"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          Rainbow Mode Unlocked!
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          24 ore de culori. Bună treabă, hacker civic. 🤘
        </div>
      </div>

      <style jsx>{`
        @keyframes lc-konami-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -20px) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -20px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
