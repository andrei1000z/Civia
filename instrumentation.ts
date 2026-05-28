// 2026-05-28 — CRITICAL: Sentry.init() trebuie să ruleze SYNC la module
// evaluation time. Pattern-ul `register()` async cu dynamic import nu
// garantează init înainte de prima request → SDK rămâne neinitializat
// pe Vercel serverless (verified via diagnostic /api/admin/sentry-test
// returnând sdkInitialized:false).
//
// Fix: top-level import → Sentry.init() rulează imediat când Next.js
// încarcă instrumentation.ts. Static analysis decide ce config să
// includă bazat pe NEXT_RUNTIME la build time.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_RUNTIME === "nodejs") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./sentry.server.config");
}
if (process.env.NEXT_RUNTIME === "edge") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./sentry.edge.config");
}

// register() rămâne pentru backwards-compat cu Next.js instrumentation
// hook. Init-ul real e mai sus, dar Next.js so calls register() pentru
// orice hooks suplimentare (none here).
export async function register() {
  // no-op — init runs at top-level module evaluation
}

// Sentry helper oficial pentru capture Next.js request errors (mai bun
// decât captureException simplu — adaugă context routing automat).
export const onRequestError = Sentry.captureRequestError;
