"use client";

import { useEffect, useState } from "react";

export function ReadProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 2026-05-29 — rAF throttle + cached scrollHeight.
    // Inainte: scrollHeight (FORCES LAYOUT) la fiecare scroll event → jank.
    // Acum: re-citim scrollHeight doar la resize (cache otherwise).
    let raf = 0;
    let height = document.documentElement.scrollHeight - window.innerHeight;
    let lastPct = -1;
    const recalcHeight = () => {
      height = document.documentElement.scrollHeight - window.innerHeight;
    };
    const calc = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        const pct = height > 0 ? Math.min(100, Math.round((scrolled / height) * 100)) : 0;
        if (pct !== lastPct) {
          lastPct = pct;
          setProgress(pct);
        }
        raf = 0;
      });
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", recalcHeight, { passive: true });
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", recalcHeight);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-[var(--color-surface-2)] z-[60] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-[var(--color-primary)] to-indigo-500 transition-[width] duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
