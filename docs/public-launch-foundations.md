# Public Launch Foundations

Public launch is not active. This document records foundations and prerequisites
for a future public launch review only.

## 1. Launch Must Stay Disabled

Default state:

- `PILOT_STAGE=internal_test`
- `PILOT_REPLY_MODE=draft_only`
- `PUBLIC_LAUNCH_ENABLED=false`
- `SMS_SENDS_DISABLED=true`
- `SMS_REQUIRE_ALLOWLIST=true`
- `SMS_ACCESS_MODE=allowlist_only`
- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_BETA_LANDING_ENABLED=false`
- `PUBLIC_BETA_WAITLIST_ENABLED=false`
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false`
- `PUBLIC_WEB_RESEARCH_ENABLED=false`

If `PILOT_STAGE=public_live` is set without all explicit gates, the app should
fail closed and report `publicLaunchReady=false` in `/api/health`.

Producer Agent v0.4 send readiness may report blockers for approved outbound
drafts, but it is dry-run only. It is not a public launch gate by itself and
does not send SMS.

The outbound SMS self-test readiness package is also dry-run only. It prepares
for one future founder/operator test before any internal team, design partner,
private beta, or public testing. It is not public launch readiness and does not
enable sends.

Post-A2P One-Number Self-Test v0.9 is documented in
`docs/post-a2p-one-number-self-test-v0.9.md` and
`docs/post-a2p-self-test-checklist.md`. It is the exact future one-number test
plan after A2P approval, not a send trigger. Design partners remain blocked
until that test and the internal-team test pass.

Controlled Live Reply Execution v0.1 is pilot-scoped and disabled by default.
It does not enable public launch, candidate outreach, shortlist sends, group
chats, or public mass texting.

LLM Provider Integration v0.1 is optional and fail-closed. `active_live` model
output remains disabled by default and is not a public launch pathway.

Production Observability v0.1 adds `/admin/observability`,
`npm run observability:daily-report`, and
`docs/incident-response-runbook.md`. These are required review inputs for any
future public-candidate or public-live decision, but they do not enable public
launch.

Public Beta Access Control v0.1 is documented in
`docs/public-beta-access-control.md`. It adds `/admin/access`, hashed invite
codes, participant caps, waitlist/paused/opt-out states, and inbound access
decisions. It does not enable public beta or public launch.

Capped Public Beta Infrastructure v0.1 is documented in
`docs/capped-public-beta-infrastructure.md`. It adds `/beta`,
`/admin/public-beta`, public-beta waitlist records, consent events, admission
gates, readiness checks, and safe landing copy. It remains disabled by default,
does not publish the SMS number, and does not send messages.

Operator Command Center v0.1 is documented in
`docs/operator-command-center.md`. It adds `/admin/command-center` as the
single internal launch/pilot overview for go/no-go status, public beta/public
launch blockers, kill-switch posture, and safe runbook links. It does not
enable public launch or edit environment variables.

Launch Freeze / Release Candidate Packaging v0.1 is documented in
`docs/release-candidate-v0.1.md` and `docs/rc-readiness-matrix.md`. It freezes
the current standalone pre-A2P state for review, but it is not public launch
approval and does not enable public beta, public launch, live SMS, active_live,
async_active, production Saga app integration, ticketing, RSVP, QR, or payments.

Design Partner Pilot Script & Operator Playbook v0.8 is documented in
`docs/design-partner-pilot-script-v0.8.md`,
`docs/design-partner-feedback-questions.md`, and
`docs/design-partner-operator-checklist.md`. It defines the future 10-person
pilot operating package, approved manual copy, monitoring workflow, feedback
capture, success criteria, and pause criteria. It does not invite anyone,
send SMS, publish the number, enable public beta, or enable public launch.

## 2. Public Launch Prerequisites

Public launch requires:

- A2P/10DLC, toll-free, or provider compliance approval.
- Opt-in path documented.
- STOP, START, and HELP tested.
- Privacy policy link.
- Terms link.
- Support contact.
- Abuse/spam controls.
- Rate limits.
- Beta access controls, caps, and invite-code lifecycle reviewed.
- Cost controls.
- Rollback plan.
- Incident response plan.
- Monitoring dashboard.
- Production observability dashboard and daily report reviewed.
- Data retention/deletion policy.
- Pilot data inventory, export/redaction workflows, backup/restore runbook, and
  data incident runbook.
- Launch readiness drill, design-partner launch checklist, and public-beta
  launch checklist reviewed.
