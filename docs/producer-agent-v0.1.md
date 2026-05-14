# Producer Agent v0.1

Producer Agent v0.1 is the standalone app's internal intelligence layer for
turning a structured project brief into reviewable production planning artifacts.
It does not send SMS, contact candidates, publish events, scrape the web, create
group chats, or connect to the production Saga app.

LLM Provider Integration v0.1 is documented in
`docs/llm-provider-integration.md`. Producer Agent helpers can use the provider
wrapper for structured extraction or wording when configured, but deterministic
fallback remains the default and backend approval gates remain authoritative.

## Pipeline

1. Project understanding
   - Reads a `ProjectBrief`, linked `Project`, recent messages, and organizer
     context.
   - Produces title, project type, city, fandom/community signals, format,
     timing, budget, audience, help needed, risk flags, missing info, confidence,
     and audit explanation.
   - Unknown fields remain null or listed as missing. The fallback path works
     without `OPENAI_API_KEY`.

2. Role map
   - Converts the understanding into required and optional roles.
   - Common roles include venue, photographer, videographer, DJ, host, guest
     cosplayer, illustrator, graphic designer, volunteer coordinator, vendor
     coordinator, production assistant, sponsor/brand partner, and social/content
     creator.
   - Small projects stay lean. Larger projects get more operations coverage.
   - No role implies paid work, availability, or a confirmed person.

3. Sourcing plan
   - Defines the internal search order:
     friends/direct connections, mutuals, same community, prior attendees or
     collaborators, local approved creator profiles, broader internal contacts,
     then open web research later.
   - Open-web research is represented only as a future step. The app does not
     scrape or call external sites.

4. Internal candidate recommendations
   - Uses internal `Person`, `CreatorProfile`, `Contact`, `RelationshipEdge`,
     `RoleOpening`, `Opportunity`, and `CandidateRecommendation` data.
   - Excludes opted-out people and rejected profiles.
   - Scores role fit, fandom fit, location fit, proximity, and reliability/review
   status.
   - Persists recommendations against canonical opportunities for admin review.
   - Private notes, raw phone numbers, and raw emails are not included in
     organizer-facing outputs.
   - Talent Discovery & Research Engine v0.1 expands this into
     `TalentSearchRun` and `TalentCandidate` records with sourcing strategy,
     public-research plans, score breakdowns, evidence, risks, and missing-info
     fields. See `docs/talent-discovery-engine-v0.1.md`.

5. Shortlist draft
   - Produces an organizer-facing draft summary, role coverage, candidate
     summaries, and a recommended next message to the organizer.
   - Always sets `adminReviewRequired=true`.
   - Does not send the shortlist and does not imply availability, booking,
     payment, rates, attendance, ticket sales, venue access, celebrity/influencer
     participation, or confirmed team placement.

## Admin Approval Gates

Project detail includes draft-only Producer Agent actions:

- Generate Project Understanding
- Generate Role Map
- Generate Sourcing Plan
- Generate Internal Candidate Recommendations
- Generate Shortlist Draft

These actions write audit events and internal database records where appropriate.
They do not send SMS or trigger outreach. The shortlist draft is an admin review
input, not an organizer message. Producer Agent v0.2 adds the durable candidate
review and shortlist packet approval queue documented in
`docs/producer-agent-v0.2.md`; Producer Agent v0.3 adds review-only outbound
drafts documented in `docs/producer-agent-v0.3.md`.

## Audit Events

- `producer.project_understanding_generated`
- `producer.role_map_generated`
- `producer.sourcing_plan_generated`
- `producer.internal_candidates_recommended`
- `producer.shortlist_draft_generated`

Producer Agent v0.2 adds candidate review and shortlist packet events; Producer
Agent v0.3 adds outbound draft queue events. See
`docs/producer-agent-v0.2.md` and `docs/producer-agent-v0.3.md`.

Audit metadata includes counts, confidence, review state, and safe summaries. It
must not include secrets, raw phone numbers, raw emails, or private/internal
notes.

## Relationship To Conversation Engine v0.1

Conversation Engine v0.1 structures inbound conversation state and produces
ReplyPlans. Producer Agent v0.1 starts after an organizer-style brief exists and
creates internal planning artifacts. Conversation Engine gathers and clarifies;
Producer Agent maps and drafts.

## What It Does Not Do

- No live SMS enablement.
- No autonomous candidate outreach.
- No autonomous shortlist sending.
- No group chat creation.
- No public web scraping.
- No active public web research by default; public-research plans are
  citation-required admin inputs under `docs/public-web-research-policy.md`.
  Public Web Research Shadow Mode v0.3 and Live Dry Run v0.4 can create
  research-only candidates for quality review from `/admin/sourcing/public-web`,
  but they cannot approve, contact, shortlist, or invite anyone.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, QR, RSVP, payment, or production
  Saga permission behavior.
- No production data dependency.

## Tests

Run:

```bash
npm run test:producer-agent
```

The test uses deterministic fixtures only. It verifies extraction, role mapping,
internal sourcing priority, opted-out candidate exclusion, safe shortlist copy,
interest-check/gig-seeker non-conversion, and fallback behavior without OpenAI,
Twilio, real SMS, public web calls, or production Saga data.

Producer Agent v0.1 is also exercised in design-partner transcript dry runs
when organizer scenarios become brief-ready. That dry-run integration generates
project understanding, role maps, sourcing plans, and shortlist drafts for
review only; it does not send shortlists, contact candidates, create group
chats, or use production data.

Candidate Graph v0.6b uses Producer Agent project understanding and role maps
as matching inputs. The matching run persists review-only ranked candidates with
score explanations; it does not send outreach, create group chats, publish
shortlists, run live public-web research, or connect to the production Saga app.
