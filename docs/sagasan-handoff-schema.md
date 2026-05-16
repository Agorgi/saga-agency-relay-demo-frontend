# Sagasan Handoff Schema

## Response shape

The public web-chat route returns:

```json
{
  "conversationId": "uuid",
  "persona": "host | creative | venue | fan | null",
  "reply": "Sagasan reply text",
  "turn": 0,
  "mode": "autonomous | holding",
  "nextStep": {
    "label": "Continue",
    "route": "/projects/new",
    "prefill": {
      "city": "Los Angeles"
    }
  }
}
```

`nextStep` is optional and only appears when Sagasan has enough minimum-crucial info to route the user forward.

## Approved routes

- `/projects/new`
- `/me`
- `/spaces`
- `/feed`
- `/explore`
- `/projects/:id`

Anything else is rejected.

## Label rules

- must be non-empty
- clamped to five words or fewer
- fallback label is `Continue`

## Prefill rules

Prefill is route-scoped and sanitized before it reaches the client URL.

### `/projects/new`

Allowed keys:

- `eventType`
- `city`
- `scale`
- `vibe`
- `projectType`
- `suggestedRoles`
- `date`
- `helpNeeded`
- `projectIdea`

### `/me`

Allowed keys:

- `city`
- `roles`
- `portfolio`
- `availability`
- `rates`

### `/spaces`

Allowed keys:

- `city`
- `capacity`
- `neighborhood`
- `availabilityHint`
- `venueType`

### `/feed`

Allowed keys:

- `city`
- `interests`

### `/explore`

Allowed keys:

- `projectId`
- `role`
- `city`

## URL transport

- prefill is encoded into `?prefill=<base64url-json>`
- unsafe keys are removed before encoding
- payload size is capped to avoid leaking large or sensitive data into the URL

## Admin QA metadata

Each persisted assistant turn can store:

- `persona`
- `route`
- `nextStep`
- `extractedFields`
- `selectedReplySource`
- `fallbackReason`
- `providerState`
- `model`
- `configuredMode`
- `effectiveMode`
- `operation`

These fields are visible on the admin web-chat session detail page for QA.
