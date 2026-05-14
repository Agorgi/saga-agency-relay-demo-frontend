# Incident Response Runbook

This runbook is for the standalone Saga SMS Producer app. It assumes live SMS remains disabled unless an explicitly approved test window is underway.

Preserve audit logs before destructive cleanup. Do not delete data until the incident is reviewed.

## 1. Unexpected Outbound SMS

- Severity: Critical.
- Detection: Twilio outbound logs, `/admin/observability` red risk,
  `/admin/command-center` red status, nonzero outbound records while
  `SMS_SENDS_DISABLED=true`.
- Immediate response: Set `SMS_SENDS_DISABLED=true`, set `PILOT_REPLY_MODE=draft_only`, remove or reduce `SMS_ALLOWED_NUMBERS`, and disable the Twilio webhook if sends continue.
- Preserve: Twilio logs, `message.send_blocked`, `live_reply.*`, `Message`, `AuditLog`, and deployment commit.
- Escalate: Immediately to engineering/operator owner.

## 2. Duplicate Replies

- Severity: High.
- Detection: repeated outbound records for one inbound `MessageSid`, duplicate Twilio logs, user report.
- Immediate response: Keep sends disabled, inspect live-reply idempotency and `InboundProcessingJob` records, pause job processing.
- Preserve: inbound `MessageSid`, job IDs, audit chain.
- Escalate: Engineering review before any further send test.

## 3. Twilio Webhook Failure

- Severity: High for pilot, Medium for dry runs.
- Detection: `/api/health`, Twilio debugger, missing inbound `Message` rows.
- Immediate response: Confirm `TWILIO_VALIDATE_WEBHOOKS=true`, app URL, route health, and deploy status. Do not disable validation except for a local-only debug path.
- Preserve: Twilio request IDs, route logs, audit errors.

## 4. OpenAI Provider Failure

- Severity: Medium unless fallback fails.
- Detection: `llm.call_failed`, high fallback rate, `/admin/llm-review`.
- Immediate response: Keep deterministic fallback active. Run `npm run test:llm-model-preflight` if a key is configured.
- Preserve: redacted `llm.call_failed` metadata, model name, operation, error category.

## 5. LLM Unsafe Output

- Severity: High.
- Detection: LLM Quality Review unsafe flag, forbidden claims, transcript dry-run failure.
- Immediate response: Keep `LLM_MODE` at `shadow` or `active_mock`; do not enable `active_live`. Patch prompts/schema/fallback checks.
- Preserve: review item, deterministic output, selected output, safety flags.

## 6. Pipeline Backlog

- Severity: Medium, High if pilot traffic is active.
- Detection: pending/failed jobs, oldest pending age, `/admin/pipeline`.
- Immediate response: Keep `MESSAGE_PROCESSING_MODE=sync` unless intentionally testing async. Retry safe failures or mark duplicates skipped.
- Preserve: job IDs, error categories, attempts.

## 7. Database Unavailable

- Severity: Critical.
- Detection: `/api/health` database error, failed admin pages, report errors.
- Immediate response: Pause pilot activity, keep sends disabled, inspect Railway Postgres status and recent migrations.
- Preserve: deployment commit, migration logs, database service status.

## 8. SMS_SENDS_DISABLED Accidentally False

- Severity: Critical before compliance.
- Detection: `/api/health`, `/admin/observability`, env audit.
- Immediate response: Set `SMS_SENDS_DISABLED=true`, confirm outbound logs show no sends, review audit.
- Preserve: env change history, deploy ID, health snapshots.

## 9. Public Launch Accidentally Enabled

- Severity: Critical.
- Detection: `PUBLIC_LAUNCH_ENABLED=true` while stage is not `public_live`.
- Immediate response: Set `PUBLIC_LAUNCH_ENABLED=false`, keep allowlist required, keep sends disabled.
- Preserve: env history and health output.

## 10. Non-Allowlisted Inbound or Outbound Issue

- Severity: High.
- Detection: allowlist blocker missing, unexpected user report, audit mismatch.
- Immediate response: Confirm `SMS_REQUIRE_ALLOWLIST=true`, inspect allowlist count only, and do not expose raw numbers.
- Preserve: redacted sender hash, audit metadata, route logs.

## 11. Opt-Out Failure

- Severity: Critical.
- Detection: STOP not respected, opted-out contact receives or would receive a reply.
- Immediate response: Keep sends disabled, mark participant/contact opted out, inspect contact reply policy and live reply gates.
- Preserve: STOP inbound, contact/person opt-out timestamps, audit chain.

## 12. Design Partner Reports Bad Interaction

- Severity: Medium or High depending on safety impact.
- Detection: participant feedback, transcript review, admin report.
- Immediate response: Add PilotFeedback, mark relevant LLM Review item, pause participant if needed, keep active-live disabled.
- Preserve: transcript, selected reply, fallback reply, review notes.

## 13. Public Beta Access Gate Failure

- Severity: High before public beta, Critical if public traffic is active.
- Detection: unknown inbound receives normal handling, caps are exceeded, invite
  code is used unexpectedly, `/admin/access` shows bad status, or
  `/admin/observability` shows access warnings.
- Immediate response: Set `SMS_ACCESS_MODE=public_closed`, keep
  `SMS_SENDS_DISABLED=true`, pause affected invite codes, and mark suspicious
  participants `PAUSED` or `REJECTED`.
- Preserve: `access.*` audit events, participant IDs, invite code IDs, cap
  snapshot, inbound `MessageSid`, and deployment commit.
- Escalate: Engineering review before reopening invite-code or public-beta
  access.

## Codex Bug-Report Template

```text
Incident:
Severity:
Active commit:
Environment:
Observed time:
Expected behavior:
Actual behavior:
Health fields:
Relevant audit events:
Relevant job/message IDs:
Screenshots/logs with secrets redacted:
Immediate mitigation taken:
What must remain disabled:
```
