"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Loader2, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import {
  MAX_UPLOAD_BYTES as MAX_BYTES,
  COMPRESS_THRESHOLD_BYTES as COMPRESS_THRESHOLD,
  MAX_IMAGE_DIMENSION as MAX_DIMENSION,
} from "@/lib/constants";

interface PhotoUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

async function compressImage(file: File): Promise<File> {
  // 2026-05-24 Faza 5 (security): always re-encode prin canvas pentru EXIF strip.
  // Înainte: skip-uiam fișiere <1.5MB → EXIF inclusiv GPS coordinates rămânea în
  // imaginea uploaded → leak adresa user-ului. Acum: forțăm canvas pass pe TOT
  // pentru a garanta zero metadate (canvas.toBlob nu preserva EXIF).
  // Pentru fișiere mici, folosim quality 0.92 (vs 0.82 pentru big) ca quality loss
  // să fie minim.
  if (!file.type.startsWith("image/")) return file;
  const isLarge = file.size > COMPRESS_THRESHOLD;
  const quality = isLarge ? 0.82 : 0.92;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (isLarge && (w > MAX_DIMENSION || h > MAX_DIMENSION)) {
          const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        }, "image/jpeg", quality);
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
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); } catch { body = { error: `HTTP ${xhr.status}` }; }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: { error: "Eroare rețea" } });
    xhr.send(fd);
  });
}

// Pending item: a locally previewed photo that hasn't finished uploading
// yet. We show it in the grid immediately so the form doesn't feel like
// it's frozen while Supabase chew on the file.
interface Pending {
  id: string;
  objectUrl: string;
  progress: number; // 0-100
  error?: string;
}

