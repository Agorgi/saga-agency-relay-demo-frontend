# Post-A2P One-Number Self-Test v0.9

This playbook defines the first real outbound SMS test after A2P/provider
approval. It is a readiness and operating plan only. It does not enable sending,
send SMS, invite design partners, publish the number, enable public beta,
enable public launch, or connect the production Saga app.

## Purpose

- Validate one controlled outbound SMS after A2P approval.
- Prove the live send path works in the standalone staging-purpose app.
- Prevent duplicate sends.
- Prevent wrong-recipient sends.
- Confirm auditability, Twilio log visibility, and rollback.

## Preconditions

Before setup:

- A2P/campaign approval is confirmed manually.
- `SMS_COMPLIANCE_APPROVED=true`.
- `SMS_SENDS_DISABLED=true` before test setup.
- `SMS_REQUIRE_ALLOWLIST=true`.
- `SMS_ALLOWED_NUMBERS` contains exactly the founder/operator phone for the
  first test.
- `PILOT_STAGE=internal_test`.
- `PILOT_REPLY_MODE=manual_approval` or the explicitly selected approved
  one-number test mode.
- Per-phone autonomy for the test number is explicitly reviewed. If enabled,
  it must be `AUTONOMOUS_UNTIL_OUTREACH` only and cannot override global SMS
  gates.
- `MESSAGING_PROVIDER=TWILIO`.
- `TWILIO_STAGING_MODE=true`.
- `TWILIO_VALIDATE_WEBHOOKS=true`.
- LLM mode is safe: `fallback`, `shadow`, or `active_mock`; never
  `active_live`.
- `MESSAGE_PROCESSING_MODE` is not `async_active`.
- `/api/health` is green or expected yellow with no critical blockers.
- `/admin/command-center` is green or expected yellow, not red.
- Rollback runbook is ready.
- Public beta and public launch remain disabled.
- No design partner pilot is active.

## Test Steps

1. Capture `/api/health` baseline.
2. Capture Twilio outbound log baseline.
3. Capture `/admin/audit` baseline.
4. Verify only one allowed recipient is configured.
5. Set `SMS_SENDS_DISABLED=false` only for the approved test window.
6. Send exactly one inbound organizer message from the allowlisted phone.
7. Expect exactly one outbound reply.
8. Verify Twilio outgoing logs show one outbound message.
9. Verify the phone received one reply.
10. Verify audit logs show the inbound, send decision, and outbound result.
11. Verify no duplicate outbound was created.
12. Verify no candidate outreach, group chat, or organizer shortlist send
    occurred.
13. Verify per-phone autonomy audit metadata shows the test was ordinary
    conversation only and did not cross outreach, shortlist, group-chat,
    rate/payment, legal, or safety boundaries.
14. Restore `SMS_SENDS_DISABLED=true` unless the operator explicitly continues
    under a separate approved plan.

## Pass Criteria

- Exactly one inbound message.
- Exactly one outbound message.
- No duplicate reply.
- No non-allowlisted send.
- No unsafe promise.
- No raw PII exposure in health, command center, or audit summaries.
- Audit event exists.
- Twilio log confirms one outbound.
- Phone receives one reply.
- Health remains green or expected yellow, not red.

## Fail Criteria

- No reply when one was expected.
- Duplicate reply.
- Wrong recipient.
- Outbound to a non-allowlisted number.
- STOP or opt-out behavior is wrong.
- Twilio error.
- Unsafe output.
- Audit event missing.
- Command center red.

## Rollback

If anything unexpected happens:

- Set `SMS_SENDS_DISABLED=true`.
- Set `PILOT_REPLY_MODE=draft_only`.
- Remove all but the founder/operator phone from `SMS_ALLOWED_NUMBERS`, or
  clear the allowlist if needed.
- Preserve Twilio logs, audit logs, health output, and command-center output.
- Document an incident.
- Pause further testing until reviewed.

## Explicit Non-Goals

- No design partner invites.
- No public beta.
- No public launch.
- No production Saga app integration.
- No ticketing, RSVP, QR, payment, ticket sales, or event publishing behavior.
- No candidate outreach.
- No organizer shortlist send.
- No group chat creation.
