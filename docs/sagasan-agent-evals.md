# Sagasan Agent Evals

## Command

```bash
npm run test:sagasan-agent
```

## Covered cases

1. host chip
2. creative chip
3. venue chip
4. fan chip
5. host free-form intake
6. creative free-form intake
7. venue free-form intake
8. fan free-form intake
9. persona pivot from host to creative
10. persona pivot from fan to host
11. persona pivot from creative to venue
12. capability question
13. paid-work boundary
14. ticketing boundary
15. off-topic question
16. Los Angeles extraction
17. large launch extraction
18. available weekends extraction
19. events in Brooklyn extraction
20. long detailed opening message
21. live OpenAI next-step preservation
22. invalid next-step route rejection
23. CTA label clamping
24. route-scoped prefill sanitization
25. backend reply rendering in `ChatThread`

## Assertions

- correct persona resolution
- one focused question at most
- no generic support fallback copy
- no guaranteed bookings, paid work, ticketing, or execution promises
- `nextStep` appears when minimum-crucial info is satisfied
- invalid `nextStep` routes are rejected
- CTA labels stay within five words
- prefill payloads strip unsafe keys
- live-mode path uses the supplied OpenAI call in tests

## Manual follow-up QA

- run a full host intake in the browser
- run a creative lane with a portfolio link
- confirm admin web-chat session detail shows:
  - persona
  - route
  - nextStep
  - extractedFields
  - selectedReplySource
  - fallbackReason
  - providerState
