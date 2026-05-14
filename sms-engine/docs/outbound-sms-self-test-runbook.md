# Outbound SMS Self-Test Runbook

This runbook prepares the first eventual one-number outbound SMS self-test. It
does not authorize sending, does not enable live SMS, and does not start
design-partner testing. The exact post-A2P execution plan is
`docs/post-a2p-one-number-self-test-v0.9.md`; the live-window checklist is
`docs/post-a2p-self-test-checklist.md`.

## Purpose

- Validate one outbound SMS reply to the founder/operator's own allowlisted phone number after A2P/compliance approval.
- Prove the send path works before any design partner, candidate outreach, group chat, or public launch testing.
- Keep the test isolated from the production Saga app and from production data.
- Precede Controlled Live Reply Execution; autonomous allowlisted replies should
  not run until the one-number self-test has been approved, executed, reviewed,
  and rolled back safely.

## Scope

- One recipient only.
- One allowlisted founder/operator phone number only.
- One approved draft or one controlled organizer-reply test.
- No candidate outreach.
- No organizer shortlist send to real design partners.
- No group chat.
- No main Saga app integration.
- No production data.
- No autonomous live reply execution.
- No ticketing, RSVP, QR, payment, ticket sales, or event publishing behavior.

## Required Preconditions

- A2P/provider compliance is approved.
- `SMS_COMPLIANCE_APPROVED=true`.
- `SMS_SENDS_DISABLED=false` only for the explicitly approved test window.
- `SMS_REQUIRE_ALLOWLIST=true`.
- `SMS_ALLOWED_NUMBERS` contains exactly the founder/operator's phone for the first test.
- `PILOT_STAGE=internal_test`.
- `PILOT_REPLY_MODE=manual_approval` or the explicitly selected approved
  one-number test mode.
- `MESSAGING_PROVIDER=TWILIO`.
- `TWILIO_STAGING_MODE=true`.
- `TWILIO_VALIDATE_WEBHOOKS=true`.
- Twilio credentials and sender are configured in the standalone Twilio staging environment.
- `/api/health` is green and reports self-test dry-run readiness.
- One approved draft exists.
- Approved draft send readiness returns `READY_IN_DRY_RUN`.
- Rollback plan has been read and understood.
- Post-A2P one-number self-test v0.9 playbook and checklist have been reviewed.

## Non-Goals

- No public number distribution.
- No design partner invite.
- No automatic replies to arbitrary users.
- No candidate outreach.
- No group chat.
- No ticketing, RSVP, QR, payment, ticket sales, or event publishing behavior.
- No real Saga app integration.

## Operator Steps

1. Capture `/api/health` baseline.
2. Capture Twilio outbound log baseline.
3. Capture `/admin/audit` baseline.
4. Confirm the recipient is the only allowlisted number.
5. Confirm `SMS_SENDS_DISABLED=false` was intentionally set only for this test.
6. Confirm `PILOT_STAGE=internal_test` and the approved one-number
   `PILOT_REPLY_MODE`.
7. Confirm the approved draft and send-readiness dry run are clean.
8. Send exactly one message through the future approved send path.
9. Confirm Twilio outbound logs show exactly one outbound message.
10. Confirm the phone receives exactly one reply.
11. Confirm audit logs record the send and safety state.
12. Immediately restore `SMS_SENDS_DISABLED=true` unless the operator explicitly approves continuing.

## Rollback

- Set `SMS_SENDS_DISABLED=true`.
- Set `PILOT_REPLY_MODE=draft_only`.
- Remove or reduce `SMS_ALLOWED_NUMBERS`.
- Disable the Twilio webhook if inbound behavior is unexpected.
- Preserve audit logs.
- Document an incident if anything unexpected happens.

## Current Status

As of this readiness package, this is documentation and dry-run evaluation only. The app must not send SMS, call Twilio send APIs, invite design partners, or expose the number publicly.
