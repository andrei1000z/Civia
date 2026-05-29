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

    const compute = () => {
      const doc = document.documentElement;
      const scrolled = window.scrollY;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      setPct(Math.max(0, Math.min(100, (scrolled / max) * 100)));
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
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
