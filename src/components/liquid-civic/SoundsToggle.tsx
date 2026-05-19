"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { soundsEnabled, setSoundsEnabled, playSound } from "@/lib/liquid-civic/sound";

/**
 * Toggle pentru sunete UI discrete (opt-in).
 * Default off. Click → toggle + plays preview „toggle" sound.
 */
export function SoundsToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(soundsEnabled());
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setSoundsEnabled(next);
    setEnabled(next);
    // Preview sound (only when turning ON)
    if (next) {
      // Slight delay to ensure setting saved before playSound reads it
      setTimeout(() => playSound("toggle"), 50);
    }
  };

  if (!mounted) {
    return (
      <div className="h-11 w-full rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse" />
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      role="switch"
      aria-checked={enabled}
      className="w-full inline-flex items-center justify-between gap-3 h-12 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <span className="inline-flex items-center gap-2.5 text-sm text-[var(--color-text)]">
        {enabled ? (
          <Volume2 size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        ) : (
          <VolumeX size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" />
        )}
        <span className="font-medium">Sunete UI</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {enabled ? "activate" : "dezactivate"}
        </span>
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-2)]"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
