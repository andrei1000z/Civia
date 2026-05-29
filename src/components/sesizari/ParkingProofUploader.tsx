"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Car, Eye, Loader2, X, Info } from "lucide-react";
import { extractPlate } from "@/lib/sesizari/parking";

// Three-slot legally-tuned upload flow used ONLY when `tip === "parcare"`.
// Each slot captures one specific piece of evidence the Poliția Locală /
// Brigada Rutieră need to prosecute: the plate, the "vehicle unattended"
// shot, and the wide context.
//
// The "plate" slot additionally does two things:
//   1. Client-side OCR (Tesseract.js, lazy-loaded) to pre-fill the plate
//      input. Users can always override manually.
//   2. Automatic redaction — we draw a black bar over the plate region
//      before uploading the file. Only the redacted version hits
//      Supabase storage, so the public gallery never shows the plate.

type SlotId = "plate" | "vehicle" | "context";

interface ParkingProofUploaderProps {
  /** URLs currently assigned to each slot. `null` = not yet filled. */
  value: { plate: string | null; vehicle: string | null; context: string | null };
  onChange: (v: ParkingProofUploaderProps["value"]) => void;
  plateText: string;
  onPlateTextChange: (plate: string) => void;
}

const SLOT_META: Record<
  SlotId,
  { title: string; required: boolean; hint: string; icon: typeof Car }
> = {
  plate: {
    title: "Număr de înmatriculare",
    required: true,
    hint: "Fotografiază clar numărul. Nu trebuie să bată soarele în el. Vom detecta automat numărul și îl vom ascunde în poza publică.",
    icon: Car,
  },
  vehicle: {
    title: "Mașina fără șofer (dovada staționării)",
    required: true,
    hint: "Demonstrează că șoferul a părăsit mașina. Staționare = sancționabilă, oprire = nu.",
    icon: Camera,
  },
  context: {
    title: "Contextul (infracțiunea)",
    required: false,
    hint: "Fă un pas în spate. Prinde mașina, trotuarul/trecerea și un reper din zonă (clădire, indicator).",
    icon: Eye,
  },
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1920;

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("invalid image")); };
    img.src = url;
  });
}

function fitDimensions(w: number, h: number): { w: number; h: number } {
  if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) return { w, h };
  const r = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("canvas blob failed"));
      resolve(new File([blob], name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
  });
}

async function resizeToJpeg(file: File): Promise<{ file: File; canvas: HTMLCanvasElement }> {
  const img = await loadImage(file);
  const { w, h } = fitDimensions(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, w, h);
  const out = await canvasToJpegFile(canvas, file.name);
  return { file: out, canvas };
}

interface OcrBox { x0: number; y0: number; x1: number; y1: number; text: string }

// Lazy Tesseract loader — we only pay for the ~2MB WASM when the user
// actually uploads a plate photo. Safe to call multiple times, the
// worker is reused.
let tesseractWorkerPromise: Promise<unknown> | null = null;
async function getOcrWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: () => {
          /* silence progress events — SesizareForm handles UX feedback */
        },
      });
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

interface OcrResult { plate: string | null; box: OcrBox | null }

/**
 * Run Tesseract on the resized plate image. Returns the best plate match
 * + a bounding box around its line so we can redact it. Best-effort —
 * if anything throws, we fall back to a sane default redaction region.
 */
/** OCR can hang 30s+ pe device-uri slow (Tesseract.js WASM init + recognize).
 *  Bound the work to 10s — dacă pică, fallback redaction (bottom-middle band)
 *  rămâne aplicat în drawRedactionBar() cu box=null. User vede uploadul
 *  încheiat în max 10s în loc să aștepte indefinit. */
const OCR_TIMEOUT_MS = 10_000;

async function ocrPlate(canvas: HTMLCanvasElement): Promise<OcrResult> {
  try {
    const worker = (await getOcrWorker()) as {
      recognize: (img: HTMLCanvasElement | string) => Promise<{
        data: { text: string; lines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> };
      }>;
    };
    const result = await Promise.race([
      worker.recognize(canvas),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("OCR timeout")), OCR_TIMEOUT_MS),
      ),
    ]);
    const plate = extractPlate(result.data.text);
    let box: OcrBox | null = null;
    if (plate) {
      const line = result.data.lines.find((l) => extractPlate(l.text) === plate);
      if (line) {
        box = {
          x0: line.bbox.x0, y0: line.bbox.y0,
          x1: line.bbox.x1, y1: line.bbox.y1,
          text: line.text,
        };
      }
    }
    return { plate, box };
  } catch {
    return { plate: null, box: null };
  }
}

