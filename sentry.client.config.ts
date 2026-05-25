import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Dynamic sampling: 2% baseline pe ruts normale, 100% pe API + flow-uri
  // critice (sesizari/checkout/auth). Inainte: 10% flat → context inundat
  // cu request-uri obisnuite + cost analytics inutil.
  tracesSampler: (samplingContext) => {
    const name = samplingContext.transactionContext?.name ?? "";
    if (
      name.includes("/api/sesizari") ||
      name.includes("/api/upload") ||
      name.includes("/api/auth") ||
      name.includes("/api/admin")
    ) {
      // 2026-05-25 OPTIMIZATION: 50% → 10%. Pe Pro plan revenim la 50%.
      return 0.1;
    }
    return 0.01;
  },
  // 2026-05-25 #30 — replays reduced: 0% baseline (cost), 0.1 pe erori
  // (per research Datadog + Sentry pricing guide). 0.5 era over-spec:
  // 1 din 2 erori capturate cu video înseamnă cost dublu pe error events
  // în Sentry. 0.1 = 1 din 10, suficient pentru reproducere fără bloat.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  // 2026-05-24 Faza 8: Browser tracing enabled pentru web vitals.
  // INP / LCP / CLS automat tracked + send la Sentry ca measurements.
  // Setup alerts în Sentry UI: Performance → Web Vitals → P75 > thresholds.
  // Suggested alert rules:
  //   - LCP P75 > 2500ms — warn (mobile slow), > 4000ms — critical
  //   - CLS P75 > 0.1 — warn, > 0.25 — critical
  //   - INP P75 > 200ms — warn, > 500ms — critical
  integrations: [
    Sentry.browserTracingIntegration({
      // Trace all navigations + page loads → automat measurements pe Web Vitals
      enableInp: true,
      enableLongAnimationFrame: true,
    }),
  ],
});
