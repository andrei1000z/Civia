"use client";

import { useEffect, useState } from "react";

export function ReadProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calc = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const pct = height > 0 ? Math.min(100, (scrolled / height) * 100) : 0;
      setProgress(pct);
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", calc);
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
