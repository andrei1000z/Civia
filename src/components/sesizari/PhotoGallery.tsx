"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImgIcon, Download } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { downloadImageAsJpeg } from "@/lib/image-download";

interface Props {
  urls: string[];
  title?: string;
}

export function PhotoGallery({ urls, title = "Foto" }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const validUrls = urls.filter((u) => u.startsWith("http"));
  if (validUrls.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {urls.map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] flex items-center justify-center"
            aria-hidden="true"
          >
            <ImgIcon size={24} className="text-[var(--color-text-muted)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-3"
        role="list"
        aria-label={`Galerie ${title.toLowerCase()} (${validUrls.length} ${validUrls.length === 1 ? "imagine" : "imagini"})`}
      >
        {validUrls.map((url, i) => (
          <div
            key={i}
            role="listitem"
            className="group relative aspect-square rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] overflow-hidden hover:ring-2 hover:ring-[var(--color-primary)] transition-all"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
              aria-label={`Deschide ${title} ${i + 1} din ${validUrls.length} la mărime mare`}
            >
              <span className="sr-only">Mărește imaginea</span>
            </button>
            {/* 2026-06-24 — next/image (înlocuiește <img> brut): optimizare
                AVIF/WebP + resize la dimensiunea reală a celulei (~jumătate de
                lățime pe mobil). Înainte se descărca JPEG-ul full-res din Storage
                = megabytes inutili pe 4g (53% din trafic). object-cover umple
                celula pătrată indiferent de orientare; lightbox-ul deschide tot
                full-res la click, deci nu se pierde contextul. */}
            <Image
              src={url}
              alt={`${title} ${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover group-hover:scale-[1.03] transition-transform pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium bg-black/60 rounded-full px-3 py-1 transition-opacity">
                Click pentru mărire
              </span>
            </div>
            {/* Download button — z-20 ca să fie peste butonul de mărire.
                44×44 tap target (WCAG AAA) — pe mobile, tactil tap area
                contează mai mult decât silueta vizuală. Pe pointer:fine
                rămâne hidden until hover, pe touch e mereu visible. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void downloadImageAsJpeg(url, `${title}-${i + 1}`);
              }}
              className="absolute top-2 right-2 z-20 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/80 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
              aria-label={`Salvează ${title} ${i + 1}`}
            >
              <Download size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {openIndex !== null && (
        <ImageLightbox
          urls={validUrls}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
