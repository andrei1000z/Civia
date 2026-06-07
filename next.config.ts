import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Guard against shipping localhost URLs to a real production deploy.
// Skip the check for local prod builds (npm run build on dev machine).
// The Vercel / CI env sets VERCEL=1 or CI=1; those are the ones that matter.
if (
  process.env.NODE_ENV === "production" &&
  (process.env.VERCEL === "1" || process.env.CI === "true" || process.env.CI === "1")
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    throw new Error(
      `[next.config] NEXT_PUBLIC_SITE_URL is set to "${siteUrl}" in production build. ` +
      `Set it to https://civia.ro (or your actual domain) in Vercel / hosting env vars.`
    );
  }
  if (!siteUrl) {
    console.warn("[next.config] NEXT_PUBLIC_SITE_URL is not set — using fallback");
  }
}

const nextConfig: NextConfig = {
  // Explicit distDir + outputFileTracingRoot — 5/22/2026 Vercel modifyConfig
  // crapa cu „path must be string, received undefined" pentru ca expecta
  // aceste optiuni explicit setate, nu fallback la __dirname.
  distDir: ".next",
  outputFileTracingRoot: process.cwd(),
  // 5/22/2026 — accelerare deploy Vercel (Level 1+8 din plan optimizare).
  // TS check rulează local + în vitest, deci skip-uim la build (-30-50s).
  // (Next 16 nu mai rulează ESLint automat la build — zero overhead acolo).
  typescript: {
    ignoreBuildErrors: true,
  },
  // Standalone output — Vercel detectează și creează deployment bundles
  // mai mici (-10-20s upload artifacts). Recommended de Vercel docs.
  output: "standalone",
  // 2026-06-08 — pachete native/grele lăsate externe (nu bundle-uite): unpdf +
  // @napi-rs/canvas pentru OCR PDF scanat (render→imagine→vision) în rutele de
  // inbox. Binarul nativ trebuie rezolvat la runtime, nu împachetat.
  serverExternalPackages: ["@napi-rs/canvas", "unpdf"],
  // În producție, eliminăm console.log-urile (dar păstrăm warn/error
  // pentru Sentry). Reduce bundle + previne PII leaking accidental.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["warn", "error"] }
        : false,
  },
  // 2026-05-25: React Compiler DISABLED — ESLint react-compiler plugin
  // flag-uia 2 errors în Server Components (Date.now()/IIFE callable)
  // care blocau CI lint. Compiler-ul e experimental și marginale beneficii
  // de INP pe codebase-ul actual (manual memoization deja optimal). Re-enable
  // după ce stable + after eslint plugin matures pe Next 16.
  images: {
    // Permissive wildcard — we aggregate news from 30+ Romanian press
    // outlets, each with their own CDN subdomain. Maintaining an
    // explicit allowlist meant images silently broke whenever a feed
    // was added. Next/Image only fetches via `image/*` Accept headers,
    // so the SSRF surface is narrow.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    // Format AVIF prima dată (~50% mai mic decât JPEG la aceeași calitate),
    // fallback automat la WebP, apoi JPEG. Next.js servește formatul cel mai
    // potrivit pe baza Accept header-ului browserului.
    formats: ["image/avif", "image/webp"],
    // Cache-ul imaginilor optimizate la edge — 30 zile (default e 60s).
    minimumCacheTTL: 2592000,
    // SSRF hardening: SVG poate conține <script> + foreignObject → off.
    // contentDispositionType "attachment" obligă browserul să descarce
    // răspunsul, niciodată să-l execute inline → previne SVG XSS chiar
    // dacă cineva forțează un Content-Type spoof prin redirect.
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  /**
   * NU mai facem redirect www↔apex la nivel Next.js. Vercel-ul are
   * configurat la CDN civia.ro → www.civia.ro (la nivel infrastructure)
   * iar redirect-ul invers din Next.js cauza un loop infinit
   * (307 civia.ro → www, 308 www → civia.ro). Vercel Domains tab
   * controlează canonical-ul; codeul rămâne neutru.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      // Tesseract.js pulls its WASM + training data from its own CDN; workers
      // need blob: to bootstrap. Dev-only unsafe-eval is for the React dev
      // server; prod stays tight.
      `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""} https://plausible.io https://cdn.jsdelivr.net https://analytics-seven-steel.vercel.app`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://api.open-meteo.com https://plausible.io https://api.openaq.org https://nominatim.openstreetmap.org https://www.seismicportal.eu https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://cdn.jsdelivr.net https://analytics-seven-steel.vercel.app https://rhjfutxgmnkonichxpro.supabase.co wss://rhjfutxgmnkonichxpro.supabase.co",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' https: data: blob:",
      "frame-ancestors 'self'",
      "frame-src 'self' https://mail.google.com https://outlook.live.com https://compose.mail.yahoo.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          // frame-ancestors in CSP already covers this; X-Frame-Options kept off intentionally.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // Permissions-Policy mai strict (5/8/2026): explicit deny pe
          // payment, USB, serial, bluetooth, MIDI, accelerometer, gyroscope,
          // magnetometer, autoplay non-self. Civia n-are nevoie de niciuna
          // dintre ele -- denying explicit blocheaza scripts third-party
          // (analytics) sa le acceseze, daca incearca.
          {
            key: "Permissions-Policy",
            value: [
              "geolocation=(self)",
              "camera=()",
              // microphone=(self) — VoiceInput foloseste Web Speech API in
              // formularul de sesizari (dictare). Fix 2026-05-15 dupa raport
              // user „Permisiunea microfonului refuzata" pe prima incercare:
              // microphone=() bloca complet API-ul cu service-not-allowed,
              // fara sa apara prompt-ul Chrome. self permite doar same-origin.
              "microphone=(self)",
              "payment=()",
              "usb=()",
              "serial=()",
              "bluetooth=()",
              "midi=()",
              "accelerometer=()",
              "gyroscope=()",
              "magnetometer=()",
              "autoplay=(self)",
              "fullscreen=(self)",
              "picture-in-picture=()",
              "interest-cohort=()", // FLoC opt-out (privacy)
            ].join(", "),
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // same-origin-allow-popups is needed for Supabase OAuth popup flow
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Limita expunerea fingerprint-urilor cross-domain.
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        // Long-lived cache for GeoJSON (they rarely change + committed to repo).
        // 7 days in browser, 30 days on CDN, serve stale for 7 days while revalidating.
        source: "/geojson/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800" },
        ],
      },
      {
        // Static images (events, primari portraits) — hash-immutable via Next Image optimizer,
        // but for direct /images/ access we want long cache too.
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=2592000" },
        ],
      },
      {
        // 2026-05-25 OPTIMIZATION: sitemap.xml are revalidate=21600 (6h) la
        // app-level. Setăm și HTTP cache-control alineat pentru CDN cache hit
        // rate maxim. Robots.txt e static.
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: "public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200" },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, s-maxage=86400" },
        ],
      },
      {
        // Admin + API: no index/follow (defense-in-depth peste meta robots).
        // Inca un strat impotriva crawlerilor care ignora <meta>.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // /cont (profil personal) — date private, nu indexat.
        source: "/cont/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

// 2026-05-28 — withSentryConfig wrapper essential pentru:
//   1. Client-side Sentry SDK loading (sentry.client.config.ts)
//   2. Source map upload la build (debug symbols pentru stack traces)
//   3. Auto-inject Sentry routing instrumentation
//
// FĂRĂ acest wrapper: doar instrumentation.ts server config se încarcă, dar
// client errors + edge errors NU sunt capturate. Verified live 2026-05-28 prin
// Sentry MCP — 0 events în 90 zile cu DSN corect setat în Vercel ENV.
//
// silent: true ca să nu spam build logs.
// hideSourceMaps: true ca să nu expunem .map fișierele în production bundle.
// disableLogger: true pentru bundle size optim (Sentry logger tree-shaken).
export default withSentryConfig(nextConfig, {
  org: "andrei-z4",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  // 2026-05-28 — upload source maps DOAR pe Vercel/CI; local builds skip.
  // Necesar SENTRY_AUTH_TOKEN env pentru upload — setat în Vercel ENV.
  // hideSourceMaps: nu expunem .map fișierele în production bundle.
  sourcemaps: {
    disable: !process.env.CI && !process.env.VERCEL,
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
  automaticVercelMonitors: true,
  // Tunnel route — evită ad-blockers care blochează *.ingest.sentry.io.
  // Browser-ul send la /monitoring (rewrite la Sentry server-side).
  tunnelRoute: "/monitoring",
});
