# Release Candidate v0.1

## Purpose

This release candidate freezes the standalone Saga SMS Producer app in a safe
pre-launch state. It is prepared for the next operational milestone after A2P
approval: one-number outbound self-test, internal-team pilot, 10 design
partners, and later capped public beta.

This is not public launch and not production Saga app integration.

## Current Verified Capabilities

- Twilio inbound staging can receive and persist inbound messages.
- SMS safety controls keep outbound sends disabled by default.
- Allowlist controls remain required for pilot SMS behavior.
- Conversation Engine v0.1 supports organizer intake, gig-seeker onboarding,
  interest checks, and contact reply / consent flows.
- Producer Agent v0.1-v0.4 supports project understanding, role mapping,
  sourcing plans, internal candidate recommendations, shortlist drafts,
  candidate review, outreach drafts, and send-readiness dry runs.
- LLM provider integration works in shadow and active_mock modes.
- LLM Quality Review compares deterministic and OpenAI outputs.
- Messaging Pipeline Reliability provides sync, async_shadow, and future
  async_active infrastructure while defaulting to sync.
- Production Observability, Public Beta Access Control, Pilot Data Operations,
  Launch Readiness Drill, Operator Command Center, Capped Public Beta
  Infrastructure, and Beta Cohort Simulation are implemented.
- Design Partner Pilot Script & Operator Playbook v0.8 is available as the
  manual operating package for the future 10-person pilot after A2P,
  one-number self-test, and internal-team test evidence are complete.
- Outbound Self-Test Readiness and Twilio Readiness remain dry-run/readiness
  only.

## Explicitly Disabled

- Live outbound SMS.
- LLM `active_live`.
- `MESSAGE_PROCESSING_MODE=async_active`.
- Public beta.
- Public launch.
- Design partner invites.
- Design partner SMS pilot launch.
- Main Saga app integration.
- Candidate outreach sends.
- Organizer shortlist sends.
- Group chat automation.
- Ticketing, RSVP, QR, payments, event publishing, and production Saga app data.

## Current Expected Blockers

- A2P / SMS compliance is not approved.
- `SMS_SENDS_DISABLED=true`.
- `PUBLIC_BETA_ENABLED=false`.
- `PUBLIC_LAUNCH_ENABLED=false`.
- No live send execution has been run.
- No one-number outbound self-test has been run.
- No internal team pilot has been run.
- No design partner pilot has been run.

These blockers are expected for this release candidate. They keep the app in a
safe A2P-hold posture.

## Go-Live Path After A2P

1. Confirm Twilio/A2P approval manually.
2. Set `SMS_COMPLIANCE_APPROVED=true`.
3. Keep `SMS_SENDS_DISABLED=true`.
4. Run the Launch Readiness Drill.
5. Run Outbound Self-Test Readiness.
6. Perform the one-number outbound self-test only during an explicit controlled
   test window.
7. Restore `SMS_SENDS_DISABLED=true` unless the operator explicitly continues.
8. Move to internal team testing.
9. Review `docs/design-partner-pilot-script-v0.8.md`,
   `docs/design-partner-feedback-questions.md`, and
   `docs/design-partner-operator-checklist.md`.
10. Move to the 10-design-partner pilot only after internal testing passes.
11. Review capped beta readiness later.

## Must Remain Out Of Scope

- Production Saga app connection or production Saga database.
- Ticketing, RSVP, QR codes, payments, event publishing, and sales flows.
- Public internet sourcing.
- Autonomous candidate outreach.
- Autonomous group chat creation.
- Any behavior that guarantees bookings, paid work, ticket sales, venue access,
  candidate availability, rates, or confirmed team placement.

## RC Commands

```bash
npm run test:release-candidate
npm run release:rc-report
```

`release:rc-report` prints a redacted Markdown report to stdout by default. To
write `reports/release-candidate-v0.1-report.md`, run it with
`RC_REPORT_WRITE=true`.

## Source Control

Annotated tag target:

```text
release-candidate-v0.1
```

Tag message:

```text
Saga SMS Producer standalone release candidate v0.1
```
