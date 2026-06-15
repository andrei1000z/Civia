"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "civia:splash-shown-v1";
const ENTER_MS = 440; // logo reveal
const HOLD_MS = 380; // hold
const EXIT_MS = 420; // fade out

/**
 * First-load splash — Civia logo cu glass-card + emerald→aqua liquid morph,
 * glow și pulse-ring (look iOS 26 / One UI launch screen).
 *
 * - PWA STANDALONE → animație de „app launch" la fiecare cold-launch (sesiune).
 * - Web → o singură dată per browser (nederanjant pt. vizitatori recurenți).
 * - Skippable la tap/click. Respectă prefers-reduced-motion (guard global CSS).
 */
export function FirstLoadSplash() {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      // standalone → sessionStorage (revine la fiecare lansare a aplicației);
      // web → localStorage (o singură dată ever).
      const store = standalone ? window.sessionStorage : window.localStorage;
      const key = standalone ? "civia:splash-session" : SPLASH_KEY;
      if (store.getItem(key)) return;
      store.setItem(key, "1");
      setShow(true);
      const toExit = setTimeout(() => setExiting(true), ENTER_MS + HOLD_MS);
      const toRemove = setTimeout(() => setShow(false), ENTER_MS + HOLD_MS + EXIT_MS);
      return () => {
        clearTimeout(toExit);
        clearTimeout(toRemove);
      };
    } catch {
      // storage blocat (Safari private) — nu arăta, evită bucle.
    }
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      onClick={() => setExiting(true)}
      className="civia-splash"
      data-exiting={exiting}
    >
      <div className="civia-splash-inner" data-exiting={exiting}>
        <div className="civia-splash-logoWrap">
          <span className="civia-splash-ring" aria-hidden="true" />
          <span className="civia-splash-ring civia-splash-ring2" aria-hidden="true" />
          <div className="civia-splash-logo">C</div>
        </div>
        <div className="civia-splash-word">Civia</div>
      </div>

      <style jsx>{`
        .civia-splash {
          position: fixed;
          inset: 0;
          z-index: 400;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: radial-gradient(
            120% 120% at 50% 38%,
            rgba(16, 185, 129, 0.18),
            rgba(8, 10, 12, 0.97) 70%
          );
          backdrop-filter: blur(12px) saturate(160%);
          -webkit-backdrop-filter: blur(12px) saturate(160%);
          opacity: 1;
          transition: opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .civia-splash[data-exiting="true"] {
          opacity: 0;
          pointer-events: none;
        }

        .civia-splash-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          animation: splash-rise ${ENTER_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transition: transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .civia-splash-inner[data-exiting="true"] {
          transform: scale(1.08);
        }
        @keyframes splash-rise {
          from {
            opacity: 0;
            transform: scale(0.86);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .civia-splash-logoWrap {
          position: relative;
          width: 96px;
          height: 96px;
        }
        .civia-splash-logo {
          position: relative;
          z-index: 1;
          width: 96px;
          height: 96px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 3rem;
          font-weight: 800;
          font-family: var(--font-sora);
          background: linear-gradient(135deg, #10b981 0%, #22d3ee 100%);
          background-size: 200% 200%;
          animation: splash-grad 1600ms ease-in-out infinite alternate;
          box-shadow:
            0 24px 60px -10px rgba(16, 185, 129, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        @keyframes splash-grad {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }

        .civia-splash-ring {
          position: absolute;
          inset: 0;
          border-radius: 28px;
          border: 1px solid rgba(16, 185, 129, 0.5);
          animation: splash-ring 1500ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        .civia-splash-ring2 {
          animation-delay: 600ms;
        }
        @keyframes splash-ring {
          0% {
            transform: scale(1);
            opacity: 0.55;
          }
          100% {
            transform: scale(1.85);
            opacity: 0;
          }
        }

        .civia-splash-word {
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          font-family: var(--font-sora);
          animation: splash-word 520ms ease-out 170ms both;
        }
        @keyframes splash-word {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
