# Twilio Staging Pilot Plan

This is a planning document for a controlled standalone SMS pilot. It is not
approval to configure Twilio, send SMS, connect the real Saga app, or launch
publicly.

For operator execution, use `docs/design-partner-pilot-runbook.md`. For
transcript review and tone/safety scoring, use
`docs/conversation-quality-guide.md`. The pilot is not active while
`SMS_SENDS_DISABLED=true` and compliance approval is unresolved.
Public launch foundations are documented in `docs/public-launch-foundations.md`;
public launch remains disabled. Production observability is documented in
`docs/production-observability.md`; operators should use `/admin/observability`
and `npm run observability:daily-report` as read-only monitoring aids.
Public beta access controls are documented in
`docs/public-beta-access-control.md`; `/admin/access` is for hashed invite
codes, participant caps, and access decisions only.

## 1. Purpose

The pilot exists to:

- Validate Saga's SMS experience with a small number of trusted design partners.
- Gather UX and product feedback on intake, tone, admin review, and safety
  handoffs.
- Exercise the standalone messaging producer loop before any production Saga app
  integration.
- Keep distribution private and controlled.

The pilot is not a public launch and must not integrate with the production Saga
mobile app, desktop app, production database, event publishing, ticketing, RSVP,
QR, sales, or payments.

## 2. Hard Boundaries

- No live public launch.
- No autonomous outreach.
- No real Saga app data.
- No event publishing.
- No ticketing.
- No ticket sales.
- No QR codes.
- No RSVP flows.
- No payment processing.
- No production Saga user permissions.
- No production Saga app data.
- No production database.
- No public internet scraping.
- No booking, payment, revenue, venue, celebrity, influencer, or attendance
  guarantees.

## 3. Environment Separation

Use a separate Twilio-specific staging environment. Do not repurpose the current
MOCK staging environment.

Required separation:

- Separate Railway project or environment for Twilio staging.
- Separate Railway Postgres database for Twilio staging.
- Separate Twilio staging phone number or Messaging Service.
- `MESSAGING_PROVIDER=TWILIO` only in the Twilio staging environment.
- Current MOCK staging remains untouched with `MESSAGING_PROVIDER=MOCK`.
- No production Saga app connection.
- No production Saga app data imports.
- `/admin/observability` should remain redacted and must not expose phone
  numbers, prompts, raw model outputs, or secrets.

## 4. Compliance Notes

- A2P/10DLC or toll-free verification may be required depending on the number
  type and Twilio/carrier requirements.
- A2P/10DLC, toll-free verification, or other provider approval must be
  understood before any real outbound design-partner SMS. Keep sends disabled
  while approval is pending.
- Opt-in, opt-out, and HELP behavior must be clear before any live testing.
- STOP and START handling must work and be verified in the app and provider.
- Webhook signature validation must be enabled with
  `TWILIO_VALIDATE_WEBHOOKS=true`.
- No public texting until the compliance state is understood, approved, and
  documented.
- Keep a written record of the approved number, use case, opt-in language,
  expected message types, support contact, and privacy/terms links.
- Contact reply and consent policies are testable in staging, but live external
  outreach is not approved yet. Admin approval remains required, and Saga must
  not create group chats or add participants automatically.
- Conversation Engine v0.1 is consolidated in
  `docs/conversation-engine-v0.1.md`. For Twilio staging, it remains
  shadow-only: it may classify, plan, and audit inbound messages, but it must
  not execute active conversation actions or send replies while
  `SMS_SENDS_DISABLED=true`.

## 5. Design Partner Policy

- Only allowlisted numbers may participate.
- Each design partner must explicitly opt in before texting the staging number.
- Each design partner must know this is a staging prototype.
- Design partners must understand there is no expectation of booking, payment,
  team confirmation, event production, or production delivery.
- Design partners should be told that a human Saga operator reviews risky or
  external-facing actions.
- Design partners should be able to leave the pilot at any time by texting STOP.

Code-side staging controls now support allowlisted pilot numbers. Keep them on
until the pilot is explicitly approved by product, engineering, and compliance.

## 6. Required Env Vars For Twilio Staging

Set these only in the Twilio-specific staging environment:

```text
MESSAGING_PROVIDER=TWILIO
TWILIO_STAGING_MODE=true
SMS_SENDS_DISABLED=true
SMS_REQUIRE_ALLOWLIST=true
SMS_ALLOWED_NUMBERS=
PILOT_STAGE=design_partner
PILOT_REPLY_MODE=draft_only
PUBLIC_LAUNCH_ENABLED=false
SMS_COMPLIANCE_APPROVED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_CONVERSATIONS_SERVICE_SID=
TWILIO_VALIDATE_WEBHOOKS=true
ADMIN_PASSWORD=
INTERNAL_API_KEY=
APP_BASE_URL=
DATABASE_URL=
```

