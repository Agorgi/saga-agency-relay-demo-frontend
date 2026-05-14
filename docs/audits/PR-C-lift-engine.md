# PR-C Audit — Lift Engine to Top-Level (+ Prisma at Root)

**Date:** 2026-05-14  
**Branch:** `feature/web-chat/pr-c-lift-engine`  
**Base:** `main` at `1ae99646752a83f90ecafbad403a75a13bffbda2`  
**Result:** PASS

## Inventory output from Step 0

### 1. `find sms-engine/src -maxdepth 3 -type d | sort`

```text
sms-engine/src
sms-engine/src/app
sms-engine/src/app/admin
sms-engine/src/app/admin/(dashboard)
sms-engine/src/app/api
sms-engine/src/app/api/health
sms-engine/src/app/api/internal
sms-engine/src/app/api/twilio
sms-engine/src/app/beta
sms-engine/src/components
sms-engine/src/components/admin
sms-engine/src/lib
sms-engine/src/lib/access
sms-engine/src/lib/admin
sms-engine/src/lib/cohortSimulation
sms-engine/src/lib/commandCenter
sms-engine/src/lib/conversation
sms-engine/src/lib/dataOps
sms-engine/src/lib/dryRuns
sms-engine/src/lib/graph
sms-engine/src/lib/launchDrill
sms-engine/src/lib/llm
sms-engine/src/lib/llm/prompts
sms-engine/src/lib/matchingEval
sms-engine/src/lib/observability
sms-engine/src/lib/producer
sms-engine/src/lib/publicBeta
sms-engine/src/lib/releaseCandidate
sms-engine/src/lib/sourcing
```

### 2. `ls sms-engine/prisma/` and `head -50 sms-engine/prisma/schema.prisma`

```text
---PRISMA_LS---
migrations
schema.prisma
seed.ts
---PRISMA_SCHEMA_HEAD---
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProjectStatus {
  NEW_INBOUND
  INTAKE_IN_PROGRESS
  BRIEF_READY_FOR_REVIEW
  ROLE_MAPPING_READY
  OUTREACH_DRAFTED
  OUTREACH_IN_PROGRESS
  SHORTLIST_READY
  SHORTLIST_SENT
  GROUPCHAT_PENDING
  GROUPCHAT_ACTIVE
  PRODUCTION_IN_PROGRESS
  ARCHIVED
  NEEDS_ADMIN
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageChannel {
  SMS
  GROUP_SMS
  ADMIN
}

enum InboundProcessingJobStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  SKIPPED_DUPLICATE
  BLOCKED
}

enum OutreachStatus {
  DRAFTED
  SENT
  INTERESTED
  NOT_INTERESTED
```

### 3. `sms-engine/package.json.original` scripts block

