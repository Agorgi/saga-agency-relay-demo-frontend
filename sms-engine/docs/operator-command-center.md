# Operator Console / Launch Command Center v0.1

The Launch Command Center is the admin-only overview for the standalone Saga
SMS Producer app. It centralizes health, safety, launch-stage readiness,
runbooks, and dry-run controls without enabling live SMS or public access.

It does not send SMS, flip environment variables, invite design partners,
publish the number, create group chats, send shortlists, send candidate
outreach, set `LLM_MODE=active_live`, set
`MESSAGE_PROCESSING_MODE=async_active`, or connect the production Saga app.

## Page Sections

Open `/admin/command-center`.

The top of the page is the operator home base. It shows the current stage,
overall status, next recommended action, top blockers, critical warnings, and
plain-language cards for SMS safety, A2P/compliance, pilot readiness, public
beta readiness, LLM status, pipeline health, and talent/matching status.

Detailed sections below still show:

- Global status and current recommended launch stage.
- SMS safety and Twilio staging posture.
- LLM provider/mode status.
- Messaging pipeline health.
- Observability risk.
- Public beta access controls.
- Pilot participant counts.
- Pilot data operations readiness.
- Launch drill status.
- Post-A2P one-number self-test plan/checklist availability, readiness,
  blockers, and next action.
- Design partner pilot package status: script, feedback questions, operator
  checklist, blockers, and next operator action.
- Release candidate version, tag, status, blockers, and post-A2P next action.
- Talent Discovery availability, candidate review queue, and public-web research
  mode.
- Candidate Graph availability, search profile count, graph edge count,
  unverified research candidates, do-not-contact candidates, and public-web-only
  candidates.
- Go / No-Go readiness for self-test, internal test, design partners, private
  beta, capped public beta, and public launch.
- Kill-switch/rollback status.
- Incident readiness.
- Safe action cards and runbook links.

The admin sidebar is grouped by operator job so new operators do not need to
scan every admin route at once. Command Center stays pinned at the top. See
`docs/admin-operator-ux-v0.1.md` for the full navigation inventory and label
mapping.

Admin IA v0.2 adds a fixed `/admin/needs-attention` link directly below Command
Center. The Command Center top summary includes the critical Needs Attention
count, and the sidebar shows small count badges for Messages, Sourcing, Quality
& Safety, and Operations. See `docs/admin-info-architecture-v0.2.md`.

All output is redacted. The page shows counts, status, stage, and runbook
availability rather than raw phone numbers, secrets, prompts, or raw LLM
outputs.

## How To Interpret Status

- `green`: no command-center blockers and all core guardrails are intact.
- `yellow`: expected launch blockers or warnings exist, such as A2P not being
  approved yet.
- `red`: unsafe conditions are detected, such as sends enabled without
  compliance, public launch enabled outside public-live, webhook validation
  disabled, `active_live`, or `async_active`.

Current expected pre-A2P state is usually yellow: safe to hold, but blocked from
outbound testing and design partners.

## Go / No-Go Logic

The command center evaluates:

1. One-number outbound self-test.
2. Internal team test.
3. 10 design partner pilot.
4. Private beta.
5. Capped public beta.
6. Public launch.

Each target shows `BLOCKED`, `NOT_READY`, `READY_FOR_REVIEW`, or `READY`,
with blockers, required evidence, related docs, and evaluation time.

Before A2P approval, all stages requiring outbound SMS should be blocked.
Public beta and public launch should also remain blocked unless their explicit
future gates are intentionally opened and reviewed.

The design-partner pilot package can show its docs as available while
`designPartnerPilotReady=false`. That is expected until A2P approval,
one-number self-test evidence, internal-team test evidence, access controls,
observability, data ops, and launch drill gates pass.

## Safe Action Rules

The command center may link to runbooks or invoke dry-run evaluations only.

Allowed:

- View runbooks/checklists.
- Record a command-center readiness evaluation.
- Run the launch readiness drill.
- Open the release candidate package, post-A2P playbook, v0.9 self-test plan,
  and v0.9 self-test checklist.
- Open observability, transcript dry runs, LLM review, sourcing, and data ops.
- Generate a redacted CLI report with `npm run command-center:report`.

Not allowed:

- Editing environment variables.
- Sending SMS.
- Inviting design partners.
- Publishing the number.
- Enabling public beta or public launch.
- Creating group chats.
- Sending organizer shortlists or candidate outreach.
- Connecting the main Saga app.

## Kill-Switch Visibility

The console displays these safety controls:

- `SMS_SENDS_DISABLED`
- `PUBLIC_LAUNCH_ENABLED`
- `PUBLIC_BETA_ENABLED`
- `SMS_REQUIRE_ALLOWLIST`
- `TWILIO_VALIDATE_WEBHOOKS`
- `LLM_MODE`
- `MESSAGE_PROCESSING_MODE`
- `PILOT_STAGE`
- `PILOT_REPLY_MODE`

The UI does not edit these values. If a value is unsafe, the operator should
use Railway/env controls and the rollback runbook, not an in-app button.

## Before A2P Approval

Use the command center to confirm:

- `SMS_SENDS_DISABLED=true`
- `SMS_REQUIRE_ALLOWLIST=true`
- `SMS_COMPLIANCE_APPROVED=false`
- `PUBLIC_LAUNCH_ENABLED=false`
- `LLM_MODE` is not `active_live`
- `MESSAGE_PROCESSING_MODE` is not `async_active`
- launch stage is `PRE_A2P_HOLD`

