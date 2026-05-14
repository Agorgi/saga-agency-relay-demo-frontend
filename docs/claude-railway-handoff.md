# Claude / Railway Staging Handoff

This is the source-of-truth handoff for Claude Co-work or computer-use operating Railway staging for the Saga Producer MVP.

## Section 1 - Purpose

Claude's job is to operate staging, not change product behavior.

Claude should:

- Set up or update Railway **STAGING**.
- Verify deployment.
- Verify database migrations.
- Run and verify seed data.
- Open `/api/health`.
- Open `/admin`.
- Run the `/admin/dev` demo QA loop.
- Audit old Railway/Twilio setup read-only.
- Collect issues for Codex.

Clear boundaries:

- Staging only.
- No live Twilio.
- No real SMS.
- No real Saga production app integration.
- No production database.
- No ticketing, RSVP, QR code, event sales, or payment changes.
- No code changes unless explicitly requested by the user.

## Section 2 - Current Repo Status

Local repository facts from this workspace:

- Current git branch: `main`.
- Local staging-prep commit created: `d16a42d` (`Prepare Saga Producer MVP for Railway staging`).
- GitHub repo URL: `https://github.com/Agorgi/saga-sms-producer-mvp`.
- Remote: `origin`.
- Latest pushed commit hash: use `git rev-parse --short HEAD` or the Codex final report for the exact current `HEAD`; a commit cannot reliably embed its own future hash in this document.
- Working tree after the GitHub readiness pass: clean.
- Pushed to GitHub: yes, after merging the remote starter README history without force-pushing.
- Package manager: `npm` with `package-lock.json`.
- Local Node observed: `v23.6.1`.
- Node version requirement: no `engines.node` field is declared in `package.json`.
- App framework: Next.js `16.2.4`, App Router, React `19.2.4`, TypeScript, Tailwind.
- Database/ORM: PostgreSQL with Prisma.
- Deployment target: Railway app service plus Railway Postgres.
- Messaging mode for staging: `MESSAGING_PROVIDER=MOCK`.

## Section 3 - What Changed Recently

### 1. Initial SMS Producer MVP

- Admin dashboard.
- Prisma/Postgres schema.
- Twilio webhook routes.
- SMS intake workflow.
- LLM abstraction with Zod validation.
- Contact matching.
- Outreach approval.
- Shortlist flow.
- Group chat flow.
- Tasks/reminders.
- Audit logs.

### 2. Live Rehearsal Hardening

- Strict env validation.
- `/api/health`.
- Twilio signature validation.
- Webhook idempotency.
- STOP/START opt-out handling.
- Rate limiting.
- `NEEDS_ADMIN` escalation flow.
- Manual outbound composer.
- Failed message retry.
- `/admin/dev` intake simulation.

### 3. Demo Mode Without Real SMS

- Channel-agnostic messaging provider.
- `MockMessagingProvider`.
- `TwilioMessagingProvider` wrapper.
- Production-network domain models.
- Deterministic matching.
- Expanded `/admin/dev`.
- Seed/demo data.
- `test:matching`.
- `test:demo-flow`.

### 4. Stabilization

- Canonical production-network models.
- Legacy-to-canonical bridges.
- Internal Saga app API contracts.
- Local DB support.
- Architecture/data/internal API/demo/handoff docs.
- Internal API tests.

### 5. Deployment-Readiness Audit

- Twilio optional for staging.
- `MESSAGING_PROVIDER=MOCK`.
- Health check works without Twilio/OpenAI.
- Seed safer to rerun.
- Railway docs/checklist updated.
- `railway.json` verified.

## Section 4 - Canonical Architecture Summary

Canonical production-network models:

- `Person`
- `CreatorProfile`
- `Project`
- `RoleOpening`
- `Opportunity`
- `CandidateRecommendation`
- `Team`
- `TeamMember`
- `ProductionConversation`
- `RelationshipEdge`
- `InterestCheck`

Legacy SMS models remain and bridge into canonical models:

