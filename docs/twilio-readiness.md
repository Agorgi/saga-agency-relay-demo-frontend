# Twilio Readiness Audit Checklist

This is an audit checklist only. It is not approval to configure live SMS.

For a controlled design-partner pilot, use the separate plan in
`docs/twilio-staging-pilot.md` and the design-partner policy in
`docs/design-partner-sms-pilot.md`. The operator runbook is
`docs/design-partner-pilot-runbook.md`, and transcript review guidance is in
`docs/conversation-quality-guide.md`. Public launch foundations are in
`docs/public-launch-foundations.md`, and the A2P/SMS compliance packet is in
`docs/a2p-compliance-packet.md`. Public launch remains disabled. The current MOCK staging environment should
remain untouched; any live provider test belongs in a separate Twilio staging
environment with its own Railway project/environment, Postgres database, and
Twilio staging phone number.

LLM Provider Integration v0.1 is documented in
`docs/llm-provider-integration.md`. OpenAI is optional; fallback remains the
safe default, shadow mode must not change Twilio replies, and active live model
output remains disabled by default.

Production Observability v0.1 is documented in
`docs/production-observability.md`, with incident handling in
`docs/incident-response-runbook.md`. Operators should monitor
`/admin/observability`, `/admin/audit`, `/admin/pipeline`, and Twilio logs
before any self-test or design-partner window. Observability is read-only and
does not enable sends.

Public Beta Access Control v0.1 is documented in
`docs/public-beta-access-control.md`. It adds `/admin/access`, hashed invite
codes, participant caps, and access decisions, but public beta remains disabled
until explicit approval.

Release Candidate v0.1 is documented in
`docs/release-candidate-v0.1.md`. The RC package is a safe freeze and evidence
bundle for the post-A2P path; it does not approve or execute live outbound SMS.
After A2P approval, follow `docs/post-a2p-execution-playbook.md` and keep
`SMS_SENDS_DISABLED=true` until the explicitly controlled one-number self-test
window.

## Current Baseline

- Default provider remains `MESSAGING_PROVIDER=MOCK`.
- Twilio staging sends are disabled by default with `SMS_SENDS_DISABLED=true`.
- Twilio staging outbound sends require allowlisted recipients by default with
  `SMS_REQUIRE_ALLOWLIST=true`.
- Pilot readiness defaults to `PILOT_STAGE=internal_test`,
  `PILOT_REPLY_MODE=draft_only`, and `PUBLIC_LAUNCH_ENABLED=false`.
- Twilio is unconfigured in Saga Producer MVP Staging Baseline v0.1.
- No live SMS should be sent from staging baseline mode.
- No live outreach should be sent without human approval.

## Before Any Twilio-Specific Staging Mode

- Create an explicit Twilio-specific staging mode separate from default mock
  staging.
- Add Twilio env vars only to that Twilio-specific staging environment:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
  - `TWILIO_CONVERSATIONS_SERVICE_SID`
  - `TWILIO_VALIDATE_WEBHOOKS=true`
  - `SMS_SENDS_DISABLED=true` until the exact allowlisted send test is approved
  - `SMS_REQUIRE_ALLOWLIST=true`
  - `SMS_ALLOWED_NUMBERS` containing only opted-in design partner test numbers
  - `TWILIO_STAGING_MODE=true`
  - `PILOT_STAGE=design_partner`
  - `PILOT_REPLY_MODE=draft_only`
  - `PUBLIC_LAUNCH_ENABLED=false`
  - `SMS_COMPLIANCE_APPROVED=false` until approval is complete
- Confirm `APP_BASE_URL` exactly matches the public URL Twilio will call.
- Keep `MESSAGING_PROVIDER=MOCK` unless the test explicitly requires live
  provider behavior.

## Required Safety Checks

- Webhook signature validation is required for all Twilio webhook routes.
- Inbound idempotency is required so Twilio retries do not duplicate messages.
- Status callback idempotency is required.
- Conversations webhook idempotency is required.
- STOP/START opt-out handling is required.
- Local opt-out state must be respected in addition to Twilio provider behavior.
- Basic rate limiting must remain enabled.
- `SMS_SENDS_DISABLED=true` must block all real Twilio sends.
- `SMS_REQUIRE_ALLOWLIST=true` must block outbound Twilio SMS to any number not
  present in `SMS_ALLOWED_NUMBERS`.
- `/api/health` may report the allowed-number count, but must never expose the
  phone numbers themselves.
- `/api/health` may report access mode, active/waitlisted counts, and invite
  code counts, but must never expose plaintext invite codes or raw phone
  numbers.
- Inbound messages from non-allowlisted numbers should not receive normal Saga
  replies; they should be logged/escalated for human review while preserving
  STOP/START handling.
- All inbound and outbound messages must be persisted.
- All admin-approved outbound sends must create audit log entries.
- Failed sends must be visible in admin.
- `/admin/observability` must not expose raw phone numbers, prompts, raw model
  outputs, API keys, Twilio tokens, database URLs, or admin passwords.
- Producer Agent v0.4 send readiness is dry-run only. It can evaluate approved
  drafts and record `producer.draft_send_readiness_evaluated`, but it must not
  call Twilio, create `Message` `SENT` records, create `Outreach`, or create
  group chats.
- Outbound SMS self-test readiness is dry-run only. It can evaluate whether the
  first future one-number founder/operator test is gated correctly and record
  `pilot.outbound_self_test_readiness_evaluated`, but it must not call Twilio,
  create outbound send records, create outreach, or create group chats.
