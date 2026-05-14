# Talent Discovery & Research Engine v0.1

Talent Discovery helps the standalone Saga SMS Producer app find reviewable
candidate options for a creative project without contacting anyone. It searches
Saga's standalone pilot database first, creates a sourcing strategy, creates a
public-web research plan when internal coverage is weak, and routes candidate
cards into admin review.

This version does not send SMS, publish shortlists, create group chats, scrape
private sources, invite users, or connect to the production Saga app.

## Internal Search First

The engine starts with internal standalone data:

- `Person`
- `CreatorProfile`
- `Contact`
- `RelationshipEdge`
- existing `CandidateRecommendation` and opportunity context where useful
- demo or pilot talent data in the standalone database

Internal search excludes opted-out and do-not-contact people. It also avoids
organizer-facing private notes and raw contact details. Candidate output is
review-only and includes why someone may fit, what evidence exists, what is
missing, and what risks require admin judgment.

## Sourcing Strategy

`generateSourcingStrategy()` converts project understanding and a role map into:

- target roles
- internal-search priorities
- proximity strategy
- fandom/community-fit strategy
- per-role evidence requirements
- suggested public research queries
- risk notes
- `humanReviewRequired=true`

The strategy recommends public research only when internal coverage is thin or
weakly evidenced. It does not assume availability, rates, willingness, paid work,
or confirmed placement.

## Public Research Plan

`generatePublicResearchPlan()` is a plan, not a crawler. It lists acceptable
sources, disallowed sources, source citation requirements, and candidate
evidence checklists.

Acceptable sources are public portfolio/profile pages, personal websites, public
event/vendor directories, convention artist/vendor pages, and public profile
pages discoverable through public search.

Disallowed sources include private or login-gated content, DMs, private groups,
personal sensitive data, and data that requires an account login.

## Public Web Research Modes

Public web research defaults to disabled.

```bash
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_MAX_RESULTS=5
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=true
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES=1
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS=
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS=
```

Modes:

- `disabled`: no web calls. The admin sees research queries only.
- `shadow`: admin planning/review mode. It does not inject the live OpenAI
  web-search provider.
- `live_dry_run`: one safe, capped, admin-triggered demo query. v0.4 can
  persist review-only public-web results for quality review; they are not
  approved candidates and cannot enter organizer-facing shortlists directly.
- `admin_active`: future admin-only mode. It still requires citations and human
  review, and still cannot contact candidates.

OpenAI web search in `live_dry_run` must use public sources only and require
source URLs/citations. Provider execution now uses two steps: cited web-search
summary first, then no-tool structured candidate-card extraction. The split was
added after a live dry run exposed `invalid_schema:400` from combining web
search and the full candidate-card schema in one request.

Public Web Research Shadow Mode v0.3 adds DB-backed
`PublicWebResearchRun` / `PublicWebResearchResult` records, an OpenAI Responses
API `web_search` wrapper, a query builder, and a safety checker. It remains
disabled by default and never runs from live Twilio inbound.

Public Web Research Review & Cleanup v0.5 adds citation normalization, source
quality scoring, duplicate detection, contactability evidence, cleanup/archive,
and promotion guards for public-web results. Contactability is collected for
future outreach readiness only and does not authorize outreach.

Candidate Graph v0.6a adds review-gated candidate persistence, candidate search
profiles, graph edges, tag/location normalization, and relationship proximity
tiers. Internal graph evidence outranks public-web inference, and public-web
candidates remain review-only until citations, source quality, duplicates,
contactability, and talent quality are reviewed.

## Candidate Card Schema

Public-web candidates must include:

- display name
- likely role
- city or service-area clue if available
- public profile and portfolio evidence
- role, fandom, and location evidence
- why they may fit
- risks and missing info
- confidence
- source URLs
- source summary
- `requiresHumanReview=true`