```json
{
  "dev": "next dev",
  "clean": "rm -rf .next",
  "build": "next build",
  "postbuild": "mkdir -p .next/standalone/.next && cp -R public .next/standalone/public && cp -R .next/static .next/standalone/.next/static",
  "start": "HOSTNAME=0.0.0.0 node .next/standalone/server.js",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "postinstall": "prisma generate",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:deploy": "prisma migrate deploy",
  "prisma:seed": "prisma db seed",
  "db:studio": "prisma studio",
  "db:up": "docker compose up -d postgres",
  "db:down": "docker compose down",
  "db:reset": "prisma migrate reset",
  "test:agent": "tsx -r tsconfig-paths/register scripts/test-producer-agent.ts",
  "test:producer-agent": "tsx -r tsconfig-paths/register scripts/test-producer-agent-v01.ts",
  "test:producer-approval-queue": "tsx -r tsconfig-paths/register scripts/test-producer-approval-queue.ts",
  "test:producer-outreach-drafts": "tsx -r tsconfig-paths/register scripts/test-producer-outreach-drafts.ts",
  "test:producer-send-readiness": "tsx -r tsconfig-paths/register scripts/test-producer-send-readiness.ts",
  "test:talent-discovery": "tsx -r tsconfig-paths/register scripts/test-talent-discovery.ts",
  "test:talent-research-quality": "tsx -r tsconfig-paths/register scripts/test-talent-research-quality.ts",
  "test:public-web-research-shadow": "tsx -r tsconfig-paths/register scripts/test-public-web-research-shadow.ts",
  "test:public-web-research-live": "tsx -r tsconfig-paths/register scripts/test-public-web-research-live.ts",
  "test:public-web-research-live-dry-run": "tsx -r tsconfig-paths/register scripts/test-public-web-research-live-dry-run.ts",
  "test:public-web-research-async-dry-run": "tsx -r tsconfig-paths/register scripts/test-public-web-research-async-dry-run.ts",
  "test:public-web-research-provider-schema": "tsx -r tsconfig-paths/register scripts/test-public-web-research-provider-schema.ts",
  "test:public-web-research-review-cleanup": "tsx -r tsconfig-paths/register scripts/test-public-web-research-review-cleanup.ts",
  "test:contactability-evidence": "tsx -r tsconfig-paths/register scripts/test-public-web-research-review-cleanup.ts",
  "test:candidate-graph-foundation": "tsx -r tsconfig-paths/register scripts/test-candidate-graph-foundation.ts",
  "test:relationship-aware-matching": "tsx -r tsconfig-paths/register scripts/test-relationship-aware-matching.ts",
  "test:matching-evaluation-tuning": "tsx -r tsconfig-paths/register scripts/test-matching-evaluation-tuning.ts",
  "test:outbound-self-test-readiness": "tsx -r tsconfig-paths/register scripts/test-outbound-self-test-readiness.ts",
  "test:post-a2p-self-test-plan": "tsx -r tsconfig-paths/register scripts/test-post-a2p-self-test-plan.ts",
  "test:controlled-live-reply-execution": "tsx -r tsconfig-paths/register scripts/test-controlled-live-reply-execution.ts",
  "test:per-phone-autonomy-controls": "tsx -r tsconfig-paths/register scripts/test-per-phone-autonomy-controls.ts",
  "test:llm-provider": "tsx -r tsconfig-paths/register scripts/test-llm-provider.ts",
  "test:llm-evals": "tsx -r tsconfig-paths/register scripts/test-llm-evals.ts",
  "test:llm-model-preflight": "tsx -r tsconfig-paths/register scripts/test-llm-model-preflight.ts",
  "test:llm-health-config": "tsx -r tsconfig-paths/register scripts/test-llm-health-config.ts",
  "test:llm-organizer-reply-language": "tsx -r tsconfig-paths/register scripts/test-llm-organizer-reply-language.ts",
  "test:llm-shadow-organizer-inbound": "tsx -r tsconfig-paths/register scripts/test-llm-shadow-organizer-inbound.ts",
  "test:llm-active-mock-admin-dev": "tsx -r tsconfig-paths/register scripts/test-llm-active-mock-admin-dev.ts",
  "test:llm-quality-review": "tsx -r tsconfig-paths/register scripts/test-llm-quality-review.ts",
  "test:intake": "tsx -r tsconfig-paths/register scripts/test-producer-agent.ts",
  "test:matching": "tsx -r tsconfig-paths/register scripts/test-matching.ts",
  "test:demo-flow": "tsx -r tsconfig-paths/register scripts/test-demo-flow.ts",
  "test:staging-repeatability": "tsx -r tsconfig-paths/register scripts/test-staging-repeatability.ts",
  "test:mock-app-integration": "tsx scripts/test-mock-app-integration.ts",
  "test:security": "tsx -r tsconfig-paths/register scripts/test-security-hardening.ts",
  "test:security-hardening": "npm run test:security",
  "test:workflow": "tsx -r tsconfig-paths/register scripts/test-workflow-state-machine.ts",
  "test:workflow-state-machine": "npm run test:workflow",
  "test:staging-baseline": "npm run test:security && npm run test:workflow && npm run test:agent && npm run test:matching && npm run test:demo-flow",
  "test:twilio-readiness": "tsx -r tsconfig-paths/register scripts/test-twilio-readiness.ts",
  "test:twilio-staging-no-send": "tsx -r tsconfig-paths/register scripts/test-twilio-staging-no-send.ts",
  "test:twilio-inbound-no-reply": "tsx -r tsconfig-paths/register scripts/test-twilio-inbound-no-reply.ts",
  "test:twilio-pilot-preflight": "tsx -r tsconfig-paths/register scripts/test-twilio-pilot-preflight.ts",
  "test:twilio-status-callbacks": "tsx -r tsconfig-paths/register scripts/test-twilio-status-callbacks.ts",
  "test:design-partner-pilot-readiness": "tsx -r tsconfig-paths/register scripts/test-design-partner-pilot-readiness.ts",
  "test:design-partner-pilot-preflight": "tsx -r tsconfig-paths/register scripts/test-design-partner-pilot-preflight.ts",
  "test:design-partner-transcript-dry-runs": "tsx -r tsconfig-paths/register scripts/test-design-partner-transcript-dry-runs.ts",
  "test:design-partner-operator-playbook": "tsx -r tsconfig-paths/register scripts/test-design-partner-operator-playbook.ts",
  "test:messaging-pipeline": "tsx -r tsconfig-paths/register scripts/test-messaging-pipeline.ts",
  "test:production-observability": "tsx -r tsconfig-paths/register scripts/test-production-observability.ts",
  "test:public-beta-access-control": "tsx -r tsconfig-paths/register scripts/test-public-beta-access-control.ts",
  "test:pilot-data-ops": "tsx -r tsconfig-paths/register scripts/test-pilot-data-ops.ts",
  "test:launch-readiness-drill": "tsx -r tsconfig-paths/register scripts/test-launch-readiness-drill.ts",
  "test:operator-command-center": "tsx -r tsconfig-paths/register scripts/test-operator-command-center.ts",
  "test:admin-navigation-ux": "tsx -r tsconfig-paths/register scripts/test-admin-navigation-ux.tsx",
  "test:admin-info-architecture": "tsx -r tsconfig-paths/register scripts/test-admin-info-architecture.ts",
  "test:repo-truth-audit": "tsx -r tsconfig-paths/register scripts/test-repo-truth-audit.ts",
  "test:capped-public-beta-infrastructure": "tsx -r tsconfig-paths/register scripts/test-capped-public-beta-infrastructure.ts",
  "test:beta-cohort-simulation": "tsx -r tsconfig-paths/register scripts/test-beta-cohort-simulation.ts",
  "test:release-candidate-package": "tsx -r tsconfig-paths/register scripts/test-release-candidate-package.ts",
  "test:release-candidate": "npm run test:staging-baseline && npm run test:conversation-engine-v0.1 && npm run test:producer-agent && npm run test:producer-approval-queue && npm run test:producer-outreach-drafts && npm run test:producer-send-readiness && npm run test:outbound-self-test-readiness && npm run test:controlled-live-reply-execution && npm run test:llm-provider && npm run test:llm-quality-review && npm run test:design-partner-pilot-readiness && npm run test:design-partner-pilot-preflight && npm run test:design-partner-transcript-dry-runs && npm run test:messaging-pipeline && npm run test:production-observability && npm run test:public-beta-access-control && npm run test:pilot-data-ops && npm run test:launch-readiness-drill && npm run test:operator-command-center && npm run test:capped-public-beta-infrastructure && npm run test:beta-cohort-simulation && npm run test:twilio-readiness && npm run test:security-hardening && npm run test:release-candidate-package",
  "jobs:process-inbound-once": "tsx -r tsconfig-paths/register scripts/process-inbound-jobs-once.ts",
  "jobs:process-public-web-research-once": "tsx -r tsconfig-paths/register scripts/process-public-web-research-jobs-once.ts",
  "observability:daily-report": "tsx -r tsconfig-paths/register scripts/observability-daily-report.ts",
  "launch:drill-report": "tsx -r tsconfig-paths/register scripts/launch-drill-report.ts",
  "command-center:report": "tsx -r tsconfig-paths/register scripts/command-center-report.ts",
  "beta:cohort-report": "tsx -r tsconfig-paths/register scripts/beta-cohort-report.ts",
  "release:rc-report": "tsx -r tsconfig-paths/register scripts/release-rc-report.ts",
  "web-research:live-dry-run": "tsx -r tsconfig-paths/register scripts/web-research-live-dry-run.ts",
  "public-web:review-report": "tsx -r tsconfig-paths/register scripts/public-web-review-report.ts",
  "matching:evaluation-report": "tsx -r tsconfig-paths/register scripts/matching-evaluation-report.ts",
  "test:ai-evals": "tsx -r tsconfig-paths/register scripts/test-ai-evals.ts",
  "test:conversation-intent-router": "tsx -r tsconfig-paths/register scripts/test-conversation-intent-router.ts",
  "test:conversation-organizer-policy": "tsx -r tsconfig-paths/register scripts/test-conversation-organizer-policy.ts",
  "test:conversation-organizer-multiturn": "tsx -r tsconfig-paths/register scripts/test-conversation-organizer-multiturn.ts",
  "test:conversation-gig-seeker-policy": "tsx -r tsconfig-paths/register scripts/test-conversation-gig-seeker-policy.ts",
  "test:conversation-gig-seeker-multiturn": "tsx -r tsconfig-paths/register scripts/test-conversation-gig-seeker-multiturn.ts",
  "test:conversation-interest-check-policy": "tsx -r tsconfig-paths/register scripts/test-conversation-interest-check-policy.ts",
  "test:conversation-interest-check-multiturn": "tsx -r tsconfig-paths/register scripts/test-conversation-interest-check-multiturn.ts",
  "test:conversation-contact-reply-policy": "tsx -r tsconfig-paths/register scripts/test-conversation-contact-reply-policy.ts",
  "test:conversation-contact-reply-demo-flow": "tsx -r tsconfig-paths/register scripts/test-conversation-contact-reply-demo-flow.ts",
  "test:conversation-capability-responses": "tsx -r tsconfig-paths/register scripts/test-conversation-capability-responses.ts",
  "test:conversation-golden-transcripts": "tsx -r tsconfig-paths/register scripts/test-conversation-golden-transcripts.ts",
  "test:conversation-engine-v0.1": "npm run test:conversation-intent-router && npm run test:conversation-organizer-policy && npm run test:conversation-organizer-multiturn && npm run test:conversation-gig-seeker-policy && npm run test:conversation-gig-seeker-multiturn && npm run test:conversation-interest-check-policy && npm run test:conversation-interest-check-multiturn && npm run test:conversation-contact-reply-policy && npm run test:conversation-capability-responses && npm run test:conversation-golden-transcripts",
  "test:internal-api": "tsx -r tsconfig-paths/register scripts/test-internal-api.ts",
  "test:seed-idempotency": "tsx -r tsconfig-paths/register scripts/test-seed-idempotency.ts"
}
```

