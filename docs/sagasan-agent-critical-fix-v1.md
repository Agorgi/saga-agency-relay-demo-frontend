# Sagasan Critical Fix Pass v1

## Goal

Restore Sagasan's public web-chat so the UI shows the backend-selected reply, persona routing works across host/creative/venue/fan, deterministic fallbacks stay in producer voice, and every routeable intake can emit an inline `nextStep` CTA.

## Current architecture

- `src/app/api/web-chat/route.ts`
  - owns session lookup, runtime-gate enforcement, history loading, reply generation, and persistence
- `src/lib/sagasanAgent.ts`
  - resolves persona, extracts routeable fields, generates deterministic replies, calls OpenAI in `active_live`, and classifies provider failures
- `src/lib/sagasanSystemPrompt.ts`
  - builds the persona-aware live prompt
- `src/lib/webChatNextStep.ts`
  - validates approved routes, sanitizes prefill payloads, clamps CTA labels, and builds navigable hrefs
- `src/lib/webChatSessionStore.ts`
  - persists message metadata for QA and admin review
- `src/components/web-chat/useWebChat.ts`
  - restores history, sends persona hints, and only falls back to client copy when the API fails entirely
- `src/components/web-chat/ChatThread.tsx`
  - renders the selected reply and inline CTA button

## Fixed bugs

### Reply rendering

- Frontend now renders the backend-selected reply directly.
- Backend deterministic fallbacks are treated as first-class replies, not masked by a second generic client layer.
- `nextStep` now travels from API response to thread rendering to route navigation.

### Persona routing

- Persona launcher chips now send a structured `personaHint`.
- Free-form classification now catches:
  - host language
  - creative work-seeking language
  - venue ownership language
  - fan discovery language
- Persona pivots are respected when a user clearly switches lanes mid-thread.

### Next-step handoff

- Host, creative, venue, and fan flows emit sanitized `nextStep` payloads once minimum-crucial info is present.
- CTA labels are clamped to five words or fewer.
- Prefill payloads are route-scoped and size-capped before encoding into the URL.

### Extraction + QA surfaces

- Web-chat assistant turns now persist:
  - persona
  - route
  - nextStep
  - extractedFields
  - selectedReplySource
  - fallbackReason
  - providerState
  - model
  - configuredMode
  - effectiveMode
  - operation
- Admin web-chat session detail now shows that metadata directly for QA.

### Runtime clarity

- Runtime dashboard now shows:
  - configured model
  - configured mode
  - effective mode
  - OpenAI configured
  - OpenAI actually called
  - fallback reason
  - provider state
  - blocking gate
  - active-live allowance
  - shadow-mode state
  - public-launch gate

## Fallback behavior

- `holding`
  - used only when the runtime gate is closed
  - still persists the user message plus Sagasan holding reply
- deterministic fallback
  - used for `active_mock`
  - also used when live mode is requested but OpenAI is missing, unavailable, fails, or returns invalid structured output
- client fallback
  - used only when the browser request fails entirely or the API returns an invalid shape
  - stays in Sagasan producer voice

## QA checklist

- persona chip sends `personaHint`
- backend reply appears in the thread
- generic support copy does not replace valid backend copy
- `nextStep` button renders inline when present
- CTA route is approved and prefill is sanitized
- one focused question per turn
- no ticketing, paid-work, or guarantee promises
- extraction keeps city/date/role fields sane on long or ambiguous messages

## Future migration plan

- move live reply generation to fully structured Responses API outputs with stricter typed extraction
- split deterministic fallback templates into dedicated config modules
- add richer web-chat review surfacing without relying on SMS-only review items
- add explicit server-side persona inference telemetry and A/B prompt variants
