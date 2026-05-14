# Design Partner Pilot Runbook v0.1

This runbook prepares Saga Producer MVP for a future invite-only SMS pilot. It
does not start the pilot, approve live SMS, configure Twilio, invite design
partners, or connect the production Saga app.

For the pilot, use `PILOT_STAGE=design_partner`,
`PILOT_REPLY_MODE=draft_only`, `PUBLIC_LAUNCH_ENABLED=false`,
`SMS_SENDS_DISABLED=true`, and `SMS_REQUIRE_ALLOWLIST=true` until an explicitly
approved outbound test window.

## 1. Purpose

The design-partner pilot will validate Saga's SMS producer experience with a
small number of trusted users. The main feedback targets are:

- Intake quality: does Saga collect the right information?
- Tone: does Saga feel like a friendly, capable producer?
- Trust: do users understand the prototype boundary?
- Usefulness: does the flow make the next step clearer?
- Admin visibility: can operators understand what happened and why?
- Producer-interface clarity: do users naturally understand texting Saga as a
  way to structure a project with a producer?
- Producer intelligence review: can admins safely inspect project
  understanding, role maps, internal recommendations, and shortlist drafts
  before anything is sent?

## 2. Non-Goals

- No public number distribution.
- No production Saga app integration.
- No real event publishing.
- No ticketing.
- No ticket sales.
- No RSVP.
- No QR codes.
- No payments.
- No autonomous outreach.
- No group-chat automation.
- No autonomous shortlist sending.
- No public web sourcing.
- No promise of bookings or paid work.
- No production Saga app data.
- No public launch.

## 3. Pilot Gates

The pilot may not begin until every gate is reviewed by the operator, product,
engineering, and compliance owners:

- A2P/10DLC, toll-free verification, or other provider compliance is approved
  for the exact number/use case.
- The A2P/SMS compliance packet in `docs/a2p-compliance-packet.md` has been
  reviewed by the business/legal/compliance owner before any provider
  submission or outbound SMS test.
- `SMS_SENDS_DISABLED` is intentionally reviewed before any outbound test.
- `SMS_REQUIRE_ALLOWLIST=true`.
- `PILOT_STAGE=design_partner` has been reviewed.
- `PILOT_REPLY_MODE=draft_only` or `manual_approval` has been reviewed.
- `PUBLIC_LAUNCH_ENABLED=false`.
- Design partner numbers are added to `SMS_ALLOWED_NUMBERS` only after explicit
  opt-in.
- STOP, START, and HELP behavior has been tested in the Twilio staging
  environment.
- `/admin/pilot`, `/admin/audit`, `/admin/projects`, and Twilio logs are ready
  for live monitoring.
- `/admin/observability` is ready for redacted system, SMS safety, LLM,
  pipeline, pilot, and risk monitoring. See
  `docs/production-observability.md`.
- `/admin/command-center` is ready as the single operator view for go/no-go
  status, kill-switch posture, launch drill status, runbooks, and next safe
  action. See `docs/operator-command-center.md`.
- The admin portal uses the v0.1 grouped operator sidebar. New operators should
  start at Command Center, then use Pilot & Launch, Projects, Sourcing &
  Matching, and Quality & Safety sections instead of hunting through a flat
  route list. See `docs/admin-operator-ux-v0.1.md`.
- The v0.2 admin IA adds `/admin/needs-attention` for approvals, blocked
  drafts, failed jobs, and warning items. Operators should check Command Center
  first, then Needs Attention, before each pilot monitoring window.
- Per-phone autonomy v0.1 can be toggled for known contacts or pilot
  participants only after the required SMS approval and self-test milestones.
  Unknown numbers stay manual-review by default. Saga must hand off before
  candidate outreach, shortlist sending, group chat creation, rate/payment/
  legal issues, safety issues, or any other external action.
- `/admin/sourcing` is available for internal-first Talent Discovery review. It
  can search standalone candidates and generate public-research plans, but it
  does not send outreach, publish shortlists, create group chats, or scrape
  private sources. See `docs/talent-discovery-engine-v0.1.md`.
