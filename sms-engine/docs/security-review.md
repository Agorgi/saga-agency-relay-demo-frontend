# Security and Privacy Review

Date: May 7, 2026

Scope: Saga Producer MVP staging app in mock-message mode. This review does not
authorize live Twilio, real SMS, real Saga app integration, ticketing, RSVPs, QR
codes, event publishing, ticket sales, payments, or production data access.

## Staging Boundary

- Staging messaging mode remains `MESSAGING_PROVIDER=MOCK`.
- Twilio is unconfigured for the staging baseline.
- Twilio-specific staging may use real credentials only with
  `SMS_SENDS_DISABLED=true`, `SMS_REQUIRE_ALLOWLIST=true`,
  `TWILIO_STAGING_MODE=true`, and `TWILIO_VALIDATE_WEBHOOKS=true`.
- A2P/10DLC or toll-free verification remains required before any real outbound
  design-partner SMS.
- OpenAI is optional; deterministic fallback mode is supported.
- The existing Saga mobile/web app is not connected.
- Internal API traffic is gated by `X-Saga-Internal-Key`.

## Findings and Fixes

### Admin Auth

- `/admin/(dashboard)` routes are protected by `requireAdmin()` in the dashboard
  layout.
- `ADMIN_PASSWORD` is read server-side only through `getAdminEnv()` and is not
  rendered into client components.
- The admin session cookie is `httpOnly`, `sameSite=lax`, path-scoped to `/`,
  and `secure` in production.
- Logout now expires the cookie with the same path/security attributes used when
  setting it.

### Internal API

- Every `/api/internal/saga/*` route inspected calls `requireInternalApiKey()`
  before processing.
- Missing or incorrect `X-Saga-Internal-Key` returns `401`.
- Internal API key comparison now uses a constant-time hash comparison.
- Unauthorized audit logging records only the route pathname, not full query
  strings or header values.
- Internal API error responses do not expose raw Prisma errors.
- Public/internal-app serializers omit raw phone, raw email, `internalNotes`,
  `availabilityNotes`, and `rateNotes`.

### Messaging Provider Boundary

- Group chat creation now uses the channel-agnostic messaging provider instead
  of calling low-level Twilio helpers directly.
- With `MESSAGING_PROVIDER=MOCK`, `getMessagingProvider("TWILIO")` still returns
  `MockMessagingProvider`.
- Mock mode returns mock SIDs and does not call Twilio.

### Webhooks

- Twilio webhook routes still do not require Twilio env vars for app startup or
  mock demo mode.
- Twilio webhook validation now rejects webhook processing when core Twilio
  webhook config is absent, even if `TWILIO_VALIDATE_WEBHOOKS=false`.
- Signature validation remains required by default whenever Twilio webhook config
  is present, unless explicitly disabled for local development.
- Inbound Twilio routes return empty TwiML only; TwiML `<Message>` replies are
  not allowed to bypass `SMS_SENDS_DISABLED`.
- Provider-level Twilio sends are blocked when `SMS_SENDS_DISABLED=true` and
  non-allowlisted recipients are blocked when `SMS_REQUIRE_ALLOWLIST=true`.
- Status callback fixtures cover valid/invalid signatures, duplicate callback
  handling, common delivery states, unknown statuses, and metadata updates
  without sending SMS.

### Logging

- Server error logging now redacts configured secret values and database URLs.
- Raw server errors were replaced with sanitized logging in audit writes,
  internal API errors, health check database failures, LLM completion failures,
  and Twilio webhook failures.
- Do not log `DATABASE_URL`, `INTERNAL_API_KEY`, `ADMIN_PASSWORD`,
  `TWILIO_AUTH_TOKEN`, or `OPENAI_API_KEY`.

## Tests Added

`npm run test:security` verifies:

- Unauthorized internal API requests return `401`.
- Internal API auth responses do not include the configured key.
- Safe person serialization does not expose raw phone/email or private profile
  notes.
- `MESSAGING_PROVIDER=MOCK` does not return a Twilio provider even when Twilio
  env vars are present.
- Twilio webhooks are rejected when Twilio config is absent.
- Log redaction removes known secret values, database URLs, raw phones, and raw
  emails.

`npm run test:staging-baseline` runs:

- `test:security`
- `test:workflow`
- `test:agent`
- `test:matching`
- `test:demo-flow`

## Remaining Professional Review Risks

- Admin auth is still an MVP password/cookie system and should be replaced or
  reviewed before production.
- Internal API auth uses a shared secret; production should use stronger
  service-to-service authentication, rotation, and request logging controls.
- Production database migrations must be reviewed before touching real Saga user
  data.
- Messaging compliance, provider approval, opt-in language, retention, deletion,
  and privacy policy requirements remain separate from mock staging.
- Any future connection to the real Saga app must be reviewed against production
  authorization and data ownership boundaries.
