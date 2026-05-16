# Sagasan Responses API Migration Plan

## Current state

Sagasan already uses the OpenAI Responses API in the live path through `client.responses.parse(...)` with a zod-backed message schema.

Current live schema:

- `message`
- `nextStep`

Current safety posture:

- provider use stays behind the existing runtime gates
- validation failures degrade to deterministic Sagasan replies
- `nextStep` is sanitized again after model output

## Target state

Move from a permissive `message + nextStep` parse to a stricter structured-output contract that makes the route and prefill schema first-class.

Target output contract:

```json
{
  "message": "string",
  "nextStep": {
    "label": "string <= 5 words",
    "route": "approved route",
    "prefill": "route-scoped object"
  }
}
```

## Benefits

- fewer malformed handoffs
- less client-side recovery logic
- clearer provider-vs-validator observability
- easier evals for route and prefill adherence

## Risks

- tighter schemas can increase validation failures before prompts are tuned
- route-scoped payload rules need careful coordination with destination pages
- production fallback behavior must remain graceful if the provider drifts

## Evals required before migration

- host / creative / venue / fan route validity
- CTA label length
- prefill sanitization
- boundary cases
- provider validation failure handling
- legacy DB compatibility
- client hydration with and without persisted metadata

## Rollback plan

If the stricter schema increases invalid live responses:

1. keep deterministic fallback enabled
2. revert to the current permissive parse contract
3. inspect failing evals and provider logs
4. tighten prompts and schema incrementally

## Recommendation

Do not migrate further in this pass. The current Responses API path is stable enough for internal dogfood, and the next migration should happen only with the expanded eval suite green.
