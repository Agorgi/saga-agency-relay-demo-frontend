# Sagasan Runtime Modes

## Gates

Sagasan only calls OpenAI when all of these are true:

1. `WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true`
2. runtime toggle row in `WebChatRuntimeSetting` is enabled
3. `LLM_MODE=active_live`
4. `OPENAI_API_KEY` is configured

If any gate is closed, the user still gets a persisted Sagasan reply, but the provider state will explain why live generation did not run.

## Configured mode vs effective mode

- configured mode
  - raw env intent from `LLM_MODE`
  - `active_mock` or `active_live`
- effective mode
  - what actually happened for the reply
  - `holding`
  - `autonomous_mock`
  - `autonomous_live`

## Provider states

- `openai_not_called_gate_closed`
  - runtime gate is off, so a holding reply was selected
- `openai_not_called_mode_mock`
  - Sagasan stayed in deterministic autonomous mode
- `openai_not_called_missing_key`
  - live mode was requested but no API key was available
- `openai_called_succeeded`
  - OpenAI was called and returned a valid structured reply
- `openai_called_failed`
  - OpenAI was called but failed before a valid reply was returned
- `openai_called_validation_failed`
  - OpenAI responded but did not match the expected structured schema

## Fallback reasons

Common reasons include:

- `runtime_gate_closed`
- `active_live_disabled`
- `missing_api_key`
- `capability_question`
- `paid_work`
- `guarantee`
- `ticketing`
- `off_topic`
- provider error categories such as `auth_error`, `model_not_found`, `rate_limit`, `provider_error`, `validation_failed`

## Model preflight

Run:

```bash
npm run test:sagasan-model-preflight
```

Behavior:

- skips cleanly if `OPENAI_API_KEY` is missing
- skips cleanly unless `SAGASAN_ENABLE_MODEL_PREFLIGHT=true`
- never logs the API key
- returns one of:
  - `ok`
  - `skipped`
  - `model_not_found`
  - `auth_error`
  - `rate_limit`
  - `provider_error`

## Admin readouts

The runtime dashboard surfaces:

- configured model
- configured mode
- effective mode
- OpenAI configured
- OpenAI actually called
- fallback reason
- provider state
- blocking gate
- active live allowed
- shadow mode
- public launch gate