Use either `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` for one-to-one
SMS. Set `TWILIO_CONVERSATIONS_SERVICE_SID` only if group chat testing is
enabled.

Safety defaults:

- `SMS_SENDS_DISABLED=true` blocks real provider sends even when
  `MESSAGING_PROVIDER=TWILIO`.
- `SMS_REQUIRE_ALLOWLIST=true` allows outbound Twilio SMS only to numbers in
  `SMS_ALLOWED_NUMBERS`.
- `SMS_ALLOWED_NUMBERS` is comma-separated and must contain only explicitly
  opted-in design partner test numbers.
- `/api/health` reports the provider mode, whether sends are disabled, whether
  allowlist is required, and the count of allowed numbers. It must never expose
  the actual allowed numbers.
- `/api/health` also reports `pilotStage`, `pilotReplyMode`,
  `publicLaunchEnabled`, `stageAllowsPublicDistribution`, and
  `autoRepliesEnabled`. Public launch must remain disabled for this pilot.

Do not copy production Saga app env vars into this environment.

## 6A. No-Send Smoke Test

First run the preflight:

```bash
npm run test:twilio-pilot-preflight
npm run test:design-partner-pilot-preflight
```

It verifies Twilio staging env shape, webhook validation, allowlist settings,
health output, and secret/allowed-number non-exposure. It does not send SMS.

Before any real outbound SMS test, run the no-send smoke test inside the
Twilio-specific Railway staging service:

```bash
npm run test:twilio-staging-no-send
```

This test requires:

- `MESSAGING_PROVIDER=TWILIO`
- `SMS_SENDS_DISABLED=true`
- `SMS_REQUIRE_ALLOWLIST=true`
- Twilio account/auth and one-to-one messaging env vars configured

Expected result:

- health shows Twilio messaging configured
- health shows provider mode `TWILIO`
- health shows `sendsDisabled=true`
- health shows `allowlistRequired=true`
- health includes `allowedNumbersCount`
- health does not expose raw allowlisted numbers
- the app's Twilio send path returns a synthetic blocked result before any
  provider API call

If the test fails, do not send real SMS. Treat failure as a staging blocker:
either the environment is not in no-send mode, health is exposing unsafe data,
or the provider path could attempt a real Twilio call before the safety block.

## 6B. Inbound No-Reply Test

Before pointing a real Twilio inbound webhook at staging, run the inbound
no-reply safety check:

```bash
npm run test:twilio-inbound-no-reply
```

This test uses fake Twilio inbound webhook payloads and signed in-process
requests. It does not configure Twilio webhooks and does not send SMS.

Expected behavior while `SMS_SENDS_DISABLED=true`:

- `/api/twilio/inbound` returns empty TwiML only, for example `<Response />`.
- `/api/twilio/inbound` must not return TwiML `<Message>` content, because that
  would let Twilio send a reply outside the provider safety gate.
- Allowlisted inbound messages may be stored and processed, but any generated
  reply must go through the provider path and be marked blocked by
  `SMS_SENDS_DISABLED`.
- Non-allowlisted inbound messages should be logged/escalated with no normal
  Saga reply.
- STOP/START paths should still update local state safely, and any START reply
  should be blocked while sends are disabled.
- The test sets a provider-call tripwire so it fails if a real Twilio API call
  would be attempted.

If this test is run inside Railway with `DATABASE_URL`, it also verifies the
database-backed inbound, outbound-blocked, non-allowlisted escalation, and
STOP/START paths. Without `DATABASE_URL`, it still verifies the no-`<Message>`
TwiML guard and provider-level send block.

After a real inbound webhook test, Claude/operator should verify in Twilio logs:

- the inbound webhook request reached the staging app
- no outbound Twilio message was created from a TwiML reply
- no outbound Twilio message was created from the provider path
- Twilio outbound logs remain at zero sends for the test window
- `/api/health` remains healthy afterward

## 6C. Status Callback Readiness

Status callback route behavior is tested without configuring Twilio callbacks:

```bash
npm run test:twilio-status-callbacks
```

The test covers valid/invalid signatures, missing `MessageSid`, common delivery
states, unknown status values, duplicate callbacks, safe metadata updates, and
audit log writes when a staging database is available. Status callbacks should
not be configured in Twilio Console until the inbound-only test window is
explicitly approved.

## 7. Kill Switch

Immediate stop options:

