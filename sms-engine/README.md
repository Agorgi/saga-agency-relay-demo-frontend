# Saga SMS Producer MVP

Saga is an AI producer for creative projects and live events. This app supports the live rehearsal loop:

`text -> brief -> admin review -> outreach -> consent -> shortlist -> group chat`

The backend owns workflow state. The LLM only assists with extraction, writing, role suggestions, summaries, and task suggestions. External-facing actions stay human-approved.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Prisma and PostgreSQL
- Twilio Programmable Messaging and Twilio Conversations
- OpenAI API-compatible LLM abstraction with deterministic fallback mode
- Zod validation for environment and LLM JSON responses
- Password-protected admin dashboard with a simple cookie session
- Railway as the primary deployment target

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Required:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/saga_sms_producer"
ADMIN_PASSWORD=
APP_BASE_URL="http://localhost:3000"
MESSAGING_PROVIDER=MOCK
```

For internal API rehearsal scripts, also set `INTERNAL_API_KEY`.

Optional:

```bash
INTERNAL_API_KEY=
LLM_PROVIDER=fallback
LLM_MODE=fallback
LLM_TIMEOUT_MS=8000
LLM_DAILY_CALL_CAP=
LLM_LOG_PROMPTS=false
LLM_LOG_OUTPUTS=false
MESSAGE_PROCESSING_MODE=sync
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_MAX_RESULTS=5
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=true
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES=1
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG=live_dry_run
RUN_LIVE_WEB_RESEARCH_TESTS=false
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS=
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS=
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_CONVERSATIONS_SERVICE_SID=
TWILIO_VALIDATE_WEBHOOKS=
```

Twilio env vars are optional for no-SMS staging/demo mode. Set either
`TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` for one-to-one SMS only
when live SMS testing is explicitly in scope. For Twilio Conversations group
SMS, set `TWILIO_PHONE_NUMBER` because it is used as the SMS proxy address.

If `OPENAI_API_KEY` is missing, Saga still runs with deterministic extraction,
reply, role, outreach, shortlist, kickoff, and task fallbacks. `LLM_MODE=shadow`
can audit configured OpenAI output without using it, `active_mock` is limited to
the explicit `/admin/dev` MOCK execution surface, and `active_live` remains
disabled by default. In active mock, organizer admin/dev reply language can use
OpenAI when the structured schema validates; gig-seeker, interest-check, and
contact reply simulations report deterministic fallback until dedicated LLM
operations exist.
`/api/health` reports configured and effective LLM provider/mode separately, so
operators can distinguish "OpenAI requested but safely falling back" from
"OpenAI shadow mode is active." The resolver uses exact runtime env lookups
first and then normalized env-key matching for `LLM_PROVIDER` and `LLM_MODE`.
Run `npm run test:llm-model-preflight` before staging OpenAI tests to catch
model-name or access mistakes without Twilio or SMS.
`TWILIO_VALIDATE_WEBHOOKS=false` only disables Twilio signature validation in
non-production local development.

## Local Setup

Install dependencies:

```bash
npm install
npx prisma generate
```

Create local Postgres with Docker:

```bash
npm run db:up
cp .env.local.example .env
```

Or create Postgres yourself and set `DATABASE_URL` manually:

```bash
createdb saga_sms_producer
```

Run migrations and seed data:

```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```

Start development:

```bash
npm run dev
```

Open `http://localhost:3000/admin` and sign in with `ADMIN_PASSWORD`.

Stop the local Docker database:

```bash
npm run db:down
```

## Health Check

Use this before connecting Twilio:

```bash
curl http://localhost:3000/api/health
```

The response reports database connectivity, Twilio config presence, LLM mode, and deployment environment without exposing secrets.

## Admin Routes

The authenticated admin now uses a grouped operator sidebar instead of a flat
developer list. Start at `/admin/command-center`; it shows status, blockers,
warnings, and the next safe action. Then check `/admin/needs-attention` for
approvals, blocked drafts, failed jobs, and warnings. See
`docs/admin-info-architecture-v0.2.md` and
`docs/admin-route-inventory-v0.2.md` for the current route inventory.

- Command Center: `/admin/command-center`
- Needs Attention: `/admin/needs-attention`
- Projects: `/admin/projects`, `/admin/network-projects`,
  `/admin/role-openings`, `/admin/opportunities`, `/admin/tasks`,
  `/admin/interest-checks`
- Talent: `/admin/people`, `/admin/creator-profiles`, `/admin/contacts`,
  `/admin/relationships`
- Sourcing: `/admin/sourcing`, `/admin/matching`, `/admin/sourcing-quality`,
  `/admin/sourcing/public-web`, `/admin/sourcing/public-web-review`
- Messages: `/admin/needs-attention?type=pending_reply`,
  `/admin/outbound-drafts`, `/admin/groupchats`
- Quality & Safety: `/admin/llm-review`, `/admin/transcript-dry-runs`,
  `/admin/audit`
