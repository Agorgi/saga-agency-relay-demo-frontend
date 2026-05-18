import * as Sentry from "@sentry/nextjs";
import {
  redactForLog,
  SENTRY_REDACT_MAX_DEPTH,
} from "@/sms-engine/safeLogging";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    release: process.env.SENTRY_RELEASE,

    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

    sendDefaultPii: false,

    // Sentry events nest deeper than typical log lines; pass the
    // Sentry-tuned depth limit so stack frames survive redaction.
    beforeSend(event) {
      try {
        return redactForLog(event, 0, SENTRY_REDACT_MAX_DEPTH) as typeof event;
      } catch {
        return null;
      }
    },

    beforeBreadcrumb(breadcrumb) {
      try {
        return redactForLog(
          breadcrumb,
          0,
          SENTRY_REDACT_MAX_DEPTH,
        ) as typeof breadcrumb;
      } catch {
        return null;
      }
    },
  });
}
