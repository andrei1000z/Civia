"use client";

import { useEffect, useRef } from "react";
import { trackCustomEvent } from "@/components/analytics/CiviaTracker";

interface Props {
  /** Article slug/ID — included în toate events pentru attribution. */
  articleId: string;
  /** Source publication (Digi24, G4Media, etc.) — segmentare. */
  source: string;
  /** Approximate word count — corelație cu engagement (long-form vs scurt). */
  wordCount?: number;
}

/**
 * 2026-05-25 #10 — Article reading metrics specific pentru /stiri/[id].
 *
 * Events emitate:
 *   - article-read-start: la mount (user a deschis articolul)
 *   - article-scroll-25/50/75/100: scroll depth specific per articol
 *     (separat de generic scroll-depth — atașat de articleId, nu de
 *     pathname, ca să putem agrega pe source / wordCount)
 *   - article-time-spent: la unload, ms vizibili (numai dacă > 30s
 *     = engaged read)
 *
 * Folosește IntersectionObserver pentru detectarea pragurilor, nu scroll
 * raw — mai eficient + lucrează corect pe articole scurte unde 100%
 * scroll = whole page încă vizibilă.
 *
 * Inserat ca client island în /stiri/[id]/page.tsx server component.
 */
export function ArticleReadingTracker({ articleId, source, wordCount = 0 }: Props) {
  const startRef = useRef(Date.now());
  const visibleMsRef = useRef(0);
  const visibleSinceRef = useRef<number>(0);
  const firedMarks = useRef(new Set<number>());

  // Initial: emit read-start + start visibility clock
  useEffect(() => {
    trackCustomEvent("article-read-start", {
      articleId: articleId.slice(0, 16),
      source: source.slice(0, 32),
      wordCount,
    });
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      visibleSinceRef.current = Date.now();
    }
  }, [articleId, source, wordCount]);

  // Visibility-aware time-on-article (mobile background-friendly)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        visibleSinceRef.current = Date.now();
      } else if (visibleSinceRef.current > 0) {
        visibleMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Scroll depth markers specific per article
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) {
        // Short articles: dacă tot conținutul vizibil din start, marchează 100%
        if (!firedMarks.current.has(100)) {
          firedMarks.current.add(100);
          trackCustomEvent("article-scroll", {
            articleId: articleId.slice(0, 16),
            depth: 100,
            short: 1,
          });
        }
        return;
      }
      const pct = Math.round((window.scrollY / max) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !firedMarks.current.has(m)) {
          firedMarks.current.add(m);
          trackCustomEvent("article-scroll", {
            articleId: articleId.slice(0, 16),
            source: source.slice(0, 32),
            depth: m,
          });
        }
      }
    };
    const onScroll = (e: Event) => {
      // Skip programmatic scrolls (modal, lazy load)
      if (e.isTrusted === false) return;
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Check initial state (short articles all-visible)
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [articleId, source]);

  // Time-spent emit on unload (only if engaged: > 30s visible)
  useEffect(() => {
    const onUnload = () => {
      // Snapshot final
      if (visibleSinceRef.current > 0) {
        visibleMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = 0;
      }
      const t = visibleMsRef.current;
      // Skip < 30s (browse mode) și > 30min (left tab open all day)
      if (t < 30_000 || t > 30 * 60_000) return;
      trackCustomEvent("article-time-spent", {
        articleId: articleId.slice(0, 16),
        source: source.slice(0, 32),
        ms: t,
        bucket:
          t < 60_000
            ? "30-60s"
            : t < 180_000
              ? "1-3min"
              : t < 600_000
                ? "3-10min"
                : "10-30min",
        wordCount,
      });
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [articleId, source, wordCount]);

  return null;
}
