"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadImageAsJpeg } from "@/lib/image-download";

interface Props {
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({ urls, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const prev = useCallback(() => setIndex((i) => (i - 1 + urls.length) % urls.length), [urls.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % urls.length), [urls.length]);

  useEffect(() => {
    // Save who had focus before lightbox opened, so screen-reader users
    // (and keyboard users) land back where they were on close instead of
    // on <body>.
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    // 2026-06-19 (audit #14) — mută focus ÎN dialog (altfel rămâne pe pagina de
    // dedesubt, ascunsă de overlay — WCAG 2.4.3) + capcană de Tab.
    const root = dialogRef.current;
    root?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") { prev(); return; }
      if (e.key === "ArrowRight") { next(); return; }
      if (e.key === "Tab" && root) {
        const f = root.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]");
        if (f.length === 0) { e.preventDefault(); return; }
        const first = f[0]!;
        const last = f[f.length - 1]!;
        const act = document.activeElement;
        if (e.shiftKey && (act === first || act === root)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus?.();
    };
  }, [prev, next, onClose]);

  if (urls.length === 0) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in focus:outline-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagine ${index + 1} din ${urls.length}`}
    >
      <div
        className="absolute right-4 flex gap-2 z-10"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const url = urls[index];
            if (url) void downloadImageAsJpeg(url);
          }}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
          aria-label="Salvează imaginea"
          title="Salvează imaginea"
        >
          <Download size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Închide galeria (Esc)"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`Imaginea anterioară (săgeată stânga)`}
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`Imaginea următoare (săgeată dreapta)`}
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt={`Imagine ${index + 1} din ${urls.length}`}
        className="max-w-full max-h-[90dvh] object-contain rounded-[var(--radius-xs)]"
        onClick={(e) => e.stopPropagation()}
      />
      {urls.length > 1 && (
        <p
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium backdrop-blur tabular-nums"
          aria-live="polite"
        >
          {index + 1} / {urls.length}
        </p>
      )}
    </div>
  );
}
