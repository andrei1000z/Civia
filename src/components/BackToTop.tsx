"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 600);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      data-floating
      onClick={() => {
        // Respect prefers-reduced-motion — instant scroll for users
        // with vestibular issues instead of the smooth animation.
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className={cn(
        "liquid-glass fixed bottom-24 left-6 z-30 w-11 h-11 rounded-full shadow-[var(--shadow-lg)] flex items-center justify-center text-[var(--color-text)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      )}
      aria-label="Înapoi la începutul paginii"
      title="Sus"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={18} aria-hidden="true" />
    </button>
  );
}
