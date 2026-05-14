# Public Web Research Shadow Mode v0.3

Public Web Research Shadow Mode lets an admin run controlled, citation-required
research for staffing roles. It is for research and review only. It does not
send SMS, contact candidates, create group chats, publish shortlists, or connect
to the production Saga app.

## Modes

- `disabled`: default. No web provider is called.
- `shadow`: admin-only planning/review mode. It can record the generated
  research request, but it does not inject the live OpenAI web-search provider.
- `live_dry_run`: v0.4 operator-only mode for one capped demo query with
  explicit gates. v0.4.1 queues live dry-run execution into an async job so the
  OpenAI web-search call runs outside the admin HTTP request path. Results
  remain research-only and require quality review.
- `admin_active`: future mode. It is treated as blocked for this release.

Default config remains:

```env
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_MAX_RESULTS=10
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=true
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES=1
```

Optional domain controls:

```env
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS=
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS=
```

## How Search Works

The admin workbench builds a role/city/fandom query plan from Project
Understanding, Role Map, Sourcing Strategy, and Public Research Plan. The
OpenAI Responses API `web_search` tool is reserved for the explicitly gated
`live_dry_run` path added in v0.4. The request requires citations and structured
candidate cards.

Allowed sources include public portfolios, public social/profile pages surfaced
through public search, personal websites, public event/vendor directories,
public convention artist/vendor pages, and public press/articles.

Disallowed sources include login-gated pages, private groups, DMs, scraped
private content, private contact databases, sensitive personal data, and
anything focused on minors.

## Candidate Cards

Public candidate cards include display name, likely role, city/region if
sourced, public profile/source URLs, role/fandom/location/portfolio evidence,
missing evidence, risk flags, confidence, and `requiresHumanReview=true`.

Availability, willingness, and rates default to unknown unless directly sourced.
Even then, they remain admin-review evidence, not confirmed facts.

## Result Handling

Shadow requests are audited but do not call a live provider. Persisted
`PublicWebResearchRun` and `PublicWebResearchResult` rows are created by the
gated v0.4 `live_dry_run` path or future admin-approved modes. Results may also
create `TalentCandidate` rows with `source=PUBLIC_WEB_RESEARCH` and
`status=NEEDS_MORE_INFO`, then enter Talent Research Quality Review.

Public-web results never enter organizer-facing shortlist packets directly.
They must pass human review and quality gates first.

## Safety Checker

The safety checker blocks or flags:

- missing citations
- private or login-gated sources
- blocked domains
- raw phone/email copied into organizer-facing fields
- unsupported availability, willingness, rate, or payment claims
- sensitive/minor risk
- missing role-fit evidence
- any candidate not marked for human review

## Admin Workflow

Use `/admin/sourcing/public-web` to select a project and role, view generated
queries, and inspect mode/config state. Use
`/admin/sourcing/public-web-review` to review citations, source quality,
duplicate matches, contactability evidence, cleanup/archive actions, and
quality-review handoff. Use `docs/public-web-research-live-dry-run-v0.4.md` for
the separate gated live dry-run procedure.

There are no send buttons, outreach buttons, group-chat buttons, public launch
buttons, or production app integration controls.

## Still Disabled

- live SMS
- candidate outreach
- organizer shortlist sends
- group chat creation
- public beta/public launch
- active-live LLM
- async-active message processing
- private-source scraping
- production Saga app integration