- Operations: `/admin/observability`, `/admin/pipeline`, `/admin/data-ops`,
  `/admin/launch-drill`, `/admin/public-beta`, `/admin/access`,
  `/admin/pilot`, `/admin/pilot-participants`, `/admin/pilot-feedback`,
  `/admin/beta-simulations`
- Advanced: `/admin/dev`, `/admin/candidate-graph`, `/admin/recommendations`,
  `/admin/matching-evaluation`, `/admin/outreach`

The sidebar uses plain labels such as Talent Search, Smart Matching, Research
Cleanup, System Health, Data Tools, and AI Reply Review. Routes remain
unchanged. The UX has no live SMS, public launch, candidate outreach,
group-chat creation, or production Saga app controls.

Per-phone conversation autonomy controls are available on Contacts and Pilot
Participants. ON means ordinary conversation only; Saga still hands off before
candidate outreach, shortlist sending, group-chat creation, rate/payment/legal
issues, safety issues, or any external action. See
`docs/per-phone-conversation-autonomy-v0.1.md`. The v0.1 controls passed
staging verification after `71a3588`; this is still not a send-safety override.

## Channel-Agnostic Production Network

The original SMS tables remain in place for compatibility: `User`, `ProjectBrief`, `Contact`, `Outreach`, `GroupChat`, and `Task`.

The production-network core adds:

- `Person` - a channel-agnostic person record that can represent an SMS lead, Saga mobile/web user, imported contact, creator, or public contact.
- `CreatorProfile` - roles, skills, fandoms, communities, portfolio/social links, opportunity preferences, and human review status.
- `Project` - future-facing production projects from SMS, mobile app, web app, imports, admin, or interest checks.
- `RoleOpening` and `Opportunity` - structured team needs and artist opportunities.
- `InterestCheck` - demand tests that can convert into projects.
- `CandidateRecommendation` and `RelationshipEdge` - deterministic proximity-first matching.
- `OutboundDraft` - admin-reviewed organizer shortlist and candidate outreach
  copy that remains unsent in the current phase.
- `InboundProcessingJob` - durable inbound webhook processing records for
  sync, async-shadow, and future async-active messaging reliability.
- `PilotParticipant` and `BetaInviteCode` - admin-only beta access records for
  cohorts, hashed invite codes, participant caps, and waitlist/paused/opt-out
  state. They are not connected to production Saga users.
- Pilot Data Operations - admin-only redacted exports, transcript previews,
  participant pause/complete/opt-out/redaction workflows, retention runbooks,
  and backup/restore checklists for the standalone pilot database.
- Launch Readiness Drill - simulation-only operational rehearsal that reports
  stage blockers from pre-A2P hold through one-number self-test, internal team
  test, design partner pilot, rollback, incident drill, and public-beta
  candidate readiness. It never sends SMS or invites users.
- Post-A2P One-Number Self-Test v0.9 - exact operating plan, checklist, and
  readiness evaluation for the first future real outbound SMS test after A2P
  approval. It keeps `SMS_SENDS_DISABLED=true` by default and does not execute
  the test, send SMS, invite design partners, or enable public access.
- Operator Command Center - admin-only launch/pilot overview that aggregates
  SMS safety, LLM health, pipeline health, access controls, data ops, launch
  drill, go/no-go status, runbooks, and kill-switch posture. It has no env
  editing, send, invite, public-launch, group-chat, shortlist, or candidate
  outreach controls.
- Design Partner Pilot Script v0.8 - operator-facing pilot package with the
  10-person partner mix, approved manual invite/opt-in language, first-message
  scripts, monitoring workflow, success criteria, pause criteria, feedback
  questions, and operator checklist. It does not invite anyone or send SMS.
- Release Candidate v0.1 - launch-freeze packaging for the standalone app with
  docs, readiness matrix, post-A2P playbook, known open items, redacted RC
  report, and a safe regression wrapper. It is not launch approval and does not
  enable SMS, public beta, public launch, active_live, async_active, or
  production Saga app integration.
- `TalentSearchRun` and `TalentCandidate` - internal-first talent discovery
  records for reviewable sourcing runs, candidate cards, score breakdowns,
  evidence, risks, missing info, and admin review state. Public-web research is
  disabled by default, citation-required when enabled later, and never sends
  outreach.
- Candidate Graph v0.6a - generic evidence edges, tag/location normalization,
  review-gated candidate persistence, rebuildable candidate search profiles,
  and proximity tiers that reserve direct/mutual claims for internal
  relationship evidence. Public-web candidates remain review-only and
  contactability remains evidence, not permission.
- `Team`, `TeamMember`, and `ProductionConversation` - mock or provider-backed production teams and conversations.

The bridge between old and new models is intentionally conservative: old SMS workflows still work, while new network records can be created from demo lab/import flows and matched against creator profiles.

## Product Boundary

This repo is currently a standalone SMS producer app. The main Saga mobile/web
app integration is a later, engineer-reviewed milestone after standalone pilot
and market testing.

This repo owns:

