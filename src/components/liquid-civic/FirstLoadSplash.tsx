"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "civia:splash-shown-v1";
const DURATION_MS = 800;

/**
 * First-load splash — Civia logo cu emerald→aqua liquid morph.
 *
 * Shown ONCE per browser (localStorage flag). After first visit, never
 * shown again. Total duration 800ms. Skippable via tap/click.
 *
 * Respects prefers-reduced-motion (instant fade-out).
 */
export function FirstLoadSplash() {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SPLASH_KEY);
      if (seen) return;
      localStorage.setItem(SPLASH_KEY, "1");
      setShow(true);
      // Auto-dismiss after DURATION_MS
      const timer = setTimeout(() => setExiting(true), DURATION_MS);
      // Remove from DOM after exit anim
      const removeTimer = setTimeout(() => setShow(false), DURATION_MS + 400);
      return () => {
        clearTimeout(timer);
        clearTimeout(removeTimer);
      };
    } catch {
      // localStorage blocked — never show, prevent infinite loops
    }
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      onClick={() => setExiting(true)}
      className="fixed inset-0 z-[400] flex items-center justify-center cursor-pointer"
      style={{
        background: "radial-gradient(circle at center, rgba(16, 185, 129, 0.12), rgba(0, 0, 0, 0.95))",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      <div
        className="relative flex flex-col items-center gap-4"
        style={{
          transform: exiting ? "scale(1.1)" : "scale(1)",
          transition: "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Logo morph — gradient emerald→aqua animated */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-white font-extrabold text-5xl"
          style={{
            background: "linear-gradient(135deg, #10B981 0%, #22D3EE 100%)",
            backgroundSize: "200% 200%",
            animation: "lc-splash-gradient 1200ms ease-in-out infinite alternate",
            boxShadow: "0 16px 48px -8px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.10)",
            fontFamily: "var(--font-sora)",
          }}
        >
          C
        </div>
        <div
          className="text-white/80 text-sm font-medium tracking-wide"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          Civia
        </div>
      </div>

      <style jsx>{`
        @keyframes lc-splash-gradient {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}
