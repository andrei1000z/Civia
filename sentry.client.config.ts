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
      return 0.5;
    }
    return 0.02;
  },
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
