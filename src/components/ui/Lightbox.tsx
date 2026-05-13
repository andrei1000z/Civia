"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X as CloseX, ExternalLink, Download, FileText } from "lucide-react";

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
   * Download fix (raportat user 5/13/2026 — pe telefon, click pe „Descarcă"
   * deschidea imaginea într-un tab nou în loc s-o salveze).
   *
   * Cauza: atribut `<a download>` nu funcționează cross-origin (Supabase
   * Storage e alt origin). Browser-ul ignoră hint-ul + navighează.
   *
   * Fix: fetch + blob + click on dynamic <a> cu blob: URL (same-origin
   * automat) → salvare reală pe disk/Photos pe mobil.
   */
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const filename = url.split("/").pop()?.split("?")[0] || `civia-${Date.now()}.jpg`;
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Eliberăm memoria — chrome cleanup la 60s, dar revoke-uim noi pentru safety.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fallback: deschide în tab nou — utilizatorul poate face long-press save manual.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-stretch justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
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
              className="w-full h-full min-h-[60vh]"
              // Browsers refuse PDFs in iframes if the host serves
              // X-Frame-Options: DENY. Supabase storage serves them
              // permissively; if that ever changes, the "Tab nou"
              // button is a perfect fallback.
            />
          ) : (
            <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center p-2">
              <Image
                src={url}
                alt={title ?? "Imagine"}
                width={1600}
                height={1200}
                className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
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
