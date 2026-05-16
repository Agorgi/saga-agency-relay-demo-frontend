# Sagasan Eval Suite

## Command

```bash
npm run test:sagasan-agent
```

## Categories

- persona routing
- persona pivots
- reply rendering
- next-step emission
- handoff hydration
- fallback quality
- safety boundaries
- extraction edge cases
- runtime compatibility
- chrome CTA state

## Pass/fail criteria

Each case should confirm some or all of the following:

- correct persona
- one focused question at most
- no generic support fallback
- no paid-work or booking overpromise
- no ticketing or payment promise
- valid `nextStep.route`
- CTA label at five words or fewer
- sanitized prefill payload
- no stale CTA after reset or persona switch
- no internal route, prompt, or provider details exposed to users

## Persona test matrix

- Host
  - sparse idea
  - complete brief
  - long detailed opener
  - anime picnic
  - cosplay cafe
  - creator launch
  - low-budget meetup
  - high-budget activation
  - staffing help
  - ticketing question
  - budget question
- Creative
  - photographer gigs
  - DJ gigs
  - cosplayer appearances
  - illustrator commissions
  - designer projects
  - portfolio link
  - paid-work guarantee question
  - capability question
  - automatic booking question
- Venue
  - venue owner
  - cafe owner
  - gallery owner
  - studio owner
  - wants more events
  - revenue question
  - ticketing question
  - guarantee question
- Fan
  - wants events
  - wants interest checks
  - wants something to exist
  - capability question
  - ticketing question
  - off-topic question
  - suggest an idea without hosting

## Handoff matrix

- host -> `/projects/new`
- creative -> `/me`
- venue -> `/spaces`
- fan -> `/feed`
- pending handoff survives local restore when legacy GET omits metadata
- destination pages hydrate prefill from URL or pending next step

## Boundary matrix

- guaranteed paid work
- guaranteed bookings
- ticketing
- payment handling
- off-topic trivia
- capability questions

## Fallback matrix

- deterministic mock mode
- live mode with missing key
- live provider failure
- live validation failure
- no-DB fallback path
- legacy DB mode

## Regression loop

1. define the expected behavior
2. write or update a failing case
3. inspect the output and runtime metadata
4. change prompt, policy, or code
5. rerun the suite

## Adding a new failing case

Add it to the narrowest matching test surface:

- `src/lib/sagasanAgent.test.ts` for routing, voice, fallback, and structured fields
- `src/app/api/web-chat/route.test.ts` for response shape and runtime path
- `src/components/web-chat/useWebChat.test.ts` for hydration, merge, and reply priority
- `src/components/AppChrome.test.tsx` for top-right CTA state
- `src/components/web-chat/ChatThread.test.tsx` for inline CTA rendering
