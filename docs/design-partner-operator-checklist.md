# Design Partner Operator Checklist

This checklist prepares the 10-person design-partner pilot. It does not invite
anyone, send SMS, publish the number, enable public beta, enable public launch,
or connect the production Saga app.

## Pre-A2P

- A2P/compliance is still pending.
- Release candidate package is reviewed.
- Design partner list is drafted but nobody is invited through the app.
- Support contact path is ready.
- Opt-in copy is ready.
- Capability / FAQ responses are reviewed.
- `SMS_SENDS_DISABLED=true`.
- Public beta and public launch remain disabled.

## Post-A2P, Pre-Self-Test

- `SMS_COMPLIANCE_APPROVED=true` only after provider approval is confirmed.
- `SMS_SENDS_DISABLED=true` still holds by default.
- Launch drill is green or expected yellow without critical blockers.
- Post-A2P one-number self-test v0.9 playbook is reviewed.
- Post-A2P self-test checklist is ready.
- One-number self-test runbook is ready.
- Rollback runbook is reviewed.
- Command center is reviewed.

## One-Number Self-Test

- Allowlist contains only the founder/operator test number.
- Exactly one inbound message is sent during the approved window.
- Exactly one reply occurs if sends are explicitly enabled for that window.
- Twilio logs are checked.
- Audit logs are checked.
- Safe state is restored if the test window ends.

## Internal Team Test

- 2 to 5 internal testers only.
- No public sharing.
- Allowlist only.
- No candidate outreach.
- No group chat automation.
- Daily transcript review.
- Feedback capture active.

## Design Partner Launch

- Maximum 10 users.
- Explicit opt-in confirmed manually.
- Allowlist configured for only approved testers.
- Monitoring active in `/admin/command-center`, `/admin/observability`, and
  `/admin/pilot-feedback`.
- Pause criteria are understood by the operator.
- Feedback capture is active.
- No public sharing of the number.
- No public beta or public launch controls enabled.

## Daily Operator Decision

At the end of each day, choose one:

- Continue: no critical issues, feedback is useful, and safety posture remains
  intact.
- Pause: a pause criterion occurred or the operator cannot explain a
  conversation.
- Fix: a non-critical product or copy issue needs correction before more tests.

Document the decision in admin notes or pilot feedback.
