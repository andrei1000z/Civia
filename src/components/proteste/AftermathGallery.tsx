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
 *
 * Safety net: dacă o poză eșuează la load (404, hotlink-protect, CDN
 * down etc.), o ascundem complet din UI și o eliminăm și din lightbox-
 * ul navigabil. Validarea de pe server (filterValidMedia) ar trebui să
 * prindă majoritatea, dar URL-urile vechi din DB pre-validare pot fi
 * încă acolo, plus că hotlink-protection se poate schimba în orice
 * moment fără ca noi să fim notificați.
 */
export function AftermathGallery({ images }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  const visibleImages = images.filter((img) => !brokenUrls.has(img.url));

  if (visibleImages.length === 0) return null;

  const urls = visibleImages.map((img) => img.url);

  function handleError(url: string) {
    setBrokenUrls((s) => {
      const next = new Set(s);
      next.add(url);
      return next;
    });
    // Dacă lightbox-ul era deschis pe poza spartă, închide-l (URL-ul nu
    // mai există în lista filtrată). React va re-render automat.
  }

  return (
    <>
      <div>
        <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
          <Camera size={14} aria-hidden="true" />
          Galerie ({visibleImages.length})
        </h3>
        <div className="columns-2 sm:columns-3 gap-2 [column-fill:_balance]">
          {visibleImages.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="group relative block w-full mb-2 break-inside-avoid overflow-hidden rounded-[var(--radius-sm)] cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label={`Deschide poza ${i + 1} din ${visibleImages.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption ?? `Foto ${i + 1}`}
                loading="lazy"
                onError={() => handleError(img.url)}
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

      {lightboxIndex !== null && lightboxIndex < urls.length && (
        <ImageLightbox
          urls={urls}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          // URL-uri externe de presă (CDN-uri terțe) — la fel ca thumbnail-urile
          // raw de mai sus; optimizer-ul Next ar face fetch server-side și unele
          // CDN-uri dau 403 la hotlinking. Le ținem raw, dar tot cu spinner+onError.
          unoptimized
        />
      )}
    </>
  );
}
