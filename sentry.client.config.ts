import * as Sentry from "@sentry/nextjs";
import { redactForLog } from "@/sms-engine/safeLogging";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      "development",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE,

    // Sample 100% of errors, 10% of transactions. Adjust via env if needed.
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),

    // Never send PII automatically. The honesty contract means we
    // never want user messages, phone numbers, or persona prompts
    // leaving the runtime tagged to a person.
    sendDefaultPii: false,

    // Run every event through the same redaction layer the
    // structured logger uses. Anything that looks like an email,
    // phone, OpenAI key, Twilio SID, etc. gets replaced before send.
    beforeSend(event) {
      try {
        return redactForLog(event) as typeof event;
      } catch {
        // If redaction blows up, drop the event rather than send
        // unredacted data.
        return null;
      }
    },

    // Likewise scrub breadcrumb bodies (Sentry collects fetch/console
    // breadcrumbs by default — those can contain user input).
    beforeBreadcrumb(breadcrumb) {
      try {
        return redactForLog(breadcrumb) as typeof breadcrumb;
      } catch {
        return null;
      }
    },
  });
}
