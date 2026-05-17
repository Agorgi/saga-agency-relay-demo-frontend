import * as Sentry from "@sentry/nextjs";
import { redactForLog } from "@/sms-engine/safeLogging";

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

    // Errors at 100%, transactions sampled lower by default to keep
    // quota usage predictable.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

    sendDefaultPii: false,

    // Reuse the structured-logger redactor so the same secrets,
    // emails, phones, and sensitive keys are stripped.
    beforeSend(event) {
      try {
        return redactForLog(event) as typeof event;
      } catch {
        return null;
      }
    },

    beforeBreadcrumb(breadcrumb) {
      try {
        return redactForLog(breadcrumb) as typeof breadcrumb;
      } catch {
        return null;
      }
    },
  });
}
