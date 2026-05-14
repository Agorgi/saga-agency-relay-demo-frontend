# Regression Testing

This repo uses npm scripts as the source of truth for regression checks. Some
scripts are composed aliases rather than one script file per command.

## Core Local Checks

These run locally without Railway, Twilio, OpenAI, or the real Saga app:

```bash
npm run test:staging-baseline
npm run test:twilio-readiness
npm run test:design-partner-pilot-readiness
npm run test:design-partner-pilot-preflight
npm run test:ai-evals
npm run test:conversation-engine-v0.1
npm run test:design-partner-operator-playbook
npm run test:producer-agent
npm run test:producer-approval-queue
npm run test:producer-outreach-drafts
npm run test:producer-send-readiness
npm run test:talent-discovery
npm run test:talent-research-quality
npm run test:public-web-research-shadow
npm run test:public-web-research-live-dry-run
npm run test:public-web-research-async-dry-run
npm run test:public-web-research-provider-schema
npm run test:public-web-research-review-cleanup
npm run test:candidate-graph-foundation
npm run test:relationship-aware-matching
npm run test:matching-evaluation-tuning
npm run test:outbound-self-test-readiness
npm run test:post-a2p-self-test-plan
npm run test:controlled-live-reply-execution
npm run test:per-phone-autonomy-controls
npm run test:messaging-pipeline
npm run test:production-observability
npm run test:public-beta-access-control
npm run test:pilot-data-ops
npm run test:launch-readiness-drill
npm run test:operator-command-center
npm run test:admin-navigation-ux
npm run test:admin-info-architecture
npm run test:llm-provider
npm run test:llm-evals
npm run test:llm-model-preflight
npm run test:llm-health-config
npm run test:llm-organizer-reply-language
npm run test:llm-shadow-organizer-inbound
npm run test:llm-active-mock-admin-dev
npm run test:llm-quality-review
npm run test:conversation-golden-transcripts
npm run test:conversation-intent-router
npm run test:conversation-organizer-policy
npm run test:conversation-organizer-multiturn
npm run test:conversation-gig-seeker-policy
npm run test:conversation-gig-seeker-multiturn
npm run test:conversation-interest-check-policy
npm run test:conversation-interest-check-multiturn
npm run test:conversation-contact-reply-policy
npm run test:security-hardening
npm run test:workflow-state-machine
npm run test:staging-repeatability
npm run test:mock-app-integration
npm run test:release-candidate
```

`test:mock-app-integration` skips safely unless `APP_BASE_URL` and
`INTERNAL_API_KEY` are set.

The conversation-engine checks are deterministic and do not require Twilio,
OpenAI, Railway, or direct database access.

`test:design-partner-pilot-readiness` verifies pilot readiness docs and safe
status serializers. It does not call Twilio, send SMS, use production data, or
require a database.

`test:design-partner-pilot-preflight` verifies fail-closed pilot/public launch
stage controls, reply mode controls, safe health output, required pilot docs,
and public launch disabled status. It does not send SMS or require production
Saga app data.

`test:conversation-engine-v0.1` is the composed no-DB conversation suite. It
runs the intent router, organizer, gig-seeker, interest-check, contact reply,
and golden transcript checks in a safe order.

`test:design-partner-operator-playbook` verifies the Design Partner Pilot
Script & Operator Playbook v0.8 docs, approved STOP/HELP guidance,
non-promissory copy, pause criteria, launch-drill evidence, command-center
pilot package status, and no-SMS/no-Twilio/no-production-data constraints. It
does not invite anyone, send messages, or require a database.

`test:producer-agent` covers Producer Agent v0.1 project understanding, role
mapping, internal sourcing priorities, candidate scoring, opted-out exclusion,
and shortlist draft safety. It does not require Twilio, OpenAI, a database,
public web calls, SMS, or production Saga data.

