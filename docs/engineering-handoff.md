# Engineering Handoff

## Staging Freeze Tag

The authoritative Saga Producer MVP Staging Baseline v0.1 freeze tag is
`staging-v0.1-final`, pointing at commit
`3477ddc509ba727f866db43db9488eba94526081`.

The earlier `staging-v0.1` tag is superseded and should not be used as the
source of truth for the corrected v0.1 staging freeze.

## What Codex Built

This repo now contains a production-minded MVP for Saga's messaging-based AI producer:

- Legacy SMS intake, Twilio webhook handlers, admin dashboard, outreach, consent, shortlist, group chat, tasks, safety, and audit logging.
- Channel-agnostic production-network models for people, creator profiles, projects, role openings, opportunities, recommendations, teams, and conversations.
- Mock messaging and `/admin/dev` demo lab that works without Twilio.
- Deterministic proximity-first matching with score breakdowns and explanations.
- Internal Saga API contract for future mobile/web app integration.
- Local Postgres Docker setup and docs.

## Safe to Keep Iterating With Codex

- Admin UI polish.
- Demo lab usability.
- Deterministic matching rules.
- Seed/demo data.
- Documentation.
- Tests and small service-level contract changes.
- Non-production provider abstractions.

## Strict Scope Boundary

This repo owns:

- Intake.
- Briefs.
- Creator profiles.
- Role openings.
- Opportunities.
- Candidate recommendations.
- Matching explanations.
- Mock/provider messaging.
- Outreach state.
- Consent state.
- Team assembly.
- Production conversations.
- Tasks.
- Audit logs.

This repo does not own:

- Event publishing.
- Ticketing.
- Ticket sales.
- QR codes.
- RSVP flows.
- Payment processing.
- Production Saga user permissions.
- Production Saga app data.

## Requires Professional Engineer Review

- Production database migrations before running against real Saga user data.
- Any connection to the live Saga mobile or desktop app.
- Auth design for internal APIs beyond the MVP shared-key approach.
- Data retention, privacy, and consent policy.
- Twilio/SMS compliance and provider approval.
- A2P/10DLC or toll-free verification before any real outbound
  design-partner SMS.
- Apple Messages, WhatsApp, or app chat production integrations.
- Any modification to ticketing, RSVPs, QR codes, payments, event sales, or booking flows.

## Production Risks

- Current admin auth is intentionally simple and password/cookie based.
- Internal API auth uses `INTERNAL_API_KEY`; rotate and store it securely.
- Demo reset is development-only and should remain disabled in production.
- `Person.sagaUserId` and `Project.existingSagaEventId` are now unique; migration should be reviewed for duplicate data before production.
- Legacy SMS and canonical network status can drift if bridge services are bypassed.
- Mock messaging does not exercise carrier/provider delivery edge cases.
- Twilio design-partner staging must keep `SMS_SENDS_DISABLED=true` until
  provider/compliance approval and an explicit outbound test window.
- Design Partner Pilot Readiness v0.1 adds
  `docs/design-partner-pilot-runbook.md`,
  `docs/conversation-quality-guide.md`, `/admin/pilot` manual readiness gates,
  and `test:design-partner-pilot-readiness`. This is preparation only; it does
  not activate a pilot, invite users, or approve live SMS.
- Public launch foundations add `PILOT_STAGE`, `PILOT_REPLY_MODE`,
  `PUBLIC_LAUNCH_ENABLED`, `SMS_COMPLIANCE_APPROVED`, support/privacy/terms
  readiness fields, `PilotParticipant`, `/admin/pilot-participants`, and
  `test:design-partner-pilot-preflight`. Defaults remain fail-closed:
  `PILOT_STAGE=internal_test`, `PILOT_REPLY_MODE=draft_only`, and
  `PUBLIC_LAUNCH_ENABLED=false`.
- Twilio staging safety controls include `SMS_REQUIRE_ALLOWLIST`,
  `SMS_ALLOWED_NUMBERS`, `TWILIO_STAGING_MODE`, webhook signature validation,
  no-send/inbound-no-reply/status-callback tests, and `/admin/pilot`
  visibility. They do not authorize public distribution or production app
  integration.
- `PilotFeedback` is an admin-only staging/design-partner feedback table. It is
  not public-facing and should not store production Saga app, ticketing,
  payment, or sensitive personal data.
- `PilotParticipant` is an admin-only standalone pilot/private beta list. It
  stores hashed/redacted phone metadata only and is not connected to production
  Saga users.
- Production Observability v0.1 adds `/admin/observability`,
  `src/lib/observability/*`, `npm run observability:daily-report`,
  `docs/production-observability.md`, and
  `docs/incident-response-runbook.md`. It is read-only, redacted, and does not
  enable SMS sends, async-active workers, active-live LLM replies, public
  launch, or production Saga app integration.
