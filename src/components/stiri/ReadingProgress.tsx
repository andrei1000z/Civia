"use client";

import { useEffect, useState } from "react";

/**
 * Thin top-of-page progress bar that fills as the user scrolls through
 * the article. Sits sticky at the top of the article container so it
 * tracks the body's scroll without depending on a specific layout.
 *
 * No bar renders if the page is shorter than the viewport.
 */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 2026-05-29 — rAF throttle + cached scrollHeight + integer pct diff.
    let raf = 0;
    let max = document.documentElement.scrollHeight - window.innerHeight;
    let lastPct = -1;
    const recalcMax = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
      setEnabled(max > 0);
    };
    const compute = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (max <= 0) {
          raf = 0;
          return;
        }
        const next = Math.max(0, Math.min(100, Math.round((window.scrollY / max) * 100)));
        if (next !== lastPct) {
          lastPct = next;
          setPct(next);
        }
        raf = 0;
      });
    };

    recalcMax();
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", recalcMax, { passive: true });
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", recalcMax);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progres lectură articol"
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 transition-[width] duration-100 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