- Intake
- Briefs
- Creator profiles
- Role openings
- Opportunities
- Candidate recommendations
- Matching explanations
- Provider/mock messaging
- Outreach state
- Consent state
- Production conversations
- Tasks
- Audit logs

This repo does not own:

- Event publishing
- Ticketing
- Ticket sales
- QR codes
- RSVP flows
- Payment processing
- Production Saga user permissions
- Production Saga app data

## Engineer Review Starting Point

For a source-of-truth audit of what exists in the repo now, start here:

- `docs/feature-status-summary.md` - compact status table for every major feature area.
- `docs/feature-inventory.md` - fuller feature map with routes, models, tests, docs, gates, caveats, and priority.
- `docs/admin-route-truth-map.md` - every admin route, simplified label, risk, and consolidation note.
- `docs/data-model-truth-map.md` - every Prisma model, purpose, sensitivity, and consolidation risk.
- `docs/service-file-truth-map.md` - key service folders/files and the behavior they own.
- `docs/test-coverage-map.md` - every package script, dependencies, and safety posture.
- `docs/docs-truth-map.md` - every docs file and whether it is current, historical, or a merge candidate.
- `docs/deployment-runtime-truth-map.md` - Railway/build/runtime expectations without secret values.
- `docs/redundancy-and-consolidation-map.md` - pages, models, docs, and tests likely to merge later.
- `docs/safety-critical-paths-audit.md` - send/contact/public-launch/data-export risk paths.
- `docs/engineering-review-priority-list.md` - review order before self-test, design partners, and beta.

These audit docs are documentation only. They do not change routes, enable SMS,
enable public beta, enable public launch, or connect the production Saga app.

Detailed architecture docs:

- `docs/ai-evals.md`
- `docs/architecture.md`
- `docs/abuse-and-rate-limit-readiness.md`
- `docs/ci.md`
- `docs/conversation-engine-v0.1.md`
- `docs/controlled-live-reply-execution.md`
- `docs/conversation-quality-guide.md`
- `docs/data-model.md`
- `docs/design-partner-pilot-runbook.md`
- `docs/design-partner-launch-checklist.md`
- `docs/design-partner-sms-pilot.md`
- `docs/launch-readiness-drill.md`
- `docs/operator-command-center.md`
- `docs/release-candidate-v0.1.md`
- `docs/rc-readiness-matrix.md`
- `docs/post-a2p-execution-playbook.md`
- `docs/known-open-items.md`
- `docs/talent-discovery-engine-v0.1.md`
- `docs/candidate-graph-v0.6a.md`
- `docs/candidate-graph-indexing-strategy.md`
- `docs/public-web-research-policy.md`
- `docs/llm-provider-integration.md`
- `docs/internal-api.md`
- `docs/demo-mode.md`
- `docs/engineering-handoff.md`
- `docs/mock-app-integration.md`
- `docs/workflow-state-machine.md`
- `docs/observability.md`
- `docs/production-observability.md`
- `docs/incident-response-runbook.md`
- `docs/outbound-self-test-checklist.md`
- `docs/outbound-sms-self-test-runbook.md`
- `docs/post-a2p-one-number-self-test-v0.9.md`
- `docs/post-a2p-self-test-checklist.md`
- `docs/per-phone-conversation-autonomy-v0.1.md`
- `docs/pilot-data-inventory.md`
- `docs/pilot-data-retention.md`
- `docs/pilot-backup-restore-runbook.md`
- `docs/pilot-migration-checklist.md`
- `docs/pilot-data-incident-runbook.md`
- `docs/pilot-infrastructure-readiness.md`
- `docs/pilot-rollback-runbook.md`
- `docs/producer-agent-v0.1.md`
- `docs/producer-agent-v0.2.md`
- `docs/producer-agent-v0.3.md`
- `docs/producer-agent-v0.4.md`
- `docs/public-beta-access-control.md`
- `docs/public-beta-launch-checklist.md`
- `docs/public-launch-foundations.md`
- `docs/regression-testing.md`
- `docs/security-review.md`
- `docs/staging-baseline.md`
- `docs/staging-deploy-checklist.md`
- `docs/staging-repeatability.md`
- `docs/twilio-readiness.md`
- `docs/twilio-staging-pilot.md`
- `docs/v0.2-engineering-review.md`

## Demo Mode Without Twilio

`/admin/dev` now supports the no-SMS demo path:

1. Simulate organizer idea intake and create/update the existing `ProjectBrief`.
2. Simulate creator/gig-seeker onboarding from texts like `I want paid cosplay gigs in LA`.
3. Import a mock existing Saga event into the network `Project` model.
4. Create an interest check, increment interest, and convert it to a project.
5. Generate role openings and opportunities.
6. Run deterministic candidate recommendations.
7. Approve mock outreach; optional diagnostics can simulate YES/NO/MAYBE replies.
8. Ask for consent before team chat.
9. Create a mock production conversation and kickoff audit entry.

Demo mode uses `MockMessagingProvider`, stores outbound mock messages, and never sends real SMS. The existing `TwilioMessagingProvider` remains available for later live SMS.