### 4. `process.env.*` references

```text
ADMIN_PASSWORD
APP_BASE_URL
CONVERSATION_ENGINE_ACTIVE
CONVERSATION_ENGINE_MODE
DATABASE_URL
INTERNAL_API_KEY
LLM_DAILY_CALL_CAP
LLM_LOG_OUTPUTS
LLM_LOG_PROMPTS
LLM_TIMEOUT_MS
MESSAGE_PROCESSING_MODE
MESSAGING_PROVIDER
NODE_ENV
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
PILOT_MAX_ACTIVE_PARTICIPANTS
PILOT_PRIVACY_URL
PILOT_REPLY_MODE
PILOT_STAGE
PILOT_SUPPORT_CONTACT
PILOT_TERMS_URL
PORT
PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS
PUBLIC_BETA_ENABLED
PUBLIC_BETA_LANDING_ENABLED
PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS
PUBLIC_BETA_NEW_USER_DAILY_CAP
PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE
PUBLIC_BETA_REQUIRE_CONSENT
PUBLIC_BETA_REQUIRE_INVITE_CODE
PUBLIC_BETA_WAITLIST_ENABLED
PUBLIC_LAUNCH_ENABLED
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS
PUBLIC_WEB_RESEARCH_ENABLED
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG
PUBLIC_WEB_RESEARCH_MAX_RESULTS
PUBLIC_WEB_RESEARCH_MODE
PUBLIC_WEB_RESEARCH_PROVIDER
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS
RAILWAY_ENVIRONMENT
SMS_ACCESS_MODE
SMS_ALLOWED_NUMBERS
SMS_AUTONOMOUS_REPLY_DAILY_CAP
SMS_COMPLIANCE_APPROVED
SMS_DAILY_INBOUND_CAP
SMS_DAILY_SEND_CAP
SMS_PER_NUMBER_DAILY_SEND_CAP
SMS_REQUIRE_ALLOWLIST
SMS_SENDS_DISABLED
TWILIO_ACCOUNT_SID
TWILIO_API_CALLS_FORBIDDEN
TWILIO_AUTH_TOKEN
TWILIO_CONVERSATIONS_SERVICE_SID
TWILIO_MESSAGING_SERVICE_SID
TWILIO_PHONE_NUMBER
TWILIO_STAGING_MODE
TWILIO_VALIDATE_WEBHOOKS
```

