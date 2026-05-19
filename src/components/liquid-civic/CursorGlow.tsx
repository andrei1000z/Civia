"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor glow — un cerc emerald/aqua subtle care urmează cursorul peste
 * glass surfaces. Mouse-only (hover: hover + pointer: fine).
 *
 * Performance:
 *  - 1 div fixed, transform via RAF
 *  - off când e tab inactiv
 *  - disabled on touch devices
 *  - respect prefers-reduced-motion
 *
 * Activat via body class `lc-cursor-glow-enabled` (set in layout).
 */
export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    // Disable on touch / mobile / reduced motion
    const isTouchDevice = window.matchMedia("(hover: none)").matches;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouchDevice || prefersReduced) return;

    document.body.classList.add("lc-cursor-glow-enabled");

    const handleMove = (e: MouseEvent) => {
      targetX.current = e.clientX;
      targetY.current = e.clientY;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    const animate = () => {
      // Lerp pentru smooth tracking (catches up after lag)
      currentX.current += (targetX.current - currentX.current) * 0.18;
      currentY.current += (targetY.current - currentY.current) * 0.18;
      const node = glowRef.current;
      if (node) {
        node.style.transform = `translate3d(${currentX.current - 150}px, ${currentY.current - 150}px, 0)`;
      }
      // Continue animating only if cursor still moved
      const dx = Math.abs(targetX.current - currentX.current);
      const dy = Math.abs(targetY.current - currentY.current);
      if (dx > 0.5 || dy > 0.5) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.body.classList.remove("lc-cursor-glow-enabled");
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="fixed pointer-events-none -z-10 hidden md:block"
      style={{
        width: "300px",
        height: "300px",
        background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(34, 211, 238, 0.08) 40%, transparent 70%)",
        filter: "blur(20px)",
        willChange: "transform",
        top: 0,
        left: 0,
      }}
    />
  );
}
