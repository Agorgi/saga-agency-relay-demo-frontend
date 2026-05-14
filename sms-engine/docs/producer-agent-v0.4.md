# Producer Agent v0.4

Producer Agent v0.4 adds dry-run send readiness for approved outbound drafts.
It evaluates whether a draft would be safe and eligible to send later, but it
does not send SMS, call Twilio APIs, create `Message` send records, create
`Outreach`, contact anyone, or create group chats.

## Purpose

v0.1 creates producer planning artifacts. v0.2 adds candidate and shortlist
approval. v0.3 creates admin-reviewable outbound drafts. v0.4 answers one
question: "If this approved draft were considered for a future manually reviewed
send, what would block it?"

This is not a send implementation.

Talent Discovery v0.1 can improve candidate evidence before a draft reaches
this stage, but it does not change send-readiness gates. Sourcing candidates
must still pass human review and public-web candidates must not bypass internal
approval.

The outbound SMS self-test readiness package builds on v0.4. It evaluates the
first eventual one-number founder/operator test at a higher level, but it is
also dry-run only and does not send SMS.

LLM Provider Integration v0.1 is separate from send readiness. LLM output can
assist wording only after schema validation and forbidden-claims checks; it
does not make a draft sendable and cannot bypass v0.4 blockers.

## Readiness Statuses

- `READY_IN_DRY_RUN`
- `BLOCKED_BY_SENDS_DISABLED`
- `BLOCKED_BY_COMPLIANCE`
- `BLOCKED_BY_ALLOWLIST`
- `BLOCKED_BY_OPTOUT`
- `BLOCKED_BY_DRAFT_STATUS`
- `BLOCKED_BY_MISSING_RECIPIENT`
- `BLOCKED_BY_FORBIDDEN_CLAIMS`
- `BLOCKED_BY_PILOT_STAGE`
- `BLOCKED_BY_UNKNOWN`

Every result includes `dryRunOnly=true`.

## Gates

A draft is blocked when any of these are true:

- Draft status is not `APPROVED`.
- No valid recipient phone can be resolved.
- Recipient is opted out.
- `SMS_SENDS_DISABLED=true`.
- `SMS_REQUIRE_ALLOWLIST=true` and the recipient is not allowlisted.
- `MESSAGING_PROVIDER` is not `TWILIO` for real SMS readiness.
- Twilio credentials or sender configuration are missing.
- `TWILIO_STAGING_MODE=true` is not effective for Twilio staging.
- `TWILIO_VALIDATE_WEBHOOKS=false`.
- `SMS_COMPLIANCE_APPROVED=false` or missing.
- `PILOT_REPLY_MODE=draft_only`.
- The current `PILOT_STAGE` is missing required safety gates.
- `PILOT_STAGE=public_live` while `PUBLIC_LAUNCH_ENABLED=false`.
- Candidate is marked `DO_NOT_CONTACT`.
- Candidate outreach draft is not tied to an `APPROVED_FOR_SHORTLIST`
  recommendation.
- Organizer shortlist draft is not tied to an approved `ShortlistPacket`.
- Forbidden-claims or privacy checks fail.
- Draft contains raw phone numbers, emails, private notes, admin notes, or
  internal-only notes.
- Draft claims someone is confirmed, available, booked, paid, selected, added to
  a team, or included in a group chat without explicit consent.

## Admin UI

Admins can run "Evaluate send readiness" from `/admin/outbound-drafts` and from
the project detail outbound draft section.

The UI shows:

- Readiness status.
- Blockers.
- Required actions.
- Redacted recipient summary.
- Provider mode and safety snapshot.
- "Dry run only" copy.

No active send button exists in v0.4.

## Audit Event

- `producer.draft_send_readiness_evaluated`

Audit metadata includes safe IDs, readiness status, eligibility, blocker and
warning counts, a redacted recipient summary, and no-side-effect markers. It
must not include secrets, raw phone numbers, raw emails, message bodies, or
private notes.

## What Must Happen Before Actual Sending

Actual sending remains future work and requires at minimum:

- A2P/provider compliance approved.
- `SMS_SENDS_DISABLED=false` in an explicitly approved Twilio staging window.
- `SMS_REQUIRE_ALLOWLIST=true` for design partner/private beta stages.
- Recipient is active, allowlisted where required, and not opted out.
- Pilot stage and reply mode reviewed.
- Draft is admin-approved.
- Forbidden-claims and privacy checks pass.
- Twilio no-send, inbound no-reply, status callback, and outbound self-test
  procedures pass.
- `docs/outbound-sms-self-test-runbook.md` and
  `docs/outbound-self-test-checklist.md` are reviewed.
- `/admin/pilot` reports the outbound self-test dry-run state with no blockers
  only after compliance and explicit operator approval.
- Professional engineering/compliance review of the send implementation.

## Relationship To Earlier Versions

- v0.1: producer understanding, role mapping, sourcing plans, internal
  recommendations, and shortlist drafts.
- v0.2: candidate review and shortlist packet approval.
- v0.3: organizer shortlist and candidate outreach draft queue.
- v0.4: dry-run readiness evaluation for approved drafts only.

## What It Does Not Do

- No live SMS enablement.
- No Twilio send API calls.
- No organizer shortlist sending.
- No candidate outreach sending.
- No `Message` `SENT` records.
- No `Outreach` `SENT` records.
- No group chat creation.
- No open-web sourcing.
- No active public web research by default; public-research candidates cannot
  authorize sends.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, QR, RSVP, payment, production
  Saga permission, or production Saga app data behavior.

## Tests

Run:

```bash
npm run test:producer-send-readiness
npm run test:outbound-self-test-readiness
```

The test uses deterministic fixtures only. It verifies readiness gates, dry-run
behavior, redacted output, no Twilio calls, no SMS, no `Outreach` send state, no
group-chat creation, and the readiness audit event name.

`test:outbound-self-test-readiness` verifies the future one-number self-test
gates and safe `/api/health` reporting without calling Twilio or sending SMS.
