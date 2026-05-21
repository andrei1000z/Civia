"use client";

import { useEffect, useRef } from "react";

/**
 * Aurora animated background — emerald + aqua + violet blobs that drift
 * slowly behind everything. Scroll-linked parallax (0.3x) for depth.
 *
 * Performance:
 *  - 3 blobs only (max GPU compositing layers)
 *  - blur via CSS filter (not backdrop-filter — much cheaper)
 *  - animation paused when tab inactive
 *  - respects prefers-reduced-motion (CSS handles disabling)
 *
 * Place at top of <body> via layout.tsx, behind all content.
 */
export function AuroraBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Respect reduced motion — skip parallax entirely
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastScrollY.current) > 1) {
          lastScrollY.current = y;
          // Parallax — blobs move SLOWER than scroll (0.3x), feels deep.
          node.style.transform = `translate3d(0, ${y * -0.3}px, 0)`;
        }
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden will-change-transform"
      style={{ transform: "translate3d(0, 0, 0)" }}
    >
      {/* Emerald blob — top-left, primary green civic */}
      <div
        className="lc-aurora-blob"
        style={{
          top: "-10%",
          left: "-15%",
          width: "55vw",
          height: "55vw",
          background: "radial-gradient(circle, var(--civic-emerald-400) 0%, transparent 60%)",
          opacity: 0.35,
          animationDelay: "0s",
        }}
      />
      {/* Aqua blob — center-right, blue trust */}
      <div
        className="lc-aurora-blob"
        style={{
          top: "20%",
          right: "-20%",
          width: "60vw",
          height: "60vw",
          background: "radial-gradient(circle, var(--civic-aqua-400) 0%, transparent 60%)",
          opacity: 0.30,
          animationDelay: "-20s",
        }}
      />
      {/* Violet blob — bottom-left, premium accent (smaller, subtler) */}
      <div
        className="lc-aurora-blob"
        style={{
          bottom: "-10%",
          left: "20%",
          width: "45vw",
          height: "45vw",
          background: "radial-gradient(circle, var(--civic-violet-400) 0%, transparent 60%)",
          opacity: 0.20,
          animationDelay: "-40s",
        }}
      />
      {/* Bug fix 5/22/2026 — al 4-lea blob (emerald, jos-dreapta) ca sa
          umpla colțul de jos-dreapta unde înainte era „bandă neagră" sub
          gradient-ul radial al html. */}
      <div
        className="lc-aurora-blob"
        style={{
          bottom: "-15%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          background: "radial-gradient(circle, var(--civic-emerald-400) 0%, transparent 60%)",
          opacity: 0.22,
          animationDelay: "-60s",
        }}
      />
    </div>
  );
}
