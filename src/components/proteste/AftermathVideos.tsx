"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Video as VideoIcon,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { AftermathVideo } from "@/lib/proteste/aftermath";

interface Props {
  videos: AftermathVideo[];
}

/**
 * Renders the aftermath video gallery with an in-tab lightbox player.
 *
 * - Direct uploads (.mp4 / .webm / .mov on Supabase Storage) play as
 *   inline `<video>` controls.
 * - YouTube / TikTok / Instagram / Facebook embed via iframe.
 * - Click on any card → modal opens IN the same tab (replaces the
 *   previous "open in new tab" link behavior so users don't leave Civia).
 * - Arrow keys navigate prev/next, Esc closes (mirrors ImageLightbox).
 *
 * Same UX language as galeria (AftermathGallery) — players don't break
 * the page flow.
 */
export function AftermathVideos({ videos }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const visible = videos.filter((v) => v.url && v.url.trim().length > 0);

  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(
    () => setOpenIdx((i) => (i === null ? null : (i - 1 + visible.length) % visible.length)),
    [visible.length],
  );
  const next = useCallback(
    () => setOpenIdx((i) => (i === null ? null : (i + 1) % visible.length)),
    [visible.length],
  );

  useEffect(() => {
    if (openIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [openIdx, close, prev, next]);

  if (visible.length === 0) return null;

  const current = openIdx !== null ? visible[openIdx] : null;

  return (
    <>
      <div>
        <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
          <VideoIcon size={14} aria-hidden="true" />
          Video ({visible.length})
        </h3>
        <ul className="grid sm:grid-cols-2 gap-2">
          {visible.map((v, i) => (
            <li key={`${v.url}-${i}`}>
              <button
                type="button"
                onClick={() => setOpenIdx(i)}
                className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors group text-left cursor-pointer"
                aria-label={`Redă ${displayTitle(v, i)}`}
              >
                <span
                  className="shrink-0 w-10 h-10 rounded-full bg-rose-500/15 grid place-items-center group-hover:bg-rose-500/25 transition-colors"
                  aria-hidden="true"
                >
                  <VideoIcon size={15} className="text-rose-500" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {displayTitle(v, i)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-0.5">
                    {sourceLabel(v.source)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Lightbox modal */}
      {current && (
        <div
          className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Video ${(openIdx ?? 0) + 1} din ${visible.length}`}
        >
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
              aria-label="Deschide video în tab nou"
              title="Deschide în tab nou"
            >
              <ExternalLink size={18} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={close}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Închide (Esc)"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          {/* Prev/next desktop (md+) — overlay pe lateralele video-ului.
              Pe mobile (<md) ar suprapune controls native ale video-ului
              și ar reduce zona vizibilă, deci se mută la bottom. */}
          {visible.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Video anterior (săgeată stânga)"
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Video următor (săgeată dreapta)"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </>
          )}

          <div
            className="relative w-full max-w-5xl px-4 md:px-0"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoPlayer video={current} />
          </div>

          {/* Bottom bar — counter centered + prev/next pe mobile (replaces
              the side-overlay buttons which n-au loc pe ecran mic). */}
          {visible.length > 1 && (
            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 px-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="md:hidden w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Video anterior"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <p
                className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium backdrop-blur tabular-nums"
                aria-live="polite"
              >
                {(openIdx ?? 0) + 1} / {visible.length}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="md:hidden w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Video următor"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Renders the actual player for a video. Direct video files (mp4 / webm /
 * mov) get a native <video> element with controls. Hosted platforms get
 * an embedded iframe with the right embed URL transform.
 *
 * Sizing: container e aspect-video (16:9) cu width 100% și max-height
 * 85vh. Player-ul în interior fill-uiește container-ul cu object-contain
 * ca să nu strivească video-uri portrait (telefon vertical, e.g. 9:16).
 *
 * Autoplay: HTML5 <video autoplay> e blocat de Chrome/Safari dacă nu e
 * `muted`. Adăugăm `muted` ca să pornească automat la deschidere modal
 * — user dă unmute din controls dacă vrea sunet.
 */
function VideoPlayer({ video }: { video: AftermathVideo }) {
  const url = video.url;
  const embed = toEmbedUrl(url, video.source);

  if (embed.kind === "video") {
    return (
      <div className="w-full aspect-video max-h-[85vh] bg-black rounded-[var(--radius-sm)] overflow-hidden">
        <video
          key={embed.src}
          src={embed.src}
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-contain bg-black"
        />
      </div>
    );
  }
  return (
    <div className="w-full aspect-video max-h-[85vh]">
      <iframe
        src={embed.src}
        title={video.title ?? "Video aftermath"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full rounded-[var(--radius-sm)] border-0 bg-black"
      />
    </div>
  );
}

interface EmbedResult {
  kind: "video" | "iframe";
  src: string;
}

function toEmbedUrl(url: string, source?: string): EmbedResult {
  // Direct video file
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || source === "direct") {
    return { kind: "video", src: url };
  }

  // YouTube
  const ytMatch =
    url.match(/youtube\.com\/watch\?v=([^&]+)/i) ??
    url.match(/youtu\.be\/([^?&]+)/i) ??
    url.match(/youtube\.com\/shorts\/([^?&]+)/i);
  if (ytMatch?.[1]) {
    return { kind: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // TikTok — embed format
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (ttMatch?.[1]) {
    return { kind: "iframe", src: `https://www.tiktok.com/embed/v2/${ttMatch[1]}` };
  }

  // Facebook — generic plugin
  if (/facebook\.com|fb\.watch/i.test(url)) {
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
    };
  }

  // Instagram embed
  if (/instagram\.com\/(reel|p)\//i.test(url)) {
    return {
      kind: "iframe",
      src: url.replace(/\/$/, "") + "/embed",
    };
  }

  // Fallback — render directly în <video> (works for direct .mp4 etc.
  // even when extension is missing in the URL; if the browser can't play
  // it, controls show "format not supported" instead of crashing the
  // modal)
  return { kind: "video", src: url };
}

/**
 * Curăță titlul afișat. Filenames de la upload-uri direct (Supabase TUS
 * tokens, screen-recording auto-names) sunt junk vizual — înlocuim cu
 * „Video N". Păstrăm titlul real dacă admin l-a editat sau dacă e setat
 * dintr-o sursă cunoscută (YouTube title scrape, etc.).
 */
function displayTitle(v: AftermathVideo, idx: number): string {
  const t = (v.title ?? "").trim();
  if (!t) return `Video ${idx + 1}`;
  // Junk pattern: 20+ caractere alfanumerice consecutive (tokens base64,
  // upload IDs) sau extensie video la final cu nume aleator
  if (/^[A-Za-z0-9_-]{20,}/.test(t) && /\.(mp4|webm|mov|m4v)$/i.test(t)) {
    return `Video ${idx + 1}`;
  }
  // Strip extension la titluri normale, dar păstrăm restul
  return t.replace(/\.(mp4|webm|mov|m4v)$/i, "");
}

function sourceLabel(s?: string): string {
  if (!s) return "Video";
  switch (s) {
    case "direct":
      return "Înregistrare";
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    default:
      return s;
  }
}
