"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download, ImageOff, ExternalLink, RotateCw, Loader2 } from "lucide-react";
import { downloadImageAsJpeg } from "@/lib/image-download";

type LoadStatus = "loading" | "loaded" | "error";

interface Props {
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
  /**
   * Treci `true` pentru URL-uri externe / CDN-uri terțe (ex. poze de presă)
   * ale căror thumbnail-uri se încarcă deja prin `<img>` brut: optimizer-ul
   * Next ar face fetch server-side, iar unele CDN-uri dau 403 la hotlinking →
   * le ținem raw. URL-urile din Supabase Storage (sesizări) lasă fals ca să
   * folosească optimizer-ul same-origin (calea dovedită, cache-uită la edge).
   */
  unoptimized?: boolean;
}

export function ImageLightbox({ urls, initialIndex = 0, onClose, unoptimized = false }: Props) {
  const [index, setIndex] = useState(initialIndex);
  // 2026-06-28 (feedback /sesizari/00093) — starea per-imagine. Înainte:
  // <img> brut full-res, fără feedback. Dacă fetch-ul direct la Storage stagna
  // sau pica în browserul userului (în timp ce thumbnail-ul next/image mergea
  // din optimizer-ul same-origin), rămânea overlay-ul negru blocat, fără poză
  // și fără scăpare. Acum: aceeași cale dovedită + spinner cât se încarcă +
  // card de eroare cu reîncercare / deschide originalul / descarcă.
  const [status, setStatus] = useState<LoadStatus>("loading");
  // Bump pe „Reîncearcă" → remontează <Image> și forțează un fetch nou (util
  // pentru un eșec tranzitoriu de rețea, care nu e în cache).
  const [reloadNonce, setReloadNonce] = useState(0);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const retryBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevStatusRef = useRef<LoadStatus>("loading");

  const prev = useCallback(() => setIndex((i) => (i - 1 + urls.length) % urls.length), [urls.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % urls.length), [urls.length]);

  // Reset la „loading" când schimbăm imaginea (←/→) sau reîncărcăm — în RENDER,
  // NU într-un useEffect: un passive-effect ar rula DUPĂ onLoad-ul next/image
  // (microtask din img.decode()) pentru o imagine deja în cache și ar suprascrie
  // „loaded"→„loading", lăsând poza invizibilă la opacity-0 (exact simptomul
  // raportat). Resetul în render se aplică înainte de mount → onLoad câștigă.
  const viewKey = `${index}-${reloadNonce}`;
  const [trackedKey, setTrackedKey] = useState(viewKey);
  if (trackedKey !== viewKey) {
    setTrackedKey(viewKey);
    setStatus("loading");
  }

  useEffect(() => {
    // Save who had focus before lightbox opened, so screen-reader users
    // (and keyboard users) land back where they were on close instead of
    // on <body>.
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    // 2026-06-19 (audit #14) — mută focus ÎN dialog (altfel rămâne pe pagina de
    // dedesubt, ascunsă de overlay — WCAG 2.4.3) + capcană de Tab.
    const root = dialogRef.current;
    root?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") { prev(); return; }
      if (e.key === "ArrowRight") { next(); return; }
      if (e.key === "Tab" && root) {
        const f = root.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]");
        if (f.length === 0) { e.preventDefault(); return; }
        const first = f[0]!;
        const last = f[f.length - 1]!;
        const act = document.activeElement;
        if (e.shiftKey && (act === first || act === root)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus?.();
    };
  }, [prev, next, onClose]);

  // Focus management la eroare: când apare cardul, focus pe „Reîncearcă"
  // (descoperibil + în capcana de Tab); când îl părăsim (retry/navigare), mută
  // focus înapoi pe dialog ca să nu cadă pe <body> (în afara capcanei).
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === "error") retryBtnRef.current?.focus();
    else if (prevStatus === "error") dialogRef.current?.focus();
  }, [status]);

  const retry = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  if (urls.length === 0) return null;

  const currentUrl = urls[index]!;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in focus:outline-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagine ${index + 1} din ${urls.length}`}
    >
      <div
        className="absolute right-4 flex gap-2 z-10"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void downloadImageAsJpeg(currentUrl);
          }}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
          aria-label="Salvează imaginea"
          title="Salvează imaginea"
        >
          <Download size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Închide galeria (Esc)"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white z-10"
            aria-label={`Imaginea anterioară (săgeată stânga)`}
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white z-10"
            aria-label={`Imaginea următoare (săgeată dreapta)`}
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </>
      )}

      {status === "error" ? (
        // Niciodată „blocat fără nimic": dacă încărcarea eșuează, arătăm un card
        // cu scăpări reale — reîncearcă, deschide originalul, descarcă.
        <div
          className="relative max-w-sm w-full mx-auto rounded-[var(--radius-md)] bg-white/6 border border-white/15 px-6 py-7 text-center text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 grid place-items-center">
            <ImageOff size={22} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">Imaginea nu s-a putut încărca</p>
          <p className="text-xs text-white/60 mt-1">
            Verifică-ți conexiunea sau deschide originalul.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              ref={retryBtnRef}
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
            >
              <RotateCw size={15} aria-hidden="true" />
              Reîncearcă
            </button>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ExternalLink size={15} aria-hidden="true" />
              Tab nou
            </a>
            <button
              type="button"
              onClick={() => void downloadImageAsJpeg(currentUrl)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Download size={15} aria-hidden="true" />
              Descarcă
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2026-06-28 — next/image (nu <img> brut): pentru URL-urile din Storage
              (default) trece prin optimizer-ul same-origin, cache-uit la edge,
              pe care thumbnail-urile îl folosesc deja cu succes → se încarcă
              instant și de încredere. Pentru URL-uri externe (unoptimized) rămâne
              raw, dar tot cu spinner + onError. Descărcarea rămâne pe originalul
              raw (fidelitate dovadă). object-contain + w/h auto = imagine la
              mărime de conținut, deci click pe fundalul negru închide. */}
          <Image
            key={viewKey}
            src={currentUrl}
            alt={`Imagine ${index + 1} din ${urls.length}`}
            width={1600}
            height={1200}
            sizes="100vw"
            preload
            unoptimized={unoptimized}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`w-auto h-auto max-w-full max-h-[90dvh] object-contain rounded-[var(--radius-xs)] transition-opacity duration-200 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => e.stopPropagation()}
          />
          {status === "loading" && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden="true">
              <Loader2 size={34} className="text-white/80 animate-spin" />
            </div>
          )}
        </>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {status === "loading"
          ? "Se încarcă imaginea"
          : status === "error"
            ? "Imaginea nu s-a putut încărca"
            : `Imaginea ${index + 1} din ${urls.length} încărcată`}
      </p>

      {urls.length > 1 && (
        <p
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium backdrop-blur tabular-nums z-10"
        >
          {index + 1} / {urls.length}
        </p>
      )}
    </div>
  );
}
