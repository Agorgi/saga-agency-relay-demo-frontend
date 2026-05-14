# Launch Readiness Drill v0.1

Launch Readiness Drill v0.1 is a simulation-only rehearsal for the standalone
Saga SMS Producer app. It checks the operational sequence from A2P approval to
one-number self-test, internal test, 10-person design-partner pilot, private
beta, rollback, incident handling, and public-beta candidate readiness.

It does not send SMS, call Twilio send APIs, invite users, publish the number,
enable `LLM_MODE=active_live`, enable `MESSAGE_PROCESSING_MODE=async_active`,
or connect the main Saga production app.

Launch Freeze / Release Candidate Packaging v0.1 adds the release-candidate
evidence bundle (`docs/release-candidate-v0.1.md`,
`docs/rc-readiness-matrix.md`, `docs/post-a2p-execution-playbook.md`, and
`docs/known-open-items.md`). The launch drill should treat that bundle as
pre-A2P operational evidence, not as permission to launch.

## Stage Model

1. `PRE_A2P_HOLD`
2. `A2P_APPROVED_REVIEW`
3. `ONE_NUMBER_SELF_TEST`
4. `INTERNAL_TEAM_TEST`
5. `DESIGN_PARTNER_10`
6. `PRIVATE_BETA_25`
7. `PUBLIC_BETA_CANDIDATE`
8. `ROLLBACK_DRILL`
9. `INCIDENT_DRILL`
10. `COMPLETE`

Each stage has preconditions, operator steps, evidence, blockers, warnings,
pass/fail criteria, rollback steps, related docs, and a status.

## How To Run

Admin UI:

- Open `/admin/launch-drill`.
- Review blockers and current recommended stage.
- Click `Run readiness drill` to write a redacted audit trail.
- Use rollback and incident simulation buttons to record drill evidence.
- Open `/admin/command-center` for the single operator view that summarizes the
  same drill status alongside SMS safety, LLM health, access controls, data
  ops, and go/no-go decisions.

CLI:

```bash
npm run test:launch-readiness-drill
npm run launch:drill-report
npm run test:release-candidate
npm run release:rc-report
```

## How To Interpret Readiness

- `PRE_A2P_HOLD` can pass while the launch is still blocked.
- `A2P_APPROVED_REVIEW` remains blocked until `SMS_COMPLIANCE_APPROVED=true`
  and approval is manually documented.
- `ONE_NUMBER_SELF_TEST` remains blocked until compliance is approved, sends
  are intentionally enabled for that future test, exactly one number is
  allowlisted, the v0.9 playbook/checklist are reviewed, and send readiness is
  `READY_IN_DRY_RUN`.
- `DESIGN_PARTNER_10` remains blocked until one-number and internal team tests
  are passed and the pilot script, feedback questions, and operator checklist
  exist.
- `PUBLIC_BETA_CANDIDATE` remains blocked until private beta evidence and
  public beta gates are reviewed.

## Required Evidence

- `/api/health` safety posture.
- A2P compliance packet.
- Outbound self-test runbook and checklist.
- Post-A2P one-number self-test v0.9 playbook.
- Post-A2P self-test checklist.
- Design partner pilot runbook.
- Design partner pilot script v0.8.
- Design partner feedback questions.
- Design partner operator checklist.
- Transcript dry-run summary.
- Production observability dashboard.
- Public beta access controls.
- Pilot data operations and retention docs.
- Rollback and incident runbooks.

## Rollback Simulation

The rollback drill states what an operator would do:

- Set `SMS_SENDS_DISABLED=true`.
- Set `PILOT_REPLY_MODE=draft_only`.
- Set `PILOT_STAGE=internal_test`.
- Reduce or clear `SMS_ALLOWED_NUMBERS`.
- Disable Twilio webhook if needed.
- Pause participants.
- Preserve audit logs.
- Avoid data deletion until reviewed.

The simulation does not actually change environment variables.

## Incident Simulation

Covered scenarios:

- Unexpected outbound SMS.
- Duplicate replies.
- OpenAI unsafe output.
- Twilio webhook failure.
- Pipeline backlog.
- Database unavailable.
- Data exposure.
- `PUBLIC_LAUNCH_ENABLED` accidentally true.

Each scenario includes detection signal, immediate response, owner, rollback,
and a Codex bug-report template.

## Before Inviting 10 Design Partners

- A2P approved.
- One-number self-test passed.
- Internal team test passed.
- `DESIGN_PARTNER_10` beta cohort simulation passed.
- Design partner runbook reviewed.
- Design partner pilot script, feedback questions, and operator checklist
  reviewed.
- Feedback capture ready.
- Data ops ready.
- Observability green or yellow, not red.
- Rollback drill completed.
- No safety-critical transcript dry-run failures.

## Before Public Beta

- Private beta passed.
- `PRIVATE_BETA_25`, `CAPPED_PUBLIC_BETA_100`, and over-capacity simulations
  passed.
- Capacity and access caps reviewed.
- Support contact, privacy, terms, opt-in language ready.
- Abuse, rate, and cost controls ready.
- Incident response ready.
- `PUBLIC_LAUNCH_ENABLED=false` until the final explicit approval step.

## Standalone Boundary

The launch drill is scoped to this standalone Railway/Postgres SMS producer app.
It does not use production Saga app data and does not add ticketing, RSVP, QR,
payment, event publishing, or production Saga user permission behavior.
