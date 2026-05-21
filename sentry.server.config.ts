import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Dynamic sampling: 50% pe rute critice (sesizari, auth, upload, admin),
  // 2% baseline pe restul. Sincronizat cu client config — same priorities.
  // Inainte: 10% flat → context inundat cu request-uri normale.
  tracesSampler: (samplingContext) => {
    const name = samplingContext.transactionContext?.name ?? "";
    if (
      name.includes("/api/sesizari") ||
      name.includes("/api/upload") ||
      name.includes("/api/auth") ||
      name.includes("/api/admin") ||
      name.includes("/api/ai")
    ) {
      return 0.5;
    }
    if (name.includes("/api/cron")) {
      // Cron-urile ruleaza rar — pastram 100% pentru visibility.
      return 1.0;
    }
    return 0.02;
  },
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
