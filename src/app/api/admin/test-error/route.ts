/**
 * POST /api/admin/test-error
 *
 * Deliberately throws an error so we can verify the Sentry capture
 * pipeline from end to end. Use after wiring SENTRY_DSN +
 * NEXT_PUBLIC_SENTRY_DSN on a deploy: hit this endpoint with the
 * internal API key, then check the Sentry dashboard for the event.
 *
 *   curl -X POST https://demo.try-saga.com/api/admin/test-error \
 *     -H "x-saga-internal-key: $INTERNAL_API_KEY"
 *
 * Auth: gated by `requireInternalApiKey` (same secret as every other
 * /api/internal/* route). 401 if the header is missing or wrong.
 *
 * What happens when called:
 *  1. captureServerError logs a redacted structured log line via
 *     logServerError (always, even without DSN)
 *  2. If SENTRY_DSN is set, the same call forwards to
 *     Sentry.captureException with action="admin_test_error" so
 *     events are easy to filter in the Sentry UI
 *  3. The request returns a 500 with { error: "test_error",
 *     sentry_dsn_configured } so the caller can confirm the
 *     branch fired
 *
 * The thrown error message includes no PII; it's a fixed string
 * "admin test error — Sentry verification" so the Sentry event is
 * recognizable without anything sensitive in it.
 *
 * See docs/DEPLOY.md "Sentry observability runbook" for the full
 * verification flow.
 */

import { captureServerError, sentryEnabled } from "@/lib/observability";
import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";

export const dynamic = "force-dynamic";

const TEST_ERROR_MESSAGE = "admin test error — Sentry verification";

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  const error = new Error(TEST_ERROR_MESSAGE);
  captureServerError("admin_test_error", error, {
    tags: {
      route: "/api/admin/test-error",
      operation: "sentry_verification",
    },
  });

  return Response.json(
    {
      error: "test_error",
      message: "Deliberate error fired for Sentry verification.",
      sentry_dsn_configured: sentryEnabled(),
    },
    { status: 500 },
  );
}
