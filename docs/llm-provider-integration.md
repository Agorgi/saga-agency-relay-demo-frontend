# LLM Provider Integration v0.1

This package adds a safe OpenAI-compatible provider layer while keeping
deterministic fallback behavior as the default. It does not enable live
LLM-driven SMS replies.

## Purpose

Saga can use an LLM to assist with language, extraction, and producer-facing
drafting. The backend still owns workflow state, safety gates, consent, send
decisions, candidate approval, and group-chat decisions.

OpenAI is optional. The app must build, start, and pass local tests without
`OPENAI_API_KEY`.

## Env Vars

- `LLM_PROVIDER=fallback | openai`
- `LLM_MODE=fallback | shadow | active_mock | active_live`
- `OPENAI_API_KEY` optional
- `OPENAI_MODEL` optional; defaults to `gpt-5.4-mini`
- `OPENAI_BASE_URL` optional
- `LLM_TIMEOUT_MS=8000` by default
- `LLM_DAILY_CALL_CAP` optional
- `LLM_LOG_PROMPTS=false` by default
- `LLM_LOG_OUTPUTS=false` by default

Prompt and output logging should remain off unless an operator explicitly needs
short redacted previews for debugging.

Env values are trimmed, unquoted, and matched case-insensitively. Runtime env
keys are also read through an exact lookup first and then a normalized key
lookup, so `LLM_PROVIDER=openai` and `LLM_MODE=shadow` can still resolve if a
deployment system stores the key with surrounding whitespace or casing drift.

## Configured Vs Effective State

Health reports both requested and effective LLM state:

- `providerConfigured` / `modeConfigured`: normalized env intent.
- `providerEffective` / `modeEffective`: what the app will actually use.
- `provider` / `mode`: effective aliases kept for older admin/status UI.
- `warnings`: safe config warnings such as `openai_api_key_missing`,
  `invalid_llm_mode`, `llm_provider_env_key_normalized`, or
  `active_live_disabled`.

If `LLM_PROVIDER=openai`, `LLM_MODE=shadow`, and `OPENAI_API_KEY` is present,
`/api/health` should show `providerEffective: "openai"`,
`modeEffective: "shadow"`, and `shadowMode: true`.

If the API key is missing, the configured values may still show `openai` and
`shadow`, but the effective provider/mode fall back safely and health includes
`openai_api_key_missing`.

## Model Configuration And Preflight

The currently configured default model is `gpt-5.4-mini`. Override it with:

```bash
OPENAI_MODEL=gpt-5.4-mini
```

Before staging tests with OpenAI configured, run:

```bash
npm run test:llm-model-preflight
```

The preflight reads `LLM_PROVIDER`, `LLM_MODE`, and `OPENAI_MODEL`, then skips
safely if `OPENAI_API_KEY` is missing. When an API key is present, it performs a
tiny structured-output check against the configured model. It does not log the
API key, send SMS, require Twilio, change `LLM_MODE`, or enable `active_live`.

If the preflight fails with model-not-found, 404, or access errors:

- Check for typos in `OPENAI_MODEL`.
- Confirm the account has access to that model.
- Remove `OPENAI_MODEL` to fall back to the repo default.
- Keep `LLM_MODE=shadow` or `fallback` until the preflight passes.
- Do not use the failure as a reason to enable live SMS or `active_live`.

If `/api/health` still shows effective fallback after setting OpenAI shadow
mode, check:

- `providerConfigured` and `modeConfigured` to confirm env values are being
  read.
- `warnings` for `openai_api_key_missing`, invalid env tokens, or normalized
  env-key matches.
- `npm run test:llm-model-preflight` for model access or 404 errors.
- Railway deploy state to confirm the service restarted with the new env.

## Modes

| Mode | Behavior |
| --- | --- |
| `fallback` | Never calls OpenAI. Uses deterministic fallback output. |
| `shadow` | Calls OpenAI only when configured, validates output, audits the result, and returns fallback output. |
| `active_mock` | Can use valid OpenAI output only when the execution surface is explicitly `admin_dev`/MOCK. Runtime and Twilio paths still fall back or shadow without changing live behavior. |
| `active_live` | Future-only. Fails closed because `activeLiveAllowed` is false in v0.1. |

`active_live` must not be enabled until compliance, `SMS_SENDS_DISABLED=false`,
allowlisting, pilot stage, controlled live reply gates, output validation, and
forbidden-claims checks are all explicitly reviewed in future code.

## Execution Context

LLM calls carry a small execution context so the configured mode cannot be
misapplied:

- `surface`: `admin_dev`, `twilio_inbound`, `test`, or `background`.
- `providerMode`: `MOCK` or `TWILIO`.
- `allowActiveMock`: true only for `admin_dev` with `MESSAGING_PROVIDER=MOCK`,
  `LLM_PROVIDER=openai`, `LLM_MODE=active_mock`, and an API key.
- `allowActiveLive`: false in this release.
- `sendsDisabled` and `dryRun`: included for audit/debug visibility.

`/admin/dev` organizer simulation passes `surface=admin_dev` and can use the
`organizer_reply_language` OpenAI operation in `active_mock`. Live Twilio
inbound passes `surface=twilio_inbound`; if `LLM_MODE=active_mock` is set there,
the LLM layer fails closed and may audit
`llm.active_mock_blocked_for_twilio_surface`. No Twilio reply behavior changes.

Gig-seeker, interest-check, and contact-reply admin/dev simulations currently
remain deterministic unless a dedicated LLM operation exists. Their audit/debug
metadata explicitly reports `deterministic_fallback` and
`llmOperationUnavailable` instead of implying OpenAI generated the reply.

