# Abuse And Rate-Limit Readiness

This is a readiness document for the standalone SMS Producer MVP. It does not
enable public distribution or live outbound SMS.

## Current Controls

- Twilio webhook signature validation is supported and should be enabled with
  `TWILIO_VALIDATE_WEBHOOKS=true`.
- Inbound idempotency uses Twilio `MessageSid` where available.
- Status callback idempotency is covered by readiness tests.
- `SMS_SENDS_DISABLED=true` blocks real provider sends.
- `SMS_REQUIRE_ALLOWLIST=true` blocks outbound SMS to non-allowlisted numbers.
- Non-allowlisted inbound messages are blocked/escalated instead of receiving a
  normal Saga reply, while STOP/START handling remains safe.
- Unsafe content escalates to `NEEDS_ADMIN`.

## Existing Inbound Rate Limits

The app includes basic rate-limit helpers for webhook paths. Before private beta
or public candidate, engineers should review exact thresholds against expected
pilot traffic and Railway/Twilio behavior.

## Recommended Caps

Suggested placeholders:

- `SMS_DAILY_SEND_CAP`: daily outbound send cap for the environment.
- `SMS_DAILY_INBOUND_CAP`: daily inbound processing cap for the environment.
- `PILOT_MAX_ACTIVE_PARTICIPANTS`: cap on active pilot participants.

These are currently readiness/configuration placeholders. They are not a public
launch approval and should be enforced before broader beta or public use.

## Recommended Per-Number Controls

- Per-number inbound cap.
- Per-number outbound cap.
- Cooldown for repeated identical messages.
- Manual pause for a participant.
- Global pause via `SMS_SENDS_DISABLED=true`.

## Blocked Sender Behavior

Blocked or non-allowlisted senders should:

- Not receive normal Saga replies.
- Be logged/audited with redacted sender details.
- Preserve STOP/START handling where applicable.
- Escalate to admin if the behavior looks risky or abusive.

## Duplicate And Spammy Messages

- Duplicate `MessageSid` should not create duplicate inbound records.
- Repeated messages should be visible in audit/admin.
- Spammy or abusive content should trigger `NEEDS_ADMIN` or participant pause.

## Pausing A Participant

To pause a participant:

1. Mark the `PilotParticipant` as `PAUSED`.
2. Remove their number from `SMS_ALLOWED_NUMBERS` if needed.
3. Keep audit logs and feedback notes.
4. Do not delete data until reviewed.

## Pausing The Whole System

1. Set `SMS_SENDS_DISABLED=true`.
2. Set `PILOT_REPLY_MODE=draft_only`.
3. Set `PILOT_STAGE=internal_test`.
4. Remove or disable Twilio webhooks.
5. Preserve logs for review.

No ticketing, RSVP, QR, payment, event publishing, production Saga app data, or
production permissions are part of abuse handling in this standalone app.
