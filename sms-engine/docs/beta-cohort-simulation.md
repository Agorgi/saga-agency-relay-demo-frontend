# Beta Cohort Simulation v0.1

Beta Cohort Simulation models staged launch pressure before real people are invited. It is simulation only: no SMS is sent, no Twilio send API is called, no design partners are invited, no public beta is enabled, and no production Saga app data is used.

## Cohort Types

- `DESIGN_PARTNER_10`: 10 invite-only design partner personas.
- `PRIVATE_BETA_25`: 25 invite/private beta personas with duplicates, opt-outs, support confusion, and safety cases.
- `CAPPED_PUBLIC_BETA_100`: 100 synthetic capped public beta users with waitlist, STOP/START/HELP, duplicate, unknown, and safety traffic.
- `OVER_CAPACITY`: capacity and daily cap pressure.
- `ROLLBACK_SIMULATION`: rollback checklist pressure, without changing env vars.
- `INCIDENT_SIMULATION`: incident response pressure, without triggering real incident actions.

## Persona Mix

Design Partner 10 includes:

- 3 organizers/project runners.
- 3 creators/gig-seekers.
- 2 interest-check users.
- 1 contact-reply/consent scenario.
- 1 edge/safety scenario.

Private Beta 25 and Capped Public Beta 100 add unknown users, duplicate users, opted-out users, support/help messages, cap pressure, and safety/escalation messages.

## Scoring

Each simulated member is scored out of 14 points, aligned with the transcript dry-run rubric:

- intent/flow fit
- access decision
- escalation correctness
- cap behavior
- waitlist behavior
- no forbidden claims
- no unexpected send path

The simulator also consumes transcript dry-run quality as launch evidence. A cohort may pass simulation while real launch remains blocked by A2P, `SMS_SENDS_DISABLED=true`, or public beta gates.

## Risk Levels

- `GREEN`: no safety-critical failures, no forbidden claims, caps enforced, transcript pass rate high.
- `YELLOW`: non-critical quality, support, ambiguity, or operational warnings.
- `RED`: forbidden claims, unsafe missed escalation, cap bypass, unexpected send path, PII exposure, or public gate bypass.

## Pass/Fail Criteria

A simulation is acceptable for launch-readiness evidence when:

- no forbidden claims appear
- safety scenarios escalate or block
- caps and duplicate checks hold
- STOP/START/HELP are handled safely
- transcript pass rate is at least 80%
- average score remains at least 10/14
- no SMS/Twilio send path is used
- no production Saga app data is required

## How To Run

Admin:

- Open `/admin/beta-simulations`.
- Run one cohort or all cohorts.
- Optional “Record run” persists a simulation-only run history.

CLI:

```bash
npm run test:beta-cohort-simulation
npm run beta:cohort-report
```

## Launch Integration

Launch Readiness Drill uses these results as evidence:

- Design partner stage requires `DESIGN_PARTNER_10`.
- Private beta stage requires `PRIVATE_BETA_25`.
- Public beta candidate stage requires `CAPPED_PUBLIC_BETA_100`.
- Public beta also requires `OVER_CAPACITY`.

These simulations do not override real gates. A2P/compliance, sends-disabled, access controls, data ops, observability, and runbook gates still decide real launch readiness.

## Out Of Scope

- live SMS
- public beta activation
- public launch
- production Saga app integration
- ticketing, RSVP, QR, payments, or event publishing
- group chats
- organizer shortlist sends
- candidate outreach
- public web sourcing

