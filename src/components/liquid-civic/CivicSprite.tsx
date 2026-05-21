"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Tipul milestone-ului — controleaza mesajul + emoji. */
  type: "first-sesizare" | "streak-3" | "streak-7" | "streak-30" | "resolved" | "cosign-10";
  /** Persistent flag — daca am aratat deja pentru acest tip in session/localStorage. */
  persistentKey?: string;
}

const MESSAGES: Record<Props["type"], { emoji: string; title: string; subtitle: string }> = {
  "first-sesizare": {
    emoji: "🌱",
    title: "Prima ta sesizare!",
    subtitle: "Felicitări — ai făcut primul pas civic.",
  },
  "streak-3": {
    emoji: "🔥",
    title: "Streak 3 zile!",
    subtitle: "Three days. Cetățean dedicat.",
  },
  "streak-7": {
    emoji: "🚀",
    title: "Streak o săptămână!",
    subtitle: "Tu ești schimbarea pe care vrei să o vezi.",
  },
  "streak-30": {
    emoji: "💎",
    title: "Streak o lună!",
    subtitle: "Top 1% cetățeni Civia.",
  },
  resolved: {
    emoji: "🎉",
    title: "Sesizare rezolvată!",
    subtitle: "Ai schimbat ceva real. Mulțumim.",
  },
  "cosign-10": {
    emoji: "🤝",
    title: "10 cosemnaturi pe sesizările tale!",
    subtitle: "Comunitatea te urmează.",
  },
};

/**
 * Civic Sprite — mascot mic animat care apare la milestone-uri.
 *
 * Auto-dismiss after 5s, click to dismiss. Spring entrance + confetti
 * particles. Persistent flag previne arat de mai multe ori per tip.
 */
export function CivicSprite({ type, persistentKey }: Props) {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);
  const msg = MESSAGES[type];

  useEffect(() => {
    if (persistentKey) {
      try {
        const seen = localStorage.getItem(`civia:sprite:${persistentKey}`);
        if (seen) return;
        localStorage.setItem(`civia:sprite:${persistentKey}`, "1");
      } catch {
        // localStorage blocked — show anyway
      }
    }
    // Timings sprite-animation: show dupa 400ms (sa nu calce content fresh),
    // exit start 5000ms dupa show (~5s visible), unmount 500ms dupa exit
    // (cat dureaza animatia CSS de exit).
    const SPRITE_SHOW_DELAY_MS = 400;
    const SPRITE_EXIT_DELAY_MS = 5400;
    const SPRITE_REMOVE_DELAY_MS = 5900;
    const showTimer = setTimeout(() => setShow(true), SPRITE_SHOW_DELAY_MS);
    const exitTimer = setTimeout(() => setExiting(true), SPRITE_EXIT_DELAY_MS);
    const removeTimer = setTimeout(() => setShow(false), SPRITE_REMOVE_DELAY_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [persistentKey]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setExiting(true)}
      className="fixed bottom-6 right-6 z-[180] max-w-xs cursor-pointer select-none"
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(20px) scale(0.95)" : "translateY(0) scale(1)",
        transition: "all 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <div
        className="lc-glass-3 rounded-2xl p-4 pr-5 flex items-center gap-3"
        style={{ borderRadius: "20px" }}
      >
        <div
          className="text-4xl shrink-0"
          style={{
            animation: "lc-sprite-bounce 2s ease-in-out infinite",
            transformOrigin: "center bottom",
          }}
          aria-hidden="true"
        >
          {msg.emoji}
        </div>
        <div className="min-w-0">
          <div
            className="font-bold text-sm text-[var(--color-text)] leading-tight"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {msg.title}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">
            {msg.subtitle}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes lc-sprite-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
