"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import {
  MAX_UPLOAD_BYTES,
  COMPRESS_THRESHOLD_BYTES,
  MAX_IMAGE_DIMENSION,
} from "@/lib/constants";

interface DocumentUploaderProps {
  /** Public URL of the currently attached document (image or PDF), or
   *  null when nothing is attached. */
  url: string | null;
  /** Notified with the new public URL on success, or null on remove. */
  onChange: (url: string | null) => void;
}

const PDF_MAX_BYTES = 15 * 1024 * 1024;

/** Image-only compression mirrors PhotoUploader. PDFs are uploaded as-is. */
async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(MAX_IMAGE_DIMENSION / w, MAX_IMAGE_DIMENSION / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }),
            );
          },
          "image/jpeg",
          0.82,
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function uploadWithProgress(
  fd: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload?kind=document");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { error: "Răspuns invalid de la server" };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: { error: "Eroare de rețea" } });
    xhr.send(fd);
  });
}

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

export function DocumentUploader({ url, onChange }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  // Reset error when the parent clears the URL — keeps the UI clean
  // after a remove/retry cycle.
  useEffect(() => {
    if (!url && !busy) setError(null);
  }, [url, busy]);

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setError(null);

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Doar imagini (JPG/PNG/WebP/GIF) sau PDF sunt acceptate.");
      return;
    }

    const cap = isPdf ? PDF_MAX_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > cap) {
      setError(
        `Fișierul depășește ${Math.round(cap / 1024 / 1024)}MB. Comprimă-l sau alege altul.`,
      );
      return;
    }

    setBusy(true);
    setProgress(0);
    setFilename(file.name);

    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const fd = new FormData();
      fd.append("files", toUpload);
      const res = await uploadWithProgress(fd, setProgress);
      if (!res.ok) {
        const msg =
          (res.body as { error?: string })?.error ?? `Eroare upload (${res.status})`;
        throw new Error(msg);
      }
      const newUrl = (res.body as { data?: { urls?: string[] } })?.data?.urls?.[0];
      if (!newUrl) throw new Error("Răspuns invalid de la server");
      onChange(newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare upload");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    onChange(null);
    setFilename(null);
    setError(null);
  };

  if (url) {
    const pdf = isPdfUrl(url);
    return (
      <div className="rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 flex items-center gap-3">
        <span
          className={`w-10 h-10 rounded-[var(--radius-xs)] grid place-items-center shrink-0 ${
            pdf
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              : "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
          }`}
          aria-hidden="true"
        >
          {pdf ? <FileText size={18} /> : <ImageIcon size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline decoration-dotted underline-offset-2 hover:text-[var(--color-primary)] truncate block"
            title={filename ?? url}
          >
            {filename ?? (pdf ? "Document atașat (PDF)" : "Imagine atașată")}
          </a>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {pdf ? "PDF" : "Imagine"} · click pentru a deschide
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-rose-600 hover:border-rose-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Elimină documentul atașat"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={pickFile}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Trimit... {progress}%
          </>
        ) : (
          <>
            <Upload size={14} aria-hidden="true" />
            Atașează poză sau PDF
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={onSelected}
        className="hidden"
      />
      {error && (
        <p role="alert" className="text-[11px] text-rose-600 mt-1.5">
          {error}
        </p>
      )}
      <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
        Formatul ideal: o poză cu intervenția sau un PDF cu emailul de la
        instituție. Max {Math.round(PDF_MAX_BYTES / 1024 / 1024)}MB pentru PDF,{" "}
        {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB pentru imagini.
      </p>
    </div>
  );
}
