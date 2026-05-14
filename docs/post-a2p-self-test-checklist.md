# Post-A2P Self-Test Checklist

Use this during the first one-number outbound test after A2P/provider approval.
This checklist does not authorize sending by itself and does not change any
environment variables.

## Before Test

- [ ] A2P/campaign approval confirmed manually.
- [ ] Operator, engineering, and compliance owner agree to the test window.
- [ ] `docs/post-a2p-one-number-self-test-v0.9.md` reviewed.
- [ ] `docs/outbound-sms-self-test-runbook.md` reviewed.
- [ ] `docs/pilot-rollback-runbook.md` reviewed.
- [ ] No design partner, public beta, or public launch activity is active.

## Env Vars

- [ ] `SMS_COMPLIANCE_APPROVED=true`.
- [ ] `SMS_SENDS_DISABLED=true` before setup.
- [ ] `SMS_REQUIRE_ALLOWLIST=true`.
- [ ] `SMS_ALLOWED_NUMBERS` contains exactly one founder/operator test phone.
- [ ] `PILOT_STAGE=internal_test`.
- [ ] `PILOT_REPLY_MODE` is the approved one-number test mode.
- [ ] `MESSAGING_PROVIDER=TWILIO`.
- [ ] `TWILIO_STAGING_MODE=true`.
- [ ] `TWILIO_VALIDATE_WEBHOOKS=true`.
- [ ] `PUBLIC_BETA_ENABLED=false`.
- [ ] `PUBLIC_LAUNCH_ENABLED=false`.
- [ ] `LLM_MODE` is not `active_live`.
- [ ] `MESSAGE_PROCESSING_MODE` is not `async_active`.

## Health Checks

- [ ] Capture `/api/health` baseline.
- [ ] Confirm `/api/health` does not expose phone numbers or secrets.
- [ ] Open `/admin/command-center`.
- [ ] Confirm command center is green or expected yellow, not red.
- [ ] Confirm one-number self-test blockers are understood.

## Send Test

- [ ] Capture Twilio outbound log baseline.
- [ ] Capture `/admin/audit` baseline.
- [ ] Verify only one allowed recipient.
- [ ] Set `SMS_SENDS_DISABLED=false` only for the approved window.
- [ ] Send exactly one inbound organizer message from the allowed phone.
- [ ] Wait for exactly one outbound reply.

## Verify Twilio

- [ ] Twilio outbound log shows exactly one new outbound message.
- [ ] No second outbound message appears after waiting.
- [ ] Twilio recipient matches the single allowed test phone.
- [ ] No non-allowlisted recipient appears.

## Verify Admin / Audit

- [ ] Audit log shows inbound received.
- [ ] Audit log shows send decision and outbound result.
- [ ] No duplicate-send audit event.
- [ ] No candidate outreach record.
- [ ] No group chat record.
- [ ] No organizer shortlist send.

## Verify Phone

- [ ] Phone receives exactly one reply.
- [ ] Reply has no unsafe promise.
- [ ] Reply has no raw PII or secrets.
- [ ] STOP/HELP behavior remains available.

## Rollback

- [ ] Restore `SMS_SENDS_DISABLED=true` unless a separate continuation plan is
  explicitly approved.
- [ ] Set `PILOT_REPLY_MODE=draft_only` if pausing.
- [ ] Remove all but the founder/operator test phone from `SMS_ALLOWED_NUMBERS`
  if needed.
- [ ] Preserve health output, command-center output, Twilio logs, and audit logs.
- [ ] Document an incident if any fail criterion occurred.

## Go / No-Go Decision

- [ ] Pass: exactly one inbound, exactly one outbound, no duplicates, no wrong
  recipient, audit present, health not red.
- [ ] Pause: any duplicate, wrong recipient, STOP issue, unsafe output, missing
  audit, Twilio error, command-center red, or unexpected outbound.
- [ ] Continue only with explicit operator approval and a documented next-stage
  plan.
