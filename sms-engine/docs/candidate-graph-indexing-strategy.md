# Candidate Graph Indexing Strategy

## Why Not All-Pairs Mutual Computation

The standalone pilot does not need all-pairs mutual computation. It would be
expensive, stale quickly, and could tempt the system to overstate weak evidence.
The safer approach is to filter candidates first, then compute relationship
proximity only for the candidate subset being reviewed.

## Adjacency-List Strategy

`CandidateGraphEdge` is an adjacency-list table. Edges are indexed by:

- `fromEntityType/fromEntityId`
- `toEntityType/toEntityId`
- `edgeType`
- `sourceType/sourceId`
- `isInferred`
- `createdAt`

This supports direct and two-hop lookups without scanning the full graph.

## Filtering Before Proximity Scoring

The matching flow should:

1. Filter by role/skill tags.
2. Filter or boost by location.
3. Filter out opted-out and do-not-contact records.
4. Require review gates for public-web candidates.
5. Compute proximity for the remaining small candidate set.
6. Explain whether proximity is internal relationship evidence, shared context,
   same fandom/community, same location, or public-web only.

v0.6b implements this as `retrieveCandidatePoolForProject` plus
`rankCandidatesForProject`. The default candidate pool cap is 250, per-role cap
is 50, and unverified public-web cap is 25. Relationship path checks run only
after this bounded retrieval step.

## Indexes Needed

`CandidateSearchProfile` indexes:

- person/profile/contact/talent candidate ids
- review status
- source mode
- city/metro
- do-not-contact
- opted-out
- last indexed time

`CandidateGraphEdge` indexes graph traversal and evidence provenance fields.

`CandidateGraphMatchRun` and `CandidateGraphMatchResult` are indexed by project,
role, status, proximity tier, source mode, review status, score, and creation
time so admins can inspect recent ranking runs without exposing candidate
contact data in health endpoints.

## When To Consider a Graph DB

Consider a graph database only if:

- candidate counts grow far beyond pilot scale,
- multi-hop paths beyond depth two become product-critical,
- relationship edge writes become high-volume,
- graph traversal dominates latency after filtering,
- the relational adjacency-list approach becomes hard to operate.

Until then, Postgres is simpler, auditable, and consistent with the standalone
pilot database.

## When To Consider Vector Search

Consider vector search only for evidence retrieval and semantic candidate
discovery after:

- citation/source review is stable,
- public-web candidates are consistently deduped,
- quality review has enough examples,
- privacy and retention rules are reviewed,
- deterministic role/location/fandom filters remain the first pass.

Vector similarity must not override do-not-contact, opt-out, source quality, or
human review gates.

## Avoiding Over-Inference

- Do not call someone a mutual unless internal relationship edges support it.
- Do not infer friendship from public co-mentions.
- Do not infer availability, willingness, rates, identity, or sensitive traits.
- Same fandom/city/community is evidence, not a relationship claim.
- Public-web profile matches remain lower confidence until admin reviewed.

## Data Freshness

Search profiles are rebuildable projections. They should be refreshed when:

- candidate review status changes,
- public-web result review changes,
- contactability review changes,
- do-not-contact or opt-out status changes,
- graph edges are added or corrected,
- location/tag evidence changes.

## Source Confidence

Internal approved creator profiles and internal relationship edges should carry
higher confidence than public-web inference. Public sources require citations,
source quality scoring, duplicate review, and Talent Research Quality Review
before any organizer-facing use.

## Performance Assumptions

v0.6a assumes pilot-scale data in Railway Postgres. The expected path is cheap:
index-backed filtering, small candidate subsets, and depth-two relationship
path checks. `/api/health` only reports counts and never source URLs, queries,
raw contact values, private notes, or secrets.

v0.6b keeps the same assumption: rank a filtered subset, not the full database,
and never run live public-web research, outreach, SMS, or production app access
from matching.

v0.7 evaluates the same assumptions with synthetic fixtures. The evaluation
suite checks pool caps, per-role behavior, explanation quality, public-web
gating, and the absence of all-pairs computation.
