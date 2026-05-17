import * as Sentry from "@sentry/nextjs";
import { logServerError, type StructuredLogInput } from "@/sms-engine/safeLogging";

export type ServerErrorContext = Omit<
  StructuredLogInput,
  "action" | "error" | "level"
> & {
  /**
   * Optional Sentry-only tags (low cardinality, e.g. persona, route,
   * operation). Avoid free-text user input here — that belongs in
   * structured-log metadata where redaction runs.
   */
  tags?: Record<string, string>;
};

/**
 * Central server-error capture.
 *
 * Always writes a redacted structured log line via logServerError.
 * Additionally forwards to Sentry when SENTRY_DSN is configured, with
 * the same redaction layer applied via the Sentry beforeSend hook.
 *
 * Use this in place of bare console.error calls in API routes and
 * lib functions. Keep call-site context to low-cardinality fields
 * (persona, route, operation, requestId).
 */
export function captureServerError(
  action: string,
  error: unknown,
  context: ServerErrorContext = {},
) {
  const { tags, ...structuredContext } = context;

  logServerError(action, error, structuredContext);

  if (sentryEnabled()) {
    try {
      Sentry.withScope((scope) => {
        if (tags) {
          for (const [key, value] of Object.entries(tags)) {
            scope.setTag(key, value);
          }
        }
        if (structuredContext.entityType) {
          scope.setTag("entityType", structuredContext.entityType);
        }
        if (structuredContext.entityId) {
          scope.setTag("entityId", structuredContext.entityId);
        }
        if (structuredContext.requestId) {
          scope.setTag("requestId", structuredContext.requestId);
        }
        scope.setTag("action", action);
        Sentry.captureException(error);
      });
    } catch {
      // Sentry failures must never crash the request. The structured
      // log line above is the source of truth.
    }
  }
}

export function sentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

/**
 * Health-endpoint summary. Public — never includes the DSN value, only
 * whether it's wired and what environment label is in use.
 */
export function sentryHealthSummary() {
  return {
    dsn_configured: sentryEnabled(),
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    traces_sample_rate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  } as const;
}
