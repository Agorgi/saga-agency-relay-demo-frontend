# Deployment / Runtime Truth Map

Baseline: `main` after `d74dc17`.

This document records runtime expectations without secret values.

## Railway and Build

- `railway.json` uses Railpack.
- Build command: `npm run build`.
- Pre-deploy command: `npm run prisma:deploy`.
- Start command: `npm run start`.
- Healthcheck path: `/api/health`.
- Healthcheck timeout: `300`.
- Restart policy: on failure, max retries `3`.

## Next Runtime

- `next.config.ts` sets `output: "standalone"`.
- `npm run postbuild` copies `public` and static assets into the standalone output.
- `npm run start` runs the standalone server and binds to all interfaces.
- Current build passes. It emits a known non-blocking Turbopack/NFT trace warning involving `next.config.ts` through the health route import graph.

## Required Runtime Categories

Do not document or commit secret values. Required categories:

- database connection string for Prisma/Postgres
- admin login secret
- app base URL for webhook validation and callback URLs
- messaging provider mode

## Optional Runtime Categories

- OpenAI-compatible provider credentials and model config
- Twilio account/messaging/conversation credentials
- Twilio webhook validation toggle
- public web research mode/provider/caps/domain filters
- live dry-run test toggles
- LLM timeout/call-cap/logging controls
- public beta and public launch gates
- pilot/reply mode controls

## Safety-Critical Runtime Flags

These must never be enabled casually:

- `SMS_SENDS_DISABLED=false`
- `LLM_MODE=active_live`
- `MESSAGE_PROCESSING_MODE=async_active`
- public beta enabled
- public launch enabled
- public web research enabled outside explicit operator test gates
- live dry-run allowed outside one-query test conditions

## Expected Current Posture

| Area | Expected safe posture |
|---|---|
| SMS | Sending off; allowlist required; staging mode expected until A2P path is approved. |
| Twilio | Inbound staging may be configured; live send path must remain disabled. |
| OpenAI | Fallback/shadow/active_mock only. No active_live. |
| Public web research | Disabled by default; async live dry run only under explicit flags and CLI/worker processing. |
| Public beta | Disabled. |
| Public launch | Disabled. |
| Internal Saga app | Not connected. |
| Production data | Not imported or touched. |

## Health Endpoint Expectations

`/api/health` should remain:

- high-level and redacted
- free of source URLs, query contents, prompts, raw model output, raw contact values, secrets, and candidate names
- cheap enough for Railway healthchecks
- explicit about disabled safety gates and blocker counts

## Commands Safe by Default

- `npm run build`
- `npm run lint`
- `npm run typecheck`
- mock-only tests
- report scripts that produce redacted summaries
- queue/worker scripts only when their own gates skip safely

## Commands Requiring Extra Care

- database migrations and reset commands
- public web live dry-run script
- inbound job processors if pointed at a real database
- any command that depends on Railway runtime env

## Never Enabled by Default

- live SMS sending
- active live LLM reply generation
- async active inbound processing
- public beta/public launch
- public web research calls
- candidate outreach
- group chat creation
- production Saga app integration
- ticketing, RSVP, QR, payment, or event publishing behavior