- Release Candidate v0.1 has been reviewed in
  `docs/release-candidate-v0.1.md`, including the readiness matrix,
  `docs/post-a2p-execution-playbook.md`, and `docs/known-open-items.md`.
  RC status is not launch approval; A2P, self-test, and internal test evidence
  are still required.
- `docs/incident-response-runbook.md` has been reviewed by the operator who
  will monitor the pilot.
- `/admin/pilot-participants` is ready for invite/private beta participant
  tracking with hashed/redacted phone display only.
- `/admin/access` is ready for invite-code, cohort, cap, and participant status
  controls. See `docs/public-beta-access-control.md`.
- Pilot feedback capture is ready at `/admin/pilot-feedback` and on project
  detail pages.
- Producer Agent outputs in `/admin/projects/[id]` and `/admin/outbound-drafts`
  are treated as drafts only. Internal recommendations, shortlist packets, and
  outbound drafts are not approval to contact anyone.
- Producer Agent v0.4 send readiness is dry-run only. A `READY_IN_DRY_RUN`
  result does not send SMS and is not permission to send.
- The first outbound test before design partners is a separate one-number
  founder/operator self-test. See `docs/outbound-sms-self-test-runbook.md` and
  `docs/outbound-self-test-checklist.md`; it requires compliance approval,
  `PILOT_STAGE=internal_test`, `PILOT_REPLY_MODE=manual_approval`, exactly one
  allowlisted number, and explicit operator approval.
- Controlled Live Reply Execution is documented in
  `docs/controlled-live-reply-execution.md`. It may only apply to ordinary
  organizer, gig-seeker, and interest-check replies after all gates pass; it
  must not send shortlists, candidate outreach, group chats, or high-risk
  replies.
- LLM Provider Integration is documented in
  `docs/llm-provider-integration.md`. For pilot planning, `fallback` or
  `shadow` mode should be used until model behavior has been reviewed. Live
  LLM-driven Twilio replies remain disabled by default.
- LLM Quality Review v0.2 is documented in `docs/llm-quality-review.md`.
  Review `/admin/llm-review` items before considering any future live
  LLM-assisted replies. `active_mock` is for admin/mock evaluation only, and
  `active_live` remains disabled.
- The rollback plan is understood before any test window.

## 4. Design Partner Onboarding Language

Send onboarding language outside the SMS system before allowlisting a design
partner:

> Saga SMS is in private staging. We're testing the intake and producer
> workflow. Please don't rely on this for confirmed bookings, payments,
> logistics, or urgent event execution yet. Reply STOP to opt out.

Use plain language and avoid implying that Saga can guarantee a booking, paid
gig, team placement, attendance, ticket sales, venue access, or production
delivery.

For the full operator script, partner mix, manual first-message prompts,
monitoring workflow, success criteria, pause criteria, and move-forward
decision process, use `docs/design-partner-pilot-script-v0.8.md`.

## 4.5 Approved Capability / FAQ Language

Design partners may ask basic questions before they know which lane they are in.
Saga should answer briefly, stay user-facing, and avoid internal system names.

Approved response patterns:

- What Saga does: "Saga helps shape creative project ideas, creator profiles,
  and interest checks into clear next steps for the pilot."
- How it works: "Tell me what you are trying to do. I will ask a few basics,
  shape it for the Saga team to check, and help point you to the right next
  step."
- What users can ask: "You can ask me to shape a creative project, look for
  relevant people for review, start a creator profile for gigs, or test whether
  an idea has interest."
- Bot disclosure: "I am Saga's text assistant for this pilot. I can collect
  details and structure next steps; the Saga team checks anything that needs
  judgment."
- Talent search: "I can help understand the project and look for relevant
  people for the Saga team to check. No one is confirmed until they are reviewed
  and contacted."
- Gigs: "I can help start a creator profile so Saga understands what you do,
  where you are based, and what gigs may fit. I cannot promise bookings or paid
  opportunities."
