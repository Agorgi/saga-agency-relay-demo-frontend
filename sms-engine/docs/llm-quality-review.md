# LLM Quality Review v0.2

This workflow lets Saga compare deterministic fallback replies with
OpenAI-generated replies before any live LLM-driven SMS is considered. It does
not enable live SMS, `active_live`, candidate outreach, shortlist sends, group
chats, or production Saga app integration.

## Purpose

- Review whether OpenAI language is better than deterministic fallback.
- Catch unsafe, confusing, verbose, or wrong-next-question outputs.
- Build confidence in `shadow` and `active_mock` before future pilot decisions.
- Preserve backend authority over workflow state, safety, consent, and sends.

## What Gets Captured

When an LLM operation runs in shadow or active mock mode, Saga may create an
admin-only `LlmReviewItem` with:

- operation, flow, provider, model, and mode
- deterministic fallback text, if safely available
- LLM text, if safely available
- selected text and selected reply source
- validation status
- safety flags and forbidden-claim result
- fallback-used state and fallback reason
- tone review status
- admin review status and reviewer notes

Raw phone numbers, secrets, prompts, and unredacted outputs should not be
stored. Full reply text is admin-only and redacted before display.

## Saga Voice Rubric

Good LLM output is:

- professional
- friendly
- casual
- concise
- producer-like
- specific enough to be useful
- one clear next step or question
- honest about uncertainty
- never overpromising

Bad LLM output is:

- too long for SMS
- corporate or robotic
- vague when a specific next question is known
- asking the wrong next question for the ReplyPlan
- trying to change workflow state
- implying a human or candidate has already committed
- making a forbidden claim

## Forbidden Claims

Saga may not promise:

- guaranteed bookings
- guaranteed paid work
- guaranteed ticket sales
- confirmed team placement
- confirmed candidate availability
- confirmed rates
- venue access
- celebrity or influencer access
- group-chat inclusion without consent

## When Fallback Should Win

Fallback should win when:

- LLM output fails schema validation
- LLM output contains forbidden claims
- LLM output escalates or de-escalates against backend policy
- LLM output asks a different question than the ReplyPlan selected
- LLM output is too verbose for SMS
- provider calls fail, time out, or hit caps
- the operation has no dedicated LLM language path yet

## Flow Review Notes

Organizer outputs should ask the next intake question or acknowledge
brief-readiness without promising attendance, venue access, revenue, or team
formation.

Gig-seeker outputs should collect city, roles, links, fandoms, and availability
without promising bookings, paid work, placement, or income.

Interest-check outputs should structure demand signals without promising the
event will happen or that Saga will find an organizer.

Contact-reply outputs should require active outreach context, ask for explicit
group-intro consent when needed, and escalate payment, contract, legal, safety,
or rate questions.

## Review Statuses

Admin reviewers can mark items:

- `GOOD`
- `TOO_VERBOSE`
- `WRONG_NEXT_QUESTION`
- `UNSAFE`
- `CONFUSING`
- `BETTER_THAN_FALLBACK`
- `WORSE_THAN_FALLBACK`
- `NEEDS_PROMPT_TUNING`

Use reviewer notes for short, redacted observations. Do not put raw phone
numbers, secrets, production Saga app data, or private external details in
notes.

## Ready For Live Pilot Consideration

Active mock is not ready for live pilot consideration until:

- transcript dry runs in `docs/design-partner-transcript-dry-runs.md` pass and
  any failed outputs are reviewed
- enough organizer outputs are reviewed as good or better than fallback
- unsafe and wrong-next-question rates are acceptably low
- fallback behavior is verified for failures
- Twilio live reply gates remain no-send until explicitly approved
- `active_live` remains disabled until a future staged approval
- shortlist, candidate outreach, group chat, payment, legal, safety, and
  external-action flows remain approval-gated
