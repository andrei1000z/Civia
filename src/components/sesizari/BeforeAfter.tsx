"use client";

import { useState } from "react";
import { CheckCircle2, ImageOff } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { formatDateTime } from "@/lib/utils";
import { trackCustomEvent } from "@/components/analytics/CiviaTracker";

interface Props {
  /** Prima poză din sesizare — folosită ca „înainte". */
  beforeUrl: string;
  /** Poza încărcată de autor la marcarea ca rezolvată. Null când lipsește. */
  afterUrl: string | null;
  resolvedAt: string | null;
  /** Când e author + status=rezolvat dar afterUrl lipsește, afișăm CTA
   *  „Adaugă poza «după»". Componenta nu manage upload-ul direct —
   *  parent-ul deja are MarkResolvedButton care suportă re-upload. */
  isAuthor?: boolean;
}

export function BeforeAfter({ beforeUrl, afterUrl, resolvedAt, isAuthor }: Props) {
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const lightboxUrls = afterUrl ? [beforeUrl, afterUrl] : [beforeUrl];

  const openLightbox = (index: number) => {
    setLightbox({ urls: lightboxUrls, index });
    // 2026-05-25 — semnalul engagement pe galeria de dovezi vizuale.
    trackCustomEvent("before-after-view", {
      hasAfter: afterUrl ? "yes" : "no",
      index,
    });
  };

  return (
    <>
      <section
        aria-label="Comparație înainte / după"
        className="relative bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-teal-50/40 dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-teal-950/20 border border-emerald-300/60 dark:border-emerald-800/60 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6 overflow-hidden"
      >
        {/* Decorative corner glow */}
        <span
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none"
        />
        <div className="relative flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)] bg-emerald-500 text-white text-xs font-bold shadow-sm">
            <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden="true" />
            Rezolvat
          </span>
          {resolvedAt && (
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
              {formatDateTime(resolvedAt)}
            </span>
          )}
          <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
            Dovadă vizuală
          </span>
        </div>

        <div className="relative grid grid-cols-2 gap-3 md:gap-4 items-start">
          {/* BEFORE */}
          <figure>
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
              Înainte
            </p>
            <button
              type="button"
              onClick={() => openLightbox(0)}
              aria-label={`Vezi poza „înainte" la mărime mare`}
              className="w-full rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-2)] block group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ring-1 ring-rose-300/40 dark:ring-rose-900/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={beforeUrl}
                alt="Starea problemei înainte de rezolvare"
                className="w-full h-auto max-h-[70dvh] object-contain group-hover:scale-[1.03] transition-transform duration-500"
                loading="lazy"
              />
              <span
                className="absolute top-2 left-2 bg-rose-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-full)] shadow-sm"
                aria-hidden="true"
              >
                BEFORE
              </span>
            </button>
          </figure>

          {/* AFTER (sau placeholder) */}
          <figure>
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              După
            </p>
            {afterUrl ? (
              <button
                type="button"
                onClick={() => openLightbox(1)}
                aria-label={`Vezi poza „după" la mărime mare`}
                className="w-full rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-2)] block group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ring-1 ring-emerald-300/40 dark:ring-emerald-900/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={afterUrl}
                  alt="Starea după rezolvare — dovadă vizuală"
                  className="w-full h-auto max-h-[70dvh] object-contain group-hover:scale-[1.03] transition-transform duration-500"
                  loading="lazy"
                />
                <span
                  className="absolute top-2 left-2 bg-emerald-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-full)] shadow-sm"
                  aria-hidden="true"
                >
                  AFTER
                </span>
              </button>
            ) : (
              <div
                role="img"
                aria-label="Poza «după» nu a fost încărcată încă"
                className="aspect-video w-full rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border-2 border-dashed border-emerald-300/60 dark:border-emerald-800/60 flex flex-col items-center justify-center gap-2 p-3 text-center"
              >
                <ImageOff size={20} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                  {isAuthor
                    ? `Încarcă o poză cu rezultatul ca să închidem perfect ciclul „before/after".`
                    : "Autorul nu a încărcat încă o poză cu rezultatul."}
                </p>
              </div>
            )}
          </figure>
        </div>
      </section>

      {lightbox && (
        <ImageLightbox
          urls={lightbox.urls}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