The top of `/admin/dev` also includes development-only reset, one-click full
demo scenario creation, a required QA checklist, optional diagnostics, and a
copyable demo summary. The staging baseline is healthy when required checks are
complete; optional fake-reply diagnostics may remain pending.

## Internal Saga API Contract

The existing Saga app is not connected yet, but this MVP exposes a reviewed contract shape under `/api/internal/saga/*`.

All internal routes require:

```http
X-Saga-Internal-Key: <INTERNAL_API_KEY>
```

Routes:

- `POST /api/internal/saga/users/upsert`
- `POST /api/internal/saga/events/import`
- `POST /api/internal/saga/projects/:projectId/role-openings`
- `GET /api/internal/saga/projects/:projectId/recommendations`
- `GET /api/internal/saga/opportunities`
- `POST /api/internal/saga/opportunities/:opportunityId/interest`
- `POST /api/internal/saga/relationships/import`
- `POST /api/internal/saga/interest-checks`
- `POST /api/internal/saga/interest-checks/:id/interest`
- `POST /api/internal/saga/interest-checks/:id/convert`

Sample payloads live in `docs/examples/internal-api/`. The contract does not modify ticketing, RSVPs, QR codes, event sales, or payments.

## Creator Onboarding

The demo creator onboarding flow recognizes texts such as:

- `I want to join the network`
- `I'm looking for paid cosplay gigs`
- `I'm a photographer in LA`
- `I want maid cafe gigs`
- `How do I get booked for events?`

Saga collects city, desired roles/gigs, portfolio/social links, fandoms/communities, and paid/collab preferences. The resulting `CreatorProfile` is marked `PENDING_REVIEW` so a human can approve it before recommendations are trusted for outreach.

## Network Matching

Production-network matching is deterministic:

- `+10` direct friend of organizer
- `+7` mutual connection
- `+5` same community
- `+4` attended related event
- `+4` collaborated before
- `+5` same city
- `+3` location compatibility
- `+5` exact role match
- `+2` related skill match
- `+3` fandom match
- `+1` portfolio/social exists
- `+1` approved profile
- `-5` opted out
- `-5` rejected or unreviewed when approval is required

The LLM may explain matches later, but it does not own ranking.

## Talent Discovery

Talent Discovery v0.1 searches the standalone Saga database before suggesting
any public research. It creates a sourcing strategy, a public-research plan, and
reviewable `TalentCandidate` cards with explainable scores. It excludes
opted-out and do-not-contact people, keeps private notes out of organizer-facing
fields, and routes candidates through admin review before they can be promoted
into shortlist workflows.

Talent Research Quality Review v0.2 adds `/admin/sourcing-quality`, a
deterministic evidence rubric, source reliability taxonomy, organizer-safe
summary checks, and shortlist/outreach gates. Public-web candidates require
source URLs and approved quality review before promotion. The feature does not
send SMS, contact candidates, scrape private sources, create group chats, or
connect to production Saga app data.

Public Web Research Shadow Mode v0.3 adds `/admin/sourcing/public-web`,
DB-backed `PublicWebResearchRun` and `PublicWebResearchResult` records, an
OpenAI Responses API `web_search` wrapper, a citation-required candidate card
schema, and a safety checker. It is disabled by default. Shadow mode is now
plan/audit only; the gated v0.4 live dry run is the only path that may call web
search, and its results are research-only, require human review, and cannot
create outreach, group chats, or organizer-facing shortlist entries.

Public Web Research Live Dry Run v0.4 adds a separate one-query operator test
path for the safe demo query “Los Angeles anime cosplay event photographer
portfolio.” It is disabled by default, requires
`PUBLIC_WEB_RESEARCH_MODE=live_dry_run`,
`PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=true`,
`RUN_LIVE_WEB_RESEARCH_TESTS=true`, `SMS_SENDS_DISABLED=true`, OpenAI provider
configuration, and admin action. Results remain `LIVE_DRY_RUN` /
review-only candidates.

Public Web Research Async Dry Run v0.4.1 keeps that live dry-run capability out
of the Railway HTTP request path. The admin action now queues a
`PublicWebResearchJob` and returns immediately; the OpenAI web-search call runs
only from `npm run jobs:process-public-web-research-once` or a future worker.
Jobs persist redacted status/error summaries, and results still remain
`SHADOW_RESULT` / `NEEDS_REVIEW` with no outreach, SMS, group chat, or automatic
shortlist promotion.

The first async live dry run reached OpenAI and failed with
`invalid_schema:400` because the original provider combined `web_search` and a
complex candidate-card structured output schema in one Responses call. The
provider now uses a safer two-step flow: first a plain `web_search` call returns
a cited research summary and source list, then a second no-tool structured
extraction pass creates candidate cards from those citations. Provider errors
store redacted diagnostics only.

