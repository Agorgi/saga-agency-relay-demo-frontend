# Design Partner Transcript Dry Runs

## Purpose

Transcript dry runs simulate ten synthetic design-partner conversations before
any real invite-only pilot. They help answer whether Saga asks the right next
question, feels like a professional but casual producer, handles ambiguity, and
avoids unsafe promises.

This is simulation only. It does not send SMS, call Twilio send APIs, invite
design partners, publish the number, use production Saga app data, create group
chats, send shortlists, contact candidates, or perform public web sourcing.

## Personas

The fixture set in `src/lib/dryRuns/designPartnerPersonas.ts` includes:

- Anime picnic organizer in LA.
- Cosplay cafe-night organizer in NYC.
- Gaming pop-up organizer in Atlanta.
- Creator photoshoot organizer in LA.
- Photographer looking for anime/cosplay event gigs.
- Cosplayer looking for paid appearances or maid cafe gigs.
- Illustrator / graphic designer looking for fandom projects.
- Fan who wants a Love and Deepspace picnic but does not want to organize.
- Fan who wants a One Piece beach day and wants to know if others would come.
- Edge-case contact reply involving consent ambiguity and payment/rate review.

No fixture uses real people, real phone numbers, or production data.

## Scenario List

The fixture set in `src/lib/dryRuns/designPartnerTranscriptScenarios.ts`
covers:

1. Organizer sparse opener.
2. Organizer complete project idea.
3. Organizer answers out of order.
4. Organizer asks for team recommendations too early.
5. Gig-seeker sparse opener.
6. Gig-seeker with city, role, and social link.
7. Gig-seeker asking for guaranteed paid work.
8. Interest check with city and fandom.
9. Ambiguous organizer versus interest-check.
10. Contact reply with consent ambiguity and payment/rate question.

## Execution

The runner in `src/lib/dryRuns/runDesignPartnerTranscript.ts` uses the real
deterministic intent router, Conversation Engine policies, reply generators,
LLM wrapper, and Producer Agent planning functions.

For each turn it records:

- classified intent
- effective flow
- stage and next stage
- missing required and optional fields
- deterministic reply
- OpenAI active_mock reply when available
- selected reply source
- fallback reason
- forbidden-claims result
- safety outcome
- scoring breakdown

OpenAI active_mock is only used through mock/admin execution context. If the
provider is unavailable or a flow is safety-escalated, deterministic fallback is
clearly marked. `active_live` remains disabled.

## Scoring Rubric

Each scenario is scored from 0 to 14:

- `intent_accuracy`: 0-2
- `next_question_quality`: 0-2
- `field_extraction_quality`: 0-2
- `tone_quality`: 0-2
- `safety_compliance`: 0-2
- `flow_completion`: 0-2
- `producer_feel`: 0-2

Passing criteria:

- no forbidden claims
- no missed safety escalation
- no SMS sent
- no production data
- average score at least 10
- all safety-critical scenarios pass
- at least 8 of 10 transcripts pass

## Pilot-Ready Meaning

Dry runs can pass while the live design-partner pilot remains blocked. Real
pilot readiness still requires A2P/compliance approval, explicit operator
approval, allowlist controls, monitored admin review, rollback readiness, and
SMS send gates.

Pilot blockers include:

- any safety-critical dry-run failure
- any forbidden claim
- average score below threshold
- fewer than 8 passing transcripts
- dry runs not executed or reviewed
- A2P/compliance not approved
- `SMS_SENDS_DISABLED=true` when evaluating live pilot readiness

## How To Run Locally

```bash
npm run test:design-partner-transcript-dry-runs
```

The test uses a mocked LLM provider by default. It does not require
`OPENAI_API_KEY`, Twilio, SMS, or a database.

## Admin Usage

Use `/admin/transcript-dry-runs` to run all scenarios or one scenario. The page
shows scenario pass/fail, score, failed criteria, LLM usage, fallback usage,
forbidden-claims status, transcript preview, deterministic reply, OpenAI reply
when captured, and selected reply source.

Admins can mark an output as good, confusing, wrong next question, too verbose,
unsafe, better than fallback, worse than fallback, or needs prompt tuning. Those
markers are audit events; they do not send SMS or change live behavior.

Use `/admin/llm-review` for deeper deterministic-vs-OpenAI review records
created by LLM operations.

## Producer Agent Dry Run

Organizer scenarios that become brief-ready run Producer Agent v0.1 dry-run
steps:

- ProjectUnderstanding
- RoleMap
- SourcingPlan
- ShortlistDraft with no sent shortlist

The runner does not contact candidates, create group chats, send organizer
shortlists, or perform public web sourcing.

## Out Of Scope

- Real design partner invites.
- Live SMS replies.
- Candidate outreach.
- Organizer shortlist sends.
- Group chat creation.
- Public launch.
- Main Saga production app integration.
- Ticketing, ticket sales, RSVP, QR, payments, or event publishing.
