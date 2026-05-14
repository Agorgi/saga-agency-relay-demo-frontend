# Design Partner SMS Pilot

This pilot is private staging only. It is not a public launch, not production
Saga app integration, and not approval to send live SMS before A2P/10DLC or
number verification is resolved.

Use `docs/design-partner-pilot-runbook.md` as the operator checklist before any
future invite-only test window, and use `docs/conversation-quality-guide.md` to
score transcripts and capture feedback. Public-launch prerequisites live in
`docs/public-launch-foundations.md`; that document is planning material only,
not approval to publish the number.

## Boundaries

- Invite-only design partners.
- No public number distribution.
- No autonomous outreach.
- No real Saga app data.
- No event publishing, ticketing, ticket sales, QR codes, RSVP flows, payment
  processing, production Saga user permissions, or production Saga app data.
- No promises of booking, payment, team confirmation, attendance, venue access,
  revenue, celebrity/influencer participation, or production delivery.

## Opt-In Language

Before a design partner texts the staging number, send them a private invite
outside the SMS system:

> You are invited to test Saga's private SMS producer prototype. This is a
> staging test, not a live booking or production service. Message frequency may
> vary during the test. Reply STOP to opt out. Do not send sensitive personal,
> financial, legal, medical, or emergency information.

Only add numbers to `SMS_ALLOWED_NUMBERS` after explicit opt-in.

## STOP, START, And HELP

- STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT must opt the participant out.
- START/UNSTOP should reactivate local state when supported.
- HELP behavior should be reviewed before any broader pilot. Until then,
  operators should answer support questions manually from admin review paths.

## Monitoring

Operators should keep `/admin/pilot`, `/admin/projects`, `/admin/audit`, and
Twilio logs open during test windows.

Verify:

- `MESSAGING_PROVIDER=TWILIO`
- `PILOT_STAGE=design_partner`
- `PILOT_REPLY_MODE=draft_only` or a manually approved pilot setting
- `PUBLIC_LAUNCH_ENABLED=false`
- `TWILIO_STAGING_MODE=true`
- `TWILIO_VALIDATE_WEBHOOKS=true`
- `SMS_SENDS_DISABLED=true` until outbound testing is explicitly approved
- `SMS_REQUIRE_ALLOWLIST=true`
- `/api/health` does not expose raw allowed numbers or secrets
- Twilio outbound logs remain zero during inbound-only tests
- `/admin/pilot-participants` stores only hashed/redacted phone references for
  invite tracking; it is not connected to production Saga users.

## Feedback Capture

Use `/admin/pilot-feedback` or the pilot feedback panel on a project detail page
to capture:

- confusing points in the SMS flow
- tone feedback
- missing brief fields
- safety/escalation issues
- operator notes about what should be improved before live testing

Do not store production Saga user data or payment/ticketing details in feedback.

## Pausing The Pilot

To pause immediately:

1. Keep or set `SMS_SENDS_DISABLED=true`.
2. Set `PILOT_REPLY_MODE=draft_only`.
3. Set `PILOT_STAGE=internal_test`.
4. Set `MESSAGING_PROVIDER=MOCK` if real provider traffic should stop.
5. Remove Twilio webhook URLs if inbound traffic should stop.
6. Remove the participant from `SMS_ALLOWED_NUMBERS`.
7. Preserve the staging database for audit review.

## Removing A Participant

1. Remove their number from `SMS_ALLOWED_NUMBERS`.
2. Mark local user/contact opted out if they requested removal.
3. Add a private pilot feedback note describing the removal reason.
4. Do not delete audit logs unless a reviewed retention/deletion policy requires
   it.

## Bug Reports

Report:

- exact test window and staging commit
- route or admin page involved
- expected vs actual behavior
- screenshots of admin state if useful
- Twilio inbound/outbound log counts, without secrets
- whether `/api/health` remained healthy

## Out Of Scope

- Public launch.
- Production Saga app connection.
- Ticketing, RSVP, QR, event publishing, sales, payments, or production
  permission changes.
- Public scraping.
- Autonomous outreach.
- Any commitment about paid work, booking, contracts, permits, safety, alcohol,
  or venue availability without human review.
