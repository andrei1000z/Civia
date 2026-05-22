import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.02,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
