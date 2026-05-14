# Pilot Data Incident Runbook

This runbook covers the standalone Saga SMS Producer pilot database and admin
surfaces. It does not cover the production Saga app.

## Immediate Pause Steps

1. Keep or set `SMS_SENDS_DISABLED=true`.
2. Set `PILOT_REPLY_MODE=draft_only` if needed.
3. Pause affected `PilotParticipant` records.
4. Preserve audit logs, Railway logs, and screenshots.
5. Do not delete data until the incident scope is understood.

## Incidents

### Raw phone number exposed in admin or export

- Severity: high.
- Detect: raw `+1...` or 10-digit phone appears in `/admin/data-ops`, export,
  observability, or logs.
- Response: pause exports, capture the route/export type, redact the affected
  record, and file a Codex bug with the serializer path.

### Secret accidentally logged

- Severity: critical.
- Detect: `OPENAI_API_KEY`, `TWILIO_AUTH_TOKEN`, `DATABASE_URL`,
  `INTERNAL_API_KEY`, or admin password appears in logs/export.
- Response: rotate the secret, preserve evidence in a restricted channel, patch
  redaction, and rerun security hardening tests.

### OpenAI prompt/output logged unexpectedly

- Severity: medium to high.
- Detect: prompt or raw output appears while `LLM_LOG_PROMPTS=false` or
  `LLM_LOG_OUTPUTS=false`.
- Response: disable LLM active mock/shadow if needed, preserve audit evidence,
  patch logging gates, and rerun LLM tests.

### Wrong participant data exported

- Severity: high.
- Response: identify export type/time, notify pilot operator, redact exported
  copy, and record `data_ops.export_failed` or an incident note.

### Failed redaction

- Severity: medium.
- Response: do not retry blindly; inspect affected model, preserve audit log,
  patch the redaction service, then retry from `/admin/data-ops`.

### Unexpected production app data detected

- Severity: critical.
- Response: pause pilot, verify `DATABASE_URL`, stop any import, preserve
  evidence, and do not merge/restore until engineering review is complete.

### Database unavailable

- Severity: high.
- Response: keep sends disabled, check Railway Postgres, preserve logs, and
  restore only to a separate staging DB first.

### Accidental migration against wrong DB

- Severity: critical.
- Response: stop deploys, preserve migration output, identify target DB, and
  follow the backup/restore runbook with engineering approval.

### Accidental public launch flag enabled

- Severity: critical.
- Response: set `PUBLIC_LAUNCH_ENABLED=false`, `PUBLIC_BETA_ENABLED=false`, and
  `SMS_SENDS_DISABLED=true`; preserve health/audit snapshots.

## Codex Bug Report Template

```text
Incident:
Route/script:
Expected redaction:
Observed exposure:
Relevant audit event IDs:
Data models involved:
SMS_SENDS_DISABLED value:
Steps to reproduce without Twilio/SMS:
```