`test:producer-approval-queue` covers Producer Agent v0.2 candidate review
statuses, shortlist packet filtering, approval gates, organizer-facing privacy,
forbidden-claim checks, and no SMS/Twilio/group-chat side effects. It does not
require a database, Twilio, OpenAI, SMS, public web calls, or production Saga
data.

`test:producer-outreach-drafts` covers Producer Agent v0.3 organizer shortlist
message drafts, candidate outreach drafts, draft approval gates, privacy checks,
forbidden-claim checks, and no SMS/Twilio/outreach/group-chat side effects. It
does not require a database, Twilio, OpenAI, SMS, public web calls, or
production Saga data.

`test:producer-send-readiness` covers Producer Agent v0.4 dry-run send
readiness gates for approved outbound drafts. It verifies sends-disabled,
allowlist, opt-out, compliance, pilot-stage, forbidden-claim, and recipient
resolution blockers without Twilio, SMS, database access, public web calls, or
production Saga data.

`test:talent-discovery` covers Talent Discovery & Research Engine v0.1 internal
search, city/fandom/review-status ranking, opted-out and do-not-contact
exclusion, internal-first sourcing strategy, citation-required public research
plans, disabled/shadow public web provider behavior, candidate-card validation,
shortlist promotion gates, and no SMS/Twilio/real-web/production-data
constraints.

`test:public-web-research-shadow` covers Public Web Research Shadow Mode v0.3:
disabled mode does not call a provider, shadow mode records/skips without
calling a provider, query plans include role/city/fandom context, citations are required,
private/login-gated sources are blocked, raw contact info is redacted,
unsupported availability claims are flagged, no shortlist/outreach/group-chat
side effects occur, and public-web results remain quality-review gated.

`test:public-web-research-live-dry-run` covers Public Web Research Live Dry Run
v0.4: disabled/default state, live-dry-run gate blockers, mocked provider
execution exactly once when gates pass, citation requirements, review-only
candidate cards, contact-info redaction, private-source blocking, no shortlist,
no outreach, no group chat, no Twilio, no SMS, and no production data.

`test:public-web-research-async-dry-run` covers Public Web Research Async Dry
Run v0.4.1: admin queue fail-closed behavior, no-provider-call queueing,
job-processor no-DB safety, mocked provider behavior, citation requirements,
timeout categorization, job audit event names, redacted health output, no
Twilio, no SMS, no outreach, and no production Saga data.

`test:public-web-research-provider-schema` covers the OpenAI provider request
shape after the `invalid_schema:400` dry-run finding: web search runs without
structured output, extraction runs as a second no-tool structured pass, citations
are required, provider errors are classified and redacted, and no live web call
is made in CI.

`test:public-web-research-review-cleanup` covers Public Web Research Review &
Cleanup v0.5: citation normalization, source-quality scoring, duplicate
detection, cleanup/archive status changes, contactability evidence review,
needs-more-contact-research actions, promotion guards, health privacy, no
Twilio, no SMS, no live web calls, no outreach, no group chats, and no
production Saga data. `test:contactability-evidence` runs the same focused
contactability-safe regression.

`test:candidate-graph-foundation` covers Candidate Graph v0.6a: tag taxonomy,
alias expansion, fandom/role fit, location normalization, relationship
proximity tiers, public-web-only handling, candidate persistence provenance,
source URL requirements, duplicate detection, do-not-contact/opt-out promotion
blocks, redacted search profiles, contactability-as-evidence behavior, no SMS,
no Twilio, no live web calls, and no production Saga data.

`test:relationship-aware-matching` covers Candidate Graph v0.6b:
project-specific candidate retrieval caps, role/fandom/location fit,
relationship proximity boosts, mutual-language guardrails, internal-vs-public
weighting, contactability-aware scoring, promotion guards, no organizer-facing
raw contact info, no availability/booking claims, no SMS, no Twilio, no live web
calls, no outreach, no group chats, and no production Saga data.

