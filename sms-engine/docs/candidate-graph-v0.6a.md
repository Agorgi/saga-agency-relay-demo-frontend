# Candidate Graph v0.6a

## Purpose

Candidate Graph v0.6a creates the foundation for relationship-aware matching in
the standalone Saga SMS Producer app. It persists reviewable candidates,
normalizes tags and locations, indexes redacted search profiles, and computes
safe proximity tiers for candidate subsets.

This phase does not optimize final ranking and does not create outreach,
group chats, organizer-facing shortlists, public launch behavior, or production
Saga app integration.

## Graph Principles

1. Internal graph evidence is higher confidence than public-web inference.
2. Mutuals are only claimed when supported by internal relationship data.
3. Public-web candidates can have public evidence, but not true mutuals unless
   matched to an internal graph record.
4. Same community, fandom, city, or metro must be evidence-backed and
   source-backed.
5. Identified candidates are persisted as research/review candidates or linked
   to canonical internal records, but they are not approved automatically.
6. Public-web candidates remain review-gated.
7. Contactability is evidence, not permission.
8. Do-not-contact and opt-out override every matching signal.
9. No outreach, SMS, group chat, or organizer-facing shortlist happens
   automatically.

## Edge Taxonomy

`CandidateGraphEdge` is a generic evidence edge with:

- entity types for people, profiles, contacts, candidates, projects, roles,
  tags, locations, sources, and contactability evidence
- edge types including direct relationship, shared project/event,
  same fandom/community/location, source, duplicate, and do-not-contact
- strength and confidence
- source type/source id
- inferred flag
- verification timestamp

`FRIEND`, `MUTUAL`, `REFERRED_BY`, and `WORKED_TOGETHER` should come from
internal evidence only. Public-web `PUBLIC_PROFILE_MATCH` edges must be marked
inferred and lower confidence until reviewed.

## Tag Taxonomy

`src/lib/graph/tagTaxonomy.ts` normalizes aliases and computes overlap for
roles, skills, fandoms, communities, cities, formats, and event types.

Examples:

- `JJK` -> `Jujutsu Kaisen` -> anime
- `Love and Deepspace` -> otome game / anime-adjacent gaming
- `maid gigs` -> maid cafe / cosplay host / performance
- `cosplay photographer` -> photography + cosplay
- `artist alley` -> convention vendor / illustrator

Exact internal tags score higher than inferred public-web tags. Sensitive traits
must not be inferred.

## Location Normalization

`src/lib/graph/locationNormalization.ts` handles deterministic mappings for:

- Los Angeles / LA / Silver Lake
- NYC / Brooklyn / Manhattan
- Atlanta
- San Francisco / Bay Area
- remote / online

No external geocoding runs in this phase. Unknown location stays unknown.

## Candidate Persistence

`src/lib/graph/candidatePersistence.ts` persists identified candidates with
provenance. It can link to an existing `Person`, `CreatorProfile`, `Contact`,
or `CandidateRecommendation`, or create a `TalentCandidate` review record.

Candidate verification statuses:

- `DISCOVERED`
- `NEEDS_IDENTITY_REVIEW`
- `NEEDS_CONTACTABILITY_REVIEW`
- `NEEDS_QUALITY_REVIEW`
- `APPROVED_FOR_INTERNAL_REVIEW`
- `APPROVED_FOR_SHORTLIST`
- `REJECTED`
- `DUPLICATE`
- `DO_NOT_CONTACT`
- `ARCHIVED`

Public-web candidates require source URLs and remain unapproved. Duplicate
detection runs before creating canonical internal records. Public-web candidates
do not become `CreatorProfile` records automatically.

## Search Profile

`CandidateSearchProfile` is a denormalized, rebuildable index with role, skill,
fandom, community, city, metro, evidence quality, contactability score,
review status, source mode, and opt-out/do-not-contact flags.

It is designed for filtering and admin debugging. It must not contain private
notes, raw phone numbers, raw emails, secrets, or organizer-facing contact data.

## Proximity Tiers

`src/lib/graph/relationshipProximity.ts` computes proximity for candidate
shortlist subsets:

- `P0_SELF`
- `P1_DIRECT`
- `P2_MUTUAL`
- `P3_SAME_PROJECT_OR_EVENT`
- `P4_SAME_COMMUNITY_OR_FANDOM`
- `P5_SAME_CITY_OR_METRO`
- `P6_PUBLIC_WEB_ONLY`
- `P7_UNKNOWN`

`P1` and `P2` require internal relationship edges. Same fandom or city can
improve evidence but must not be labeled a mutual.

## Admin View

Open `/admin/candidate-graph` to inspect:

- candidate search profiles
- graph edges
- tag and location evidence
- source/evidence summaries
- proximity tier debug for selected internal person ids
- duplicate/contactability/review status

The page has no send, outreach, group-chat, shortlist-send, public-launch, or
env-editing controls.

## Intentionally Not Built Yet

- final ranking optimization beyond v0.6b deterministic project-specific
  relationship-aware ranking
- all-pairs graph computation
- vector search
- graph database migration
- automatic candidate approval
- production Saga app data integration
- public-web candidate organizer display
- outreach/email/DM/SMS send paths
- group chat creation
- ticketing, RSVP, QR, payment, or event publishing behavior

## Tests

Run:

```bash
npm run test:candidate-graph-foundation
npm run test:relationship-aware-matching
```

The tests use synthetic records only. They do not require Twilio, SMS, OpenAI,
live web access, direct database access, or production Saga app data.

## v0.6b Matching Layer

`docs/relationship-aware-matching-v0.6b.md` documents the project-specific
ranking layer built on this foundation. It persists match runs/results, scores
only bounded candidate pools, explains proximity without overclaiming mutuals,
uses contactability as evidence rather than permission, and keeps all candidates
inside admin review.

`docs/matching-evaluation-tuning-v0.7.md` adds synthetic golden fixtures and
evaluation reports to catch ranking regressions, mutual-label overclaims,
public-web gating mistakes, and contactability/availability explanation issues.