- `ProjectBrief.projectId` -> `Project`
- `Contact.personId` -> `Person` / `CreatorProfile`
- `Outreach.opportunityId` -> `Opportunity`
- `Outreach.candidateRecommendationId` -> `CandidateRecommendation`
- `GroupChat.productionConversationId` -> `ProductionConversation`
- `Task` can attach to `ProjectBrief`, `Project`, or `ProductionConversation`

Plain-English model roles:

- `ProjectBrief` is still useful for SMS/intake transcript and brief workflow state.
- `Project` is the canonical creative/project object.
- `RoleOpening` is the canonical staffing need.
- `Opportunity` is the surfaced gig/collab/job object.
- `CandidateRecommendation` is the match object.
- `ProductionConversation` is the channel-agnostic conversation object.

## Section 5 - Key Files Claude Should Inspect

- `package.json` - scripts, package manager, dependencies.
- `railway.json` - Railway build/start/predeploy/healthcheck settings.
- `next.config.ts` - Next.js standalone output.
- `prisma/schema.prisma` - canonical and legacy data model.
- `prisma/seed.ts` - staging/demo seed data.
- `.env.example` - deployment env template.
- `.env.local.example` - local demo env template.
- `README.md` - setup, Railway, demo, verification notes.
- `docs/staging-deploy-checklist.md` - staging operator checklist.
- `docs/architecture.md` - layered architecture summary.
- `docs/data-model.md` - canonical and legacy model mapping.
- `docs/internal-api.md` - internal Saga app API contract.
- `docs/demo-mode.md` - no-SMS demo mode.
- `docs/engineering-handoff.md` - engineering risk/handoff notes.
- `src/app/api/health/route.ts` - health check behavior.
- `src/app/admin/(dashboard)/dev/page.tsx` - demo QA lab.
- `src/app/api/internal/saga` - internal API route handlers.
- `src/lib/messagingProvider.ts` - mock/Twilio provider abstraction.
- `src/lib/networkBridge.ts` - legacy-to-canonical bridge services.
- `src/lib/networkCore.ts` - production-network demo/core services.
- `src/lib/networkMatching.ts` - deterministic matching.
- `src/lib/internalSagaApi.ts` - internal API service layer.
- `scripts/test-producer-agent.ts` - producer agent/fallback test.
- `scripts/test-matching.ts` - deterministic matching test.
- `scripts/test-demo-flow.ts` - demo reply classification test.
- `scripts/test-internal-api.ts` - internal API contract smoke test.

## Section 6 - Required Railway Staging Configuration

Railway project:

```text
Saga Producer MVP - Staging
```

Services:

- Next.js app service from latest GitHub repo.
- Railway Postgres database.

Required env vars:

```text
DATABASE_URL=<Railway Postgres reference variable>
ADMIN_PASSWORD=<user enters manually>
INTERNAL_API_KEY=<user enters manually>
APP_BASE_URL=https://<Railway public app URL>
MESSAGING_PROVIDER=MOCK
```

Recommended/optional:

```text
NODE_ENV=production
TWILIO_VALIDATE_WEBHOOKS=false
OPENAI_API_KEY=
OPENAI_MODEL=
```