`test:matching-evaluation-tuning` covers Matching Evaluation & Tuning v0.7:
12 synthetic project fixtures, 40+ fake candidates, golden expectations,
top-K quality, exclusion accuracy, relationship/proximity explanation QA,
public-web gating, contactability handling, performance caps, tuning
recommendations, redacted report serialization, no SMS, no Twilio, no live web
calls, no outreach, no group chats, and no production Saga data.

`test:outbound-self-test-readiness` covers the dry-run readiness gates for the
first eventual one-number outbound SMS self-test. It verifies compliance,
sends-disabled, allowlist count, pilot stage/reply mode, approved draft,
health-output privacy, audit event naming, and no SMS/Twilio/outreach/group-chat
side effects without requiring real Twilio credentials, direct database access,
or production Saga data.

`test:post-a2p-self-test-plan` covers Post-A2P One-Number Self-Test v0.9:
playbook and checklist presence, compliance and sends-disabled blockers,
one-recipient allowlist rules, public beta/public launch/design-partner
exclusion, duplicate-send checks, Twilio outbound log verification language,
command-center and launch-drill integration, no SMS, no Twilio calls, no
secrets, and no production Saga data.

`test:controlled-live-reply-execution` covers Controlled Live Reply Execution
v0.1 gates for ordinary inbound organizer, gig-seeker, and interest-check
replies. It verifies sends-disabled, compliance, allowlist, opt-out, reply-mode,
flow, idempotency, cap, and forbidden-claim blockers plus a mocked-provider
eligible path without real Twilio credentials, SMS, direct database access,
group chats, outreach sends, or production Saga data.

`test:per-phone-autonomy-controls` covers Per-Phone Conversation Autonomy v0.1:
unknown/manual/paused/on modes, ordinary conversation eligibility, global SMS
gate precedence, candidate-outreach/shortlist/group-chat handoffs, rate/payment
handoffs, Needs Attention visibility, audit redaction, no SMS, no Twilio calls,
no outreach sends, no group chats, and no production Saga data.

`test:messaging-pipeline` covers Messaging Pipeline Reliability v0.1 mode
parsing, secret-safe health output, sender hashing, duplicate-safe no-database
fallbacks, and no-SMS job utilities. It does not require Twilio, real SMS,
OpenAI, direct database access, or production Saga data.

`test:production-observability` covers the redacted observability summary,
risk invariants, daily report formatter, no-secret/no-phone serializers, SMS
safety red blockers, Twilio webhook validation blockers, LLM failure-rate
warnings/blockers, pipeline warnings, and public-launch fail-closed posture. It
does not require Twilio, OpenAI, SMS, direct database access, or production Saga
data.

`test:public-beta-access-control` covers Public Beta Access Control v0.1 access
modes, invite-code validation, cap behavior, participant status blockers,
public-beta/public-live fail-closed gates, STOP/START/HELP precedence, no-SMS
behavior, no Twilio calls, and redacted decision output. It does not require
Twilio, OpenAI, SMS, direct database access, or production Saga data.

`test:pilot-data-ops` covers Pilot Data Operations v0.1 export serializers,
phone/email/secret redaction, participant and transcript export shape,
redaction summary behavior, data-ops audit event names, required runbook docs,
admin serializer privacy, and no-SMS/no-Twilio/no-production-data constraints.
It does not require Twilio, OpenAI, SMS, direct database access, or production
Saga data.

`test:launch-readiness-drill` covers Launch Readiness Drill v0.1 stage modeling,
current pre-A2P/no-send blockers, one-number self-test blockers, design-partner
and public-beta gating, rollback and incident simulations, safe report
serialization, audit event names, and no-SMS/no-Twilio-send/no-production-data
constraints. It does not require Twilio, OpenAI, SMS, direct database access,
or production Saga data.

