/**
 * Client-side Sentry instrumentation (Next.js 16 + @sentry/nextjs v10+).
 *
 * 2026-05-28 — CRITICAL FIX: @sentry/nextjs v10+ a deprecat
 * `sentry.client.config.ts` și folosește `instrumentation-client.ts` la
 * root. Fără acest fișier, client SDK NU se inițializează → 0 events din
 * browser (verified live prin Sentry MCP).
 *
 * Acest fișier mirror-uiește sentry.client.config.ts (păstrat pentru
 * backward-compat). În viitor, sentry.client.config.ts poate fi șters.
 */

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 2026-05-28 — TEMPORAR enabled în toate environments + sampleRate 1.0
  // ca să confirmăm wireup. După ce vedem events apar, revenim la
  // enabled: NODE_ENV === "production".
  enabled: true,
  sampleRate: 1.0,
  tracesSampler: (samplingContext) => {
    const name = samplingContext.transactionContext?.name ?? "";
    if (
      name.includes("/api/sesizari") ||
      name.includes("/api/upload") ||
      name.includes("/api/auth") ||
      name.includes("/api/admin")
    ) {
      return 0.1;
    }
    return 0.05;
  },
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  debug: false,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  integrations: [
    Sentry.browserTracingIntegration({
      enableInp: true,
      enableLongAnimationFrame: true,
    }),
  ],
});

// 2026-05-28 — onRouterTransitionStart required pentru Next.js App Router
// navigation tracking (Sentry v10+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
