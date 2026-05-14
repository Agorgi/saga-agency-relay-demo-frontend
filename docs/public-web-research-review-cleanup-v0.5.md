# Public Web Research Review & Cleanup v0.5

Public Web Research Review & Cleanup adds the human-review layer after shadow,
live dry-run, and async dry-run research. It turns public-web results into
reviewable evidence objects that can be discarded, archived, deduped, or sent to
Talent Research Quality Review. It does not authorize outreach.

## Result Lifecycle

`PublicWebResearchResult` can use:

- `SHADOW_RESULT`
- `NEEDS_REVIEW`
- `IN_QUALITY_REVIEW`
- `APPROVED_FOR_INTERNAL_REVIEW`
- `REJECTED`
- `DISCARDED`
- `ARCHIVED`
- `DUPLICATE`
- `DO_NOT_CONTACT`

`SHADOW_RESULT`, `NEEDS_REVIEW`, and `IN_QUALITY_REVIEW` cannot enter organizer
shortlists. `REJECTED`, `DISCARDED`, `ARCHIVED`, `DUPLICATE`, and
`DO_NOT_CONTACT` cannot be promoted. `DO_NOT_CONTACT` also blocks any future
outreach draft.

## Citation and Source Normalization

`sourceNormalization.ts` normalizes URLs, strips tracking parameters, classifies
source types, detects private/login-gated URLs, enforces blocked domains, and
validates citation sets. Source URLs are required for public-web candidates.
Source URLs may be shown in the admin review UI, but not in `/api/health`.

## Source Quality

`sourceQuality.ts` scores:

- source reliability
- citation completeness
- identity clarity
- role evidence strength
- recency evidence
- privacy safety

Bands:

- `HIGH_CONFIDENCE_SOURCE`
- `MEDIUM_CONFIDENCE_SOURCE`
- `LOW_CONFIDENCE_SOURCE`
- `INSUFFICIENT_SOURCE`
- `BLOCKED_SOURCE`

Weak or blocked sources route to more research, rejection, or discard.

## Duplicate Detection

`publicWebDeduplication.ts` compares normalized names, canonical profile URLs,
portfolio/source URLs, city, role, and internal approved profiles. It can
recommend linking to an internal profile or marking a public result duplicate,
but it never auto-merges or auto-approves.

## Contactability Evidence

Public-web review now records contactability evidence for future outreach
readiness. Contactability is not permission.

Evidence can include:

- internal contact
- public business email
- public contact form
- public website
- Instagram/TikTok/YouTube/LinkedIn profile URL
- booking link
- agency/manager contact
- public business phone

Every method requires human review. Social profiles are stored as possible
profile channels, not permission to DM. Public phone numbers are high-risk by
default. Organizer-facing outputs must not include raw contact details.

## Cleanup and Archive

`publicWebResearchCleanup.ts` supports:

- result review/status changes
- archive research run
- mark duplicate
- mark do-not-contact
- archive test-tagged results
- no hard delete by default

Audit logs are preserved. Internal candidates are not deleted by cleanup.

## Promotion Guard

A public-web result can move forward only when:

- status is `APPROVED_FOR_INTERNAL_REVIEW`
- citations pass validation
- source quality is not insufficient/blocked
- duplicate review is completed
- privacy safety passed
- Talent Research Quality Review passed or is explicitly required next
- contactability review exists for future outreach readiness
- admin action occurred

Even then, v0.5 does not send outreach, create a group chat, send SMS, or show a
candidate to an organizer.

Candidate Graph v0.6a adds a second guardrail after review: public-web results
can be persisted as `TalentCandidate` research records and indexed into
`CandidateSearchProfile`, but they keep `PUBLIC_WEB_RESEARCH` source mode and a
review status such as `NEEDS_CONTACTABILITY_REVIEW` or
`NEEDS_QUALITY_REVIEW`. They do not become canonical `CreatorProfile` records,
approved shortlist candidates, or outreach targets automatically.

Candidate Graph v0.6b can rank reviewed public-web candidates against a specific
project/role, but public-web-only candidates keep lower relationship proximity
unless linked to internal graph evidence. They remain admin-review candidates,
not organizer-facing shortlist entries or outreach targets.

Matching Evaluation v0.7 verifies reviewed public-web candidates can rank when
evidence is strong, while unreviewed or ambiguous public-web candidates are held
back and never described as internally connected.

## Admin Workflow

Use `/admin/sourcing/public-web-review` to:

- review runs and async jobs
- inspect citations
- see source quality and duplicate status
- review contactability evidence
- send to quality review
- mark needs more research, needs more contact research, duplicate,
  do-not-contact, rejected, discarded, or archived
- archive test-tagged live dry-run results

No send buttons, DM buttons, group-chat controls, shortlist sends, public launch
buttons, or unrestricted live search controls exist on this page.

## Still Disabled

- live SMS
- candidate outreach
- group chats
- organizer shortlist sends
- public beta/public launch
- `active_live`
- `async_active`
- production Saga app integration
- private/login-gated scraping
