"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/**
 * 2026-05-25 — Share button native (Web Share API + clipboard fallback).
 *
 * Mobile (iOS Safari, Chrome Android): deschide system share sheet
 * (Twitter, WhatsApp, Mail, etc.).
 * Desktop / no support: copy link to clipboard cu feedback vizual.
 *
 * Variant "ghost" (default) — folosit în hero. Variant "pill" pentru
 * sticky bottom bar.
 */
export function ShareProtestButton({
  url,
  title,
  text,
  variant = "ghost",
  size = "md",
}: {
  url: string;
  title: string;
  text?: string;
  variant?: "ghost" | "pill";
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData: ShareData = {
      title,
      text: text || title,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled OR API not allowed in current context → fallback
      }
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard either — open mailto: as last resort
      window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    }
  };

  const base = "inline-flex items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2";
  const sizeCls = size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm";
  const variantCls =
    variant === "pill"
      ? "rounded-[var(--radius-full)] bg-white text-[var(--color-text)] font-semibold shadow-[var(--shadow-2)] hover:bg-white/95 active:scale-[0.97]"
      : "rounded-[var(--radius-pill)] bg-white/15 backdrop-blur-sm text-white font-medium border border-white/30 hover:bg-white/25";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Distribuie"
      className={`${base} ${sizeCls} ${variantCls}`}
    >
      {copied ? (
        <>
          <Check size={14} aria-hidden="true" />
          <span>Copiat</span>
        </>
      ) : (
        <>
          <Share2 size={14} aria-hidden="true" />
          <span>Distribuie</span>
        </>
      )}
    </button>
  );
}