- Guarantees: "I cannot make firm commitments around bookings, paid
  opportunities, teams, venues, ticket outcomes, or whether an event moves
  forward. I will flag those questions for the Saga team."
- Event planning: "I can help turn an event idea into a clear brief and map
  what kind of support it may need. It is not confirmed execution, but we can
  start with the basics."
- Help: "I can help with project ideas, creator/gig profiles, interest checks,
  and basic questions about the pilot. Reply STOP if you need to opt out."

Do not mention internal systems, model providers, messaging providers, admin
tools, queues, candidate graph internals, or production infrastructure. Do not
promise bookings, paid opportunities, confirmed teams, venue access, candidate
availability, ticket outcomes, or event execution.

## 5. Pilot Operating Rules

- Invite-only.
- Small number of trusted users.
- No public sharing of the staging number.
- No urgent projects or time-sensitive production dependencies.
- Human monitoring during every test window.
- No autonomous external outreach.
- No group chat without explicit consent and admin action.
- Risky topics escalate to `NEEDS_ADMIN`.
- Operators capture feedback after each session.
- Public sharing of the number is prohibited.

## 6. Pilot Success Criteria

The pilot is useful if:

- Users understand what Saga is asking.
- Saga asks the right next question.
- Tone feels like a friendly producer.
- Users trust the flow and understand the staging boundary.
- Admin can understand the transcript, intent, `ReplyPlan`, blocked/sent state,
  and audit trail.
- Saga makes no unsafe promises.
- No unexpected outbound sends occur.
- No non-allowlisted numbers receive messages.
- Feedback is specific enough to guide v0.2 work.

## 7. Transcript Review Procedure

Before inviting real design partners, run the synthetic dry-run suite in
`docs/design-partner-transcript-dry-runs.md` and `/admin/transcript-dry-runs`.
The dry runs must pass without forbidden claims or missed safety escalations.
Passing dry runs do not activate the pilot by themselves; compliance, allowlist,
monitoring, and rollback gates still apply.

For each design-partner session, review:

- Full transcript in `/admin/projects` or the relevant message thread.
- Classified intent in `/admin/audit`.
- Shadow `ReplyPlan` audit event.
- Producer Agent audit events, if the operator generated project understanding,
  role maps, sourcing plans, internal recommendations, shortlist drafts, or
  shortlist approval packets.
- Candidate review and shortlist packet status, if the operator used Producer
  Agent v0.2. Packet approval is internal readiness only; it does not send SMS,
  contact candidates, contact organizers, or create group chats.
- Outbound draft status, if the operator used Producer Agent v0.3. Draft
  approval is internal copy readiness only; it does not send SMS, create
  outreach, contact candidates or organizers, or create group chats.
- Dry-run send readiness status, if the operator used Producer Agent v0.4.
  Readiness checks are useful for spotting blockers, but they do not send SMS,
  create `Message` send records, create `Outreach`, or create group chats.
- Messaging pipeline state in `/admin/pipeline`, especially duplicate
  MessageSid handling, failed jobs, and whether `MESSAGE_PROCESSING_MODE` is
  still `sync` or intentionally set to `async_shadow` for testing.
- Generated reply source, if a mock/admin simulation was used.
- Blocked or sent status for each outbound message.
- Any `NEEDS_ADMIN` transitions.
- Admin notes and feedback notes.

Do not copy raw phone numbers or secrets into reports.

## 8. Feedback Capture

Use `/admin/pilot-feedback` or the project detail feedback panel. The approved
question list is in `docs/design-partner-feedback-questions.md`. Categories:

- `intake_quality`
- `tone`
- `trust`
- `confusion`
- `usefulness`
- `matching`
- `safety`
- `bug`
- `other`

Feedback notes are admin-only and should not contain production Saga app data,
payment details, ticketing details, sensitive legal/medical information, or
secrets.

## 8.5 Data Operations