Public Web Research Review & Cleanup v0.5 adds `/admin/sourcing/public-web-review`,
citation/source normalization, duplicate detection against internal records,
source-quality scoring, contactability evidence review, cleanup/archive actions,
needs-more-contact-research handling, and a promotion guard. Public-web results
can be discarded, archived, marked duplicate, marked do-not-contact, marked as
needing more contact research, or sent to Talent Research Quality Review, but
they still cannot create outreach, group chats, organizer-facing shortlists,
SMS, email, DMs, or automatic approvals.

Public web research remains disabled by default:

```bash
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
```

When live dry-run/admin modes are reviewed later, candidate cards must cite
public source URLs, avoid private or login-gated sources, and never imply
availability, rates, booking, paid work, team placement, or consent to be
contacted.

Run:

```bash
npm run test:talent-discovery
npm run test:talent-research-quality
npm run test:public-web-research-shadow
npm run test:public-web-research-live-dry-run
npm run test:public-web-research-async-dry-run
npm run test:public-web-research-provider-schema
npm run test:public-web-research-review-cleanup
```

## Twilio Local Testing

Expose the dev server:

```bash
ngrok http 3000
```

Set `APP_BASE_URL` to the ngrok HTTPS URL, restart Next.js, then configure Twilio:

- Messaging inbound webhook: `POST [APP_BASE_URL]/api/twilio/inbound`
- Messaging status callback: `POST [APP_BASE_URL]/api/twilio/status`
- Conversations webhook: `POST [APP_BASE_URL]/api/twilio/conversations-webhook`

For real Twilio testing, keep signature validation enabled and make sure `APP_BASE_URL` exactly matches the public URL Twilio calls.

## Railway Production Setup

Railway is the default deployment path for this MVP. The app uses `output: "standalone"` and starts with `node .next/standalone/server.js`, which lets Railway provide `PORT` at runtime.

Launch checklist:

1. Create a Railway project.
2. Add a Railway Postgres database.
3. Connect the GitHub repo as the app service.
4. Confirm the app service build command is `npm run build`.
5. Confirm the app service start command is `npm run start`.
6. Add a reference variable from Postgres so the app service has `DATABASE_URL`.
7. For staging demo mode, add `ADMIN_PASSWORD`, `APP_BASE_URL`, `INTERNAL_API_KEY`, and `MESSAGING_PROVIDER=MOCK`. Twilio variables can stay blank until live SMS testing.
8. Set `APP_BASE_URL` to the Railway public URL.
9. Set the Railway pre-deploy command to `npm run prisma:deploy`.
10. Deploy and open `[APP_BASE_URL]/api/health`.
11. For no-SMS staging, run `npm run prisma:seed` manually and test `/admin/dev`.
12. Configure Twilio webhooks only when live SMS approval/testing is ready.

Pilot migration discipline: verify `DATABASE_URL` points to the standalone
Railway Postgres database, review Prisma migration SQL, confirm a backup exists,
run `npm run prisma:deploy` through Railway predeploy, and verify
`/api/health` plus `/admin/data-ops` after deploy. See
`docs/pilot-migration-checklist.md`.

Useful Railway notes:

- Railway's Next.js guide recommends standalone output and serving the standalone server for self-hosted deployment.
- Railway Postgres exposes `DATABASE_URL` for app services.
- Railway supports pre-deploy commands such as `npx prisma migrate deploy` before the new version serves traffic.
- See `docs/staging-deploy-checklist.md` for the staging-specific no-Twilio launch path.

## Workflow

Automated:

- Normalize phone numbers.
- Find or create users, contacts, active project briefs, messages, and outreach records.
- Persist inbound and outbound messages before provider send.
- Ask the first-time host question only once per organizer phone number.
- Collect intake one question at a time.
- Move briefs to `BRIEF_READY_FOR_REVIEW` once enough intake exists.
- Validate Twilio signatures by default.
- Deduplicate Twilio retries by message SID where available.
- Rate-limit inbound SMS per sender.
- Handle STOP/START opt-out state locally.
- Classify contact YES/NO/MAYBE replies.
- Ask interested contacts for group SMS consent before group chat.
- Escalate risky or unclear cases to `NEEDS_ADMIN`.
- Store audit logs for approvals, sends, failures, fallbacks, escalations, group chat creation, and status changes.

Manual in the MVP:

- Admin reviews and edits project briefs.
- Admin generates role maps and selects matched contacts.
- Admin drafts, edits, approves, and sends outreach.
- Admin sends organizer shortlists.
- Admin creates group chats after consent.
- Admin writes manual replies for escalations.
- Admin creates tasks and triggers reminders manually.

## Safety

Saga escalates to `NEEDS_ADMIN` for contracts, deposits, payments, payment disputes, insurance, permits, alcohol, security, medical or safety issues, minors, weapons, explicit sexual content, harassment, discrimination, illegal activity, spam or abuse, contact disputes, and requests to guarantee booking, attendance, revenue, venue access, celebrity participation, or influencer participation.

Saga does not scrape the internet, promise rates, book vendors, guarantee venues, confirm team members, or send external-facing messages without admin approval.

## Contact Import

Paste CSV at `/admin/contacts` with:

```text
name,phone,email,city,roles,tags,portfolioUrl,instagramUrl,notes
```