### 5. `find sms-engine/src/app -maxdepth 3 -type d | sort`

```text
sms-engine/src/app
sms-engine/src/app/admin
sms-engine/src/app/admin/(dashboard)
sms-engine/src/app/admin/(dashboard)/access
sms-engine/src/app/admin/(dashboard)/audit
sms-engine/src/app/admin/(dashboard)/beta-simulations
sms-engine/src/app/admin/(dashboard)/candidate-graph
sms-engine/src/app/admin/(dashboard)/command-center
sms-engine/src/app/admin/(dashboard)/contacts
sms-engine/src/app/admin/(dashboard)/creator-profiles
sms-engine/src/app/admin/(dashboard)/data-ops
sms-engine/src/app/admin/(dashboard)/dev
sms-engine/src/app/admin/(dashboard)/groupchats
sms-engine/src/app/admin/(dashboard)/interest-checks
sms-engine/src/app/admin/(dashboard)/launch-drill
sms-engine/src/app/admin/(dashboard)/llm-review
sms-engine/src/app/admin/(dashboard)/matching
sms-engine/src/app/admin/(dashboard)/matching-evaluation
sms-engine/src/app/admin/(dashboard)/needs-attention
sms-engine/src/app/admin/(dashboard)/network-projects
sms-engine/src/app/admin/(dashboard)/observability
sms-engine/src/app/admin/(dashboard)/opportunities
sms-engine/src/app/admin/(dashboard)/outbound-drafts
sms-engine/src/app/admin/(dashboard)/outreach
sms-engine/src/app/admin/(dashboard)/people
sms-engine/src/app/admin/(dashboard)/pilot
sms-engine/src/app/admin/(dashboard)/pilot-feedback
sms-engine/src/app/admin/(dashboard)/pilot-participants
sms-engine/src/app/admin/(dashboard)/pipeline
sms-engine/src/app/admin/(dashboard)/projects
sms-engine/src/app/admin/(dashboard)/public-beta
sms-engine/src/app/admin/(dashboard)/recommendations
sms-engine/src/app/admin/(dashboard)/relationships
sms-engine/src/app/admin/(dashboard)/role-openings
sms-engine/src/app/admin/(dashboard)/sourcing
sms-engine/src/app/admin/(dashboard)/sourcing-quality
sms-engine/src/app/admin/(dashboard)/tasks
sms-engine/src/app/admin/(dashboard)/transcript-dry-runs
sms-engine/src/app/api
sms-engine/src/app/api/health
sms-engine/src/app/api/internal
sms-engine/src/app/api/internal/saga
sms-engine/src/app/api/twilio
sms-engine/src/app/api/twilio/conversations-webhook
sms-engine/src/app/api/twilio/inbound
sms-engine/src/app/api/twilio/status
sms-engine/src/app/beta
```