The next safe action should be to wait for A2P approval and continue dry-run
review. Release candidate status should read `READY_FOR_A2P_HOLD` unless an
unsafe config has been detected.

## Release Candidate Status

The command center surfaces `release-candidate-v0.1` as a packaging state, not
a launch state. `READY_FOR_A2P_HOLD` means the release candidate is safe to hold
while A2P remains external. It does not mean outbound SMS, public beta, public
launch, active_live, async_active, design partner invites, or production Saga
app integration are approved.

Use `docs/release-candidate-v0.1.md`, `docs/rc-readiness-matrix.md`,
`docs/post-a2p-execution-playbook.md`, and `docs/known-open-items.md` as the
operator evidence bundle.

## After A2P Approval

Use the command center to verify:

- Compliance flag is intentionally set only after provider approval.
- Post-A2P one-number self-test v0.9 plan and checklist are available.
- One-number self-test runbook and checklist are ready.
- Allowlist count is exactly one for the first outbound self-test.
- Rollback and incident runbooks are reviewed.
- `/admin/launch-drill` still reports no unresolved blockers for the next
  stage.

## Before Design Partners

The 10-person design partner pilot remains blocked until:

- One-number self-test passed.
- Internal team test passed.
- Design partner checklist is complete.
- Transcript dry runs have no safety-critical failures.
- Feedback capture and data ops are ready.
- Observability is green or yellow, not red.
- Rollback drill is complete.

## Before Public Beta

Public beta remains blocked until private beta evidence exists, caps and access
controls are reviewed, support/privacy/terms are ready, abuse controls are in
place, incident response is reviewed, and public launch remains disabled until
final approval.

The command center now includes capped public beta infrastructure status:

- waitlist count
- admitted count
- cap usage
- landing/waitlist enabled flags
- public number visibility
- support/privacy/terms configuration
- public beta readiness blockers

The console links to `/admin/public-beta` for waitlist and consent review. It
does not provide env editing, SMS sending, public-number publishing, or public
launch controls.

## Beta Cohort Simulation

The command center now surfaces `/admin/beta-simulations` evidence:

- latest 10-person design partner simulation
- latest 25-person private beta simulation
- latest 100-person capped public beta simulation
- over-capacity simulation status
- simulation risk level and blocker count

Simulation readiness can pass while real launch remains blocked by A2P,
`SMS_SENDS_DISABLED=true`, missing self-test evidence, or public beta flags. The
command center keeps those as separate signals so operators do not confuse a
synthetic cohort pass with permission to invite people.

## Out Of Scope

The command center does not implement live send execution, public signup,
production Saga app integration, ticketing, RSVP, QR codes, payments, event
publishing, public web sourcing, autonomous candidate outreach, shortlist
sending, or group chat creation.

## Per-Phone Autonomy Controls

The command center reports per-phone autonomy availability, autonomous/manual/
paused counts, recent handoffs, and candidate-outreach boundary handoffs. If
handoffs exist, the next operator action is to review Needs Attention before
any pilot reply continues.

Per-phone autonomy never overrides `SMS_SENDS_DISABLED`, allowlist, opt-out,
compliance, candidate outreach review, shortlist review, or group-chat approval.
The v0.1 controls passed staging verification after `71a3588`; operators should
still re-check runtime SMS gates before any post-A2P test window.

## Talent Research Quality

The command center links to `/admin/sourcing-quality` and reports the talent
quality review risk level, pending review count, public-web candidates pending
review, approved reviews, rejected candidates, and do-not-contact counts. These
are visibility signals only; the console does not approve outreach, send
shortlists, or run public web research.

## Public Web Research Shadow Mode

The command center links to `/admin/sourcing/public-web` and reports whether
public-web shadow research and live dry-run infrastructure are available,
enabled, blocked, carrying pending review results, or carrying pending/failed
async jobs. Passing a live dry run does not authorize outreach, shortlist sends,
group chat creation, public beta, public launch, or production Saga app
integration.

## Public Web Review And Cleanup

The command center also reports the v0.5 public-web review signal: pending
review results, needs-more-research counts, needs-more-contact-research counts,
discarded/duplicate/do-not-contact counts, source-quality risk, contactability
pending/high-risk counts, and review risk. Operators use
`/admin/sourcing/public-web-review` to normalize citations, review
contactability evidence, archive test results, and send safe candidates to
Talent Research Quality Review. The command center remains read-only for
dangerous actions and does not expose source URLs, contact values, send
controls, invite controls, group-chat controls, or public-launch controls.

## Relationship-Aware Matching

The command center reports v0.6b matching availability, recent match runs,
pending match reviews, internal/public-web coverage, average candidate score,
high-risk match counts, and do-not-contact/opt-out exclusions. These are
redacted operational counters only. Operators use `/admin/matching` to run
project-specific ranking and update review statuses; the command center does
not trigger outreach, SMS, email, DMs, group chats, public-web research, or
organizer shortlist sends.

## Matching Evaluation

The command center reports Matching Evaluation v0.7 availability, last score,
last pass/fail status, failure count, safety-violation count, and tuning
recommendation count. These are report-level counters only; no candidate names,
source URLs, contact details, prompts, secrets, or production data are exposed.
