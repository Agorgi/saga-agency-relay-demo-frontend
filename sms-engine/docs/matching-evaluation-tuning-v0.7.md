# Matching Evaluation & Tuning v0.7

## Purpose

Matching Evaluation & Tuning v0.7 verifies that relationship-aware matching
produces explainable, Saga-specific rankings across realistic synthetic project
types. It is evaluation infrastructure only.

It does not send SMS, email, DMs, outreach, organizer shortlists, group chats,
public web calls, public beta/public launch actions, or production Saga app
integration.

## Fixture Design

The evaluation suite contains 12 synthetic project fixtures:

1. Anime picnic in Los Angeles / Silver Lake.
2. Cosplay cafe night in NYC.
3. Gaming pop-up in Atlanta.
4. Maid cafe gig in LA.
5. Artist alley / fandom market in LA.
6. Anime rave in LA.
7. Cosplay photoshoot in NYC.
8. Brand/community launch party.
9. Love and Deepspace interest-check picnic.
10. Low-budget casual meetup.
11. Remote-friendly illustration/design need.
12. Edge/safety-heavy project.

Each fixture defines project understanding, role map, expected top candidate
traits, disallowed candidates, safety behavior, and scoring emphasis.

## Candidate Pool Design

The synthetic pool has 40+ fake candidates covering:

- internal approved creators
- internal pending creators
- contacts
- direct relationship candidates
- mutual relationship candidates
- same-event/fandom/city candidates
- remote-friendly candidates
- reviewed and unreviewed public-web candidates
- weak-evidence candidates
- do-not-contact, opted-out, and duplicate candidates
- contactability-present and no-contact-path candidates

The fixtures use no real names, no real phone numbers, no real emails, no public
web calls, and no production Saga data.

## Golden Expectations

Each fixture defines flexible expectations:

- expected top roles
- candidates who should rank high
- candidates who should rank low
- candidates who must be excluded
- candidates who need review
- expected proximity tiers
- location/fandom/contactability/public-web treatment
- expected warnings

The suite avoids brittle exact ordering unless behavior is safety-critical.

## Scoring Metrics

Each fixture receives a 0-100 score from:

- top-K quality
- exclusion accuracy
- role coverage
- explanation quality
- proximity-label accuracy
- public-web gating
- contactability handling
- safety compliance
- overstaffing warnings
- performance budget

Pass threshold is 80. Any safety-critical explanation failure fails the fixture.
Overall pass requires at least 10 of 12 fixtures to pass and no safety-critical
failures.

## Weight Config

`src/lib/graph/matchingWeights.ts` documents the baseline:

- role fit: 25
- fandom/community fit: 15
- location fit: 15
- relationship proximity: 15
- evidence quality: 10
- contactability readiness: 10
- review trust: 10

Role-specific overrides cover local-required roles, remote-friendly roles,
unreviewed public-web penalties, weak evidence, no contactability, direct
relationships, and mutual relationships.

Evaluation can recommend tuning, but it never auto-applies changes.

## Tuning Recommendations

`matchingTuningRecommendations.ts` inspects failures and suggests human-reviewed
adjustments, such as:

- increase or decrease location weighting
- tighten public-web penalties
- improve relationship boost calibration
- reduce overstaffing for interest checks
- increase weak-evidence penalties
- adjust remote-friendly role rules
- tune contactability weighting
- add tag aliases for missed fandom matches

## Explanation QA

The evaluator fails if explanations:

- call same fandom a mutual
- call same city a mutual
- describe public-web-only candidates as connected
- claim a candidate is available, confirmed, or booked
- treat contactability as permission
- leak private notes or raw contact details

## Performance Strategy

The suite asserts candidate pool caps and runtime sanity. It uses the existing
`CandidateSearchProfile`-style synthetic pool and does not perform all-pairs
graph computation.

## How To Run

```bash
npm run test:matching-evaluation-tuning
npm run matching:evaluation-report
```

The report writes:

```text
reports/matching-evaluation-report.md
```

## Admin UI

Open `/admin/matching-evaluation` to run all fixtures or a single fixture,
review scores, inspect failures/warnings, view the current weight config, and
read tuning recommendations.

The page has no send, outreach, group-chat, live web research, public launch,
or production app controls.

## Still Disabled

- live SMS
- public web research by default
- candidate outreach
- email, DMs, contact form submission, or phone calls
- group chat creation
- organizer shortlist sends
- `active_live`
- `async_active`
- design partner invites
- public launch
- production Saga app integration
- ticketing, RSVP, QR, payments, and event publishing
