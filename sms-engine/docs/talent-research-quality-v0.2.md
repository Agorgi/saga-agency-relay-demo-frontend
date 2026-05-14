# Talent Research Quality Review v0.2

## Purpose

Talent Research Quality Review evaluates candidate recommendations before they
can be promoted into shortlist or outreach workflows. It applies to internal
Saga standalone records and future public-web research candidates.

This layer is review infrastructure only. It does not send SMS, contact
candidates, create group chats, scrape private sources, enable public web
research, or connect to the main Saga production app.

## Quality Rubric

Scores total 100 points:

| Category | Points | Meaning |
| --- | ---: | --- |
| evidenceQuality | 20 | Strength and specificity of candidate evidence |
| identityConfidence | 15 | Whether the candidate identity is clear |
| roleFitEvidence | 20 | Evidence that the candidate can fill the role |
| fandomCommunityFitEvidence | 15 | Evidence of scene/community fit |
| locationProximityEvidence | 10 | Location or proximity evidence |
| sourceReliability | 10 | Reliability of sources used |
| actionability | 10 | Whether the candidate can safely move forward |

Review bands:

| Score | Band |
| ---: | --- |
| 85-100 | STRONG_FIT |
| 70-84 | LIKELY_FIT |
| 50-69 | NEEDS_MORE_RESEARCH |
| 30-49 | WEAK_FIT |
| 0-29 | REJECT_RECOMMENDATION |

## Source Reliability

Source types:

- INTERNAL_CREATOR_PROFILE
- INTERNAL_CONTACT
- INTERNAL_RELATIONSHIP_EDGE
- USER_PROVIDED_PORTFOLIO
- PUBLIC_PERSONAL_WEBSITE
- PUBLIC_SOCIAL_PROFILE
- PUBLIC_EVENT_PAGE
- PUBLIC_VENDOR_DIRECTORY
- PUBLIC_CONVENTION_DIRECTORY
- PUBLIC_PRESS_OR_ARTICLE
- PUBLIC_MARKETPLACE_PROFILE
- ADMIN_ADDED
- UNKNOWN

Reliability levels:

- HIGH: approved internal profiles, strong internal relationships, or strong public personal sites with role evidence.
- MEDIUM: user-provided portfolios, public directories, or corroborated public profiles.
- LOW: single social profiles, incomplete admin-added records, or weak public evidence.
- UNKNOWN: no reliable source signal.

Private or login-gated sources are disallowed.

## Evidence Checklist

Each review computes:

- hasDisplayName
- hasRoleEvidence
- hasPortfolioOrPublicProfile
- hasLocationEvidence
- hasFandomCommunityEvidence
- hasSourceUrls
- hasRecentActivityEvidence
- hasInternalRelationshipEvidence
- hasReviewStatus
- hasAvailabilityEvidence
- hasDoNotContactFlag
- hasOptOutFlag
- hasPrivateNotesLeakRisk
- hasRawContactInfoLeakRisk
- hasUnsupportedClaims

Public-web candidates require source URLs, role-fit evidence, identity/source
evidence, and human review. Missing availability is recorded as unknown, not
assumed.

Public Web Research Shadow Mode v0.3, Live Dry Run v0.4, and Async Dry Run
v0.4.1 send persisted research results into this quality gate as
`source=PUBLIC_WEB_RESEARCH` candidates with `status=NEEDS_MORE_INFO`. A
public-web result remains research-only until an admin reviews citations, source
reliability, missing evidence, unsupported claims, and organizer-safe summary
text.

Public Web Research Review & Cleanup v0.5 adds lifecycle cleanup, source
quality, duplicate detection, and contactability evidence before public-web
results can advance. Contactability is reviewed for future outreach readiness
only; it is not permission and does not enable email, SMS, DMs, or group chats.

Candidate Graph v0.6a feeds this review layer with persisted research
candidates, search profiles, graph evidence, and proximity tiers. Public-web
graph evidence can explain public source fit, same city, or same fandom, but it
must not claim a mutual relationship unless internal relationship edges support
that claim.

The live dry-run provider feeds this gate through a two-step Responses flow:
`web_search` produces cited research and source URLs, then structured extraction
turns those citations into candidate cards. If extraction fails, the result
stays failed/review-only and no candidate can bypass this quality gate.

## Review Statuses

- UNREVIEWED
- APPROVED_FOR_SHORTLIST
- NEEDS_MORE_RESEARCH
- REJECTED
- DO_NOT_CONTACT
- NEEDS_ADMIN

DO_NOT_CONTACT blocks shortlist promotion and outreach draft generation.
Rejected and needs-more-research candidates cannot appear in organizer-facing
shortlist packets.

## LLM Assistance

LLM assistance is optional and gated. The deterministic review is primary.

Allowed LLM assistance:

- Summarize evidence.
- Detect unsupported claims.
- Detect missing sources.
- Rewrite organizer-safe summaries.
- Classify source reliability.
- Explain fit.

The LLM must not decide final approval, contact permission, outreach sends,
shortlist sends, or group-chat inclusion. `active_live` remains disabled.
Invalid LLM output falls back to deterministic review.

## Admin Workflow

`/admin/sourcing-quality` shows candidates awaiting review and recent quality
reviews. Admins can:

- run deterministic quality review,
- inspect score breakdowns,
- inspect evidence checklists,
- inspect source URLs/citations,
- mark candidates approved, needs more research, rejected, do not contact, or needs admin,
- edit organizer-safe summaries,
- add reviewer notes.

The UI has no send buttons, no outreach buttons, no group-chat buttons, and no
public-web scrape controls. The public-web shadow workbench lives at
`/admin/sourcing/public-web` and can only create review candidates when shadow
mode is explicitly configured.

## Workflow Integration

Shortlist approval now checks talent quality gates:

- public-web candidates require APPROVED_FOR_SHORTLIST quality review,
- DO_NOT_CONTACT / REJECTED / NEEDS_MORE_RESEARCH / NEEDS_ADMIN block promotion,
- organizer shortlist packets use organizer-safe summaries when present,
- private review notes never appear in organizer-facing text,
- candidate outreach drafts stay blocked when quality review is not approved.

## Public-Web Candidate Rules

Invalid or blocked:

- no source URL,
- private/login-gated source,
- ambiguous identity,
- no role-fit evidence,
- unsupported availability, willingness, rate, or payment claims,
- raw contact info copied without review,
- do-not-contact or opt-out match.

Needs more research:

- plausible role fit but weak source evidence,
- unclear location,
- unclear fandom/community fit,
- stale profile,
- identity match uncertain.

Approved for shortlist only after:

- citations/source URLs are present,
- identity confidence is high,
- role-fit evidence is present,
- sensitive/privacy flags are absent,
- organizer-facing summary is safe,
- admin has reviewed.

## Disabled

- Live SMS.
- Candidate outreach sends.
- Organizer shortlist sends.
- Group chat automation.
- Public-web research by default.
- Private or login-gated scraping.
- Production Saga app integration.
- Ticketing, RSVP, QR, payments, and event publishing.

## Relationship-Aware Matching v0.6b

Project-specific matching consumes quality-review and source reliability signals
as review trust and evidence quality. Public-web candidates remain lower
confidence unless citation-backed and reviewed. A matching score is not final
approval: rejected, do-not-contact, opted-out, needs-more-research, and
unreviewed public-web candidates cannot bypass quality review, shortlist
approval, contactability review, or future outreach gates.

Matching Evaluation v0.7 includes public-web and weak-evidence fixtures to
verify those quality gates remain reflected in project-specific rankings.
