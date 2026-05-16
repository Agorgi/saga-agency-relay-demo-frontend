# Sagasan Internal Dogfood v3

## Purpose

This dogfood pass is meant to answer one question before design partner testing:

Can internal testers use Sagasan like a real creative producer, understand what it does, move through the right handoff, and trust the boundaries?

This plan covers the public web-app Sagasan agent only. It is for web Sagasan, not SMS Producer.

## Who should test

Recommended first group:

- 2 internal operators or user-success people
- 1 founder or operator
- 1 creative or designer
- 1 engineer or product-minded tester

Minimum:

- 5 testers
- 20 to 30 total conversations
- 4 conversations per persona
- 4 CTA and handoff checks
- 4 boundary and guardrail checks

## What each tester should do

1. Start on the public Sagasan entry.
2. Run at least four prompts from the dogfood test script.
3. Cover at least two personas.
4. Complete at least one CTA handoff.
5. Try at least one boundary prompt.
6. Record the result in the feedback form.

## How to test

- Use `Reset to landing` before each new scenario.
- If the flow feels stale, open a fresh tab or clear the browser session before retrying.
- Run the prompts exactly as written once before improvising.
- Note whether Sagasan understood the persona, asked a useful next question, and handed off cleanly.

## What to record

- the starting prompt
- the detected persona
- the reply Sagasan gave
- whether the next question felt useful
- whether the CTA made sense
- whether the destination page preserved context
- whether the reply felt like a creative producer
- whether anything felt misleading, vague, or overpromising
- screenshots for anything confusing or broken

## What counts as success

- testers understand what Sagasan is for
- testers know what to type without coaching
- persona routing feels correct in most runs
- replies feel concise and useful
- CTAs make sense and load the right page
- handoff state carries forward cleanly
- boundary prompts stay safe without feeling robotic

## What blocks design partner testing

- common persona misclassification
- CTA or handoff context loss
- stale CTA or wrong route after a persona switch
- generic fallback showing in normal successful turns
- ticketing, payment, paid-work, booking, or execution overpromises
- internal system details exposed to users

## Feedback classification

Use these labels:

- wrong persona
- wrong next question
- too generic
- too long
- too vague
- overpromised
- CTA confusing
- handoff lost context
- stale CTA
- route wrong
- bad fallback
- boundary failure
- off-topic handling issue
- other

## How to report issues

1. Fill out the dogfood feedback form.
2. Add a screenshot if the issue is visual or handoff-related.
3. If it is reproducible, add it to the issue log template.
4. Mark whether it should become a permanent eval case.

## Go / no-go decision

Go to design partner testing only when:

- at least 20 internal conversations have been reviewed
- no red issues remain open
- most yellow issues are triaged
- the top 5 copy issues are listed
- the top 5 UX issues are listed

If any red issue remains open, hold.