Roles and tags can be separated by commas, pipes, or semicolons. Import validates rows first, normalizes phone numbers, and upserts by phone to avoid duplicate contacts.

## Contact Matching

The MVP uses deterministic matching only:

- `+3` if city matches
- `+2` for each matching role
- `+1` for each matching tag
- `+1` if portfolio or Instagram exists

Admins choose who receives outreach.

## Verification

Core local checks:

```bash
npx prisma generate
npm run lint
npm run typecheck
npm run build
npm run test:staging-baseline
npm run test:twilio-readiness
npm run test:twilio-pilot-preflight
npm run test:twilio-status-callbacks
npm run test:twilio-inbound-no-reply
npm run test:design-partner-pilot-readiness
npm run test:design-partner-pilot-preflight
npm run test:ai-evals
npm run test:conversation-engine-v0.1
npm run test:producer-agent
npm run test:producer-approval-queue
npm run test:producer-outreach-drafts
npm run test:producer-send-readiness
npm run test:talent-discovery
npm run test:outbound-self-test-readiness
npm run test:post-a2p-self-test-plan
npm run test:controlled-live-reply-execution
npm run test:messaging-pipeline
npm run test:llm-provider
npm run test:llm-evals
npm run test:llm-model-preflight
npm run test:llm-health-config
npm run test:llm-organizer-reply-language
npm run test:llm-shadow-organizer-inbound
npm run test:conversation-golden-transcripts
npm run test:conversation-intent-router
npm run test:conversation-organizer-policy
npm run test:conversation-organizer-multiturn
npm run test:conversation-gig-seeker-policy
npm run test:conversation-gig-seeker-multiturn
npm run test:conversation-interest-check-policy
npm run test:conversation-interest-check-multiturn
npm run test:conversation-contact-reply-policy
npm run test:conversation-contact-reply-demo-flow
npm run test:security-hardening
npm run test:workflow-state-machine
npm run test:staging-repeatability
npm run test:mock-app-integration
```

`test:staging-baseline` is an npm alias/composed command, not a standalone
`scripts/test-staging-baseline.ts` file. It runs `test:security`,
`test:workflow`, `test:agent`, `test:matching`, and `test:demo-flow`.

Useful individual aliases:

- `test:security-hardening` runs the same checks as `test:security`.
- `test:workflow-state-machine` runs the same checks as `test:workflow`.
- `test:twilio-readiness` uses fake fixtures only and does not configure Twilio
  or send SMS.
- `test:twilio-pilot-preflight` validates provider mode, Twilio staging safety
  env shape, health fields, and secret/allowlist non-exposure. In local mock
  mode it passes without Twilio.
- `test:twilio-status-callbacks` uses fake signed Twilio callbacks and skips
  DB-backed callback update checks when `DATABASE_URL` is missing.
- `test:twilio-inbound-no-reply` verifies inbound TwiML cannot bypass
  `SMS_SENDS_DISABLED`; DB-backed inbound checks run only when `DATABASE_URL` is
  available.
- `test:design-partner-pilot-readiness` verifies pilot readiness health/status
  serializers, feedback summaries, and required pilot docs without Twilio API
  calls, live SMS, production data, or a database.
- `test:design-partner-pilot-preflight` verifies stage/reply mode guardrails,
  public launch disabled state, safe health output, required pilot/public docs,
  and no active production Saga app/ticketing/RSVP/QR/payment behavior.
- `test:ai-evals` runs deterministic fallback AI reliability evals without
  requiring `OPENAI_API_KEY`.
- `test:conversation-engine-v0.1` runs the full no-DB conversation engine
  suite in a safe order without Twilio, OpenAI, real SMS, or production data.
- `test:producer-agent` checks Producer Agent v0.1 project understanding, role
  mapping, internal sourcing, candidate recommendations, and shortlist drafts
  without SMS, Twilio, OpenAI, public web calls, or production Saga data.
- `test:producer-approval-queue` checks Producer Agent v0.2 candidate review
  statuses, shortlist packet filtering, approval gates, organizer-facing
  privacy, forbidden-claim checks, and no SMS/Twilio/group-chat side effects.
- `test:producer-outreach-drafts` checks Producer Agent v0.3 organizer
  shortlist message drafts, candidate outreach drafts, approval gates,
  privacy, forbidden-claim checks, and no SMS/Twilio/outreach/group-chat side
  effects.
- `test:producer-send-readiness` checks Producer Agent v0.4 dry-run send
  readiness gates for approved drafts without Twilio calls, SMS, outreach send
  state, group-chat creation, or production Saga data.
- `test:talent-discovery` checks Talent Discovery v0.1 internal search,
  candidate scoring, public research planning, disabled/shadow public web
  provider behavior, source-citation validation, shortlist promotion gates, and
  no SMS/Twilio/real web/production-data behavior.
- `test:public-web-research-live-dry-run` checks the gated one-query public-web
  dry run with a mocked OpenAI provider, citation requirements, no outreach, no
  group chat, no shortlist promotion, no Twilio, and no SMS.
