# Pilot Infrastructure Readiness

This document describes infrastructure readiness for a future standalone Saga
SMS design-partner pilot. It is not approval to enable outbound SMS, publish a
number, or connect the production Saga app.

## 1. Current Environment

- Railway app service for the standalone SMS Producer MVP.
- Railway Postgres for app data.
- Prisma migrations are the source of database structure.
- Twilio staging credentials may exist in a Twilio-specific staging
  environment.
- `SMS_SENDS_DISABLED=true` remains the required safety posture.
- Outbound self-test readiness is dry-run only. `/api/health` and
  `/admin/pilot` may report blocker counts, but they do not send SMS or call
  Twilio send APIs.
- The production Saga mobile/web app is not connected.
- Ticketing, RSVP, QR, payments, event publishing, ticket sales, and production
  Saga permissions are out of scope.

## 2. Recommended Pilot Environment

Use a standalone pilot environment:

- Separate Railway project or environment for pilot testing.
- Isolated Railway Postgres database for pilot data.
- Separate from mock/demo staging if possible.
- Separate Twilio staging number or Messaging Service.
- No main Saga production database.
- No ticketing, RSVP, QR, payment, event publishing, or sales integrations.

The first eventual outbound test should run before design partner testing and
only after compliance approval, with `PILOT_STAGE=internal_test`,
`PILOT_REPLY_MODE=manual_approval`, exactly one allowlisted founder/operator
number, and the rollback runbook ready.

## 3. Database Safety Checklist

Before the pilot starts:

- Backups are enabled or scheduled.
- Restore process is documented and tested where practical.
- Prisma migrations are reviewed before deploy.
- Seed scripts are not run against the pilot DB unless explicitly intended.
- PII retention policy is defined.
- Deletion/export process is defined.
- Demo/test data is separated from pilot data.
- Audit logs are preserved for incident review.
- Public beta access records are isolated to this standalone database:
  `PilotParticipant` for cohort/status/cap state and `BetaInviteCode` for
  hashed invite codes. They must not depend on production Saga users.

## 4. What "Proper DB" Means For This Pilot

For this pilot, a proper database means:

- Real isolated Postgres, not local-only or shared production storage.
- Backups and restore discipline.
- Reviewed migrations.
- Audit logs for operator actions and message processing.
- Defined retention and deletion process.
- No dependency on production Saga app data.

The pilot can be valuable without production Saga app integration. Integration
belongs to a later engineering-reviewed milestone after standalone market
testing.
