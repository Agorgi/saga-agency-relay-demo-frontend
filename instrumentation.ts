// Next.js instrumentation hook. Runs once per runtime startup. Each
// runtime loads the matching Sentry config, which is itself a no-op
// when SENTRY_DSN is unset (i.e. gated off by default).
//
// See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Re-export Sentry's request-error hook so server-side errors thrown
// from route handlers / RSCs flow into Sentry automatically.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