Twilio env vars are optional and should be left blank for staging demo mode unless the user explicitly asks to test Twilio later:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_CONVERSATIONS_SERVICE_SID=
```

Rules for secrets:

- Twilio env vars should not be required for demo mode.
- OpenAI env vars should not be required for demo mode.
- Claude should not read, store, screenshot, or repeat secret values.
- The user should paste `ADMIN_PASSWORD` and `INTERNAL_API_KEY` manually.

## Section 7 - Railway Build/Deploy Settings

From `package.json`:

- Install behavior: `npm install`; `postinstall` runs `prisma generate`.
- Build command: `npm run build`.
- Start command: `npm run start`.
- Prisma deploy command: `npm run prisma:deploy`.
- Prisma seed command: `npm run prisma:seed`.
- Manual local cleanup command: `npm run clean`. Railway build should not run this automatically because Railpack may mount `.next/cache` as a build cache.

Exact script values:

```json
{
  "postinstall": "prisma generate",
  "clean": "rm -rf .next",
  "build": "next build",
  "start": "HOSTNAME=0.0.0.0 node .next/standalone/server.js",
  "prisma:deploy": "prisma migrate deploy",
  "prisma:seed": "prisma db seed"
}
```

From `railway.json`:

```json
{
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "preDeployCommand": "npm run prisma:deploy",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

Next.js standalone output is configured in `next.config.ts`:

```ts
output: "standalone"
```

## Section 8 - Health Check Expectations

URL:

```text
[APP_BASE_URL]/api/health
```

Expected success shape for staging demo mode:

```json
{
  "ok": true,
  "database": "connected",
  "twilio": {
    "accountSidConfigured": false,
    "authTokenConfigured": false,
    "messagingConfigured": false,
    "conversationsConfigured": false,
    "webhookValidationEnabled": false,
    "forcedProvider": "MOCK"
  },
  "llm": {
    "configured": false,
    "mode": "fallback",
    "model": null,
    "customBaseUrlConfigured": false
  },
  "app": {
    "adminConfigured": true,
    "appBaseUrlConfigured": true,
    "internalApiConfigured": true,
    "demoModeAvailable": true
  },
  "deployment": {
    "platform": "railway",
    "environment": "production",
    "portConfigured": true
  }
}
```

Notes:

- `database: "connected"` means Railway Postgres is reachable.
- Twilio can be absent for staging demo mode.
- LLM can be fallback/not configured.
- `ok` should still be `true` when database + core app config are healthy.
- `app.internalApiConfigured` should be `true` for staging readiness, even though current `ok` is gated by database, admin password, and app base URL.

## Section 9 - Seed Instructions

Seed only after:

- Deployment is healthy.
- `/api/health` reports `database: "connected"`.
- Migrations have been applied by `npm run prisma:deploy`.

Command:

```bash
npm run prisma:seed
```

If using Railway CLI:

```bash
railway ssh
npm run prisma:seed
```

Seed notes:

- Use staging only.
- Railway Postgres commonly uses `postgres.railway.internal`, which is only
  reachable inside Railway's network. Local `railway run npm run prisma:seed`
  can fail with `P1001` when it injects that private URL into a local shell.
- The seed is safer to rerun because the sample legacy brief is upserted.
- Seed-tagged sample messages/audit rows are refreshed.
- Demo contacts, people, creator profiles, projects, role openings, opportunities, and interest checks are upserted or deduped where practical.

## Section 10 - Admin Verification Checklist

Claude should verify these routes:

- `/admin` loads.
- Admin login works.
- `/admin/dev` loads.
- `/admin/people` loads.
- `/admin/creator-profiles` loads.
- `/admin/network-projects` loads.
- `/admin/role-openings` loads.
- `/admin/opportunities` loads.
- `/admin/interest-checks` loads.
- `/admin/recommendations` loads.
- `/admin/relationships` loads.
- `/admin/projects` loads.
- `/admin/contacts` loads.
- `/admin/outreach` loads.
- `/admin/groupchats` loads.
- `/admin/tasks` loads.
- `/admin/audit` loads.
- Audit/log sections render where available, especially project detail and demo/network pages.

## Section 11 - Full `/admin/dev` Demo QA Loop

### 1. Organizer Idea Intake

- Fake organizer sends project/event idea.
- Saga responds in mock mode.
- `ProjectBrief` and/or `Project` is created.
- Canonical `Project` is linked where appropriate.

### 2. Creator/Gig-Seeker Onboarding

- Fake person says they want gigs.
- System collects city, desired gigs, skills/fandoms, portfolio/social.
- `Person` is created.
- `CreatorProfile` is created.
- `CreatorProfile` is marked `PENDING_REVIEW`.

### 3. Existing Saga Event Import Mock

- Create/import fake existing Saga event.
- `Project` is created with `existingSagaEventId`.
- No ticketing/RSVP/payment behavior is touched.

### 4. Interest Check

- Create interest check.
- Simulate interest.
- Threshold is reached.
- Convert to `Project`.
- Generate role openings.

### 5. Role Openings/Opportunities

- Generate role openings.
- Inspect/edit role openings if UI supports it.
- Create opportunities.

### 6. Candidate Recommendations

- Run matching.
- Verify recommendations include:
  - Score.
  - Score breakdown.
  - Proximity tier.
  - Matching reasons.
  - Risks.

### 7. Mock Outreach/Replies

- Select candidates.
- Draft mock outreach.
- Approve mock send.
- Optional diagnostic: simulate `YES`, `NO`, and `MAYBE` replies.
- Verify reply classification if running the optional fake-reply diagnostic.
- Verify consent is requested before group chat when testing replies.

### 8. Mock Shortlist/Group Chat

- Select interested/consented candidates.
- Generate shortlist if the UI path is available.
- Send mock shortlist if the UI path is available.
- Create mock production conversation/group chat.
- Generate kickoff message.
- Generate initial tasks or audit-level next steps.

### 9. Audit/Logging/Checklist

- Verify required demo checks show `10/10 required complete`.
- Verify `Fake replies received` is shown as an optional diagnostic. It may be
  pending without failing the staging baseline.
- Verify `MOCK` vs `LIVE` labels are clear.
- Verify audit logs are readable enough.

## Section 12 - Internal API Smoke Test

Internal API routes:

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

Auth:

- Header: `X-Saga-Internal-Key`.
- User enters key manually.
- Do not expose the key in docs, screenshots, terminal output, or final reports.

Script:

```bash
npm run test:internal-api
```

If running against Railway:

```bash
APP_BASE_URL=<staging-url> INTERNAL_API_KEY=<redacted> npm run test:internal-api
```

Clarifications:

- Use fake staging data only.
- No real Saga app integration.
- No ticketing/payment/RSVP/QR behavior.
- The script is black-box/API-only. It does not open Prisma and can run from a
  local machine without direct database access.
- If `APP_BASE_URL` or `INTERNAL_API_KEY` is missing, the script exits with a
  skip message.

## Section 13 - Twilio Audit Only

Claude must not configure live Twilio during this staging demo.

Do not:

- Configure live Twilio.
- Send real SMS.
- Point Twilio webhooks to staging.
- Change Twilio settings without explicit user approval.

If previous Twilio setup exists, audit read-only:

- Is there a Twilio number?
- Are webhooks pointing anywhere?
- Do they point to an old deployment?
- Could they accidentally send real traffic?

Report findings before changing anything.

## Section 14 - Known Caveats and Risks

- Twilio is blocked/waiting and out of scope for this staging demo.
- Demo mode uses `MESSAGING_PROVIDER=MOCK`.
- OpenAI is optional; fallback mode should work.
- Fresh Railway staging DB is recommended.
- Unique indexes on `Person.sagaUserId` and `Project.existingSagaEventId` require no duplicate preexisting values.
- Migrations are additive for staging but should be engineer-reviewed before production data.
- Real Saga app integration is not connected yet.
- Production ticketing, RSVP, QR, sales, and payments should not be touched.
- Internal API uses shared-key auth and is MVP only; production auth needs engineer review.

## Section 15 - Bug Report Format For Claude

Use this format:

```text
Issue 1:
- Area:
- Step:
- Expected:
- Actual:
- Error/log:
- Likely cause:
- Suggested Codex fix:
```

## Section 16 - Final Report Template For Claude

```text
1. Railway status:
- project name:
- app service status:
- database status:
- public URL:
- health check result:

2. Migration/seed status:
- migrations ran?
- seed ran?
- errors?

3. Admin status:
- /admin works?
- /admin/dev works?
- pages checked:

4. Demo QA result:
- each flow pass/fail:
- notes:

5. Internal API status:
- routes/scripts tested:
- pass/fail:

6. Twilio status:
- webhook state:
- whether anything points to staging or old deployment:
- no changes made unless approved:

7. Issues for Codex:
- concise bug list:
```

## Section 17 - Claude Operating Rules

- Staging only.
- Audit first.
- No code changes unless the user explicitly asks.
- No live Twilio.
- No real SMS.
- No real Saga production DB.
- No real Saga app connection.
- No production user data.
- No ticketing/RSVP/QR/payment changes.
- Do not expose secrets.
- Do not invent/fake secret values.
- If demo mode fails because Twilio env vars are required, report it as a Codex bug.
- If code needs changes, collect issue details for Codex.