### 6. `cat sms-engine/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/sms-engine/*": ["../src/sms-engine/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

### 7. `cat tsconfig.json` (root)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/sms-engine/*": [
        "./src/sms-engine/*"
      ],
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "sms-engine",
    "sms-engine/**"
  ]
}
```

## Exact directories moved

### Library lift

- `sms-engine/src/lib/**` → `src/sms-engine/**`
- File count moved: `124`

Top-level subtree mapping preserved under the new root:

- `sms-engine/src/lib/access` → `src/sms-engine/access`
- `sms-engine/src/lib/admin` → `src/sms-engine/admin`
- `sms-engine/src/lib/cohortSimulation` → `src/sms-engine/cohortSimulation`
- `sms-engine/src/lib/commandCenter` → `src/sms-engine/commandCenter`
- `sms-engine/src/lib/conversation` → `src/sms-engine/conversation`
- `sms-engine/src/lib/dataOps` → `src/sms-engine/dataOps`
- `sms-engine/src/lib/dryRuns` → `src/sms-engine/dryRuns`
- `sms-engine/src/lib/graph` → `src/sms-engine/graph`
- `sms-engine/src/lib/launchDrill` → `src/sms-engine/launchDrill`
- `sms-engine/src/lib/llm` → `src/sms-engine/llm`
- `sms-engine/src/lib/matchingEval` → `src/sms-engine/matchingEval`
- `sms-engine/src/lib/observability` → `src/sms-engine/observability`
- `sms-engine/src/lib/producer` → `src/sms-engine/producer`
- `sms-engine/src/lib/publicBeta` → `src/sms-engine/publicBeta`
- `sms-engine/src/lib/releaseCandidate` → `src/sms-engine/releaseCandidate`
- `sms-engine/src/lib/sourcing` → `src/sms-engine/sourcing`
- all root-level library files under `sms-engine/src/lib/*.ts` → `src/sms-engine/*.ts`

### Prisma lift

- `sms-engine/prisma/**` → `prisma/**`
- File count moved: `25`

## Prisma layout before / after

### Before

```text
sms-engine/prisma/
  migrations/
  schema.prisma
  seed.ts
```

### After

```text
prisma/
  migrations/
  schema.prisma
  seed.ts
```

Additional relocation follow-up:

- `prisma/seed.ts` imports were updated from `../src/lib/*` to `../src/sms-engine/*`

## Path alias config before / after

### Root `tsconfig.json` before

```json
{
  "paths": {
    "@/*": [
      "./src/*"
    ]
  }
}
```

### Root `tsconfig.json` after

```json
{
  "paths": {
    "@/sms-engine/*": [
      "./src/sms-engine/*"
    ],
    "@/*": [
      "./src/*"
    ]
  }
}
```

### `sms-engine/tsconfig.json` before

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

### `sms-engine/tsconfig.json` after

```json
{
  "paths": {
    "@/sms-engine/*": ["../src/sms-engine/*"],
    "@/*": ["./src/*"]
  }
}
```

## Scripts added to root `package.json`

```json
{
  "postinstall": "prisma generate",
  "prisma:generate": "prisma generate",
  "prisma:migrate:dev": "prisma migrate dev",
  "prisma:studio": "prisma studio"
}
```

Additional root package changes:

- added top-level Prisma config:

```json
{
  "prisma": {
    "schema": "prisma/schema.prisma"
  }
}
```

## Env vars surfaced

`.env.example` was added at repo root with blank placeholders for every environment variable found in the engine inventory:

```text
ADMIN_PASSWORD
APP_BASE_URL
CONVERSATION_ENGINE_ACTIVE
CONVERSATION_ENGINE_MODE
DATABASE_URL
INTERNAL_API_KEY
LLM_DAILY_CALL_CAP
LLM_LOG_OUTPUTS
LLM_LOG_PROMPTS
LLM_TIMEOUT_MS
MESSAGE_PROCESSING_MODE
MESSAGING_PROVIDER
NODE_ENV
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
PILOT_MAX_ACTIVE_PARTICIPANTS
PILOT_PRIVACY_URL
PILOT_REPLY_MODE
PILOT_STAGE
PILOT_SUPPORT_CONTACT
PILOT_TERMS_URL
PORT
PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS
PUBLIC_BETA_ENABLED
PUBLIC_BETA_LANDING_ENABLED
PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS
PUBLIC_BETA_NEW_USER_DAILY_CAP
PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE
PUBLIC_BETA_REQUIRE_CONSENT
PUBLIC_BETA_REQUIRE_INVITE_CODE
PUBLIC_BETA_WAITLIST_ENABLED
PUBLIC_LAUNCH_ENABLED
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS
PUBLIC_WEB_RESEARCH_ENABLED
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG
PUBLIC_WEB_RESEARCH_MAX_RESULTS
PUBLIC_WEB_RESEARCH_MODE
PUBLIC_WEB_RESEARCH_PROVIDER
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS
RAILWAY_ENVIRONMENT
SMS_ACCESS_MODE
SMS_ALLOWED_NUMBERS
SMS_AUTONOMOUS_REPLY_DAILY_CAP
SMS_COMPLIANCE_APPROVED
SMS_DAILY_INBOUND_CAP
SMS_DAILY_SEND_CAP
SMS_PER_NUMBER_DAILY_SEND_CAP
SMS_REQUIRE_ALLOWLIST
SMS_SENDS_DISABLED
TWILIO_ACCOUNT_SID
TWILIO_API_CALLS_FORBIDDEN
TWILIO_AUTH_TOKEN
TWILIO_CONVERSATIONS_SERVICE_SID
TWILIO_MESSAGING_SERVICE_SID
TWILIO_PHONE_NUMBER
TWILIO_STAGING_MODE
TWILIO_VALIDATE_WEBHOOKS
```

## Verification

### `npx prisma generate`

```text
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 283ms
```

### Clean install

Command:

```bash
rm -rf node_modules .next
npm install
```

Result:

```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@renovatebot/pep440@4.2.1',
npm warn EBADENGINE   required: { node: '^20.9.0 || ^22.11.0 || ^24', pnpm: '^10.0.0' },
npm warn EBADENGINE   current: { node: 'v23.6.1', npm: '10.9.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'eslint-visitor-keys@5.0.1',
npm warn EBADENGINE   required: { node: '^20.19.0 || ^22.13.0 || >=24' },
npm warn EBADENGINE   current: { node: 'v23.6.1', npm: '10.9.2' }
npm warn EBADENGINE }
npm warn deprecated scmp@2.1.0: Just use Node.js's crypto.timingSafeEqual()
npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

> saga-visual-talent-demo@0.1.0 postinstall
> prisma generate

warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 314ms
```

### Lint

```text
npm run lint
PASS
```

### Build

```text
npm run build
PASS

▲ Next.js 16.2.6 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 6.4s
  Running TypeScript ...
  Finished TypeScript in 10.2s ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/12) ...
  Generating static pages using 15 workers (3/12)
  Generating static pages using 15 workers (6/12)
  Generating static pages using 15 workers (9/12)
✓ Generating static pages using 15 workers (12/12) in 625ms
  Finalizing page optimization ...
```

### Dev server + route checks

Command:

```bash
npm run dev
for r in / /explore /feed /my-events /post-project /profile /projects /relay /talent; do
  printf '%s ' "$r"
  curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000$r"
done
```

Result:

```text
/ 200
/explore 200
/feed 200
/my-events 200
/post-project 200
/profile 200
/projects 200
/relay 200
/talent 200
```

Homepage content check:

```text
Saga
```

### Secret sweeps

```text
git grep -nE 'AC[0-9a-f]{32}' || echo OK_AC
OK_AC

git grep -nE 'sk-[a-zA-Z0-9]{20,}' || echo OK_SK
OK_SK
```

### Prisma package resolution

```text
saga-visual-talent-demo@0.1.0 /Users/alexgorgi/Documents/Playground/saga-agency-relay-demo-frontend-pr-a
├── @prisma/client@6.19.3
└── prisma@6.19.3
```

## Deviations from the prompt

- The prompt cited `f548154db65da67b1b03bf37b4823189f8ed5cc3` as the expected base tip, but that SHA was the PR-B branch tip before merge. The actual merged `main` tip used for PR-C was `1ae99646752a83f90ecafbad403a75a13bffbda2`.
- In addition to lifting the moved library files, imports were also rewritten inside `sms-engine/scripts/**`, `sms-engine/src/app/**`, and `sms-engine/src/components/**` so those files reference the new canonical `@/sms-engine/*` path instead of the old `@/lib/*` path.
- `prisma/seed.ts` needed one follow-up import-path fix after the move because it still referenced `../src/lib/*`; that was corrected to `../src/sms-engine/*`.
- `.env.example` matched the prompt’s requirement but had to be force-added because the repo’s ignore rules treat `.env*` files as ignored by default.
- Prisma emitted a deprecation warning for `package.json#prisma`; the requested setup still works in Prisma 6, so no behavioral change was made in this PR.
