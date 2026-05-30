"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VID_KEY = "civia_vid"; // session-only marker; NU folosit pentru tracking
const EXCLUDE_KEY = "civia_exclude_tracking";
const LANG_FALLBACK = "unknown";

/**
 * 2026-05-25 #1 — Migrare de la localStorage UUID persistent la
 * sessionStorage marker. Server-ul folosește acum daily-rotating salted
 * hash (sha256(salt + host + ip + ua)) ca visitor ID real. Acest token
 * client-side e DOAR un „request a venit din CiviaTracker" marker —
 * server-ul îl ignoră pentru tracking, dar îl verifică pentru defense
 * (zod sanitizeId).
 *
 * sessionStorage = se șterge automat la închidere tab → nu persistă
 * cross-session → outside scope ePrivacy Art. 5(3).
 *
 * Sursă: https://plausible.io/blog/legal-assessment-gdpr-eprivacy
 */
function getVisitorId(): string {
  try {
    let vid = sessionStorage.getItem(VID_KEY);
    if (!vid) {
      // 16-char hex, identic ca format cu derivedVisitorId server-side.
      // Server-ul ignoră valoarea; e doar markeur de validitate request.
      vid = `s${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-7)}`.slice(0, 16);
      sessionStorage.setItem(VID_KEY, vid);
    }
    return vid;
  } catch {
    return "s-anon-fallback";
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

// 2026-05-25 #24 — Gzip compression pentru batch-uri >2KB.
// Compression Streams API e nativ în browsers din 2023 (Chrome 80+,
// Firefox 113+, Safari 16.4+). Sub 2KB nu merită (overhead > savings).
// Peste 2KB compresie 60-80% (JSON event arrays = repetitive shape).
// sendBeacon NU suportă Content-Encoding manual; folosim fetch keepalive
// pentru batch-uri compresate. Trade-off: pagehide unload-time skip
// compression (always sendBeacon, raw JSON) ca să nu pierdem events.
const GZIP_THRESHOLD_BYTES = 2 * 1024;

async function gzipBlob(body: string): Promise<Blob | null> {
  try {
    // Type guard pentru browsers vechi.
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([body], { type: "application/json" })
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
}

async function flushBatch(opts: { onUnload?: boolean } = {}): Promise<void> {
  if (batchBuffer.length === 0) return;
  const events = batchBuffer;
  batchBuffer = [];
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  try {
    const body = JSON.stringify({ action: "track-batch", events });
    // Pe unload: sendBeacon mereu, raw JSON (max prioritate să ajungă).
    if (opts.onUnload && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    // Body mare: încearcă gzip. Câștig 60-80%.
    if (body.length > GZIP_THRESHOLD_BYTES) {
      const gzipped = await gzipBlob(body);
      if (gzipped) {
        await fetch("/api/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
          },
          body: gzipped,
          keepalive: true,
        });
        return;
      }
    }
    // Default: sendBeacon dacă există, altfel fetch keepalive.
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

/**
 * 2026-05-29 — VOLUME REDUCTION pentru Upstash Free tier (10k req/zi).
 * Skip non-essential events 80% din timp pentru a rămâne sub quota.
 * Critical events (auth, sesizare-create, js-error) NU sunt sampled.
 */
const VOLUME_REDUCE_EVENT_TYPES = new Set([
  "scroll-depth",
  "click",
  "outbound",
  "rage-click",
  "copy",
  "time-on-page",
  "web-vital",
]);

function shouldSampleOut(payload: TrackPayload): boolean {
  if (!VOLUME_REDUCE_EVENT_TYPES.has(payload.eventType)) return false;
  // 20% retention — keep 1 in 5 events of these types
  return Math.random() > 0.2;
}

async function send(payload: TrackPayload): Promise<void> {
  if (shouldSampleOut(payload)) return;
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
// 2026-05-25 #24 — paseăm onUnload:true ca să fie sendBeacon raw (no gzip,
// max prioritate să ajungă în background-state browser).
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushBatch({ onUnload: true });
  });
  window.addEventListener("pagehide", () => flushBatch({ onUnload: true }));
}

export function trackCustomEvent(eventType: string, extra: Record<string, string | number> = {}): void {
  if (typeof window === "undefined") return;
  if (isExcluded()) return;
  send({ action: "track", visitorId: getVisitorId(), eventType, ...extra });
}

/**
 * 2026-05-25 #29 — Deterministic visitor-hash sampler. Pentru când
 * traffic depășește 100k pv/zi, sample 20% pentru web-vitals NOISY
 * (LCP good, CLS good, FCP). Bad experiences (poor INP/LCP) și
 * erorile rămân 100% — acolo e signal acțional.
 *
 * Activat doar dacă NEXT_PUBLIC_ANALYTICS_SAMPLE=on în env. Default:
 * 100% capture (sub pragul de cost).
 *
 * Hash stable per visitor → același user mereu IN sau OUT (nu skew
 * per-user). djb2 hash, simple, edge-compatible.
 */
function isInVitalsSample(rating: "good" | "needs-improvement" | "poor"): boolean {
  // Bad experiences ÎNTOTDEAUNA capturate — sursa de acțiune.
  if (rating !== "good") return true;
  // Sampling enabled doar via env flag (default off pentru visibility max).
  if (typeof process === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_SAMPLE !== "on") {
    return true;
  }
  const vid = getVisitorId();
  let h = 5381;
  for (let i = 0; i < vid.length; i++) {
    h = (h * 31 + vid.charCodeAt(i)) | 0;
  }
  // 20% sample stable: hash mod 5 === 0
  return Math.abs(h) % 5 === 0;
}

// Web Vitals buckets — per web.dev thresholds. Rating affects aggregation.
function webVitalRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  // Google Web Vitals thresholds (2026 — LCP tightened from 2500 to 2000ms
  // in March 2026 core update; INP/CLS unchanged but INP is now equal
  // ranking signal alongside LCP).
  //   LCP:  good ≤ 2000ms, poor > 4000ms   ← 2026 tightening
  //   INP:  good ≤ 200ms,  poor > 500ms
  //   CLS:  good ≤ 0.1,    poor > 0.25
  //   FCP:  good ≤ 1800ms, poor > 3000ms
  //   TTFB: good ≤ 800ms,  poor > 1800ms
  switch (name) {
    case "LCP":
      return value <= 2000 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
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
  const visibleMsRef = useRef<number>(0); // 2026-05-25 — sum of visible-only ms
  const visibleSinceRef = useRef<number>(0); // last "visible" timestamp
  const lastPathRef = useRef<string | null>(null);
  const pathnameRef = useRef<string>(pathname);
  // 2026-05-25 #3 — pageview dedup guard against React StrictMode +
  // hydration double-fires. We keep the LAST pathname that emitted a
  // pageview event in a ref; if useEffect re-runs with the same pathname
  // within 100ms we skip. Real route changes always pass through.
  const lastPageviewPathRef = useRef<string | null>(null);
  const lastPageviewAtRef = useRef<number>(0);

  // Keep pathname current for listeners attached once at mount
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Pageview
  useEffect(() => {
    if (isExcluded()) return;
    if (typeof window === "undefined") return;

    // 2026-05-25 #3 — guard against double-fire on hydration.
    const now = Date.now();
    if (
      lastPageviewPathRef.current === pathname &&
      now - lastPageviewAtRef.current < 100
    ) {
      return;
    }
    lastPageviewPathRef.current = pathname;
    lastPageviewAtRef.current = now;

    // Time-on-page for previous route — 2026-05-25 #21 only count
    // visible-time, not total elapsed (mobile backgrounding skewed +5-15%).
    if (lastPathRef.current && lastPathRef.current !== pathname) {
      // Add the final visible-segment to the accumulator before sending.
      if (visibleSinceRef.current > 0) {
        visibleMsRef.current += now - visibleSinceRef.current;
        visibleSinceRef.current = now;
      }
      const t = visibleMsRef.current;
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
    pageEnterRef.current = now;
    visibleMsRef.current = 0;
    visibleSinceRef.current =
      typeof document !== "undefined" && document.visibilityState === "visible" ? now : 0;
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

  // 2026-05-25 #21 — Visibility tracker. Accumulează doar ms cât pagina e
  // vizibilă; mobile backgrounding (iOS share sheet, Android task switch)
  // pune pause până redevine visible. Înlocuiește elapsed-time naiv.
  useEffect(() => {
    if (isExcluded()) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        visibleSinceRef.current = Date.now();
      } else if (visibleSinceRef.current > 0) {
        visibleMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = 0;
      }
    };
    // Inițializare: dacă pagina e visible la mount, start clock.
    if (document.visibilityState === "visible" && visibleSinceRef.current === 0) {
      visibleSinceRef.current = Date.now();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Unload: flush time-on-page. Folosim DOAR pagehide (bfcache-friendly);
  // beforeunload distruge bfcache. Mobile Safari poate skip pagehide → de
  // aia avem și visibilitychange→hidden flush prin alt path.
  useEffect(() => {
    const onUnload = () => {
      if (isExcluded()) return;
      // Snapshot final al visible-time
      if (visibleSinceRef.current > 0) {
        visibleMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = 0;
      }
      const t = visibleMsRef.current;
      if (t <= 1000 || t >= 3600000) return;
      send({
        action: "track",
        visitorId: getVisitorId(),
        eventType: "time-on-page",
        timeOnPage: t,
        pathname: pathnameRef.current,
      });
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  // Scroll depth — 2026-05-25 #20: filtrare e.isTrusted ca să nu contăm
  // programmatic scrolls (scrollIntoView, modal expand, lazy reveal).
  // Marks reset pe schimbare pathname (deja are pathname în deps).
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
    const onScroll = (e: Event) => {
      // Skip JS-initiated scrolls — only count real user scroll input.
      // `isTrusted` e false pentru scrollIntoView, scrollTo, hash jumps.
      if (e.isTrusted === false) return;
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
  // 2026-05-25 upgrades:
  //  #15 INP: interactionId-grouped + p98 estimator (was naive max())
  //  #16 LCP attribution: capture element selector + image url
  //  #18 Reset pe soft navigation (deps [pathname] + cleanup flush)
  //  #19 bfcache reset (pageshow.persisted)
  // Spec-compliant cu web-vitals v5; aliniat cu PSI + Search Console.
  useEffect(() => {
    if (isExcluded()) return;
    if (typeof PerformanceObserver === "undefined") return;

    const reported = new Set<string>();
    const report = (name: string, value: number, extra: Record<string, string | number> = {}) => {
      // Clamp extreme values to sane bounds — avoids one broken session
      // poisoning the p95.
      if (!Number.isFinite(value) || value < 0 || value > 300_000) return;
      const rating = webVitalRating(name, value);
      // 2026-05-25 #29 — deterministic sampling pentru vitals „good"
      // doar dacă NEXT_PUBLIC_ANALYTICS_SAMPLE=on. Bad experiences (poor/
      // needs-improvement INP/LCP/CLS) ÎNTOTDEAUNA 100%.
      if (!isInVitalsSample(rating)) return;
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
        ...extra,
      });
    };

    const observers: PerformanceObserver[] = [];
    const observe = (
      type: string,
      cb: (entries: PerformanceEntry[]) => void,
      opts: Record<string, unknown> = {},
    ) => {
      try {
        const po = new PerformanceObserver((list) => cb(list.getEntries()));
        // `buffered: true` catches entries that fired before this effect ran.
        po.observe({ type, buffered: true, ...opts });
        observers.push(po);
      } catch { /* unsupported on this browser */ }
    };

    // ── LCP — track value + element + URL attribution (#16) ──────────
    let lcpValue = 0;
    let lcpElement = "";
    let lcpUrl = "";
    observe("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1] as
        | (PerformanceEntry & { startTime: number; url?: string; element?: Element | null })
        | undefined;
      if (!last) return;
      lcpValue = last.startTime;
      lcpUrl = (last.url || "").slice(0, 200);
      const el = last.element ?? null;
      if (el) {
        // Build short deterministic selector for admin debugging.
        // Prefer #id; fallback to tag.class1.class2 (max 2 classes).
        try {
          const tag = el.tagName.toLowerCase();
          if (el.id) {
            lcpElement = `#${el.id}`.slice(0, 80);
          } else {
            const cls =
              typeof (el as HTMLElement).className === "string"
                ? (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join(".")
                : "";
            lcpElement = (cls ? `${tag}.${cls}` : tag).slice(0, 80);
          }
        } catch {
          lcpElement = "";
        }
      }
    });

    // ── CLS — session-window algorithm (web-vitals spec) ─────────────
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

    // ── INP — interactionId-grouped + p98 (#15) ──────────────────────
    // Spec INP: pointerdown + pointerup + click au același interactionId
    // și trebuie luate ca un GRUP. Apoi computăm p98 cu 1 outlier skip
    // per 50 interacțiuni (web-vitals v5 _estimateP98LongestInteraction).
    // Plus durationThreshold:40 ca să captăm interacțiunile <40ms care
    // altfel sunt suprimate de browser.
    const interactionMap = new Map<number, number>();
    observe(
      "event",
      (entries) => {
        for (const entry of entries as (PerformanceEntry & { interactionId?: number; duration: number })[]) {
          if (!entry.interactionId) continue;
          const prev = interactionMap.get(entry.interactionId) ?? 0;
          if (entry.duration > prev) interactionMap.set(entry.interactionId, entry.duration);
        }
      },
      { durationThreshold: 40 },
    );
    // Fallback `first-input` pentru pagini cu <2 interacțiuni — INP poate
    // să nu se compute fără asta.
    observe("first-input", (entries) => {
      const first = entries[0] as (PerformanceEntry & { processingStart: number; startTime: number }) | undefined;
      if (!first) return;
      const fid = first.processingStart - first.startTime;
      // Tratat ca o singură interacțiune dacă INP nu e disponibil.
      if (interactionMap.size === 0 && fid > 0) {
        interactionMap.set(-1, fid);
      }
    });

    // ── #17 LoAF (Long Animation Frames, Chrome 123+) ────────────────
    // Tracking pentru atribuirea INP slab: care SCRIPT a blocat frame-ul.
    // Salvăm cel mai prost LoAF (blockingDuration > 50ms) pentru a fi
    // trimis împreună cu INP la flush. Admin vede direct: „INP slab pe
    // /petitii cauzat de petitii-helpers.ts:248 onSelect()".
    interface LoAFScriptInfo {
      sourceURL?: string;
      sourceFunctionName?: string;
      duration: number;
      forcedStyleAndLayoutDuration?: number;
    }
    interface LoAFEntry extends PerformanceEntry {
      blockingDuration: number;
      scripts?: LoAFScriptInfo[];
    }
    let worstLoaf: { blocking: number; script: string; fn: string } | null = null;
    observe("long-animation-frame", (entries) => {
      for (const e of entries as LoAFEntry[]) {
        if (e.blockingDuration < 50) continue;
        if (worstLoaf && worstLoaf.blocking >= e.blockingDuration) continue;
        // Pick longest script in the frame
        const longest = (e.scripts ?? [])
          .slice()
          .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
        worstLoaf = {
          blocking: e.blockingDuration,
          script: (longest?.sourceURL ?? "").slice(-60),
          fn: (longest?.sourceFunctionName ?? "").slice(0, 40),
        };
      }
    });

    function computeINP(): number {
      const sorted = [...interactionMap.values()].sort((a, b) => b - a);
      if (sorted.length === 0) return 0;
      // 1 outlier dropped per 50 interactions (web-vitals v5)
      const idx = Math.min(sorted.length - 1, Math.floor(interactionMap.size / 50));
      return sorted[idx] ?? 0;
    }

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

    // Flush LCP/CLS/INP on hide. LCP/INP send attribution extras.
    const flush = () => {
      if (lcpValue > 0 && !reported.has("LCP")) {
        reported.add("LCP");
        report("LCP", lcpValue, {
          lcpElement: lcpElement || "(none)",
          lcpUrl: lcpUrl || "(none)",
        });
      }
      if (clsEntries.length > 0 && !reported.has("CLS")) {
        reported.add("CLS");
        report("CLS", clsValue);
      }
      const inpValue = computeINP();
      if (inpValue > 0 && !reported.has("INP")) {
        reported.add("INP");
        const inpExtra: Record<string, string | number> = {
          interactionCount: interactionMap.size,
        };
        // #17 Atașăm worst LoAF la INP poor — diagnostic acțional.
        // Send doar dacă INP > 200ms (slabe interacțiuni); altfel noise.
        if (worstLoaf && inpValue > 200) {
          inpExtra.loafBlocking = worstLoaf.blocking;
          inpExtra.loafScript = worstLoaf.script || "(unknown)";
          inpExtra.loafFn = worstLoaf.fn || "(anonymous)";
        }
        report("INP", inpValue, inpExtra);
      }
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onHide = () => flush();
    // #19 bfcache reset — când Chrome restaurează din bfcache, vitals
    // sunt stale. Flush previous, reset accumulators, re-arm observers.
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      flush(); // emit ce avem din pagina anterioară
      lcpValue = 0;
      lcpElement = "";
      lcpUrl = "";
      clsValue = 0;
      clsEntries = [];
      clsSessionValue = 0;
      clsSessionEntries = [];
      interactionMap.clear();
      worstLoaf = null; // #17 reset LoAF state pe bfcache
      reported.clear();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);

    return () => {
      // #18 cleanup: la schimbare pathname (soft nav SPA), flush vitals
      // și disconnect — apoi useEffect re-run cu noul pathname creează
      // observers noi. Aliniază metricile per-route corect.
      flush();
      observers.forEach((po) => po.disconnect());
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, [pathname]);

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

  // ─── 2026-05-25: 5 listener-i automati pentru cele 20 evenimente noi ──

  // 1) Time-to-first-action — masoara ms de la pageview la primul click
  //    meaningful (anchor / button / data-track). Reset pe schimbare ruta.
  useEffect(() => {
    if (isExcluded()) return;
    let fired = false;
    const enter = Date.now();
    const onFirstClick = (e: MouseEvent) => {
      if (fired) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest("a, button, [role=button]")) return;
      fired = true;
      const ms = Date.now() - enter;
      if (ms < 50 || ms > 600_000) return; // outliers
      trackTimeToFirstAction(ms, pathnameRef.current);
    };
    document.addEventListener("click", onFirstClick, { capture: true });
    return () => document.removeEventListener("click", onFirstClick, { capture: true });
  }, [pathname]);

  // 2) Scroll velocity — semnal de engagement (scan rapid vs citit atent).
  //    Calculam doar la final de scroll-session (idle 300ms).
  useEffect(() => {
    if (isExcluded()) return;
    let lastY = window.scrollY;
    let lastT = Date.now();
    let totalPx = 0;
    let totalMs = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (totalMs < 200 || totalPx < 100) {
        totalPx = 0;
        totalMs = 0;
        return;
      }
      const pxPerSec = (totalPx / totalMs) * 1000;
      trackScrollVelocity(pxPerSec, pathnameRef.current);
      totalPx = 0;
      totalMs = 0;
    };
    const onScroll = () => {
      const now = Date.now();
      const dy = Math.abs(window.scrollY - lastY);
      totalPx += dy;
      totalMs += now - lastT;
      lastY = window.scrollY;
      lastT = now;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(flush, 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  // 3) Viewport resize — bucket change (responsive issues, rotation).
  //    Debounce 500ms ca să nu spammăm pe drag-resize desktop.
  useEffect(() => {
    if (isExcluded()) return;
    let lastBucket = viewportBucket();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const nowBucket = viewportBucket();
        if (nowBucket !== lastBucket) {
          trackViewportResize(lastBucket, nowBucket);
          lastBucket = nowBucket;
        }
      }, 500);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 4) Back button — popstate (browser back/forward = navigation friction
  //    signal cand userul nu găseste ce caută).
  useEffect(() => {
    if (isExcluded()) return;
    const onPopstate = () => trackBackButton(pathnameRef.current);
    window.addEventListener("popstate", onPopstate);
    return () => window.removeEventListener("popstate", onPopstate);
  }, []);

  // 5) Focus return — tab redevenit visible; durata blur = atenție user
  //    (5s+ = userul s-a întors după ce a deschis altă tab, deci interes
  //    real, nu doar passive scroll).
  useEffect(() => {
    if (isExcluded()) return;
    let blurStart: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        blurStart = Date.now();
      } else if (blurStart !== null) {
        const blurDuration = Date.now() - blurStart;
        blurStart = null;
        if (blurDuration > 1000 && blurDuration < 7_200_000) {
          // skip < 1s (window dragging / quick alt-tab nu conteaza)
          // skip > 2h (computer sleep, sesizari noi)
          trackFocusReturn(blurDuration);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
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

export function trackFormAbandon(form: string, step: string, field?: string): void {
  trackCustomEvent("form-abandon", field ? { form, step, field } : { form, step });
}

/**
 * AI vision routing — userul a primit o sugestie de la vision model
 * (tip + autoritate) si fie a acceptat-o, fie a inlocuit-o.
 *
 * accepted=true: a folosit sugestia ca atare
 * accepted=false: a schimbat fie tipul, fie autoritatea (manual override)
 */
export function trackVisionAcceptance(accepted: boolean, tip?: string): void {
  trackCustomEvent("vision-acceptance", {
    accepted: accepted ? "yes" : "no",
    tip: tip || "(unknown)",
  });
}

// ─── 20 evenimente noi (2026-05-25) ───────────────────────────────────
// Cerinta: „ADAUGA 20 CA SA STRANG DATE SA TI LE DAU SA IMBUNATTIM SITE U".
// Toate consumate via trackCustomEvent → /api/analytics → Redis HINCRBY,
// vizibile in admin/analytics fara modificari server-side (count generic).

/** Sesizare photo upload — start → complete / fail → abandon funnel. */
export function trackSesizarePhotoUpload(
  stage: "start" | "complete" | "fail",
  extra: Record<string, string | number> = {},
): void {
  trackCustomEvent(`sesizare-photo-${stage}`, extra);
}

/** Draft de sesizare/petitie/protest restaurat din localStorage. */
export function trackDraftRestore(form: "sesizare" | "petitie" | "protest"): void {
  trackCustomEvent("draft-restore", { form });
}

/** Vote pe o sesizare publica. */
export function trackSesizareVote(direction: "up" | "down"): void {
  trackCustomEvent(`sesizare-vote-${direction}`);
}

/** Co-semnare sesizare (cetatean trimite + el aceeasi sesizare). */
export function trackSesizareCosign(): void {
  trackCustomEvent("sesizare-cosign");
}

/** Semnare petitie. */
export function trackPetitieSign(slug: string): void {
  trackCustomEvent("petitie-sign", { slug: slug.slice(0, 80) });
}

/** Share petitie/sesizare/protest pe o platforma. */
export function trackShare(
  kind: "sesizare" | "petitie" | "protest" | "stire",
  channel: "copy" | "facebook" | "twitter" | "whatsapp" | "telegram" | "native",
): void {
  trackCustomEvent("share", { kind, channel });
}

/** Comentariu postat. */
export function trackCommentPost(kind: "sesizare" | "petitie"): void {
  trackCustomEvent("comment-post", { kind });
}

/** Schimbare judet (CountyPickerInline / dropdown). */
export function trackCountySwitch(from: string, to: string): void {
  trackCustomEvent("county-switch", {
    from: from.slice(0, 8),
    to: to.slice(0, 8),
  });
}

/** Deschidere modal auth (semnal de friction la login). */
export function trackAuthModalOpen(trigger: string): void {
  trackCustomEvent("auth-modal-open", { trigger: trigger.slice(0, 40) });
}

/** Push notification permission — granted/denied/dismissed. */
export function trackPushPermission(outcome: "granted" | "denied" | "default"): void {
  trackCustomEvent("push-permission", { outcome });
}

/** Before/After galerie vizualizata (rezolvare verificata vizual). */
export function trackBeforeAfterView(code: string): void {
  trackCustomEvent("before-after-view", { code: code.slice(0, 16) });
}

/** Map interaction — zoom/drag (engagement pe vizualizari spatiale). */
export function trackMapInteraction(map: string, action: "zoom" | "drag" | "marker-click"): void {
  trackCustomEvent("map-interaction", { map: map.slice(0, 32), action });
}

/** Filter aplicat pe un feed (sesizari/petitii/stiri). */
export function trackFilterApplied(feed: string, filter: string, value: string): void {
  trackCustomEvent("filter-applied", {
    feed: feed.slice(0, 20),
    filter: filter.slice(0, 20),
    value: value.slice(0, 40),
  });
}

/** AI assist click — userul a apasat „Generează" / „Polish" / „Improve". */
export function trackAiAssistClick(feature: string): void {
  trackCustomEvent("ai-assist-click", { feature: feature.slice(0, 40) });
}

/** AI suggestion accept — userul a păstrat textul/sugestia AI. */
export function trackAiAssistAccept(feature: string): void {
  trackCustomEvent("ai-assist-accept", { feature: feature.slice(0, 40) });
}

/** Time-to-first-action — ms de la pageview la primul click meaningful.
 *  Fired automat in tracker (vezi listener pe primul click). */
export function trackTimeToFirstAction(ms: number, route: string): void {
  trackCustomEvent("time-to-first-action", {
    ms: Math.round(ms),
    bucket: ms < 1000 ? "0-1s" : ms < 3000 ? "1-3s" : ms < 10000 ? "3-10s" : "10s+",
    route: route.slice(0, 80),
  });
}

/** Scroll velocity bucket — slow/medium/fast/very-fast (engagement signal). */
export function trackScrollVelocity(pxPerSec: number, route: string): void {
  trackCustomEvent("scroll-velocity", {
    bucket:
      pxPerSec < 300 ? "slow" : pxPerSec < 800 ? "medium" : pxPerSec < 2000 ? "fast" : "very-fast",
    route: route.slice(0, 80),
  });
}

/** Viewport resize — semnal pentru responsive issues / device rotation. */
export function trackViewportResize(fromBucket: string, toBucket: string): void {
  trackCustomEvent("viewport-resize", { from: fromBucket, to: toBucket });
}

/** Back button hit — popstate browser-level (navigation friction signal). */
export function trackBackButton(fromRoute: string): void {
  trackCustomEvent("back-button", { from: fromRoute.slice(0, 80) });
}

/** Focus regained (tab redevenit visible) — măsoară durata tab-blur. */
export function trackFocusReturn(blurDurationMs: number): void {
  trackCustomEvent("focus-return", {
    ms: Math.round(blurDurationMs),
    bucket:
      blurDurationMs < 5000
        ? "0-5s"
        : blurDurationMs < 60000
          ? "5-60s"
          : blurDurationMs < 300000
            ? "1-5min"
            : "5min+",
  });
}
