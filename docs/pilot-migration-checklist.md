# Pilot Migration Checklist

Use this checklist before any Prisma migration against the standalone pilot
database.

## Before Migration

1. Confirm `DATABASE_URL` points to the standalone Saga SMS Producer database.
2. Confirm it is not the main Saga production DB.
3. Review the generated Prisma migration SQL.
4. Confirm the migration is additive or explicitly approved.
5. Confirm no ticketing, RSVP, QR, payment, event-publishing, or production Saga
   app tables are involved.
6. Run local no-SMS regression checks.
7. Confirm a fresh backup exists.
8. Keep `SMS_SENDS_DISABLED=true`.

## Deploy

1. Use Railway predeploy migration flow: `npm run prisma:deploy`.
2. Deploy the app.
3. Confirm `/api/health` is 200 and `database=connected`.
4. Confirm `/admin/data-ops` loads.
5. Run the relevant regression scripts from `docs/regression-testing.md`.

## Rollback/Restore

1. Pause pilot operations.
2. Preserve migration logs.
3. Restore only to a separate staging DB first.
4. Verify restored data before replacing any active pilot environment.
5. Record restore checks in `/admin/data-ops`.

## Short README Version

Before migrating: verify standalone DB target, review SQL, back up, run tests,
deploy via Railway predeploy, verify `/api/health`, and keep sends disabled.
