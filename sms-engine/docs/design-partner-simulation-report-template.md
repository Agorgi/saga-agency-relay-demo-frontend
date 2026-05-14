# Design Partner Simulation Report Template

Use this template after running `DESIGN_PARTNER_10` or all beta cohort simulations. Keep it redacted. Do not include real phone numbers, invite codes, secrets, prompt text, or production Saga data.

## Simulation Summary

- Date:
- Operator:
- Cohort type:
- Simulation run ID:
- Pass/fail:
- Risk level:
- Average score:
- Transcript pass rate:
- Forbidden claims count:
- Escalation misses:
- Duplicate/cap issues:
- No SMS sent: yes
- No Twilio send API called: yes
- Production app data used: no

## Transcript Issues

- Wrong next question:
- Too verbose:
- Confusing:
- Better than deterministic fallback:
- Worse than deterministic fallback:
- Needs prompt tuning:

## Access Issues

- Incorrect allow/block/waitlist decisions:
- Cap behavior:
- Duplicate behavior:
- Opt-out behavior:
- Invite-code behavior:

## Safety Issues

- Unsafe promise:
- Missed escalation:
- Payment/rate/legal/safety handoff:
- Group-chat implication:
- Candidate/shortlist implication:

## Open Bugs

- P0/P1 launch blockers:
- P2 quality issues:
- Docs/runbook gaps:
- Data ops gaps:
- Observability gaps:

## Go / No-Go Recommendation

- Design partner simulation ready:
- Real design partner launch ready:
- Real launch blockers:
- Recommended next action:

Reminder: simulation can pass while real launch remains blocked by A2P/compliance, `SMS_SENDS_DISABLED=true`, missing manual evidence, or public-beta gates.