- `test:public-web-research-async-dry-run` checks the async dry-run queue/job
  path, timeout categorization, safe health rollup, no synchronous provider call
  from queueing, no Twilio, no SMS, and no production Saga data.
- `test:outbound-self-test-readiness` checks the future one-number outbound SMS
  self-test gates without sending SMS, calling Twilio, creating outreach, or
  creating group chats. The current safe default is blocked while
  `SMS_SENDS_DISABLED=true` or compliance is not approved.
- `test:post-a2p-self-test-plan` checks the v0.9 playbook/checklist,
  one-number-only readiness rules, command-center/launch-drill integration,
  duplicate-send verification language, Twilio log verification language, and
  no-SMS/no-Twilio/no-production-data constraints.
- `test:controlled-live-reply-execution` checks autonomous live-reply gates,
  idempotency, pilot caps, blocked flows, and a mocked-provider eligible path
  without sending SMS, calling Twilio, creating outreach, or creating group
  chats.
- `test:per-phone-autonomy-controls` checks manual/default/paused/on modes,
  autonomy handoffs, Needs Attention visibility, audit redaction, and no
  SMS/Twilio/outreach/group-chat behavior.
- `test:messaging-pipeline` checks message processing mode parsing,
  health-output privacy, sender hashing, and no-database-safe pipeline
  fallbacks without Twilio or SMS.
- `test:llm-provider` checks fallback, shadow, active mock, active-live
  fail-closed behavior, validation fallback, timeout fallback, forbidden-claim
  fallback, and secret-safe health output without requiring OpenAI.
- `test:llm-evals` validates structured LLM schemas and safe producer-tone
  fixtures without calling OpenAI.
- `test:llm-model-preflight` skips safely without `OPENAI_API_KEY`; with a key,
  it checks the configured `OPENAI_MODEL` through a tiny structured-output call
  and fails clearly on model-not-found/access errors without Twilio or SMS.
- `test:llm-health-config` checks configured/effective OpenAI shadow health
  state, missing-key fallback, and active-live fail-closed behavior.
- `test:llm-organizer-reply-language` checks the organizer reply language
  structured-output schema, safe provider error categories, fallback behavior,
  and audit metadata privacy.
- `test:llm-shadow-organizer-inbound` simulates shadow-mode organizer inbound
  extraction and reply-language calls while preserving fallback output and
  blocking SMS sends.
- `test:llm-active-mock-admin-dev` checks that active mock OpenAI output is
  allowed only in `/admin/dev` MOCK context, Twilio inbound fails closed,
  unavailable flow operations report deterministic fallback, contact payment
  replies stay safe, and active-live remains disabled.
- `test:llm-quality-review` checks LLM review comparison metadata, safe
  serializers, review status updates, forbidden-claim fallback, tone flags, and
  active-live disabled posture without Twilio or SMS.
- `test:conversation-golden-transcripts` checks one representative multi-turn
  transcript for organizer intake, gig-seeker onboarding, interest checks, and
  contact consent without Twilio, OpenAI, or a database.
- `test:conversation-intent-router` checks deterministic intent routing without
  requiring Twilio, OpenAI, or a database.
- `test:conversation-organizer-policy` checks the organizer intake `ReplyPlan`
  policy without requiring Twilio, OpenAI, or a database.
- `test:conversation-organizer-multiturn` checks mock-active organizer replies,
  Twilio fail-closed mode semantics, and multi-turn intake behavior without
  requiring Twilio, OpenAI, or a database.
- `test:conversation-gig-seeker-policy` checks the shadow-mode creator/gig-seeker
  onboarding `ReplyPlan` policy without requiring Twilio, OpenAI, or a database.
- `test:conversation-gig-seeker-multiturn` checks mock-active gig-seeker
  replies, Twilio fail-closed mode semantics, and pure pending-profile draft
  behavior without requiring Twilio, OpenAI, or a database.
- `test:conversation-interest-check-policy` checks the shadow-mode
  interest-check `ReplyPlan` policy, organizer ambiguity, safety escalation, and
  no-promises behavior without requiring Twilio, OpenAI, or a database.
- `test:conversation-interest-check-multiturn` checks mock-active interest-check
  replies, Twilio fail-closed mode semantics, and pure draft `InterestCheck`
  behavior without requiring Twilio, OpenAI, or a database.
- `test:conversation-contact-reply-policy` checks contact YES/NO/MAYBE,
  consent, STOP/START/HELP precedence, no-active-outreach ambiguity, and
  escalation behavior without requiring Twilio, OpenAI, or a database.
- `test:conversation-contact-reply-demo-flow` is a DB-backed `/admin/dev`
  harness check for mock outreach activation and the contact reply simulator. It
  skips safely when `DATABASE_URL` is missing.
- `test:design-partner-transcript-dry-runs` runs ten synthetic design-partner
  transcripts across organizer, gig-seeker, interest-check, and contact-reply
  flows with a mocked LLM provider by default. It sends no SMS and requires no
  Twilio, database, or production Saga app data.