Before any live design-partner window, review `/admin/data-ops` and:

- Confirm the pilot data inventory, retention policy, backup/restore runbook,
  migration checklist, and incident runbook exist.
- Confirm exports are redacted by default.
- Confirm no raw phone numbers, emails, prompts, secrets, or production Saga app
  data appear in export previews.
- Confirm participant pause, completion, opt-out, and redaction workflows are
  available.
- Record backup/restore/retention checklist events as needed.

Data operations do not enable SMS and do not invite design partners.

## 8.6 Launch Readiness Drill

Before inviting any design partners, run `/admin/launch-drill` and confirm:

- `PRE_A2P_HOLD`, A2P review, one-number self-test, and internal team test
  evidence are recorded as appropriate.
- `docs/design-partner-pilot-script-v0.8.md`,
  `docs/design-partner-feedback-questions.md`, and
  `docs/design-partner-operator-checklist.md` exist and have been reviewed.
- `DESIGN_PARTNER_10` has no safety-critical blockers.
- Rollback and incident drills have been simulated.
- The drill report contains no raw phone numbers, secrets, prompts, raw LLM
  outputs, or production Saga app data.

The launch drill is simulation only. It does not send SMS, invite design
partners, publish the number, or enable public launch.

Also review `/admin/command-center`. Its `10 design partner pilot` panel should
remain `BLOCKED` until A2P, one-number self-test, internal team test, data ops,
observability, transcript dry runs, and feedback capture gates are satisfied.

## 8.7 Beta Cohort Simulation

Before any real design-partner invite, run `/admin/beta-simulations` or:

```bash
npm run test:beta-cohort-simulation
```

The `DESIGN_PARTNER_10` simulation must pass without forbidden claims, missed
escalations, cap bypasses, duplicate-user bypasses, or PII exposure. This is
synthetic evidence only; it does not send SMS, admit users, publish the number,
or override A2P/self-test/internal-test launch gates.

## 8.8 Capped Public Beta Infrastructure

The capped public beta layer is available for future planning only. Review
`/admin/public-beta` to see waitlist, consent, admission, and capacity posture.
For design partners, public beta should remain disabled:

- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_BETA_LANDING_ENABLED=false`
- `PUBLIC_BETA_WAITLIST_ENABLED=false`
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false`
- `PUBLIC_WEB_RESEARCH_ENABLED=false` unless an admin-only shadow or live
  dry-run research review has been explicitly approved. Live dry run still uses
  the safe demo query only and does not contact anyone.

Do not use the public beta waitlist to invite design partners. Design partner
invites stay operator-managed, allowlisted, and blocked until A2P/self-test
evidence is complete.

## 8.9 Talent Research Quality

Before showing any candidate to an organizer, review `/admin/sourcing-quality`.
Candidates should have role-fit evidence, source reliability, identity
confidence, and an organizer-safe summary. Public-web candidates require source
URLs and approved quality review before shortlist promotion. This does not send
outreach, create group chats, publish shortlists, or contact candidates.

Public Web Research Shadow Mode v0.3 may be used only by admins for
citation-required review candidates. It remains disabled by default and is not a
design-partner invite mechanism, outreach mechanism, or public launch mechanism.
Use `/admin/sourcing/public-web-review` for any public-web result cleanup,
duplicate review, source-quality scoring, and contactability evidence review.
Contactability evidence is not contact permission and must not expose raw
contact details to organizers.

## 9. Pilot Rollback

To pause or stop immediately:

1. Set or keep `SMS_SENDS_DISABLED=true`.
2. Set `PILOT_REPLY_MODE=draft_only`.
3. Set `PILOT_STAGE=internal_test`.
4. Remove or disable Twilio webhook URLs.
5. Remove design partner numbers from `SMS_ALLOWED_NUMBERS`.
6. Pause the test window and notify operators.
7. Keep the staging database and audit logs for review.
8. Confirm no production Saga app, ticketing, RSVP, QR, event publishing, or
   payment systems were touched.
