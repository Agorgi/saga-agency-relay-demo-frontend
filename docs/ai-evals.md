# AI Reliability Evals

The Saga Producer MVP uses an OpenAI-compatible LLM abstraction where available,
but staging and demo mode must remain reliable without `OPENAI_API_KEY`. The AI
eval suite checks deterministic fallback behavior and safety boundaries before
any live user testing.

Run:

```bash
npm run test:ai-evals
npm run test:llm-provider
npm run test:llm-evals
```

The suite forces fallback mode by unsetting `OPENAI_API_KEY`, `OPENAI_BASE_URL`,
and `OPENAI_MODEL` inside the test process. It does not call a live LLM, Twilio,
or the database.

`test:llm-provider` covers the provider wrapper, mode behavior, fallback
behavior, and secret-safe health metadata. `test:llm-evals` covers the
structured schemas used by LLM Provider Integration v0.1.

## What Is Tested

- Organizer event idea intake.
- Vague project ideas and safe follow-up questions.
- Gig-seeker / creator onboarding heuristics.
- Creator looking for paid gigs, without promising paid work.
- Role mapping for anime, cosplay, gaming, and community event concepts.
- Unsafe or high-risk requests involving:
  - money
  - contracts
  - alcohol
  - minors
  - permits
  - weapons
  - harassment
  - discrimination
  - explicit sexual content
  - guaranteed sales
  - celebrity or influencer participation
- Contact reply classification: YES, NO, MAYBE, unclear.
- Consent reply classification before group chat.
- Organizer-facing shortlist summarization.

## What The LLM May Do

- Help write friendly, concise producer-style replies.
- Extract structured brief fields when clearly present.
- Suggest practical production roles.
- Draft outreach copy for admin review.
- Summarize interested contacts for organizer review.
- Suggest non-sensitive tasks from group chat messages.

## What The LLM May Not Do

- Promise bookings, payment, revenue, ticket sales, attendance, venue access,
  celebrity participation, influencer participation, permits, insurance, legal
  outcomes, contracts, or confirmed team placement.
- Send outreach autonomously.
- Send a shortlist autonomously.
- Create a group chat autonomously.
- Override backend workflow state transitions.
- Expose internal notes, private contact notes, admin notes, raw secrets, or
  production Saga data.

## Human Approval Required

Human/admin approval remains required for:

- Outreach sends.
- Shortlist sends.
- Group chat creation.
- Risky or confusing messages.
- Anything involving payment, contracts, deposits, permits, insurance, alcohol,
  minors, safety, weapons, harassment, discrimination, explicit content, legal
  issues, or guarantees.
- Any future connection to the real Saga app, ticketing, RSVPs, QR codes, event
  publishing, ticket sales, payments, or production data.

## Current Limitations

- These evals are deterministic fallback evals, not live LLM quality scoring.
- They do not test real OpenAI latency, refusal behavior, model drift, or JSON
  parsing failures from a live provider.
- They do not test database-backed intake persistence or admin UI flows.
- Before live user testing, run these alongside `npm run test:staging-baseline`
  and the mock Twilio readiness suite.