- Controlled Live Reply Execution v0.1 is documented in
  `docs/controlled-live-reply-execution.md`. It remains blocked until
  compliance, allowlist, reply-mode, idempotency, and cap gates pass; it must
  not apply to contact replies, candidate outreach, shortlists, or group chats.
- No autonomous outreach is allowed.
- No automatic shortlist send is allowed.
- No automatic group chat creation is allowed.
- No payment, contract, booking, permit, insurance, alcohol, security, safety, or
  minors-related message should proceed without human review.

## Mock Readiness Tests

Run the no-live-provider fixture suite with:

```bash
npm run test:twilio-readiness
npm run test:release-candidate
```

This script uses fake Twilio SIDs, fake phone numbers, fake webhook payloads,
and fake Twilio env values only. It must not require real Twilio credentials and
must not make real Twilio API calls.

The suite covers:

- mocked provider behavior with `MESSAGING_PROVIDER=MOCK`, even when fake Twilio
  env vars are present
- inbound SMS webhook fixture parsing
- status callback fixture parsing
- duplicate `MessageSid` idempotency decision logic
- STOP and START keyword detection
- invalid/failed webhook signature handling
- missing-field webhook responses
- rate-limit threshold logic
- contact YES / NO / MAYBE reply classification
- consent reply classification before group chat
- Twilio sends disabled blocking before any provider call
- allowlist blocking non-allowed recipients
- allowlist permitting an allowed recipient while staying mocked without real
  credentials
- health output exposing only allowed-number counts, not phone numbers
- inbound route no-reply behavior: empty TwiML only, no `<Message>` response,
  non-allowlisted inbound escalation, STOP/START safety, and blocked provider
  replies while `SMS_SENDS_DISABLED=true`

Database-backed live-path verification remains separate. When a Twilio-specific
staging environment exists, engineers should also verify persistence,
idempotency, opt-out state, audit logs, and failed-send visibility against a
staging database before sending any real SMS.

Run the inbound no-reply fixture suite with:

```bash
npm run test:twilio-inbound-no-reply
```

This test must pass before any real inbound webhook is pointed at Twilio
staging. TwiML `<Message>` replies are not allowed to bypass
`SMS_SENDS_DISABLED`.

## Compliance Gate

- Do not send live SMS until compliance/provider approval is resolved.
- A2P/10DLC brand, campaign, messaging service approval, toll-free verification
  where applicable, opt-in language, privacy policy, terms, and carrier
  compliance remain external to this codebase.
- Review `docs/a2p-compliance-packet.md` before any provider submission. Do not
  submit anything to Twilio from this repo or without business/legal/compliance
  approval.
- Approved Twilio Console configuration must be documented before enabling any
  live SMS staging mode.
- Do not point production Twilio webhooks at staging unless explicitly approved.
- Do not use staging for production user traffic.
- Do not connect Twilio testing to ticketing, RSVPs, QR codes, event sales,
  payments, or production Saga app data.

## Before Enabling Live SMS

- Keep default staging on `MESSAGING_PROVIDER=MOCK`.
- Create a separate Twilio-specific staging mode and document the exact env var
  set.
- Confirm webhook signature validation is enabled and passing with real Twilio
  signatures.
- Confirm inbound, status, and Conversations webhook retries are idempotent
  against the staging database.
- Confirm STOP/START behavior and local opt-out state.
- Confirm rate limiting and per-recipient send controls.
- Confirm all external-facing sends remain human-approved; no autonomous
  outreach, shortlist send, or group-chat creation is allowed.
- Confirm no code path touches event publishing, ticketing, RSVPs, QR codes,
  ticket sales, payments, or production Saga app data.
- Before a design-partner SMS pilot, complete the checklist in
  `docs/twilio-staging-pilot.md`.

## Pilot Preflight

Before any inbound-only or outbound pilot test in Twilio staging, run:

```bash
npm run test:twilio-pilot-preflight
npm run test:twilio-staging-no-send
npm run test:twilio-inbound-no-reply
npm run test:twilio-status-callbacks
npm run test:design-partner-pilot-readiness
npm run test:design-partner-pilot-preflight
npm run test:outbound-self-test-readiness
npm run test:controlled-live-reply-execution
npm run test:llm-provider
npm run test:llm-evals
```

`test:twilio-pilot-preflight` verifies provider mode, Twilio staging flags,
allowlist settings, webhook validation, health output, and secret/allowed-number
non-exposure. `test:twilio-status-callbacks` verifies the status callback route
with fake Twilio payloads and no SMS sends; status callbacks remain unconfigured
until an explicit Twilio staging test window.

`test:design-partner-pilot-readiness` verifies that pilot readiness status and
feedback summary serializers expose only safe status fields, not raw
allowlisted numbers, notes, phone numbers, or secrets.

`test:design-partner-pilot-preflight` verifies fail-closed pilot/public launch
stage controls, reply mode controls, public launch disabled state, and required
pilot/public launch documentation. It does not send SMS or make Twilio API
calls.

`test:outbound-self-test-readiness` verifies that the first eventual outbound
self-test remains blocked until compliance, one-number allowlist, manual reply
mode, approved draft, and rollback gates are satisfied. It does not send SMS or
make Twilio API calls.

`test:controlled-live-reply-execution` verifies the autonomous reply gates,
idempotency, pilot caps, blocked flows, and mocked-provider send path without
calling Twilio or sending real SMS.
