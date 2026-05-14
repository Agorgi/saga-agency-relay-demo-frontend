# Public Web Research Live Dry Run v0.4

Public Web Research Live Dry Run lets an admin run exactly one capped, citation-required public-web research query against a safe demo staffing scenario. It is for operator verification only. Results are review-only candidate cards and must not contact anyone, send SMS, create group chats, publish shortlists, or connect to the production Saga app.

## Required Gates

All gates must pass before the OpenAI `web_search` provider is constructed:

- `PUBLIC_WEB_RESEARCH_ENABLED=true`
- `PUBLIC_WEB_RESEARCH_MODE=live_dry_run`
- `PUBLIC_WEB_RESEARCH_PROVIDER=openai_web_search`
- `PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=true`
- `PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=true`
- `OPENAI_API_KEY` is present
- `LLM_PROVIDER=openai`
- `SMS_SENDS_DISABLED=true`
- active-live LLM remains disabled
- admin action explicitly triggers the run
- the request uses the safe demo fixture and does not exceed `PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES`

Defaults keep this off:

```env
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=true
PUBLIC_WEB_RESEARCH_MAX_RESULTS=5
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES=1
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG=live_dry_run
RUN_LIVE_WEB_RESEARCH_TESTS=false
```

## Demo Query

The only built-in live dry-run fixture is:

- Project: Anime picnic in Los Angeles / Silver Lake
- Role target: cosplay or anime event photographer
- Query: `Los Angeles anime cosplay event photographer portfolio`

Do not use real project, person, participant, organizer, or production Saga app data for this dry run.

## Admin Flow

Open `/admin/sourcing/public-web`. The page shows the live dry-run gates, blockers, safe demo query, recent run count, job status, and pending review count. The action is disabled unless all gates pass.

As of v0.4.1, the admin action queues a `PublicWebResearchJob` and returns immediately. The OpenAI `web_search` call must run from the CLI/worker path so Railway HTTP proxy timeouts do not discard the request before persistence. Candidate cards remain `SHADOW_RESULT` or `NEEDS_REVIEW`, require human review, and may be sent to Talent Research Quality Review. They are not organizer-facing and are not eligible for automatic shortlist or outreach.

The OpenAI provider uses a two-step request shape. Step 1 runs Responses
`web_search` without structured output and captures citations/source URLs. Step
2 runs a no-tool structured extraction pass over the cited summary. This
replaced the original one-call schema, which failed in live dry run with
`invalid_schema:400`.

## CLI

The CI-safe regression test uses a mocked provider:

```bash
npm run test:public-web-research-live-dry-run
npm run test:public-web-research-provider-schema
```

The optional live dry-run script skips unless every live gate is explicitly configured:

```bash
npm run web-research:live-dry-run
```

Process queued jobs from Railway SSH:

```bash
JOB_PROCESS_LIMIT=1 npm run jobs:process-public-web-research-once
```

Expected output is a redacted summary with run id, result count, citation count, blockers, warnings, and explicit `noSmsSent`, `noOutreachSent`, and `noGroupChatCreated` flags. It does not print source URLs, prompts, raw model output, secrets, or phone numbers.

## Storage Rules

- Store citation-backed candidate fields only.
- Do not store raw search output unless `PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=true`.
- Do not store raw phone/email from public results.
- Availability, willingness, and rates default to unknown.
- Every public-web candidate remains `requiresHumanReview=true`.
- Use `/admin/sourcing/public-web-review` after a dry run to inspect source
  quality, duplicate matches, contactability evidence, cleanup/archive status,
  and Talent Research Quality Review handoff.
- Contactability evidence is not permission to contact anyone and does not
  enable email, SMS, social DMs, booking-form submission, or outreach drafts.

## Still Disabled

- live SMS
- candidate outreach
- organizer shortlist sends
- group chat creation
- public beta/public launch
- active-live LLM
- async-active message processing
- private or login-gated scraping
- production Saga app integration
