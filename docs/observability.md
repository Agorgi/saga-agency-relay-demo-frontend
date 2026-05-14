# Observability and Operator Safety

Saga Producer MVP staging uses simple, structured logs plus database-backed
audit events. The goal is to make failures diagnosable without exposing
secrets, private contact details, or internal notes.

## Structured Logs

Use `src/lib/safeLogging.ts` for server-side logs. Structured log events include:

- `action`
- `entityType`
- `entityId` when it is a safe internal id
- `providerMode`
- `status`
- `result`
- `errorCategory`
- `requestId` or correlation id when available
- sanitized `metadata`

The logger redacts:

- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `INTERNAL_API_KEY`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- Twilio account, messaging, and conversation identifiers
- database connection strings
- raw phone numbers
- raw email addresses

Operators should not add ad hoc `console.log` statements with request bodies,
message bodies, raw contact records, or environment variables.

## Audit Logs

Audit events are written through `src/lib/audit.ts`, which sanitizes metadata
before persistence and again before admin display.

Current coverage includes:

- admin approvals and outbound-message actions
- workflow status transitions
- internal API authorized and unauthorized calls
- demo lab action failures
- full demo scenario creation
- mock outreach approval
- fake reply simulation
- interest check conversion workflow events
- candidate recommendation status changes
- mock team creation
- mock production conversation kickoff creation

The admin dashboard exposes recent events at `/admin/audit`. The page supports a
simple entity-type filter and displays redacted metadata only.

## What Is Intentionally Not Logged

Do not log:

- secrets or env var values
- raw phone numbers or email addresses
- private contact notes
- admin notes
- creator internal notes, rate notes, or availability notes
- full inbound/outbound message bodies unless explicitly reviewed and sanitized
- production Saga app data
- ticketing, RSVP, QR, payment, or sales data

## Debugging Staging Failures

1. Check `[APP_BASE_URL]/api/health`.
2. Confirm `MESSAGING_PROVIDER=MOCK` for no-SMS staging.
3. Open `/admin/audit` and filter by the affected entity type.
4. Open `/admin/dev` and review the demo checklist and visible notices.
5. Check Railway logs for structured log lines with `action`, `result`, and
   `errorCategory`.
6. If a request id is visible in Railway or browser tooling, include it in the
   bug report.

## Issue Report Format

Claude/Codex should report staging issues with:

- Area
- Step
- Expected
- Actual
- Relevant audit action or structured log action
- Error category
- Request/correlation id if available
- Suggested fix or open question

## Boundaries

Observability must remain read-only and operator-focused. It must not enable
live Twilio, real SMS, real Saga app integration, event publishing, ticketing,
RSVPs, QR codes, payments, or production-data workflows.