`test:operator-command-center` covers Operator Console / Launch Command Center
v0.1 summary serialization, pre-A2P stage recommendation, go/no-go blockers,
kill-switch posture, command-center report redaction, health snapshot fields,
unsafe env red status, audit event names, and no-SMS/no-Twilio/no-production
data constraints. It does not require Twilio, OpenAI, SMS, direct database
access, or production Saga data.

`test:admin-navigation-ux` covers Admin UX + Navigation Simplification v0.1:
centralized sidebar route coverage, duplicate-label protection, Command Center
pinned first, exact and nested active-state behavior, Test Lab / Advanced
grouping, page header rendering, redacted nav output, and
no-SMS/no-Twilio/no-production-data constraints.

`test:admin-info-architecture` covers Admin Information Architecture + Needs
Attention v0.2: route inventory coverage, fixed Command Center and Needs
Attention links, manually closable dropdowns, right/down chevron mapping,
short sidebar labels, Advanced grouping, Network Projects consolidation docs,
redacted Needs Attention summaries, pending approval counts, and
no-SMS/no-Twilio/no-production-data constraints.

`test:release-candidate` is the Launch Freeze / Release Candidate Packaging
v0.1 wrapper. It runs the major safe suites in order and finishes with
`test:release-candidate-package`, which verifies the RC docs, redacted report,
safe package metadata, no live SMS, no Twilio send calls, no public beta/public
launch activation, no active_live, no async_active, and no production Saga app
data.

`test:llm-provider` covers LLM Provider Integration v0.1 fallback, shadow,
active mock, active-live fail-closed behavior, invalid-output fallback,
timeout fallback, forbidden-claim fallback, normalized env key parsing, and
secret-safe health output. It does not require OpenAI, Twilio, SMS, database
access, or production Saga data.

`test:llm-evals` validates structured LLM output schemas and safe producer-tone
fixtures for organizer, gig-seeker, interest-check, safety escalation, role-map,
candidate-fit, and draft-language use cases without calling OpenAI.

`test:llm-model-preflight` skips safely without `OPENAI_API_KEY`. When a key is
present, it runs a tiny structured-output check against `OPENAI_MODEL` and fails
clearly on model-not-found or account-access errors without logging secrets,
requiring Twilio, or sending SMS.

`test:llm-health-config` verifies configured/effective LLM health state for
OpenAI shadow mode, missing-key fallback, and active-live fail-closed behavior.

`test:llm-organizer-reply-language` covers the organizer reply language
structured-output schema, mocked successful responses, invalid-output fallback,
safe provider error categorization, and audit metadata privacy.

`test:llm-shadow-organizer-inbound` simulates a shadow-mode organizer inbound
path with successful extraction and organizer reply language model calls while
confirming deterministic fallback output is preserved and SMS sends remain
blocked.

`test:llm-active-mock-admin-dev` verifies the explicit LLM execution-context
gate: admin/dev MOCK can use OpenAI active mock for organizer reply language,
Twilio inbound cannot use active mock live behavior, unavailable flow operations
report deterministic fallback, contact payment questions stay safe, and
`active_live` remains disabled.

`test:llm-quality-review` covers LLM Quality Review v0.2 comparison metadata,
admin serializer redaction, review status updates, reviewer notes safety,
forbidden-claim fallback, too-verbose and wrong-next-question flags, no-DB
behavior, and active-live disabled posture without Twilio or SMS.

`test:conversation-golden-transcripts` covers one representative multi-turn
transcript for each core v0.1 flow: organizer intake, gig-seeker onboarding,
interest check, and contact reply/consent.

`test:conversation-interest-check-policy` covers the shadow-mode
interest-check `ReplyPlan`, organizer ambiguity notes, safety escalation, and
forbidden-promise guards.

`test:conversation-interest-check-multiturn` covers mock-active interest-check
replies, Twilio fail-closed mode, pure draft `InterestCheck` preparation, and
blocked Project/ticketing/RSVP behavior.

