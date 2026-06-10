"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up — cifrele „numără" de la 0 la valoare când intră în viewport
 * (fundația de motion Fable, 2026-06-11). rAF + ease-out-expo, ~0.9s.
 *
 * Respectă prefers-reduced-motion (sare direct la valoarea finală) și
 * SSR (randează valoarea finală — fără layout shift, fără SEO pierdut;
 * animația pornește doar client-side, de la 0, la intrarea în viewport).
 */
export function CountUp({
  value,
  className = "",
  durationMs = 900,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 4); // ease-out-quart ≈ expo, ieftin
          setDisplay(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setDisplay(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {display.toLocaleString("ro-RO")}
    </span>
  );
}
