# Messaging Pipeline Reliability v0.1

Messaging Pipeline Reliability v0.1 adds a durable, observable inbound job layer around Twilio webhook processing. It prepares Saga for design-partner and future public beta traffic without changing the current no-send posture.

## Processing Modes

`MESSAGE_PROCESSING_MODE` controls how inbound messages are handled:

- `sync` is the default. The Twilio inbound route keeps processing immediately, exactly as it did before, and records a completed `InboundProcessingJob` for observability when an inbound message is persisted.
- `async_shadow` keeps immediate route processing, then creates a pending job that can be replayed manually for queue testing. The job processor runs the deterministic router and ReplyPlan policy in dry-run mode and must not duplicate side effects.
- `async_active` is future-only. It validates, persists, enqueues, and returns quickly so a worker can process the message later. Do not enable this for the design-partner pilot until the worker model has been reviewed.

The default remains `sync`.

## Job Model

`InboundProcessingJob` stores:

- related inbound message, Twilio MessageSid, project brief, user, and contact ids
- normalized sender hash only, never raw phone numbers
- status: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `SKIPPED_DUPLICATE`, or `BLOCKED`
- processing mode, attempts, lock data, retry timing, redacted error category/message, and result summary

The Twilio MessageSid is unique so duplicate webhook retries cannot create duplicate jobs.

## Idempotency

- One inbound `Message` is persisted per Twilio MessageSid.
- One `InboundProcessingJob` is created per Twilio MessageSid.
- Duplicate webhooks are audited as `pipeline.inbound_job_skipped_duplicate`.
- Re-running a terminal job is a no-op.
- Shadow job processing records dry-run outcomes and does not create outbound sends, group chats, outreach, or candidate contact.

## Job Runner

Run a single batch locally or through Railway SSH:

```bash
JOB_PROCESS_LIMIT=10 npm run jobs:process-inbound-once
```

The runner redacts phone-like values in terminal output. It does not require Twilio and does not send SMS while the existing gates remain closed.

## Failure Categories

Safe error categories are:

- `signature_failed`
- `duplicate_message_sid`
- `allowlist_blocked`
- `opted_out`
- `llm_provider_failed`
- `llm_validation_failed`
- `db_error`
- `missing_context`
- `safety_blocked`
- `send_blocked`
- `unknown`

Raw stack traces are not shown in admin UI.

## Admin Visibility

`/admin/pipeline` shows the processing mode, queue depth, failed count, status counts, recent jobs, attempts, redacted errors, and dry-run result summaries. It has retry and mark-skipped controls for jobs, but no send button.

`/api/health` reports:

- `messageProcessingMode`
- `asyncProcessingAvailable`
- `queueDepth`
- `failedJobCount`

No secrets or phone numbers are exposed.

## Current Safety Posture

This layer does not enable live SMS. `SMS_SENDS_DISABLED=true` still blocks sends. Twilio staging remains no-send. No group chats, candidate outreach, organizer shortlist sends, public web sourcing, ticketing, RSVP, QR, payments, event publishing, or production Saga app integration are added.

## When To Consider A Worker

Move beyond `async_shadow` only after:

- A2P/compliance is approved
- the one-number outbound self-test is complete
- idempotency and retry behavior have been observed in staging
- queue depth and failed jobs are monitored
- an operator rollback path is rehearsed
