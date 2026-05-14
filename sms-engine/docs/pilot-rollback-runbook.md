# Pilot Rollback Runbook

Use this if a design-partner pilot or private beta test needs to stop. This
does not delete data by default and does not touch production Saga systems.

It also applies to the first eventual one-number outbound SMS self-test. If
anything unexpected happens during that self-test, stop immediately and preserve
logs before continuing.

## Immediate Kill Switch

1. Set `SMS_SENDS_DISABLED=true`.
2. Set `PILOT_REPLY_MODE=draft_only`.
3. Set `PILOT_STAGE=internal_test`.
4. Clear or remove `SMS_ALLOWED_NUMBERS`.
5. Remove or disable Twilio webhook URLs.
6. Confirm `/admin/pilot` reports the outbound self-test as blocked again.
7. Confirm `/admin/observability` shows `SMS_SENDS_DISABLED=true`, public
   launch disabled, and no unexpected outbound activity.
8. Set `SMS_ACCESS_MODE=public_closed` if unknown inbound access needs to be
   paused immediately.
9. Confirm `/admin/command-center` shows go/no-go panels blocked and
   kill-switch values safe.

## Participant Pause

1. Mark active `PilotParticipant` records as `PAUSED`.
2. If a participant opted out, mark them `OPTED_OUT`.
3. Remove participant numbers from the allowlist.
4. Pause active `BetaInviteCode` records in `/admin/access`.
5. Add a pilot feedback note explaining the pause reason.

## Preserve Evidence

- Keep audit logs.
- Keep observability daily reports and `/admin/observability` screenshots if
  they were captured during the incident.
- Keep message records for review unless deletion is required by a reviewed
  policy.
- Keep Producer Agent outbound drafts and dry-run readiness checks for review;
  they are not sent messages.
- Do not delete data until product/engineering/compliance review is complete.
- Export only redacted summaries when reporting.

## Notifications

Notify design partners if needed, using a reviewed non-SMS channel if sends are
disabled. Do not promise resolution timelines or outcomes.

## Decision Authority

The call to pause or stop can be made by product, engineering, compliance, or
the operator monitoring the test window if safety is uncertain.

## Out Of Scope

Rollback must not touch event publishing, ticketing, ticket sales, QR codes,
RSVP flows, payment processing, production Saga user permissions, production
Saga app data, or production databases.