## Provider Wrapper

Core files:

- `src/lib/llm/llmProvider.ts`
- `src/lib/llm/openaiProvider.ts`
- `src/lib/llm/fallbackProvider.ts`
- `src/lib/llm/llmTypes.ts`
- `src/lib/llm/prompts/index.ts`

The OpenAI wrapper uses the Responses API with structured output where
configured. Model output is validated with Zod. Invalid output, timeouts,
provider failures, forbidden claims, and disabled modes all return deterministic
fallback output.

## Structured Schemas

`src/lib/llm/llmTypes.ts` defines schemas for:

- brief field extraction
- organizer reply language
- gig-seeker profile extraction
- interest-check extraction
- producer role-map refinement
- candidate fit explanation
- shortlist/outreach draft language

These schemas are designed for LLM assistance only. They do not replace backend
workflow validation.

## What The LLM May Decide

- Extract likely fields from user text.
- Suggest concise reply wording.
- Refine role descriptions and candidate fit explanations.
- Draft admin-review-only shortlist or outreach language.
- Mark low confidence or risky content for escalation.

## What The Backend Must Decide

- Intent routing.
- Workflow state transitions.
- Safety escalation.
- Consent.
- Candidate approval.
- Shortlist approval.
- Send eligibility.
- Twilio/live SMS execution.
- Group-chat creation.

## Prompt Policy

Prompts include Saga voice guidance and forbidden claims. They must not include
secrets, raw phone numbers, production Saga app data, or private notes unless a
future admin-only feature explicitly requires it.

Saga voice remains professional, friendly, casual, concise, producer-like, not
overly corporate, and never overpromising.

## Audit Events

The provider layer emits:

- `llm.call_started`
- `llm.call_succeeded`
- `llm.call_failed`
- `llm.fallback_used`
- `llm.active_mock_blocked_for_twilio_surface`

Audit metadata includes provider, mode, model, operation, validation result, and
safe error categories. It does not include API keys, raw phone numbers, private
notes, or full prompts/outputs by default.

`llm.call_failed` includes enough safe diagnostics to debug provider issues:
`errorCategory`, `statusCode`, `redactedMessageSnippet`, `schemaName`,
`requestMode`, and `structuredOutputRequested`. Error categories include
`model_not_found`, `auth_error`, `rate_limit`, `timeout`, `invalid_schema`,
`invalid_request`, `network_error`, `provider_5xx`, and `unknown`.

## Admin And Health

`/api/health` reports:

- `llm.provider`
- `llm.mode`
- `llm.providerConfigured`
- `llm.providerEffective`
- `llm.modeConfigured`
- `llm.modeEffective`
- `llm.configured`
- `llm.model`
- `llm.shadowMode`
- `llm.activeLiveAllowed`
- `llm.warnings`

`/admin/pilot` shows provider, mode, model, timeout, daily cap, and logging
posture without exposing API keys.

`/admin/llm-review` shows admin-only LLM quality review items. These compare
deterministic fallback text with schema-valid or rejected LLM output, show the
selected reply source, and let operators mark outputs as good, too verbose,
wrong next question, unsafe, confusing, better/worse than fallback, or needing
prompt tuning. The queue is for evaluation only and does not enable live SMS.

## Tests

Run:

```bash
npm run test:llm-provider
npm run test:llm-evals
npm run test:llm-model-preflight
npm run test:llm-health-config
npm run test:llm-organizer-reply-language
npm run test:llm-shadow-organizer-inbound
npm run test:llm-active-mock-admin-dev
npm run test:llm-quality-review
```

`test:llm-provider` verifies fallback mode, shadow fallback without a key,
shadow output auditing semantics, invalid-output fallback, timeout fallback,
forbidden-claim fallback, active mock scoping, and active-live fail-closed
behavior.

`test:llm-health-config` verifies `/api/health`-safe configured/effective LLM
state for OpenAI shadow mode, missing-key fallback, and active-live fail-closed
behavior.

`test:llm-organizer-reply-language` verifies the `organizer_reply_language`
schema can be converted into OpenAI structured-output format, mocked success
validates, mocked invalid output falls back, provider schema errors are
categorized safely, and audit metadata does not expose prompts, raw outputs,
phone numbers, or secrets.

`test:llm-shadow-organizer-inbound` simulates a shadow-mode organizer inbound
path with successful extraction and organizer reply language model calls while
preserving deterministic fallback output and confirming `SMS_SENDS_DISABLED`
blocks outbound execution.

`test:llm-active-mock-admin-dev` verifies that `LLM_MODE=active_mock` is allowed
only for the admin/dev MOCK execution surface, organizer admin/dev can use valid
OpenAI output, Twilio inbound cannot use active mock live behavior, unavailable
flow operations report deterministic fallback, contact payment questions remain
safe, and `active_live` stays disabled.

`test:llm-quality-review` verifies comparison metadata, forbidden-claim
detection, too-verbose/wrong-next-question heuristics, safe admin serializers,
review status updates, no-DB fallback, and active-live disabled posture.

`test:llm-evals` validates representative structured output fixtures for
organizer intake, gig-seeker onboarding, interest checks, safety escalation,
role mapping, candidate fit, and draft language.

`test:llm-model-preflight` validates configured model access only when
`OPENAI_API_KEY` is present; otherwise it skips cleanly.

## Current Status

LLM Provider Integration v0.1 is readiness infrastructure. It does not enable
live LLM-driven Twilio replies, live SMS, candidate outreach, organizer
shortlist sends, group chats, public launch, public web sourcing, or production
Saga app integration.