- Public Beta Access Control v0.1 adds `SMS_ACCESS_MODE`,
  `PUBLIC_BETA_ENABLED`, participant caps, `/admin/access`,
  `BetaInviteCode`, extended `PilotParticipant` cohort/status metadata, and
  `src/lib/access/accessControl.ts`. Defaults remain closed:
  `PILOT_STAGE=internal_test`, `SMS_ACCESS_MODE=allowlist_only`,
  `PUBLIC_BETA_ENABLED=false`, and `PUBLIC_LAUNCH_ENABLED=false`.
- Launch Freeze / Release Candidate Packaging v0.1 adds
  `docs/release-candidate-v0.1.md`, `docs/rc-readiness-matrix.md`,
  `docs/post-a2p-execution-playbook.md`, `docs/known-open-items.md`,
  `src/lib/releaseCandidate/releaseCandidate.ts`,
  `npm run test:release-candidate`, and `npm run release:rc-report`. It
  packages the standalone pre-A2P state only. It must not be treated as
  approval for live SMS, public beta, public launch, `active_live`,
  `async_active`, design partner invites, production Saga app integration,
  ticketing, RSVP, QR, payments, or real user data imports.

## Schema and Migration Notes

The newest migration adds bridge fields:

- `ProjectBrief.projectId`
- `Contact.personId`
- `Outreach.opportunityId`
- `Outreach.candidateRecommendationId`
- `GroupChat.productionConversationId`
- `Task.projectId`
- `Task.productionConversationId`
- `CandidateRecommendation.scoreBreakdown`

It also makes `Task.projectBriefId` nullable and adds uniqueness to `Person.sagaUserId` and `Project.existingSagaEventId`.

The schema index-hardening migration is additive and adds review-friendly
indexes for bridge fields, import keys, admin list sorting, matching lookups,
relationship graph lookups, role-opening team membership, and provider
conversation lookup. Notable additions include:

- `Project.existingSagaCommunityId`
- `ProductionConversation.provider/externalConversationId`
- `TeamMember.roleOpeningId`
- `CandidateRecommendation.opportunityId/score/updatedAt`
- `CandidateRecommendation.personId/status/updatedAt`
- relationship edge person/type composites
- `updatedAt` indexes on commonly listed admin models
- `Task.status/dueDate/updatedAt`

The current migrations are additive for a fresh staging database. Production
data review is still required before applying them to existing Saga data,
especially for unique indexes on `Person.sagaUserId`,
`Project.existingSagaEventId`, nullable unique bridge fields, and the
`Task.projectBriefId` nullability change.

The Producer Agent v0.2 migration is additive too. It adds candidate review
statuses/metadata and `ShortlistPacket` for admin-approved draft shortlist
packets. Packet approval is internal readiness only; it does not send SMS,
create outreach, contact organizers or candidates, or create group chats.

The Producer Agent v0.3 migration is additive too. It adds `OutboundDraft` for
admin-reviewed organizer shortlist and candidate outreach copy. Draft approval
is internal copy readiness only; it does not send SMS, create `Outreach`, contact
organizers or candidates, or create group chats.

Do not change uniqueness, nullability, or cascade behavior against production
data without an engineer-reviewed duplicate audit and retention plan. In
particular:

- `Person.phone` and `Person.email` are unique when present and depend on
  normalization before import.
- `Contact.personId`, `ProjectBrief.projectId`, and
  `GroupChat.productionConversationId` enforce one-to-one bridge semantics.
- `Outreach.projectBriefId/contactId` prevents duplicate legacy outreach rows
  for one contact on one brief.
- Existing cascade deletes are acceptable for staging/demo but should be
  revisited before any production data connection.
- `ThresholdType.TICKET_PLEDGE` is a modeling placeholder only; this repo does
  not own ticketing, ticket sales, RSVPs, QR codes, or payments.

The seed script is intended for local and Railway staging demo databases. It
uses upserts, find-or-create records, and seed-tagged message/audit refreshes so
it can be rerun in staging, but it should not be treated as a production data
operation without explicit engineering approval.

Railway Postgres `DATABASE_URL` is currently expected to use Railway's private
network hostname, such as `postgres.railway.internal`. That URL is reachable
from the Railway app service, but not from a local Mac. Do not instruct
operators to use local `railway run` for DB-dependent checks unless a
staging-only public TCP proxy/Postgres URL is explicitly configured. Prefer
`railway ssh` into the app service for `prisma:seed` and
`test:seed-idempotency`.

## Auth and Security Notes

