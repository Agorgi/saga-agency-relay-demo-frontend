# Sagasan Runtime Modes

## Gates

Sagasan only calls OpenAI when all of these are true:

1. `WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true`
2. the runtime toggle row in `WebChatRuntimeSetting` is enabled
3. `LLM_MODE=active_live`
4. `OPENAI_API_KEY` is configured

If any gate is closed, the user still gets a producer-style Sagasan reply. The runtime panel explains why live output did not run.

## Core fields

- configured model
  - raw model intent from `OPENAI_MODEL` or the default model
- effective model
  - the model actually used, or the deterministic fallback path if no provider call happened
- configured mode
  - env intent from `LLM_MODE`
- effective mode
  - what users actually saw
- provider configured
  - whether an OpenAI key exists
- provider effective
  - whether OpenAI was both available and allowed by the gates

## Effective modes

- `holding`
  - the runtime gate is closed, so users see a holding-pattern Sagasan reply
- `autonomous_mock`
  - users see deterministic Sagasan replies
- `autonomous_live`
  - users see provider-generated Sagasan replies

## Provider states

- `openai_not_called_gate_closed`
- `openai_not_called_mode_mock`
- `openai_not_called_missing_key`
- `openai_called_succeeded`
- `openai_called_failed`
- `openai_called_validation_failed`

## Fallback reasons

Common reasons include:

- `runtime_gate_closed`
- `provider_failed`
- `validation_failed`
- `capability_question`
- `boundary_ticketing`
- `boundary_paid_work`
- `boundary_guarantee`
- `off_topic`
- `unknown_persona`

## Plain-English runtime explanations

The admin runtime panel should be read like this:

- `Live OpenAI is disabled. Users are seeing holding replies.`
- `Live OpenAI is disabled. Users are seeing deterministic Sagasan replies.`
- `OpenAI is configured and active. Users are seeing live Sagasan replies.`
- `OpenAI is configured, but the latest live attempt failed validation. Users are seeing deterministic Sagasan replies.`
- `OpenAI is configured, but the latest live attempt failed. Users are seeing deterministic Sagasan replies.`

## Model preflight

Run:

```bash
npm run test:sagasan-model-preflight
```

Behavior:

- skips cleanly if `OPENAI_API_KEY` is missing
- skips unless `SAGASAN_ENABLE_MODEL_PREFLIGHT=true`
- never logs the API key
- returns one of:
  - `ok`
  - `skipped`
  - `model_not_found`
  - `auth_error`
  - `rate_limit`
  - `provider_error`

## Operator visibility

The web-chat runtime/admin surfaces now show:

- configured model
- effective model
- configured mode
- effective mode
- provider configured
- provider effective
- OpenAI called?
- fallback used?
- fallback reason
- validation status
- blocking gate
- active live allowed?
- shadow mode?
- public launch gate
- current runtime explanation in plain English
