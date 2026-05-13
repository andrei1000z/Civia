"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VID_KEY = "civia_vid";
const EXCLUDE_KEY = "civia_exclude_tracking";
const LANG_FALLBACK = "unknown";

function getVisitorId(): string {
  try {
    let vid = localStorage.getItem(VID_KEY);
    if (!vid) {
      vid = `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      localStorage.setItem(VID_KEY, vid);
    }
    return vid;
  } catch {
    return "v-anon";
  }
}

function isExcluded(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === "1";
  } catch {
    return false;
  }
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|tablet|PlayBook|Kindle|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mac OS/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "edge";
  if (/OPR\//i.test(ua)) return "opera";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "chrome";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Safari\//i.test(ua)) return "safari";
  return "other";
}

function detectDisplayMode(): string {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "standalone";
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return "standalone";
  return "browser";
}

function viewportBucket(): string {
  const w = window.innerWidth;
  if (w < 480) return "xs";
  if (w < 640) return "sm";
  if (w < 1024) return "md";
  if (w < 1280) return "lg";
  if (w < 1536) return "xl";
  return "2xl";
}

function getReferrer(): { host: string; full: string } {
  try {
    const ref = document.referrer;
    if (!ref) return { host: "direct", full: "" };
    const u = new URL(ref);
    if (u.host === window.location.host) return { host: "direct", full: "" };
    return { host: u.host.slice(0, 100), full: ref.slice(0, 280) };
  } catch {
    return { host: "direct", full: "" };
  }
}

interface TrackPayload {
  action: "track";
  visitorId: string;
  eventType: string;
  [k: string]: string | number | undefined;
}

// ─── Batching layer ────────────────────────────────────────────────
//
// Înainte: fiecare eveniment trimitea propriul request → 100+ requests
// per sesiune activă. Costuri Vercel + scrieri Redis enormous.
//
// Acum: buffer evenimentele 2 secunde (BATCH_FLUSH_MS), trimite-le
// împreună într-un singur POST. Pe pagehide/visibilitychange flush-uim
// imediat ca să nu pierdem ultimele evenimente. Pentru evenimente
// critice (js-error, web-vital la flush), trimitem direct fără buffer.
const BATCH_FLUSH_MS = 2000;
const BATCH_MAX_SIZE = 30;
let batchBuffer: TrackPayload[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch(): Promise<void> {
  if (batchBuffer.length === 0) return;
  const events = batchBuffer;
  batchBuffer = [];
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  try {
    const body = JSON.stringify({ action: "track-batch", events });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* silent — events lost is acceptable, network down */
  }
}

async function send(payload: TrackPayload): Promise<void> {
  batchBuffer.push(payload);
  // Flush early dacă ne apropiem de limita batch-ului
  if (batchBuffer.length >= BATCH_MAX_SIZE) {
    flushBatch();
    return;
  }
  // Schedule flush dacă nu există unul activ
  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_FLUSH_MS);
  }
}

// Flush la pagehide / visibilitychange ca să nu pierdem evenimente
// când userul închide tab-ul. Înregistrat o singură dată per pagină.
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushBatch();
  });
  window.addEventListener("pagehide", flushBatch);
}

export function trackCustomEvent(eventType: string, extra: Record<string, string | number> = {}): void {
  if (typeof window === "undefined") return;
  if (isExcluded()) return;
  send({ action: "track", visitorId: getVisitorId(), eventType, ...extra });
}

// Web Vitals buckets — per web.dev thresholds. Rating affects aggregation.
function webVitalRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  // Google Web Vitals thresholds (2024):
  //   LCP:  good ≤ 2500ms, poor > 4000ms
  //   INP:  good ≤ 200ms,  poor > 500ms
  //   CLS:  good ≤ 0.1,    poor > 0.25
  //   FCP:  good ≤ 1800ms, poor > 3000ms
  //   TTFB: good ≤ 800ms,  poor > 1800ms
  switch (name) {
    case "LCP":
      return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "INP":
    case "FID":
      return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "CLS":
      return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "FCP":
      return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    case "TTFB":
      return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
    default:
      return "needs-improvement";
  }
}

// Rage-click detector: 3+ clicks within 1s in a 40x40px window = frustration
interface ClickRecord { x: number; y: number; t: number }

export function CiviaTracker(): null {
  const pathname = usePathname();
  const pageEnterRef = useRef<number>(0);
  const lastPathRef = useRef<string | null>(null);
  const pathnameRef = useRef<string>(pathname);

  // Keep pathname current for listeners attached once at mount
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Pageview
  useEffect(() => {
    if (isExcluded()) return;
    if (typeof window === "undefined") return;

    // Time-on-page for previous route
    if (lastPathRef.current && lastPathRef.current !== pathname) {
      const t = Date.now() - pageEnterRef.current;
      if (t > 1000 && t < 3600000) {
        send({
          action: "track",
          visitorId: getVisitorId(),
          eventType: "time-on-page",
          timeOnPage: t,
          pathname: lastPathRef.current,
        });
      }
    }
    pageEnterRef.current = Date.now();
    lastPathRef.current = pathname;

    const params = new URLSearchParams(window.location.search);
    const ref = getReferrer();

    // Load time (only meaningful on first pageview of the session)
    let loadTime = 0;
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        const t = nav.loadEventEnd - nav.startTime;
        if (t > 0 && t < 60000) loadTime = Math.round(t);
      }
    } catch { /* noop */ }

    send({
      action: "track",
      visitorId: getVisitorId(),
      eventType: "pageview",
      pathname,
      displayMode: detectDisplayMode(),
      deviceType: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      referrer: ref.host,
      referrerFull: ref.full,
      language: navigator.language?.slice(0, 10) || LANG_FALLBACK,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewport: viewportBucket(),
      orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
      connection:
        (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType || "unknown",
      colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      loadTime,
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || "",
      utmTerm: params.get("utm_term") || "",
    });
  }, [pathname]);

  // Unload: flush time-on-page
  useEffect(() => {
    const onUnload = () => {
      if (isExcluded()) return;
      const t = Date.now() - pageEnterRef.current;
      if (t <= 1000 || t >= 3600000) return;
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "time-on-page",
        timeOnPage: t,
        pathname: pathnameRef.current,
      });
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  // Scroll depth
  useEffect(() => {
    if (isExcluded()) return;
    const marks = new Set<number>();
    let raf = 0;
    const check = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !marks.has(m)) {
          marks.add(m);
          send({
            action: "track",
            visitorId: getVisitorId(),
            eventType: "scroll-depth",
            depth: String(m),
            pathname: pathnameRef.current,
          });
        }
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  // JS errors (filtered noise) + unhandled rejections
  useEffect(() => {
    if (isExcluded()) return;
    // Pattern-uri de zgomot extension/browser/in-app-browser. Astea NU sunt
    // buguri Civia — sunt cauzate de:
    //  - extensii care injecteaza DOM dupa SSR (Grammarly, MetaMask, ad blockers)
    //  - mobile in-app browsers (Reddit, Facebook, Instagram, X) care modifica markup
    //  - wallet-uri (MetaMask, Phantom, Coinbase) care pun proprietati pe window
    // Update 2026-05-13 dupa audit: React #418/#419 (816 ocurente!) + classList/
    // parentNode null + ethereum.selectedAddress se intampla doar in browsere
    // cu extensii sau in webview-uri sociale. Le filtram ca sa nu drowneze
    // erorile reale (pana acum, intre #418 zgomot nu mai vedeam alte buguri).
    const NOISE = [
      /__firefox__/i,
      /chrome-extension/i,
      /moz-extension/i,
      /safari-extension/i,
      /^Script error\.?$/i,
      /ResizeObserver loop/i,
      // React hydration mismatches — cauzate de extensii care modifica DOM-ul
      // intre SSR si client hydration. Layout-ul are deja suppressHydrationWarning
      // pe body, dar copiii injectati de extensii dau eroare hard. Pe trafic
      // public, 99% sunt zgomot real.
      /Minified React error #418/i,
      /Minified React error #419/i,
      /Hydration failed/i,
      /hydrating/i,
      // Wallet extensions (MetaMask, Phantom, Coinbase, etc.)
      /window\.ethereum/i,
      /ethereum\.selectedAddress/i,
      /web3/i,
      /__phantom/i,
      // uBlock Origin / AdBlock cosmetic filtering
      /cosmeticAPI/i,
      /getSelectors/i,
      // Grammarly / LanguageTool / extension DOM injection
      /grammarly/i,
      /languagetool/i,
      // Extensii care manipuleaza DOM dupa ce React l-a re-rendat —
      // referintele lor catre nodes vechi devin null/stale.
      /classList/i,
      /parentNode/i,
      /Cannot read propert(y|ies).*null/i,
      // Generic „object is not extensible" — apare cand extensii incearca sa
      // adauge proprietati pe obiectele Supabase / next-router (frozen).
      /object is not extensible/i,
      // Bytedance/TikTok webview script errors
      /bytedance/i,
      // Facebook in-app browser injecteaza propriul cod care esueaza pe site-uri ne-FB
      /FB.*navigator/i,
    ];
    const onError = (e: ErrorEvent) => {
      const msg = (e.message || "").slice(0, 200);
      if (!msg || NOISE.some((rx) => rx.test(msg))) return;
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "js-error",
        error: msg,
        pathname: pathnameRef.current,
        // File + line help triage where the error happened
        errorSrc: `${(e.filename || "").slice(-80)}:${e.lineno || 0}`,
      });
    };
    const onReject = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg = (typeof reason === "string" ? reason : reason?.message || String(reason)).slice(0, 200);
      if (!msg || NOISE.some((rx) => rx.test(msg))) return;
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "js-error",
        error: `(promise) ${msg}`,
        pathname: pathnameRef.current,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  // Web Vitals — LCP, INP, CLS, FCP, TTFB via PerformanceObserver.
  // No external lib; we implement the minimum that matches web-vitals.js
  // thresholds so the dashboard numbers line up with PSI / Search Console.
  useEffect(() => {
    if (isExcluded()) return;
    if (typeof PerformanceObserver === "undefined") return;

    const reported = new Set<string>();
    const report = (name: string, value: number) => {
      // Clamp extreme values to sane bounds — avoids one broken session
      // poisoning the p95.
      if (!Number.isFinite(value) || value < 0 || value > 300_000) return;
      const rating = webVitalRating(name, value);
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "web-vital",
        vital: name,
        // Round to preserve precision for CLS (0-1 range) while keeping
        // timing values compact.
        value: name === "CLS" ? Math.round(value * 1000) / 1000 : Math.round(value),
        rating,
        pathname: pathnameRef.current,
      });
    };

    const observers: PerformanceObserver[] = [];
    const observe = (type: string, cb: (entries: PerformanceEntry[]) => void) => {
      try {
        const po = new PerformanceObserver((list) => cb(list.getEntries()));
        // `buffered: true` catches entries that fired before this effect ran.
        po.observe({ type, buffered: true });
        observers.push(po);
      } catch { /* unsupported on this browser */ }
    };

    // LCP — report on page hide (last value seen wins)
    let lcpValue = 0;
    observe("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) lcpValue = last.startTime;
    });

    // CLS — cumulative layout shift, sum of session windows
    let clsValue = 0;
    let clsEntries: PerformanceEntry[] = [];
    let clsSessionValue = 0;
    let clsSessionEntries: PerformanceEntry[] = [];
    observe("layout-shift", (entries) => {
      for (const entry of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (entry.hadRecentInput) continue;
        const firstEntry = clsSessionEntries[0] as (PerformanceEntry & { startTime: number }) | undefined;
        const lastEntry = clsSessionEntries[clsSessionEntries.length - 1] as (PerformanceEntry & { startTime: number }) | undefined;
        if (
          lastEntry &&
          firstEntry &&
          entry.startTime - lastEntry.startTime < 1000 &&
          entry.startTime - firstEntry.startTime < 5000
        ) {
          clsSessionValue += entry.value;
          clsSessionEntries.push(entry);
        } else {
          clsSessionValue = entry.value;
          clsSessionEntries = [entry];
        }
        if (clsSessionValue > clsValue) {
          clsValue = clsSessionValue;
          clsEntries = clsSessionEntries;
        }
      }
    });

    // FCP — first contentful paint
    observe("paint", (entries) => {
      for (const entry of entries) {
        if (entry.name === "first-contentful-paint" && !reported.has("FCP")) {
          reported.add("FCP");
          report("FCP", entry.startTime);
        }
      }
    });

    // INP — interaction to next paint, reported on page hide
    let inpValue = 0;
    observe("event", (entries) => {
      for (const entry of entries as (PerformanceEntry & { interactionId?: number; duration: number })[]) {
        if (!entry.interactionId) continue;
        if (entry.duration > inpValue) inpValue = entry.duration;
      }
    });

    // TTFB — derived from navigation entry
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        const ttfb = nav.responseStart - nav.startTime;
        if (ttfb > 0 && !reported.has("TTFB")) {
          reported.add("TTFB");
          report("TTFB", ttfb);
        }
      }
    } catch { /* noop */ }

    // Flush LCP/CLS/INP on hide
    const flush = () => {
      if (lcpValue > 0 && !reported.has("LCP")) {
        reported.add("LCP");
        report("LCP", lcpValue);
      }
      if (clsEntries.length > 0 && !reported.has("CLS")) {
        reported.add("CLS");
        report("CLS", clsValue);
      }
      if (inpValue > 0 && !reported.has("INP")) {
        reported.add("INP");
        report("INP", inpValue);
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);

    return () => {
      observers.forEach((po) => po.disconnect());
    };
  }, []);

  // Click tracking + Rage clicks UNIFIED — un singur listener pentru
  // ambele (înainte erau 2 listeners pe document.click — runtime dublu
  // pentru fiecare click). Logica:
  // 1. Detectăm rage (3+ click-uri în 1s, în 40×40 px)
  // 2. În același handler facem click tracking normal
  useEffect(() => {
    if (isExcluded()) return;
    let recent: ClickRecord[] = [];

    const onClick = (e: MouseEvent) => {
      // ─── RAGE DETECTION ───
      const now = Date.now();
      recent = recent.filter((r) => now - r.t < 1000);
      const nearby = recent.filter(
        (r) => Math.abs(r.x - e.clientX) < 40 && Math.abs(r.y - e.clientY) < 40,
      );
      recent.push({ x: e.clientX, y: e.clientY, t: now });
      if (nearby.length >= 2) {
        recent = recent.filter((r) => !nearby.includes(r));
        const tEl = e.target as HTMLElement | null;
        const rageEl = tEl?.closest("a, button, [role=button]") as HTMLElement | null;
        const rageLabel =
          (rageEl?.getAttribute("aria-label") || rageEl?.textContent || rageEl?.tagName || "body")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40);
        send({
          action: "track",
          visitorId: getVisitorId(),
          eventType: "rage-click",
          label: rageLabel,
          pathname: pathnameRef.current,
        });
      }

      // ─── REGULAR CLICK TRACKING ───
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest("a, button, [role=button]") as HTMLElement | null;
      if (!el) return;

      // Build a short label: prefer aria-label > visible text (first 50 chars)
      const label = (
        el.getAttribute("aria-label") ||
        el.getAttribute("data-track") ||
        el.textContent ||
        el.tagName
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50);

      // Outbound link detection
      if (el.tagName === "A") {
        const href = (el as HTMLAnchorElement).href;
        try {
          const u = new URL(href);
          if (u.host && u.host !== window.location.host) {
            send({
              action: "track",
              visitorId: getVisitorId(),
              eventType: "outbound",
              host: u.host.slice(0, 60),
              label,
              pathname: pathnameRef.current,
            });
            return;
          }
        } catch { /* relative url — treat as internal */ }
      }

      // Internal click — only track buttons + elements with data-track or
      // aria-label to avoid drowning in noise from generic <a> clicks
      // already captured as pageviews.
      const isButton = el.tagName === "BUTTON" || el.getAttribute("role") === "button";
      const tagged = el.hasAttribute("data-track") || el.hasAttribute("aria-label");
      if (!isButton && !tagged) return;

      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "click",
        label,
        pathname: pathnameRef.current,
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Rage clicks: integrate în click handler (vezi mai sus, secțiunea
  // RAGE DETECTION). Acest useEffect a fost eliminat ca să economisim
  // un listener pe document.click.

  // Copy events — what content users copy (indicates value)
  useEffect(() => {
    if (isExcluded()) return;
    const onCopy = () => {
      const text = window.getSelection()?.toString().trim() ?? "";
      if (text.length < 3) return;
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "copy",
        length: text.length,
        pathname: pathnameRef.current,
      });
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  // Online/offline transitions
  useEffect(() => {
    if (isExcluded()) return;
    const onOnline = () => send({
      action: "track",
      visitorId: getVisitorId(),
      eventType: "online",
      pathname: pathnameRef.current,
    });
    const onOffline = () => send({
      action: "track",
      visitorId: getVisitorId(),
      eventType: "offline",
      pathname: pathnameRef.current,
    });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // PWA install prompts
  useEffect(() => {
    if (isExcluded()) return;
    const onBeforeInstall = () => trackCustomEvent("pwa-install-prompt");
    const onInstalled = () => trackCustomEvent("pwa-installed");
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Print — users printing sesizări for offline submission
  useEffect(() => {
    if (isExcluded()) return;
    const onPrint = () => trackCustomEvent("print", { pathname: pathnameRef.current });
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, []);

  return null;
}

// Public helpers consumed from feature code (form, auth, search, AI).
// Each emits a specialized event type so the backend can aggregate it
// under its own Redis key.

export function trackFunnelStep(funnel: string, step: string, extra: Record<string, string | number> = {}): void {
  trackCustomEvent("funnel-step", { funnel, step, ...extra });
}

export function trackSearchQuery(query: string, resultCount: number, context: string = "global"): void {
  const q = query.trim().slice(0, 80);
  if (!q) return;
  trackCustomEvent("search", { query: q, results: resultCount, context });
  if (resultCount === 0) {
    trackCustomEvent("search-zero-results", { query: q, context });
  }
}

export function trackAiUsage(feature: string, extra: Record<string, string | number> = {}): void {
  trackCustomEvent("ai-usage", { feature, ...extra });
}

export function trackAuthEvent(kind: "signup" | "signin" | "signout" | "password-reset"): void {
  trackCustomEvent("auth", { kind });
}

export function trackFormAbandon(form: string, step: string): void {
  trackCustomEvent("form-abandon", { form, step });
}