Internal app routes require:

```http
X-Saga-Internal-Key: <INTERNAL_API_KEY>
```

Unauthorized requests return `401` and attempt to log an audit event. Internal responses should not expose private notes, admin notes, private contact notes, raw ticketing details, or payment data.

## Connecting the Existing Saga App Later

Recommended order:

1. Upsert existing app users through `/api/internal/saga/users/upsert`.
2. Import Saga events through `/api/internal/saga/events/import`.
3. Import relationship edges through `/api/internal/saga/relationships/import`.
4. Create role openings through `/api/internal/saga/projects/:projectId/role-openings`.
5. Fetch recommendations through `/api/internal/saga/projects/:projectId/recommendations`.
6. Show safe opportunities through `/api/internal/saga/opportunities`.
7. Record app user interest through `/api/internal/saga/opportunities/:opportunityId/interest`.

Do not let this service modify tickets, RSVPs, QR scans, event sales, or payments.

## Running the Full Demo

```bash
npm install
npm run db:up
cp .env.local.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Then open `/admin/dev`, sign in, click `Create full demo scenario`, and follow the checklist.
The required baseline should show `10/10 required complete`. Optional
diagnostics such as `Fake replies received` may remain pending without failing
the staging baseline.

## Messaging Pipeline Reliability

`MESSAGE_PROCESSING_MODE` defaults to `sync`, so Twilio inbound webhooks still
process immediately. Each persisted inbound can also create an
`InboundProcessingJob` for observability and idempotency. `async_shadow` keeps
the current behavior but leaves replayable dry-run jobs for queue testing.
`async_active` is future-only and should not be enabled for the design-partner
pilot without engineering review.

Use `/admin/pipeline` for queue depth, failed jobs, duplicate MessageSid
observability, redacted errors, and manual retry/skip controls. Use
`npm run jobs:process-inbound-once` from the service environment to process a
small batch manually. The runner does not send SMS while the normal SMS gates
remain closed.

## Pilot Data Operations

`/admin/data-ops` is the operator console for standalone pilot data handling.
It shows participant, project, message, audit, feedback, LLM review, outbound
draft, and pipeline job counts; redacted export previews; participant
pause/complete/opt-out/redaction controls; project message-body redaction; and
recent `data_ops.*` audit events.

Use these docs before real design-partner data is collected:

- `docs/pilot-data-inventory.md`
- `docs/pilot-data-retention.md`
- `docs/pilot-backup-restore-runbook.md`
- `docs/pilot-migration-checklist.md`
- `docs/pilot-data-incident-runbook.md`

Pilot data remains in the standalone Railway Postgres database. Do not connect
it to the main Saga production app, and do not use these workflows for
ticketing, RSVP, QR, payment, event publishing, or production Saga permissions.

## Launch Readiness Drill

`/admin/launch-drill` evaluates the simulated launch sequence:

- `PRE_A2P_HOLD`
- `A2P_APPROVED_REVIEW`
- `ONE_NUMBER_SELF_TEST`
- `INTERNAL_TEAM_TEST`
- `DESIGN_PARTNER_10`
- `PRIVATE_BETA_25`
- `PUBLIC_BETA_CANDIDATE`
- `ROLLBACK_DRILL`
- `INCIDENT_DRILL`
- `COMPLETE`

The drill writes only `launch_drill.*` audit events. It does not send SMS,
invite users, change environment variables, enable public launch, enable
`active_live`, enable `async_active`, or connect production Saga app data.

Useful commands:

```bash
npm run test:launch-readiness-drill
npm run launch:drill-report
```

## Talent Discovery & Research Engine

`/admin/sourcing` is the internal-first sourcing workbench. It uses
`src/lib/sourcing/*`, `TalentSearchRun`, and `TalentCandidate` to search the
standalone database, score candidates with explainable breakdowns, generate a
sourcing strategy, and produce public-research plans.

Public web research is disabled by default:

```bash
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
```

If shadow/admin research is later reviewed, follow
`docs/public-web-research-policy.md`. This layer must not send SMS, create group
chats, send organizer shortlists, send candidate outreach, scrape private or
login-gated sites, or connect to production Saga app data.

Useful command:

```bash
npm run test:talent-discovery
```

## What Remains Mocked

- No real SMS needed for demo mode.
- Mock conversation delivery.
- Existing Saga app data imports.
- Outcome feedback from completed productions.
- App chat and Apple/WhatsApp providers.

## What Not To Automate Yet

- Outreach to real creators.
- Shortlist sending.
- Group chat creation.
- Payment, deposits, contracts, permits, insurance, alcohol/security/safety, or booking decisions.
- Team confirmation without human review.