export function PhotoUploader({ urls, onChange, max = 5 }: PhotoUploaderProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 2026-06-06 (audit #43) — feedback când poze sunt ignorate (peste limită) sau
  // s-a atins maximul. Înainte: slice silențios → userul credea că s-au adăugat
  // toate, deși unele erau aruncate fără niciun semn.
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 2026-05-26 — Input separat pentru cameră (capture="environment").
  // Buton dedicat pe mobile ca user-ul să poată alege explicit „fă poza
  // acum" vs „aleg din galerie". Default input fără capture → picker
  // nativ cu toate opțiunile.
  const cameraRef = useRef<HTMLInputElement>(null);

  // 2026-05-24 Faza 4: Auto-trigger camera când URL conține ?camera=1.
  // QuickCameraCTA de pe homepage trimite cu acest param → user ajunge direct
  // în camera nativă fără tap extra. Mobile-only (camera permission prompt).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("camera") !== "1") return;
    // Wait one tick pentru ca inputRef.current să fie atașat
    const t = setTimeout(() => inputRef.current?.click(), 100);
    // Curăță param după click ca să nu re-trigger la navigation back.
    const url = new URL(window.location.href);
    url.searchParams.delete("camera");
    window.history.replaceState({}, "", url.toString());
    return () => clearTimeout(t);
  }, []);

  // Lightbox: Escape closes, ←/→ navigate, body scroll locked while open.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowLeft" && lightbox > 0) setLightbox(lightbox - 1);
      else if (e.key === "ArrowRight" && lightbox < urls.length - 1) setLightbox(lightbox + 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, urls.length]);

  // Revoke any leftover object URLs when the component unmounts — otherwise
  // the blobs leak in memory until full page refresh.
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only clean up on unmount
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const remaining = max - urls.length - pending.length;
      const toUpload = files.slice(0, Math.max(0, remaining));
      if (toUpload.length === 0) {
        setNotice(`Ai deja ${max} poze (maximul). Șterge una ca să poți adăuga alta.`);
        return;
      }
      // Dacă userul a ales mai multe decât încap, spunem clar câte am ignorat.
      setNotice(
        files.length > toUpload.length
          ? `Maxim ${max} poze: am adăugat ${toUpload.length}, restul de ${files.length - toUpload.length} au fost ignorate.`
          : null,
      );

      setError(null);

      // ─── Show local previews IMMEDIATELY ────────────────────────
      // The preview grid fills in under 1ms; Supabase can take its time.
      const pendingItems: Pending[] = toUpload.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        objectUrl: URL.createObjectURL(f),
        progress: 0,
      }));
      setPending((prev) => [...prev, ...pendingItems]);

      try {
        // Compress in parallel, then upload. Compression is deliberately
        // done in-browser so Supabase only sees <=1.5MB JPEGs.
        const compressed = await Promise.all(toUpload.map(compressImage));
        for (const f of compressed) {
          if (f.size > MAX_BYTES) {
            throw new Error(`"${f.name}" e prea mare (max 5MB).`);
          }
        }

        const fd = new FormData();
        compressed.forEach((f) => fd.append("files", f));

        const res = await uploadWithProgress(fd, (pct) => {
          // Map overall upload progress to each pending item (rough but OK
          // since they all go in the same request body).
          setPending((prev) =>
            prev.map((p) =>
              pendingItems.find((pi) => pi.id === p.id) ? { ...p, progress: pct } : p,
            ),
          );
        });

        const json = res.body as { error?: string; data?: { urls?: string[] } };
        if (!res.ok) throw new Error(json?.error || `Eroare server (${res.status}).`);
        const uploaded = json?.data?.urls ?? [];

        // Commit: swap previews for real URLs + free the object URLs
        onChange([...urls, ...uploaded]);
        pendingItems.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        setPending((prev) =>
          prev.filter((p) => !pendingItems.find((pi) => pi.id === p.id)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Eroare la upload";
        setError(msg);
        pendingItems.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        setPending((prev) =>
          prev.filter((p) => !pendingItems.find((pi) => pi.id === p.id)),
        );
      }
    },
    [urls, pending.length, max, onChange],
  );

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    uploadFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) uploadFiles(files);
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
      }
    },
    [uploadFiles],
  );

  const zoneRef = useRef<HTMLDivElement>(null);

  const totalCount = urls.length + pending.length;
  const canAdd = totalCount < max;

  return (
    <div
      ref={zoneRef}
      onPaste={(e) => handlePaste(e.nativeEvent)}
      tabIndex={0}
      className="outline-none"
    >
      {canAdd && (
        <div className="space-y-2">
          <button
            type="button"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            aria-label={`Încarcă poze (${totalCount} din ${max} folosite)`}
            className={`w-full flex flex-col items-center justify-center gap-1.5 h-24 rounded-[var(--radius-xs)] border-2 border-dashed cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ${
              dragging
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
            } text-sm text-[var(--color-text-muted)]`}
          >
            <Upload size={18} aria-hidden="true" />
            <span>
              Încarcă, trage sau lipește poze (<span className="tabular-nums">{totalCount}/{max}</span>)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
              aria-hidden="true"
              tabIndex={-1}
            />
          </button>

          {/* 2026-05-26 — Buton secundar dedicat pentru camera (mobile).
              Vizibil doar pe mobile (sm:hidden). Cetățeanul care vrea
              EXPLICIT „fă poza acum" apasă aici; restul folosește picker
              nativ care arată Galerie + Camera + Files. Pe desktop input-ul
              cu capture e ignorat de browser → ascuns. */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            aria-label="Fă poza acum cu camera"
            className="sm:hidden w-full inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Camera size={16} aria-hidden="true" />
            Fă poza acum cu camera
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFiles}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {!canAdd && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Ai atins maximul de {max} poze. Șterge una ca să adaugi alta.
        </p>
      )}
      {notice && <p role="status" className="text-xs text-amber-600 dark:text-amber-400 mt-2">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-500 mt-2">{error}</p>}

      {(urls.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
          {urls.map((url, i) => (
            <div
              key={url}
              className="aspect-square rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] relative overflow-hidden group"
            >
              <button
                type="button"
                onClick={() => setLightbox(i)}
                aria-label={`Vezi poza ${i + 1} la mărime mare`}
                className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset cursor-pointer"
              >
                <span className="sr-only">Mărește</span>
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} width={120} height={120} className="w-full h-full object-cover pointer-events-none" loading="lazy" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(urls.filter((_, j) => j !== i)); }}
                aria-label={`Șterge poza ${i + 1}`}
                className="absolute top-1 right-1 z-20 w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-within:opacity-100 transition-opacity"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.id}
              className="aspect-square rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] relative overflow-hidden"
              aria-live="polite"
              aria-label={`Se încarcă poza (${p.progress}%)`}
              role="progressbar"
              aria-valuenow={p.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.objectUrl}
                alt=""
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-white gap-1.5">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span className="text-[10px] font-semibold tabular-nums">{p.progress}%</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-black/30" aria-hidden="true">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Imagine ${lightbox + 1} din ${urls.length}`}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setLightbox(null)}
            aria-label="Închide (Esc)"
          >
            <X size={24} aria-hidden="true" />
          </button>

          {lightbox > 0 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              aria-label="Imaginea anterioară"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
          )}

          {lightbox < urls.length - 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              aria-label="Imaginea următoare"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[lightbox]}
            alt={`Foto ${lightbox + 1} din ${urls.length}`}
            className="max-w-[90vw] max-h-[85dvh] object-contain rounded-[var(--radius-xs)]"
            onClick={(e) => e.stopPropagation()}
          />

          <p
            className="absolute bottom-4 text-white/60 text-xs tabular-nums"
            aria-live="polite"
          >
            {lightbox + 1} / {urls.length}
          </p>
        </div>
      )}
    </div>
  );
}
