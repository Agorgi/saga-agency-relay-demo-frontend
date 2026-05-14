# Post-A2P Execution Playbook

This playbook starts only after A2P / SMS compliance approval is confirmed.
Until then, keep `SMS_SENDS_DISABLED=true` and hold the release candidate.

## Stage 1 - Confirm Approval

1. Verify Twilio A2P/campaign approval manually in Twilio.
2. Confirm the approved campaign matches the Saga SMS producer use case.
3. Confirm opt-in, STOP, START, HELP, privacy, terms, and support copy are ready.
4. Set `SMS_COMPLIANCE_APPROVED=true`.
5. Keep `SMS_SENDS_DISABLED=true`.
6. Verify `/api/health`.
7. Run:

```bash
npm run test:release-candidate
npm run launch:drill-report
```

Rollback: restore `SMS_COMPLIANCE_APPROVED=false` if approval status was entered
incorrectly, keep sends disabled, and preserve audit notes.

## Stage 2 - One-Number Self-Test

1. Ensure `SMS_ALLOWED_NUMBERS` contains exactly the founder/operator phone.
2. Ensure `PILOT_STAGE=internal_test`.
3. Choose `PILOT_REPLY_MODE=manual_approval` or `auto_allowlisted` based on the
   final self-test path.
4. Confirm outbound self-test readiness is ready in dry run.
5. Capture `/api/health`, Twilio log, and admin/audit baselines.
6. Set `SMS_SENDS_DISABLED=false` only for the controlled test window.
7. Send exactly one inbound message.
8. Expect exactly one outbound reply if the selected path enables execution.
9. Verify Twilio outbound logs, phone receipt, admin/audit, and pipeline state.
10. Immediately restore `SMS_SENDS_DISABLED=true` unless the operator explicitly
    continues.

Rollback: set `SMS_SENDS_DISABLED=true`, set `PILOT_REPLY_MODE=draft_only`,
remove or reduce allowed numbers, preserve audit logs, and document anything
unexpected.

## Stage 3 - Internal Team

1. Use 2-5 internal testers only.
2. Keep allowlist required.
3. Do not run candidate outreach, shortlist sends, or group chat creation.
4. Review transcripts daily.
5. Keep observability and command center open during testing.

Rollback: pause participants, restore draft/manual mode, set sends disabled,
and preserve audit logs.

## Stage 4 - 10 Design Partners

1. Limit active design partners to 10.
2. Confirm explicit opt-in and participant records.
3. Confirm transcript dry runs and beta cohort simulation are passing.
4. Confirm data ops, observability, incident response, and rollback readiness.
5. Human-monitor conversations and collect feedback.
6. Do not publicly share the number.
7. Do not run external outreach automation.

Rollback: pause participants, disable sends, close invite codes, preserve audit,
and run the incident checklist if any unsafe behavior occurred.

## Stage 5 - Private Beta

1. Expand to 25-50 users only after design partner review passes.
2. Keep caps and invite/operator approval active.
3. Run command center and observability daily reports.
4. Review data retention and redaction posture.
5. Keep public beta disabled unless explicitly reviewed.

Rollback: pause admissions, disable sends, mark affected participants paused,
and preserve audit/data exports.

## Stage 6 - Capped Public Beta

1. Enable only through an explicit public beta review.
2. Confirm public beta support, privacy, terms, caps, abuse/rate-limit controls,
   incident process, and rollback readiness.
3. Keep `PUBLIC_LAUNCH_ENABLED=false` until final public launch approval.
4. Show the public number only if explicitly enabled.
5. Continue to exclude production Saga app integration, ticketing, RSVP, QR,
   payments, and event publishing.

Rollback: disable public beta gates, hide the public number, pause admissions,
set sends disabled, and follow the incident runbook for any user-facing issue.