- Set `SMS_SENDS_DISABLED=true` to block real provider sends while preserving
  Twilio staging configuration for inspection.
- Set `PILOT_REPLY_MODE=draft_only`.
- Set `PILOT_STAGE=internal_test`.
- Set `MESSAGING_PROVIDER=MOCK` to disable real provider sends.
- Remove all values from `SMS_ALLOWED_NUMBERS` or keep
  `SMS_REQUIRE_ALLOWLIST=true` to prevent sends to unlisted numbers.
- Remove or disable Twilio webhook URLs in Twilio Console.
- Disable or stop using the Twilio staging phone number or Messaging Service.
- Rotate Twilio staging credentials if needed.
- Keep the staging database intact for audit review.

## 8. Pilot Flows

Allowed pilot flows:

- Inbound organizer intake.
- Gig-seeker onboarding.
- Admin review and brief correction.
- Admin-visible message/audit review.
- Optional outbound replies to opted-in, allowlisted design partners.

Restricted flows:

- No autonomous external outreach.
- No outreach to real creators/vendors unless explicitly approved and
  allowlisted.
- No group chat with real people until the consent path is verified end to end.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, QR, RSVP, payment, production
  permission, or production-data workflow.

## 9. QA Checklist Before First Real SMS

Before any design partner sends or receives a real SMS:

- `docs/design-partner-pilot-runbook.md` has been reviewed by the operator.
- `docs/conversation-quality-guide.md` has been reviewed by the operator.
- `docs/public-launch-foundations.md`, `docs/pilot-data-retention.md`,
  `docs/pilot-rollback-runbook.md`, and
  `docs/abuse-and-rate-limit-readiness.md` have been reviewed.
- `/admin/pilot` shows provider mode, send disablement, allowlist requirement,
  allowed number count only, webhook validation, conversation engine mode, and
  manual readiness gates.
- `/api/health` reports Twilio config present in the Twilio staging environment.
- `/api/health` reports the expected provider mode.
- `/api/health` reports the expected SMS safety controls:
  `sendsDisabled`, `allowlistRequired`, and `allowedNumbersCount`.
- `/api/health` does not expose the actual allowlisted phone numbers.
- `SMS_SENDS_DISABLED=false` is set only for the specific moment when approved
  allowlisted real sends are being tested.
- `SMS_REQUIRE_ALLOWLIST=true` and `SMS_ALLOWED_NUMBERS` contains only approved
  design partner test numbers.
- `TWILIO_VALIDATE_WEBHOOKS=true`.
- Inbound webhook receives and validates a real Twilio request.
- Outbound send works only to allowlisted test numbers.
- STOP marks the sender opted out locally and at provider level where
  applicable.
- START reactivates the sender if supported by the provider and local state.
- Duplicate `MessageSid` does not create duplicate messages.
- `/admin/pipeline` shows one durable processing job per inbound MessageSid and
  duplicate webhooks do not create duplicate jobs.
- `MESSAGE_PROCESSING_MODE` remains `sync` unless an operator is explicitly
  testing `async_shadow`; `async_active` is future-only.
- Status callback updates existing message metadata.
- Rate limits work.
- Audit logs record sends, receives, failures, opt-outs, and admin actions.
- Admin can see all inbound and outbound messages.
- Failed sends are visible to admin.
- No messages are sent to non-allowlisted numbers.
- No real Saga app data appears in the Twilio staging database.

## 10. Pilot Success Criteria

The pilot is successful if:

- Trusted design partners can start a conversation.
- Saga collects the right intake fields.
- Saga's tone feels professional, friendly, and safe.
- Admin can inspect and correct the brief.
- Risky topics create human-review paths instead of unsafe commitments.
- Saga makes no unsafe promises about booking, payment, ticket sales, revenue,
  venue access, celebrity/influencer participation, attendance, contracts,
  permits, or production delivery.
- No messages are sent to non-allowlisted numbers.
- Opt-out works.
- Logs and audit events are reviewable.
- Feedback is actionable for product and engineering review.

## 11. Rollback

If the pilot needs to stop:

1. Set `SMS_SENDS_DISABLED=true`.
2. Set `MESSAGING_PROVIDER=MOCK`.
3. Remove Twilio webhook URLs from the staging phone number or Messaging
   Service.
4. Disable or stop using the Twilio staging number/Messaging Service.
5. Preserve the Twilio staging database for audit review.
6. Export relevant audit notes if needed, with secrets and private contact data
   redacted.
7. Confirm the current MOCK staging environment remains healthy.

Rollback must have no production data impact because the pilot environment is
separate from the production Saga app and production Saga data.
