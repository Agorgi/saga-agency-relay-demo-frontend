# Controlled Live Reply Execution v0.1

Controlled Live Reply Execution v0.1 prepares the standalone Saga SMS producer
app for future autonomous replies to allowlisted pilot users. It does not enable
SMS, does not configure Twilio, and does not send messages while the current
environment remains fail-closed.

## Purpose

Ordinary inbound conversations should eventually be autonomous for:

- Organizer intake.
- Gig-seeker / creator onboarding.
- Interest-check intake.

Manual approval remains required for organizer shortlist packets, candidate
outreach, group chat creation, team introductions, rates, contracts, payment,
legal, safety, and anything that claims a person is confirmed, booked,
available, or added to a team.

## What Is Allowed

Autonomous live replies may become eligible only for ordinary inbound
conversation flows:

- `ORGANIZER_INTAKE`
- `GIG_SEEKER_ONBOARDING`
- `INTEREST_CHECK`

The reply must be generated from a safe `ReplyPlan`, must not require admin
review, and must pass forbidden-claims checks.

## What Is Blocked

The executor blocks:

- `CONTACT_REPLY`
- Candidate outreach.
- Organizer shortlist sends.
- Group chats and team introductions.
- Admin-review flows.
- Payment, rates, contracts, legal, permits, alcohol, safety, minors, weapons,
  harassment, discrimination, explicit content, or other high-risk topics.
- Any reply with forbidden claims.
- Any recipient who is not allowlisted or is opted out.
- Any duplicate reply for the same inbound Twilio `MessageSid`.

## Gate Matrix

All gates must pass before an autonomous live reply can send:

- `MESSAGING_PROVIDER=TWILIO`
- `TWILIO_STAGING_MODE=true` for pilot stages
- `TWILIO_VALIDATE_WEBHOOKS=true`
- Twilio credentials and sender are configured
- `SMS_COMPLIANCE_APPROVED=true`
- `SMS_SENDS_DISABLED=false`
- `SMS_REQUIRE_ALLOWLIST=true`
- Recipient is in `SMS_ALLOWED_NUMBERS`
- Recipient is not opted out
- `PILOT_STAGE=internal_test` or `design_partner`
- `PILOT_REPLY_MODE=auto_allowlisted`
- `PUBLIC_LAUNCH_ENABLED=false`
- Flow is one of the allowed ordinary inbound flows
- `ReplyPlan.shouldEscalate=false`
- Forbidden-claims check passes
- Inbound Twilio `MessageSid` has not already produced an outbound reply,
  blocked attempt, or pending draft
- No active outreach/contact reply context
- No group-chat action

If any gate fails, no SMS is sent. The evaluator returns a blocked status and
writes safe audit metadata when invoked with an audit sink.

## Pilot Stages

- `internal_test`: allowed for one-number internal tests only after all gates
  pass.
- `design_partner`: allowlist required; ordinary inbound conversations only.
- `private_beta`: future only; blocked in v0.1 until stronger caps and review
  gates are added.
- `public_candidate` and `public_live`: blocked in v0.1. Public launch remains
  disabled.

## Idempotency

The executor uses inbound Twilio `MessageSid` as the idempotency key.

Rules:

- A duplicate Twilio webhook must not produce a duplicate outbound reply.
- A Twilio retry must not produce a duplicate outbound reply.
- If a reply attempt was blocked, the same inbound message should not be retried
  autonomously without explicit review.
- If a send attempt was recorded, the same inbound message must not send again.
- If the system is uncertain, it should fail closed.

## Rate Caps

The app enforces stricter pilot caps than provider-level queues:

- `SMS_DAILY_SEND_CAP=25` by default.
- `SMS_PER_NUMBER_DAILY_SEND_CAP=5` by default.
- `SMS_AUTONOMOUS_REPLY_DAILY_CAP=10` by default.

If a cap is exceeded, the executor blocks, writes a cap-blocked audit event, and
does not call Twilio.

## Audit Events

- `live_reply.evaluated`
- `live_reply.blocked`
- `live_reply.sent` future-compatible
- `live_reply.idempotency_blocked`
- `live_reply.cap_blocked`
- `live_reply.needs_admin`

Audit metadata includes inbound IDs, flow, status, blocker counts, dry-run mode,
provider mode, pilot stage, reply mode, redacted sender/recipient, and cap
snapshots. It must not include raw phone numbers, secrets, message bodies, or
private notes.

## Health And Admin Visibility

`/api/health` reports:

- `liveReplyExecutionAvailable`
- `autonomousRepliesEnabled`
- `autonomousReplyBlockerCount`
- send cap values and current counts

`/admin/pilot` shows live-reply blockers, daily cap status, idempotency posture,
and scope limits. It has no live send button.

## Relationship To The First Outbound Self-Test

The one-number outbound self-test remains the first live send milestone after
A2P/provider compliance approval. Controlled live replies should not run before
that self-test is approved, executed, reviewed, and rolled back safely.

## Design Partner Behavior

For a design-partner pilot, autonomous replies can only apply to allowlisted
participants and only for ordinary inbound organizer, gig-seeker, and
interest-check conversations. Candidate outreach, shortlist sends, group chats,
and team introductions remain manual.

Per-phone autonomy v0.1 adds one more gate before any reply can be considered
sendable. Unknown numbers default to manual review. A phone set to ON may only
continue ordinary FAQ, organizer intake, gig-seeker onboarding, interest-check,
or clarification flows, and must hand off before outreach, shortlists, group
chats, rate/payment/legal, safety, or other external actions.

## Public Launch

Public launch remains disabled. `public_candidate` and `public_live` are blocked
for live replies in v0.1.

## Tests

Run:

```bash
npm run test:controlled-live-reply-execution
npm run test:per-phone-autonomy-controls
```

The test uses deterministic fixtures and a mocked send callback. It does not
call Twilio, send SMS, create group chats, create outreach sends, or use
production Saga app data.
