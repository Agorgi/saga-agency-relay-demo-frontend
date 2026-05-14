# Outbound Self-Test Checklist

Use this checklist only after compliance approval and explicit operator approval. This document does not authorize live SMS.

## Pre-Test Checklist

- A2P/provider compliance approved.
- `SMS_COMPLIANCE_APPROVED=true`.
- `SMS_SENDS_DISABLED=false` only for the approved test window.
- `SMS_REQUIRE_ALLOWLIST=true`.
- `SMS_ALLOWED_NUMBERS` contains exactly one founder/operator number.
- `PILOT_STAGE=internal_test`.
- `PILOT_REPLY_MODE=manual_approval`.
- `MESSAGING_PROVIDER=TWILIO`.
- `TWILIO_STAGING_MODE=true`.
- `TWILIO_VALIDATE_WEBHOOKS=true`.
- `/api/health` reports `outboundSelfTestReady=true`.
- `/admin/pilot` shows dry-run readiness with no blockers.
- One approved draft exists and draft send readiness is `READY_IN_DRY_RUN`.
- Controlled Live Reply Execution remains blocked until the self-test is
  complete and reviewed.
- Twilio outbound log baseline captured.
- `/admin/audit` baseline captured.
- Rollback runbook reviewed.

## Test Steps

1. Confirm the test recipient is the only allowlisted number.
2. Confirm no design partner participants are active for the self-test.
3. Confirm no candidate outreach, organizer shortlist, group chat, ticketing, RSVP, QR, payment, or event publishing flow is involved.
4. Send exactly one approved message through the future approved send path.
5. Do not run repeated tests without a fresh operator decision.

## Post-Test Verification

- Twilio outbound logs show exactly one outbound SMS in the test window.
- The founder/operator phone receives exactly one message.
- `/admin/audit` records the send and safety snapshot.
- No non-allowlisted number receives anything.
- No candidate outreach is created.
- No group chat is created.
- No production Saga app data is touched.
- `SMS_SENDS_DISABLED=true` is restored unless explicitly approved otherwise.

## Failure Conditions

- More than one SMS sends.
- A non-allowlisted number receives anything.
- Twilio logs show unexpected outbound activity.
- An outbound Message is created without the approved send path.
- A group chat, candidate outreach send, organizer shortlist send, ticketing, RSVP, QR, payment, or event publishing action occurs.

## Failure Response

- Immediately set `SMS_SENDS_DISABLED=true`.
- Set `PILOT_REPLY_MODE=draft_only`.
- Remove or reduce `SMS_ALLOWED_NUMBERS`.
- Disable Twilio webhooks if inbound processing appears unsafe.
- Preserve audit logs and Twilio logs.
- Document the incident before any additional testing.