No candidate card may claim availability, willingness, confirmed rates, bookings,
team placement, venue access, or paid work unless directly verified later by a
human process. Public candidates default to `NEEDS_MORE_INFO`.

Public-web candidates that are persisted into the graph keep their public source
URLs as provenance and verification evidence, but they are not canonical
`CreatorProfile` records and are not approved automatically.

## Scoring Rubric

Candidates are scored out of 100:

| Category | Points |
| --- | ---: |
| Role fit | 25 |
| Fandom/community fit | 20 |
| Location fit | 15 |
| Evidence quality | 15 |
| Proximity/internal relationship | 15 |
| Availability/review status | 10 |

Internal approved profiles should generally outrank similarly qualified unknown
public candidates. Public-web candidates get low proximity unless matched to an
existing internal record.

## Admin Sourcing Workbench

`/admin/sourcing` lets an operator:

- select a project brief
- view project understanding and role map
- run internal talent search
- view candidates by score and role
- generate sourcing strategy
- generate a public research plan
- see whether public web research is disabled, shadow, or admin-active
- approve, reject, mark needs-more-info, or mark do-not-contact

The workbench has no outreach button, send button, group-chat button, public
scraping bypass, or production app integration.

`/admin/sourcing-quality` adds the v0.2 quality gate. It scores evidence,
classifies source reliability, checks unsupported claims, and records an
organizer-safe summary before candidates can flow into shortlist or outreach
workflows. Public-web candidates require quality review before promotion.

`/admin/sourcing/public-web` shows generated shadow research queries, the gated
live dry-run demo query, current public-web mode, citations, research results,
risk flags, and actions to reject, discard, or send a result to quality review.
It has no outreach, SMS, group chat, or shortlist-send control.

## Audit Events

Talent Discovery writes or reserves these audit events:

- `sourcing.internal_search_run_created`
- `sourcing.internal_search_completed`
- `sourcing.strategy_generated`
- `sourcing.public_research_plan_generated`
- `sourcing.public_web_research_skipped`
- `sourcing.public_web_research_started`
- `sourcing.public_web_research_completed`
- `public_web_research.plan_generated`
- `public_web_research.run_started`
- `public_web_research.run_completed`
- `public_web_research.run_failed`
- `public_web_research.result_created`
- `public_web_research.result_rejected`
- `public_web_research.result_discarded`
- `public_web_research.result_sent_to_quality_review`
- `public_web_research.disabled_mode_blocked`
- `public_web_research.safety_blocked`
- `sourcing.candidate_card_created`
- `sourcing.candidate_scored`
- `sourcing.candidate_approved`
- `sourcing.candidate_rejected`
- `sourcing.candidate_marked_needs_more_info`
- `sourcing.candidate_marked_do_not_contact`

Audit metadata must not include raw phone numbers, secrets, private notes, raw
prompts, or unredacted contact details.

## What Is Disabled

- No live SMS.
- No candidate outreach.
- No organizer shortlist send.
- No group chat creation.
- No active public web research by default.
- No private or login-gated scraping.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, RSVP, QR, payment, or production
  Saga permission behavior.

## Tests

Run:

```bash
npm run test:talent-discovery
npm run test:talent-research-quality
```

The test uses synthetic candidates and synthetic public candidate cards only. It
does not require Twilio, OpenAI, web access, direct database access, SMS, or
production Saga app data.

## Relationship-Aware Matching v0.6b

Talent Discovery feeds Candidate Graph search profiles that v0.6b can rank for
a specific project/role. The matcher uses bounded retrieval, internal-first
source trust, relationship proximity, location/fandom fit, evidence quality,
contactability readiness, and review status. It never contacts candidates,
sends SMS, creates group chats, runs live public-web research, or sends
organizer-facing shortlists.

Matching Evaluation v0.7 uses synthetic Talent Discovery-style candidates to
measure whether internal reviewed candidates, reviewed public-web candidates,
weak evidence, opt-outs, do-not-contact records, and contactability signals are
handled correctly.
