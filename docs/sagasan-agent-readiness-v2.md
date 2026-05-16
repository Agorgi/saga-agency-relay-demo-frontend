# Sagasan Agent Readiness v2

## Goal

Sagasan is ready for internal dogfood and design-partner testing when it:

- routes the four existing personas correctly
- keeps one focused question per turn
- produces producer-voice replies instead of generic chatbot copy
- emits a valid `nextStep` once minimum-crucial info is present
- carries prefill into the destination page without breaking the public flow
- makes runtime and fallback reasons legible to operators

## What changed in v2

- expanded the Sagasan eval suite to scenario-level coverage across host, creative, venue, fan, pivots, fallbacks, and handoffs
- tightened the producer voice guidance in the system prompt and deterministic fallback library
- added lightweight client-side telemetry for chat open, persona inference, pivots, next-step emission, handoff hydration, validation failure, and reset
- improved destination-page handoff hydration for `/projects/new`, `/me`, `/spaces`, and `/feed`
- surfaced clearer runtime state in the admin web-chat runtime panel
- exposed richer handoff metadata in the admin web-chat session detail page

## Readiness checklist

- Persona routing
  - host, creative, venue, and fan all resolve from chips and free-form starts
  - persona pivots override stale remembered persona when the new signal is stronger
- Reply quality
  - no generic support fallback on healthy turns
  - no `"As an AI"` language
  - no `"Sure, I'd be happy to"` default opener
  - no more than one question per turn
- Handoffs
  - CTA labels stay at five words or fewer
  - host handoff routes to `/projects/new`
  - creative handoff routes to `/me`
  - venue handoff routes to `/spaces`
  - fan handoff routes to `/feed`
- Safety
  - no guaranteed paid work, booking, team, ticketing, payment, or execution promises
- Operator visibility
  - runtime panel explains whether users are seeing live OpenAI, deterministic Sagasan, or holding replies
  - web-chat detail page shows reply source, fallback reason, next route, next label, and prefill keys

## Telemetry in this pass

This pass adds session-local telemetry only. It does not introduce a new vendor.

Events:

- `chat_opened`
- `persona_chip_clicked`
- `persona_inferred`
- `persona_pivoted`
- `sagasan_reply_generated`
- `fallback_used`
- `next_step_emitted`
- `next_step_clicked`
- `handoff_loaded`
- `prefill_hydrated`
- `validation_failed`
- `reset_to_landing_clicked`

## Known caveats

- Production can still run in legacy DB mode if the additive web-chat metadata migration has not been applied yet.
- In legacy DB mode, public chat still works, but some handoff metadata remains client-side instead of fully replayable from persisted server history.
- The live OpenAI path is still gated by the existing runtime controls and key availability.

## Verification commands

```bash
npm run test:sagasan-agent
npm run test:sagasan-model-preflight
npm run lint
npm run typecheck
npm run build
npm run lint:copy
```
