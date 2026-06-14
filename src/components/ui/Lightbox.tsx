"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X as CloseX, ExternalLink, Download, FileText } from "lucide-react";
import { downloadImageAsJpeg } from "@/lib/image-download";

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** Public URL of the asset to preview. */
  url: string;
  /** Override the auto-detection. Useful when the URL doesn't expose
   *  the extension (signed URLs, hashed paths, etc). */
  kind?: "image" | "pdf" | "auto";
  /** Optional caption rendered above the asset. */
  caption?: string;
  /** Optional title shown in the header bar. */
  title?: string;
}

function detectKind(url: string): "image" | "pdf" {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".pdf")) return "pdf";
  } catch {
    if (url.toLowerCase().includes(".pdf")) return "pdf";
  }
  return "image";
}

/**
 * Modal in-tab preview for images + PDFs. Replaces the previous
 * "open in new tab" behaviour for proof attachments. Honors Esc, locks
 * body scroll, click-outside-to-close, and renders PDFs via the
 * browser's native PDF viewer through an `<iframe>`.
 */
export function Lightbox({ open, onClose, url, kind = "auto", caption, title }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the dialog so the close button + actions are reachable via Tab.
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const resolvedKind = kind === "auto" ? detectKind(url) : kind;
  const isPdf = resolvedKind === "pdf";

  /**
   * Download: delega la helper-ul shared care face fetch → blob → canvas
   * convert la JPEG → trigger <a download> pe object URL. Cauza istorica:
   *  - <a download> cross-origin (Supabase Storage) e ignorat de browser
   *  - webp-ul nu apare in galeria foto Android/iOS pentru multi useri
   * Helper-ul rezolva ambele intr-un singur loc reutilizabil.
   */
  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isPdf) {
      // PDF-urile le lasam asa cum sunt — fara conversie, doar trigger
      // download standard. Daca Supabase serveste cu Content-Disposition
      // potrivit, browser-ul salveaza direct.
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    void downloadImageAsJpeg(url);
  };

  return (
    <div
      // safe-area-inset pentru iOS landscape — notch + home indicator nu mai
      // taie din header/footer-ul dialog-ului. Min 16px ca p-4 garantat.
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      className="fixed inset-0 z-[var(--z-modal)] flex items-stretch justify-center bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Previzualizare dovadă"}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] border border-[var(--color-border)] overflow-hidden flex flex-col outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-7 h-7 rounded-[var(--radius-xs)] grid place-items-center shrink-0 ${
                isPdf
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
              }`}
              aria-hidden="true"
            >
              <FileText size={14} />
            </span>
            <p className="text-sm font-semibold truncate">
              {title ?? (isPdf ? "Document PDF" : "Imagine")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[var(--radius-xs)] text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              title="Deschide în tab nou"
            >
              <ExternalLink size={12} aria-hidden="true" />
              Tab nou
            </a>
            <a
              href={url}
              onClick={handleDownload}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[var(--radius-xs)] text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              title="Descarcă fișierul"
            >
              <Download size={12} aria-hidden="true" />
              Descarcă
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Închide previzualizarea"
            >
              <CloseX size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        {caption && (
          <p className="px-4 py-2 text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            {caption}
          </p>
        )}
        <div className="relative flex-1 min-h-0 bg-[#0b0b0d] grid place-items-center overflow-hidden">
          {isPdf ? (
            <iframe
              src={url}
              title={title ?? "PDF"}
              className="w-full h-full min-h-[60dvh]"
              // Browsers refuse PDFs in iframes if the host serves
              // X-Frame-Options: DENY. Supabase storage serves them
              // permissively; if that ever changes, the "Tab nou"
              // button is a perfect fallback.
            />
          ) : (
            <div className="relative w-full h-full max-h-[80dvh] flex items-center justify-center p-2">
              <Image
                src={url}
                alt={title ?? "Imagine"}
                width={1600}
                height={1200}
                className="max-w-full max-h-[80dvh] w-auto h-auto object-contain"
                unoptimized
                priority
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