- `test:staging-repeatability` runs locally with DB-required checks skipped when
  `DATABASE_URL` is missing.
- `test:mock-app-integration` calls the deployed internal API only when
  `APP_BASE_URL` and `INTERNAL_API_KEY` are set; otherwise it skips safely.
- `test:internal-api` is an HTTP smoke test against `APP_BASE_URL` using
  `INTERNAL_API_KEY`; it skips if either value is missing and does not require
  direct database access.

DB-dependent staging checks:

```bash
npm run prisma:seed
npm run test:seed-idempotency
```

Run DB-dependent commands inside the Railway service container with
`railway ssh` when `DATABASE_URL` uses `postgres.railway.internal`, or use a
staging-only public TCP proxy if one is explicitly configured. Do not run these
against production Saga app data.

## CI

GitHub Actions runs the no-secrets guardrail suite on pull requests and pushes
to `main`: install, Prisma Client generation, lint, typecheck, build,
`test:staging-baseline`, `test:twilio-readiness`, and `test:ai-evals`.

CI does not require `DATABASE_URL`, Railway, Twilio, OpenAI, or
`INTERNAL_API_KEY`. DB-dependent staging checks such as `prisma:seed` and
`test:seed-idempotency` should be run inside Railway staging after deploy.
`test:staging-repeatability` can run locally with DB-required checks skipped, or
inside Railway staging for the full mock workflow repeatability pass.

See `docs/ci.md` for the full CI contract and failure guide.

If `DATABASE_URL` points to a real local database, also run:

```bash
npm run prisma:migrate -- --name hardening_live_mvp
npm run prisma:seed
```

## Live Rehearsal Checklist

- Can a new organizer text Saga and receive a reply?
- Does the first-time host question only appear once?
- Does the brief appear in admin?
- Can admin edit the brief?
- Can admin generate roles?
- Can admin match contacts?
- Can admin draft outreach only to selected contacts?
- Can admin edit and approve/send outreach?
- Can a contact reply YES?
- Does Saga ask consent before group chat?
- Does consent require an explicit YES?
- Can admin send a shortlist?
- Can admin create a group chat only with consented contacts?
- Does Saga send the kickoff?
- Can admin create tasks and send manual reminders?
- Are all messages stored?
- Are failed sends visible and retryable?
- Are admin approvals logged?
- Does STOP prevent future messages?
- Does `/api/health` pass in production?

## Integration Notes For Saga App Engineers

- Connect existing mobile/web users to `Person.sagaUserId`.
- Connect existing Saga events to `Project.existingSagaEventId`.
- Connect existing communities to `Project.existingSagaCommunityId` and `CreatorProfile.communities`.
- Import friend, mutual, event-attendance, follow, and collaboration graph data into `RelationshipEdge`.
- Keep internal notes in `CreatorProfile.internalNotes`; do not expose them to organizers or creators.
- Keep outreach, shortlist, and group conversation creation human-approved.

## Capped Public Beta Infrastructure

Capped public beta support is infrastructure-only and disabled by default:

- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_BETA_LANDING_ENABLED=false`
- `PUBLIC_BETA_WAITLIST_ENABLED=false`
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false`

Use `/admin/public-beta` to review waitlist, consent, capacity, and admission
readiness. The public `/beta` route shows a closed/coming-soon page unless the
landing and waitlist flags are intentionally enabled. No public beta path sends
SMS, publishes the number, enables public launch, or connects to the main Saga
production app.

Run the capped public beta checks with:

```bash
npm run test:capped-public-beta-infrastructure
```

## Beta Cohort Simulation

Beta Cohort Simulation is simulation-only evidence for staged rollout pressure.
It models 10 design partners, 25 private beta users, 100 capped public beta
users, and over-capacity behavior with synthetic data only. It never sends SMS,
calls Twilio send APIs, invites users, enables public beta, or touches production
Saga app data.

Use `/admin/beta-simulations` to run or record simulated cohorts. The Operator
Command Center and Launch Readiness Drill consume the latest simulation summary,
but real launch remains blocked until A2P/compliance, SMS, access-control,
observability, data-ops, and manual evidence gates pass.

```bash
npm run test:beta-cohort-simulation
npm run beta:cohort-report
```

## Release Candidate v0.1

Launch Freeze / Release Candidate Packaging v0.1 freezes the current safe
standalone state for the post-A2P path. It packages docs, readiness evidence,
known open items, and a redacted report while keeping all live behavior
disabled.

Current expected posture:

- `SMS_SENDS_DISABLED=true`
- `SMS_REQUIRE_ALLOWLIST=true`
- `LLM_MODE` is fallback, shadow, or active_mock, never active_live
- `MESSAGE_PROCESSING_MODE=sync`
- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_LAUNCH_ENABLED=false`
- no main Saga production app integration
- no ticketing, RSVP, QR, payment, event publishing, shortlist send, candidate
  outreach send, group chat automation, or public web sourcing

Run the RC wrapper and report with:

```bash
npm run test:release-candidate
npm run release:rc-report
```
