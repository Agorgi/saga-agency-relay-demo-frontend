# Sagasan Dogfood Test Script

## How to use this script

For each prompt:

1. Paste the prompt into Sagasan.
2. Note the reply and the detected persona.
3. If a CTA appears, click it and confirm the destination makes sense.
4. Record the result in the feedback form.
5. Use `Reset to landing` before starting the next scenario.

For each prompt, record:

- did Sagasan understand me?
- did it ask one useful question?
- did the reply feel natural?
- did the CTA make sense?
- did the destination page preserve context?
- did anything feel misleading?
- did it overpromise?

## What to record for every case

- did the expected persona match what Sagasan seemed to understand?
- did Sagasan ask one useful next question or move to the right CTA?
- did the reply feel like a creative producer instead of a generic assistant?
- did the CTA make sense for the lane?
- did the destination page preserve context?
- did anything feel misleading or overpromising?

## Host

### 1. Anime picnic

- Prompt: `I want to throw an anime picnic in Silver Lake next month.`
- Expected persona: `host`
- Expected behavior: host-style producer reply, useful follow-up or `Build my event` CTA

### 2. Cosplay cafe night

- Prompt: `I want to plan a cosplay cafe night in Brooklyn.`
- Expected persona: `host`
- Expected behavior: host-style producer reply, event-oriented handoff if enough detail is present

### 3. Small creator launch

- Prompt: `I'm thinking about a small creator launch party.`
- Expected persona: `host`
- Expected behavior: one useful clarifying question if not enough context yet

## Creative

### 4. Photographer gigs

- Prompt: `I'm a photographer in LA looking for anime event gigs.`
- Expected persona: `creative`
- Expected behavior: creative-profile reply and a creative CTA like `Open my feed`

### 5. DJ work

- Prompt: `I'm a DJ and I want to play more fandom events.`
- Expected persona: `creative`
- Expected behavior: creative follow-up or feed/profile handoff

### 6. Cosplayer appearances

- Prompt: `I'm a cosplayer looking for paid appearances.`
- Expected persona: `creative`
- Expected behavior: clear creative reply without paid-work guarantees

## Venue

### 7. Small venue

- Prompt: `I run a small venue in Brooklyn.`
- Expected persona: `venue`
- Expected behavior: venue-style reply and venue CTA if enough context is present

### 8. Cafe host interest

- Prompt: `I have a cafe and want to host more community events.`
- Expected persona: `venue`
- Expected behavior: venue reply focused on space fit, capacity, or availability

### 9. Gallery popups

- Prompt: `I manage a gallery that could host creative popups.`
- Expected persona: `venue`
- Expected behavior: venue reply, no overpromise about guaranteed bookings

## Fan

### 10. Find events

- Prompt: `I want to find cool anime events near me.`
- Expected persona: `fan`
- Expected behavior: discovery-style reply and fan CTA like `See events`

### 11. Wish for an event

- Prompt: `I wish someone would host a Love and Deepspace picnic.`
- Expected persona: `fan`
- Expected behavior: fan/discovery reply that treats this as scene interest, not host intent

### 12. Find fun things

- Prompt: `I'm just here to find fun things to do.`
- Expected persona: `fan`
- Expected behavior: fan reply that narrows city, scene, or fandom

## Persona pivots

### 13. Host to creative

- Prompt 1: `I want to host a show.`
- Prompt 2: `Actually I'm the DJ.`
- Expected persona: pivot from `host` to `creative`
- Expected behavior: CTA and follow-up should switch with the persona

### 14. Fan to host

- Prompt 1: `I want to find events.`
- Prompt 2: `Actually I want to organize one.`
- Expected persona: pivot from `fan` to `host`
- Expected behavior: stale fan CTA should not persist after the pivot

## Boundaries

### 15. Paid work guarantee

- Prompt: `Can you guarantee I'll get paid work?`
- Expected persona: usually `creative`
- Expected behavior: clear refusal to guarantee paid work, but still useful

### 16. Ticketing

- Prompt: `Can you sell tickets for me?`
- Expected persona: depends on context
- Expected behavior: `Tickets live elsewhere — Saga doesn't handle those.`

### 17. Book the whole team

- Prompt: `Can you book the whole team for me?`
- Expected persona: usually `host`
- Expected behavior: no guarantee of bookings or confirmed team

### 18. Off-topic question

- Prompt: `What's the capital of France?`
- Expected persona: no strong persona signal required
- Expected behavior: redirect back to Saga's real purpose without leaking internal details
