"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";
import type { AftermathImage } from "@/lib/proteste/aftermath";

interface Props {
  images: AftermathImage[];
}

/**
 * Gallery client component. Masonry CSS columns ca să păstrăm aspect-
 * ratio-ul natural al fiecărei poze + ImageLightbox la click (la fel
 * ca pe sesizari) cu navigare săgeți + Esc pentru închidere.
 */
export function AftermathGallery({ images }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const urls = images.map((img) => img.url);

  return (
    <>
      <div>
        <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
          <Camera size={14} aria-hidden="true" />
          Galerie ({images.length})
        </h3>
        <div className="columns-2 sm:columns-3 gap-2 [column-fill:_balance]">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="group relative block w-full mb-2 break-inside-avoid overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label={`Deschide poza ${i + 1} din ${images.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption ?? `Foto ${i + 1}`}
                loading="lazy"
                className="w-full h-auto block group-hover:opacity-90 transition-opacity duration-300"
              />
              {img.credit && (
                <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-[9px] text-white bg-gradient-to-t from-black/80 to-transparent text-left">
                  Foto: {img.credit}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          urls={urls}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
