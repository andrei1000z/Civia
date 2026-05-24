"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Check, Loader2 } from "lucide-react";

/**
 * 2026-05-24 — Modal de decupare avatar înainte de upload.
 *
 * Flow: user selectează file → modal afișează imaginea + zone pătrat
 * draggable + zoom slider → user ajustează → confirm → canvas extrage
 * regiunea ca 256×256 JPEG → callback `onCrop(file)`.
 *
 * Zero deps externe (canvas nativ). Mobile + desktop pointer events.
 */

interface AvatarCropModalProps {
  file: File | null;
  onCancel: () => void;
  onCrop: (croppedFile: File) => void;
}

const OUTPUT_SIZE = 256;

export function AvatarCropModal({ file, onCancel, onCrop }: AvatarCropModalProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number }>({ x: 0, y: 0, px: 0, py: 0 });

  // Read file → data URL
  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [file]);

  // Reset position + scale when new image loads
  const onImgLoad = useCallback(() => {
    if (!imgRef.current) return;
    setImgNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    setPos({ x: 0, y: 0 });
    setScale(1);
  }, []);

  // Pointer drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (processing) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  // Escape to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleCrop = async () => {
    if (!imgRef.current || !containerRef.current || !file) return;
    setProcessing(true);
    try {
      const container = containerRef.current.getBoundingClientRect();
      const cropSize = Math.min(container.width, container.height) * 0.8;

      // Position of image relative to crop circle center
      // The crop circle is centered in the container.
      const centerX = container.width / 2;
      const centerY = container.height / 2;

      // Image is rendered cu object-fit: contain at base, then scaled by `scale`
      // and translated by `pos`. We need the source pixel range that maps to
      // the crop circle's bbox.

      // Base displayed size of img (object-fit: contain inside container)
      const imgAspect = imgNatural.w / imgNatural.h;
      const containerAspect = container.width / container.height;
      let baseW: number, baseH: number;
      if (imgAspect > containerAspect) {
        baseW = container.width;
        baseH = container.width / imgAspect;
      } else {
        baseH = container.height;
        baseW = container.height * imgAspect;
      }
      const dispW = baseW * scale;
      const dispH = baseH * scale;
      // Image top-left in container coords
      const imgLeft = centerX - dispW / 2 + pos.x;
      const imgTop = centerY - dispH / 2 + pos.y;
      // Crop bbox in container coords
      const cropLeft = centerX - cropSize / 2;
      const cropTop = centerY - cropSize / 2;
      // Crop bbox in image-displayed coords
      const cropX = cropLeft - imgLeft;
      const cropY = cropTop - imgTop;
      // Convert to natural pixels
      const naturalRatio = imgNatural.w / dispW;
      const sx = Math.max(0, cropX * naturalRatio);
      const sy = Math.max(0, cropY * naturalRatio);
      const sSize = cropSize * naturalRatio;

      // Render to canvas at OUTPUT_SIZE×OUTPUT_SIZE
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imgRef.current,
        sx, sy, sSize, sSize,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
      );
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("blob fail")), "image/jpeg", 0.9);
      });
      const croppedFile = new File([blob], file.name.replace(/\.\w+$/, "") + "-avatar.jpg", {
        type: "image/jpeg",
      });
      onCrop(croppedFile);
    } catch {
      setProcessing(false);
    }
  };

  if (!file || !imgSrc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decupează poza de profil"
      className="fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-base">
            Decupează poza
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Anulează"
            className="w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Crop area — fixed aspect ratio 1:1 */}
        <div
          ref={containerRef}
          className="relative w-full bg-black select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ aspectRatio: "1 / 1" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Image — centered, scaled + translated */}
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            onLoad={onImgLoad}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: "center",
            }}
            draggable={false}
          />
          {/* Crop overlay — circle mask. Pointer events disabled. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, transparent 0, transparent 40%, rgba(0,0,0,0.65) 40.5%)`,
            }}
          />
          {/* Circle outline */}
          <div
            aria-hidden="true"
            className="absolute pointer-events-none border-2 border-white/80 rounded-full"
            style={{
              width: "80%",
              height: "80%",
              top: "10%",
              left: "10%",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] space-y-1">
          <label htmlFor="zoom-slider" className="text-xs text-[var(--color-text-muted)]">
            Zoom
          </label>
          <input
            id="zoom-slider"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full accent-[var(--color-primary)]"
            disabled={processing}
          />
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Trage imaginea ca să o centrezi. Ajustează zoom-ul. Decupajul final
            e pătratic (256×256px).
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-2 justify-end border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="h-10 px-4 rounded-[var(--radius-xs)] text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleCrop}
            disabled={processing}
            className="h-10 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            {processing ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
            {processing ? "Procesează..." : "Folosește poza"}
          </button>
        </div>
      </div>
    </div>
  );
}
