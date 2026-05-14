# Relationship-Aware Matching v0.6b

## Purpose

Relationship-Aware Matching v0.6b ranks review-gated candidates for a specific
project and role. It uses the Candidate Graph v0.6a foundation, but keeps every
result inside admin review.

This phase does not send SMS, email, DMs, candidate outreach, organizer
shortlists, group chats, public launch actions, live public-web research, or
production Saga app integration.

## Matching Pipeline

1. Load or build project understanding and role map.
2. Retrieve a bounded candidate pool from `CandidateSearchProfile`.
3. Exclude opted-out, do-not-contact, rejected, duplicate, and archived records.
4. Score role fit, fandom/community affinity, location fit, relationship
   proximity, evidence quality, contactability readiness, and review trust.
5. Apply risk penalties for weak evidence, unreviewed public-web candidates,
   missing contactability, stale/ambiguous evidence, or uncertain identity.
6. Persist a `CandidateGraphMatchRun` and `CandidateGraphMatchResult` records.
7. Keep results in `SUGGESTED` or `NEEDS_REVIEW` until an admin acts.

## Scoring Rubric

Total score is capped at 100:

- role fit: 0-25
- fandom/community fit: 0-15
- location fit: 0-15
- relationship proximity: 0-15
- evidence quality: 0-10
- contactability readiness: 0-10
- review trust: 0-10

Risk penalties are subtracted:

- weak evidence: -5 to -15
- unverified public-web candidate: -5 to -20
- missing contactability: -3 to -10
- stale or ambiguous evidence: -3 to -25 depending severity
- do-not-contact or opted-out: hard block, not a penalty

Internal approved/reviewed candidates generally outrank similarly fitting
public-web candidates. A public-web candidate can rank well only when evidence
is strong, cited, reviewed, and still admin-gated.

## Proximity Tiers

- `P0_SELF`
- `P1_DIRECT`
- `P2_MUTUAL`
- `P3_SAME_PROJECT_OR_EVENT`
- `P4_SAME_COMMUNITY_OR_FANDOM`
- `P5_SAME_CITY_OR_METRO`
- `P6_PUBLIC_WEB_ONLY`
- `P7_UNKNOWN`

Only `P1_DIRECT` and `P2_MUTUAL` may use direct/mutual language. Same fandom,
community, event, project, city, or metro is affinity/shared-context evidence,
not a mutual relationship.

## Mutual Rules

Mutuals require internal graph evidence. Public-web co-mentions, shared tags,
same city, same convention, or same fandom are not enough to claim a mutual.
Public-web candidates show “no known internal relationship” unless they are
matched to internal graph records.

## Location Weighting

Role location rules are role-aware:

- venue owner and volunteer coordinator: local required
- photographer and videographer: local strongly preferred
- DJ and guest cosplayer: local/regional preferred
- illustrator, graphic designer, and content roles: remote acceptable when the
  scope supports it

No external geocoding runs in this phase.

## Fandom and Community Fit

Tag matching uses canonical tags, aliases, and parent categories. Exact internal
tags score highest. Alias and parent-category matches score lower. Public-web
inferred tags score lower than reviewed internal evidence. Sensitive traits must
not be inferred.

## Contactability Weighting

Contactability improves operational readiness but is not permission to contact.

- verified internal contact path: strongest
- public business contact form or booking link: strong after review
- public business email: medium/high after review
- social profile URL: evidence only, not DM permission
- public phone: high risk unless clearly business-facing
- no contactability: lower operational score, but not a fit rejection by itself
- opted-out or do-not-contact: hard block

## Promotion Guardrails

A match result can move forward only through admin review. Before promotion:

- candidate is not opted out
- candidate is not do-not-contact
- result is not rejected or archived
- public-web candidate is quality-review gated
- organizer-facing summary has no private notes, raw email, or raw phone
- summary does not claim availability, willingness, confirmation, booking, or
  rates unless separately reviewed and allowed later

Even approved match results do not send outreach, create group chats, or send
shortlists in v0.6b.

## Performance Strategy

The retrieval layer filters before scoring:

- default pool cap: 250 candidates
- per-role pool cap: 50 candidates
- unverified public-web cap: 25 candidates
- depth-two relationship paths only for the candidate subset

This avoids all-pairs graph computation and keeps Railway Postgres queries
simple and auditable.

## Admin UI

Open `/admin/matching` to:

- select a project brief
- run project-specific matching
- view score breakdowns
- inspect proximity and relationship-path explanations
- inspect fandom/community, location, contactability, risk, and missing evidence
- mark results suggested, needs review, approved for shortlist workflow,
  rejected, or do-not-contact

The page has no SMS, email, DM, outreach, group-chat, public-web-search,
shortlist-send, public-launch, or environment-editing controls.

## Tests

Run:

```bash
npm run test:relationship-aware-matching
```

The test uses synthetic data only and requires no Twilio, SMS, live web calls,
OpenAI, direct production app data, or production Saga integration.

## Matching Evaluation v0.7

`docs/matching-evaluation-tuning-v0.7.md` adds golden synthetic fixtures,
candidate pools, expected ranking behavior, explanation QA, and tuning
recommendations for this matcher. Evaluation reports are review-only and do not
change weights automatically, send outreach, send SMS, run live web research, or
promote candidates.