- Release candidate package, known open items, and post-A2P playbook reviewed.
- Design partner pilot script, feedback questions, and operator checklist
  reviewed. These are required for the 10-person pilot only after A2P,
  one-number self-test, and internal-team test evidence are complete.
- Talent Discovery public-web research policy reviewed; private or login-gated
  scraping and autonomous candidate outreach remain disabled.
- Engineer-reviewed decision about whether any production Saga app integration
  is appropriate.

## 3. Public Opt-In Language

Draft only; must be reviewed before use:

> Text Saga to help structure creative projects, event ideas, and creator
> opportunities. Message frequency may vary. Reply STOP to opt out or HELP for
> support. Saga cannot guarantee bookings, paid work, attendance, venue access,
> ticket sales, or production outcomes.

## 4. HELP Response Copy

Draft only:

> Saga SMS helps collect project and creator intake for review. We cannot handle
> emergencies, legal advice, payments, or urgent logistics here. Reply STOP to
> opt out.

## 5. STOP/START Expectations

- STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT must opt out.
- START/UNSTOP may reactivate local state where supported.
- HELP must provide support/boundary information.
- These must work before any public candidate test.

## 6. What Saga Can And Cannot Promise

Saga can:

- Ask structured intake questions.
- Turn ideas into draft briefs.
- Collect creator profile information for review.
- Capture interest-check concepts.
- Help admins review next steps.

Saga cannot promise:

- Bookings.
- Paid work.
- Rates.
- Revenue.
- Ticket sales.
- Attendance.
- Venue access.
- Confirmed team placement.
- Celebrity or influencer participation.
- Group-chat inclusion without consent and admin action.

## 7. Launch Stages

- `internal_test`: safest default; internal allowlist only.
- `design_partner`: invite-only pilot; no public distribution.
- `private_beta`: larger invite-only beta; still not public.
- `public_candidate`: public launch rehearsal; docs/support/privacy/terms and
  compliance required.
- `public_live`: future only; must fail closed unless explicit gates are
  satisfied.

## 8. Engineering Review Before `public_live`

Engineers must review:

- Schema and migrations.
- Admin auth.
- Twilio provider safety.
- Design-partner transcript dry-run results and LLM quality review outcomes.
- Rate limiting and cost controls.
- Opt-out state and provider compliance.
- Logging redaction and audit visibility.
- Incident/rollback runbook.
- Data retention/deletion process.
- Any production Saga app integration plan.
- Producer Agent send readiness and any future send execution code.
- Messaging pipeline reliability, including MessageSid idempotency, retry
  behavior, queue depth monitoring, and the decision to move beyond
  `MESSAGE_PROCESSING_MODE=sync`.
- Pilot data operations, including redacted exports, participant deletion or
  redaction requests, backup/restore procedure, and proof that no production
  Saga app data is mixed into the standalone pilot database.
- Launch Readiness Drill v0.1 output, including rollback and incident
  simulations. Public beta candidate readiness must be rehearsal evidence only;
  it must not enable `PUBLIC_LAUNCH_ENABLED` by itself.
- Beta Cohort Simulation v0.1 output, including 10-person, 25-person,
  100-person, and over-capacity synthetic cohorts. These simulations must not be
  treated as real admissions, design partner invites, SMS sends, or public beta
  activation.
- Talent Research Quality Review v0.2 output, especially for any public-web
  candidates. Public-web recommendations require citations, identity clarity,
  evidence strength, and admin approval before organizer-facing shortlist or
  outreach workflows.
- Public Web Research Shadow Mode v0.3 and Live Dry Run v0.4 output, if enabled
  in admin-only modes. Results are review-only and must not be treated as
  permission to contact candidates, create group chats, send shortlists,
  activate public beta, or launch publicly.
- Public Web Research Review & Cleanup v0.5 output, including citation/source
  normalization, duplicate detection, source-quality scoring, contactability
  evidence, and archive/discard state. Contactability remains a future
  admin-review signal only; it does not authorize SMS, email, social DMs,
  contact-form submissions, organizer-facing contact display, or outreach.
- Design Partner Pilot Script & Operator Playbook v0.8 output, including the
  approved capability language, STOP/HELP guidance, feedback questions,
  daily operator workflow, and pause/rollback criteria. This package is not an
  invite list, SMS send path, public launch approval, or production Saga app
  integration.

No event publishing, ticketing, ticket sales, RSVP, QR, payment, or production
Saga user permission behavior may be introduced by public launch preparation.
