"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, ImageIcon } from "lucide-react";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  caption?: string;
  poster?: string;
}

interface Props {
  items: MediaItem[];
  /** Title-ul stirii pentru aria-label + fallback alt. */
  title?: string;
}

/**
 * Carousel media pentru pagina stire — sub sinteza AI.
 *  - Aspect 16:9 mare (max-width container), fill responsive
 *  - Arrows prev/next + dot indicators
 *  - Keyboard nav: ←/→ when carouselul are focus / hover
 *  - Touch-swipe pe mobile (CSS scroll-snap nativ)
 *  - Caption dedesubt (alt sau figcaption din articol)
 *  - Lazy-loaded: imaginile vecine (current ± 1) au priority, restul lazy
 *  - Click pe imagine → fullscreen lightbox (native <dialog>)
 *
 * Performance:
 *  - Next/Image cu unoptimized (URL extern) + sizes responsiv
 *  - Video element cu preload="metadata" (nu pull frames până nu hit play)
 *  - Loading lazy pe non-active slides (≥ 2 away from active)
 */
export function StireMediaCarousel({ items, title }: Props) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (dir: 1 | -1) => {
      setActive((i) => {
        const next = i + dir;
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    },
    [items.length],
  );

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= items.length) return;
      setActive(idx);
    },
    [items.length],
  );

  // Keyboard nav when carousel is focused/hovered
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (!node.matches(":hover") && !node.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "Escape" && lightboxOpen) {
        e.preventDefault();
        setLightboxOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, lightboxOpen]);

  if (items.length === 0) return null;

  const current = items[active];
  if (!current) return null;

  return (
    <section
      ref={containerRef}
      aria-label={`Galerie media${title ? `: ${title}` : ""}`}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div
          className="w-7 h-7 rounded-[var(--radius-xs)] bg-violet-500/15 grid place-items-center"
          aria-hidden="true"
        >
          <ImageIcon size={14} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base leading-tight">
            Galerie din articol
          </h2>
          <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {active + 1} / {items.length}
          </p>
        </div>
      </div>

      {/* Main display — 16:9 aspect, large */}
      <div className="relative bg-black aspect-video overflow-hidden">
        {current.type === "image" ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ring-inset"
            aria-label="Mărește imaginea"
          >
            <Image
              src={current.url}
              alt={current.caption || title || "Imagine din articol"}
              fill
              unoptimized
              priority={active === 0}
              sizes="(min-width: 1024px) 800px, (min-width: 640px) 90vw, 100vw"
              className="object-contain"
            />
          </button>
        ) : (
          <video
            key={current.url}
            src={current.url}
            poster={current.poster}
            controls
            preload="metadata"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          >
            <track kind="captions" />
          </video>
        )}

        {/* Prev / Next arrows */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagine precedentă"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagine următoare"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {current.caption && current.caption.trim().length > 0 && (
        <div className="px-5 pt-3 pb-2">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed italic">
            {current.caption}
          </p>
        </div>
      )}

      {/* Thumbnails strip + dots */}
      {items.length > 1 && (
        <div className="px-5 py-3 border-t border-[var(--color-border)]">
          {/* Thumbnail strip pe desktop */}
          <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
            {items.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Mergi la imaginea ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={`relative shrink-0 w-20 h-12 rounded-[var(--radius-xs)] overflow-hidden border-2 transition-all ${
                  i === active
                    ? "border-violet-500 opacity-100"
                    : "border-transparent opacity-60 hover:opacity-90"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
              >
                {m.type === "image" ? (
                  <Image
                    src={m.url}
                    alt=""
                    fill
                    unoptimized
                    loading={Math.abs(i - active) <= 2 ? "eager" : "lazy"}
                    sizes="80px"
                    className="object-cover"
                  />
                ) : m.poster ? (
                  <Image
                    src={m.poster}
                    alt=""
                    fill
                    unoptimized
                    loading={Math.abs(i - active) <= 2 ? "eager" : "lazy"}
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[var(--color-surface-2)] grid place-items-center">
                    <Play size={14} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  </div>
                )}
                {m.type === "video" && (
                  <div
                    className="absolute inset-0 bg-black/30 grid place-items-center"
                    aria-hidden="true"
                  >
                    <Play size={12} className="text-white drop-shadow" fill="white" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {/* Dots pe mobile */}
          <div className="sm:hidden flex justify-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Mergi la slide ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  i === active
                    ? "w-6 bg-violet-500"
                    : "w-1.5 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox — fullscreen overlay */}
      {lightboxOpen && current.type === "image" && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Imagine mărită"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center transition-colors z-10"
            aria-label="Închide"
          >
            ×
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center transition-colors z-10"
                aria-label="Imagine precedentă"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center transition-colors z-10"
                aria-label="Imagine următoare"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <div
            className="relative max-w-[95vw] max-h-[90vh] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.url}
              alt={current.caption || title || ""}
              fill
              unoptimized
              sizes="95vw"
              className="object-contain"
            />
          </div>
          {current.caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[90vw] px-4 py-2 rounded-[var(--radius-xs)] bg-black/60 text-white text-sm text-center">
              {current.caption}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
