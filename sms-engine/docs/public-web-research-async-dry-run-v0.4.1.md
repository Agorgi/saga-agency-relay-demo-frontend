# Public Web Research Async Dry Run v0.4.1

Public Web Research Async Dry Run moves the live dry-run OpenAI `web_search`
call out of the admin HTTP request path. The v0.4 synchronous server action was
safe, but Railway's HTTP proxy timed out before the provider returned, so the
POST surfaced as `503` and no `PublicWebResearchRun` records were persisted.

v0.4.1 fixes the architecture: the admin button queues a job quickly, and a CLI
or future worker processes the job outside the proxy timeout window.

The first end-to-end async live dry run confirmed that the flags, health rollup,
queue, Railway SSH runner, and revert path worked, but the OpenAI provider
failed with `invalid_schema:400`. Root cause: the provider asked the Responses
API to run `web_search` and satisfy the full candidate-card structured output
schema in the same call. The current provider uses two steps instead:

1. A plain Responses `web_search` call returns a concise cited research summary
   and source list.
2. A second no-tool structured extraction pass converts that cited summary into
   review-only candidate cards.

This keeps citations required while avoiding a complex schema on the tool call.
Results remain `SHADOW_RESULT` / `NEEDS_REVIEW`.

## Job Model

`PublicWebResearchJob` records the async work:

- `researchRunId`
- `projectBriefId` / `projectId`
- `role`
- `querySummary`
- `mode`
- `status`
- `attempts` / `maxAttempts`
- `lockedAt` / `lockedBy`
- `runAfter`
- `errorCategory`
- `lastErrorMessageRedacted`
- `resultSummary`
- timestamps

The job never stores phone numbers, secrets, raw prompts, or raw OpenAI output.
The demo query is safe to summarize, but health output does not expose queries
or source URLs.

## Queue Flow

From `/admin/sourcing/public-web`:

1. Admin clicks **Queue live dry run**.
2. The server action validates all live dry-run gates.
3. It creates a `PublicWebResearchRun` in `DRAFT`.
4. It creates a `PublicWebResearchJob` in `PENDING`.
5. It returns immediately with a queued state.

The server action does not call OpenAI, does not send SMS, does not create
outreach, does not create group chats, and does not promote candidates.
After processing, review and cleanup happens in
`/admin/sourcing/public-web-review`; async results remain review-only until the
v0.5 lifecycle, source-quality, duplicate, and contactability checks are handled.

## Processing From Railway SSH

Run one job:

```bash
JOB_PROCESS_LIMIT=1 npm run jobs:process-public-web-research-once
```

The runner:

- processes pending/failed retryable jobs
- re-checks public-web research gates
- calls the OpenAI web-search provider only from CLI/worker context
- requires citations
- creates `SHADOW_RESULT` / `NEEDS_REVIEW` results only
- runs the public-web safety checker
- optionally creates Talent Research Quality Review records
- marks the job and run succeeded or failed

## Failure Categories

Safe categories:

- `provider_timeout`
- `provider_4xx`
- `provider_5xx`
- `provider_rate_limit`
- `invalid_schema`
- `invalid_request`
- `model_not_found`
- `auth_error`
- `network_error`
- `invalid_citation_set`
- `invalid_structured_output`
- `safety_blocked`
- `gate_blocked`
- `no_results`
- `unknown`

Timeouts mark the job `FAILED`, mark the run `FAILED`, write
`public_web_research.run_failed_timeout`, and expose only redacted error text.
Retries are bounded by `maxAttempts`.

## Optional Live Dry Run Script

```bash
npm run web-research:live-dry-run
```

This now queues one job. It processes the job only when
`RUN_LIVE_WEB_RESEARCH_TESTS=true` and all public-web live dry-run gates pass.
Otherwise it prints a redacted queued/skipped summary.

## Still Disabled

- live SMS
- candidate outreach
- organizer shortlist sends
- candidate auto-approval
- group chat creation
- public beta/public launch
- `active_live`
- `async_active`
- production Saga app integration
- private/login-gated scraping
