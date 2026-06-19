"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * 2026-06-19 — <Image> cu fallback grațios la imagine SPARTĂ sau LIPSĂ (onError) —
 * în loc de cutie goală / glyph de „imagine ruptă", arată un placeholder discret.
 * Necesar pentru URL-uri externe efemere (cover-uri Facebook CDN care expiră,
 * after-photos vechi mutate din storage etc.). Funcționează cu `fill`.
 */
export function SafeImage({
  fallbackClassName,
  fallbackIconSize = 28,
  ...props
}: ImageProps & { fallbackClassName?: string; fallbackIconSize?: number }) {
  const [broken, setBroken] = useState(false);

  if (broken || !props.src) {
    return (
      <div
        className={`grid place-items-center bg-[var(--color-surface-2)] ${props.fill ? "absolute inset-0" : ""} ${fallbackClassName ?? ""}`}
        aria-hidden="true"
      >
        <ImageOff size={fallbackIconSize} className="text-[var(--color-text-muted)]/40" />
      </div>
    );
  }

  return <Image {...props} onError={() => setBroken(true)} />;
}
