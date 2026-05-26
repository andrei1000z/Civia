import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 2026-05-25 OPTIMIZATION: 50% → 10% pe rute critice + 1% baseline.
  // Sentry trace generation consumă CPU; 10% sample suficient pentru
  // detect issues. Pe Pro plan trecem înapoi la 50%.
  tracesSampler: (samplingContext) => {
    const name = samplingContext.transactionContext?.name ?? "";
    if (
      name.includes("/api/sesizari") ||
      name.includes("/api/upload") ||
      name.includes("/api/auth") ||
      name.includes("/api/admin") ||
      name.includes("/api/ai")
    ) {
      return 0.1;
    }
    if (name.includes("/api/cron")) {
      // Cron-urile ruleaza rar — pastram 100% pentru visibility.
      return 1.0;
    }
    // 2026-05-27 — baseline bump 1% → 5% pentru observabilitate mai bună
    // pe user flows non-critical (homepage, content pages). Cost +$5-10/mo.
    return 0.05;
  },
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