`test:conversation-contact-reply-policy` covers contact reply classification,
explicit group-intro consent, STOP/START/HELP precedence, no-active-outreach
ambiguity, and safety escalation without Twilio, OpenAI, or direct DB access.

`test:conversation-contact-reply-demo-flow` is DB-backed and therefore listed
below with the direct database checks. It exercises the `/admin/dev` mock
outreach activation path and contact reply simulator against real staging/demo
records.

`test:design-partner-transcript-dry-runs` executes ten synthetic design-partner
conversation transcripts through the real intent router, Conversation Engine
policies, dry-run LLM active_mock path, and Producer Agent dry-run planning. It
uses a mocked LLM provider by default and requires no Twilio, SMS, database, or
production data.

`test:capped-public-beta-infrastructure` verifies disabled-by-default public
beta flags, waitlist/consent serializers, admission gates, readiness blockers,
admin-safe redaction, and no-SMS/no-Twilio boundaries. It does not require
OpenAI, Twilio, a database, or production Saga app data.

## Composed Baseline Command

`test:staging-baseline` is a composed npm command. There is intentionally no
`scripts/test-staging-baseline.ts` file.

Current composition:

```text
npm run test:security &&
npm run test:workflow &&
npm run test:agent &&
npm run test:matching &&
npm run test:demo-flow
```

Aliases:

- `test:security-hardening` -> `test:security`
- `test:workflow-state-machine` -> `test:workflow`

## DB-Dependent Checks

These require direct database access:

```bash
npm run prisma:seed
npm run test:seed-idempotency
npm run test:conversation-contact-reply-demo-flow
npm run jobs:process-inbound-once
```

If Railway Postgres uses `postgres.railway.internal`, run these inside the
Railway service container:

```bash
railway ssh
npm run prisma:seed
npm run test:seed-idempotency
npm run test:conversation-contact-reply-demo-flow
npm run jobs:process-inbound-once
```

Do not use local `railway run` for DB-dependent checks with a private Railway
database URL unless a staging-only public TCP proxy is explicitly configured.

## Remote API Checks

These are black-box HTTP checks and do not need direct DB access:

```bash
APP_BASE_URL=https://your-staging-url \
INTERNAL_API_KEY=<paste manually> \
npm run test:internal-api

APP_BASE_URL=https://your-staging-url \
INTERNAL_API_KEY=<paste manually> \
npm run test:mock-app-integration
```

Do not paste or log `INTERNAL_API_KEY` in reports.

## Scope Boundaries

Regression tests must not use production Saga app data, connect the real Saga
app, configure Twilio, send SMS, or touch event publishing, ticketing, ticket
sales, QR codes, RSVP flows, payment processing, production Saga permissions,
or production Saga app data.

## Beta Cohort Simulation

Run the cohort simulator after transcript, access-control, command-center, and
launch-drill changes:

```bash
npm run test:beta-cohort-simulation
```

The test runs synthetic 10-person, 25-person, 100-person, and over-capacity
cohorts. It asserts structured results, cap/waitlist/duplicate/opt-out handling,
STOP/START/HELP behavior, launch-blocked public beta state, command-center and
launch-drill integration, no raw phone numbers/secrets, no Twilio requirement,
and no SMS sends.

## Talent Research Quality

Run the talent quality checks after sourcing, Producer Agent shortlist, or
public-web research changes:

```bash
npm run test:talent-research-quality
npm run test:public-web-research-shadow
npm run test:public-web-research-live-dry-run
npm run test:public-web-research-async-dry-run
npm run test:public-web-research-review-cleanup
```

The test uses synthetic internal and public candidate fixtures. It checks score
bands, source reliability, evidence checklist flags, unsupported availability
and payment claims, LLM review schema validation/fallback, shortlist promotion
gates, no raw PII, no Twilio, no SMS, no live web call, and no production Saga
app data.