function drawRedactionBar(canvas: HTMLCanvasElement, box: OcrBox | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let x: number, y: number, w: number, h: number;
  if (box) {
    const padX = Math.round((box.x1 - box.x0) * 0.1);
    const padY = Math.round((box.y1 - box.y0) * 0.25);
    x = Math.max(0, box.x0 - padX);
    y = Math.max(0, box.y0 - padY);
    w = Math.min(canvas.width - x, box.x1 - box.x0 + padX * 2);
    h = Math.min(canvas.height - y, box.y1 - box.y0 + padY * 2);
  } else {
    // Fallback heuristic: plates on a direct rear/front close-up
    // usually sit in the bottom-middle quarter. We redact a generous
    // band there so a failed OCR still doesn't leak the plate.
    w = Math.round(canvas.width * 0.6);
    h = Math.round(canvas.height * 0.18);
    x = Math.round((canvas.width - w) / 2);
    y = Math.round(canvas.height * 0.72);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.max(14, Math.round(h * 0.5))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ASCUNS PENTRU GDPR", x + w / 2, y + h / 2);
}

// XHR upload with progress, mirrors PhotoUploader.tsx behaviour.
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

export function ParkingProofUploader({ value, onChange, plateText, onPlateTextChange }: ParkingProofUploaderProps) {
  const [busySlot, setBusySlot] = useState<SlotId | null>(null);
  const [progress, setProgress] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processSlot = useCallback(
    async (slot: SlotId, file: File) => {
      setError(null);
      if (file.size > MAX_BYTES && !file.type.startsWith("image/")) {
        setError("Fișier prea mare sau nu este imagine.");
        return;
      }
      setBusySlot(slot);
      setProgress(0);
      try {
        const { canvas } = await resizeToJpeg(file);

        if (slot === "plate") {
          // OCR first, then redact before upload. User gets the plate
          // text pre-filled even if they later override it.
          setOcrRunning(true);
          const { plate, box } = await ocrPlate(canvas);
          setOcrRunning(false);
          if (plate && !plateText.trim()) onPlateTextChange(plate);
          drawRedactionBar(canvas, box);
        }

        const uploadFile = await canvasToJpegFile(canvas, `${slot}.jpg`);
        if (uploadFile.size > MAX_BYTES) {
          setError("Imaginea depășește 5MB chiar și comprimată.");
          setBusySlot(null);
          return;
        }

        const fd = new FormData();
        fd.append("files", uploadFile);
        const res = await uploadWithProgress(fd, setProgress);
        const json = res.body as { error?: string; data?: { urls?: string[] } };
        if (!res.ok) throw new Error(json?.error || `Eroare server (${res.status}).`);
        const url = json?.data?.urls?.[0];
        if (!url) throw new Error("Upload incomplet.");
        onChange({ ...value, [slot]: url });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la upload.");
      } finally {
        setBusySlot(null);
        setOcrRunning(false);
        setProgress(0);
      }
    },
    [value, onChange, plateText, onPlateTextChange],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-[var(--radius-xs)] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          <strong>Sesizare cu „dovadă aer-tight”.</strong> Poliția respinge sesizările de parcare fără probe clare. Completează cele 3 sloturi de mai jos — fiecare tratează un punct slab în lanțul de probe.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {(Object.keys(SLOT_META) as SlotId[]).map((slot) => (
          <Slot
            key={slot}
            slot={slot}
            url={value[slot]}
            busy={busySlot === slot}
            progress={progress}
            ocrRunning={slot === "plate" && ocrRunning && busySlot === "plate"}
            onPick={(file) => processSlot(slot, file)}
            onRemove={() => onChange({ ...value, [slot]: null })}
          />
        ))}
      </div>

      {/* Plate text input — pre-filled by OCR, always user-editable.
          Feeds directly into the legal email template. */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Număr de înmatriculare <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={plateText}
          onChange={(e) => onPlateTextChange(e.target.value.toUpperCase().slice(0, 12))}
          placeholder="ex: B 123 ABC"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Se completează automat când încarci prima poză. Poți corecta manual dacă OCR-ul greșește o literă.
        </p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Slot({
  slot, url, busy, progress, ocrRunning, onPick, onRemove,
}: {
  slot: SlotId;
  url: string | null;
  busy: boolean;
  progress: number;
  ocrRunning: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = SLOT_META[slot];
  const Icon = meta.icon;

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[var(--color-primary)]" />
        <p className="text-xs font-semibold">
          {meta.title}
          {meta.required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </p>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-snug">{meta.hint}</p>

      <div
        className="relative aspect-video rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors cursor-pointer overflow-hidden"
        onClick={() => !busy && !url && inputRef.current?.click()}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={meta.title} width={120} height={120} className="w-full h-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
              aria-label="Șterge poza"
            >
              <X size={14} />
            </button>
          </>
        ) : busy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-muted)] px-3">
            <Loader2 size={18} className="animate-spin" />
            {ocrRunning ? (
              <span>Citim numărul...</span>
            ) : progress > 0 ? (
              <>
                <span className="tabular-nums">{progress}%</span>
                <div className="w-full h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : (
              <span>Se procesează...</span>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Icon size={18} />
            <span>Încarcă poza</span>
          </div>
        )}
        {/* 2026-05-29 — Eliminat `capture="environment"` (raportat pe
            Reddit: „voiam sa fac sesizare dar nu ma lasa sa uploadez
            poze, doar sa le fac pe loc"). Capture fortat = cetatenii
            care au pozele deja in galerie nu pot incarca. Browser-ul
            mobile arata oricum picker nativ cu Camera + Galerie +
            Fisiere — userul decide. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
