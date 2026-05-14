# Pilot Backup and Restore Runbook

This runbook is for the standalone Saga SMS Producer Railway Postgres database.
Do not restore pilot data into the production Saga app database.

## Confirm Database

1. Open `/api/health`.
2. Confirm `database=connected`.
3. Confirm the Railway service `DATABASE_URL` points to the standalone pilot DB.
4. Confirm no main Saga production DB connection string is configured.

## Backup Checklist

1. Confirm Railway Postgres backups are enabled or scheduled in the Railway UI.
2. Record the backup cadence and retention window in the pilot ops notes.
3. Before schema migrations, create or verify a fresh backup.
4. Do not run seed scripts against the pilot DB unless explicitly intended.
5. Record the check from `/admin/data-ops`.

## Manual Backup

Use the Railway-supported backup/export mechanism for the database plan. If a
manual `pg_dump` is used, run it only from a trusted operator environment, store
the dump securely, and do not paste credentials into tickets, chats, or Codex
prompts.

## Restore To Staging

1. Create a separate temporary Railway Postgres database.
2. Restore the backup into that temporary DB.
3. Point a temporary app environment at the restored DB.
4. Run `/api/health`.
5. Spot-check counts in `/admin/data-ops`.
6. Verify redaction/export behavior before touching the live pilot DB.

## Do Not

- Do not overwrite the active pilot database without explicit approval.
- Do not restore pilot data into production Saga app infrastructure.
- Do not restore ticketing, RSVP, QR, payment, or event-publishing data because
  this app does not own those systems.

## Failed Migrations

If a migration fails:

1. Keep `SMS_SENDS_DISABLED=true`.
2. Pause pilot operations.
3. Preserve logs and migration output.
4. Restore only after engineering approval.
5. Verify `/api/health`, `/admin/data-ops`, and regression checks after restore.

## Approval

A restore should be approved by the operator responsible for the pilot and an
engineer who has reviewed the target `DATABASE_URL`.
