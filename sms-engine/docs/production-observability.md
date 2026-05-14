# Production Observability v0.1

Production Observability v0.1 gives operators one redacted internal view of the standalone Saga SMS Producer app before any design-partner or public-beta traffic is enabled. It monitors safety posture, inbound/outbound activity, LLM health, pipeline jobs, pilot readiness, and risk signals without changing product behavior.

This layer is admin-only. It does not send SMS, enable async-active processing, enable `LLM_MODE=active_live`, connect the main Saga app, or touch event publishing, ticketing, RSVP, QR, payment, or production Saga app data.

## Summary Shape

`src/lib/observability/observabilitySummary.ts` produces:

- `app`: database, app base URL, admin, and internal API configuration presence.
- `sms`: provider mode, sends-disabled state, allowlist status, Twilio staging/webhook flags, compliance/public-launch flags, recent inbound/outbound counts, blocked sends, and unexpected outbound detection.
- `llm`: effective provider/mode/model, shadow/active-mock/live state, recent call/success/failure/fallback counts, fallback rate, and top failure categories.
- `conversation`: recent intent classifications, reply plans, needs-admin count, and flow counts.
- `producer`: recent project understanding, role-map, recommendation, shortlist, and draft-readiness activity.
- `pipeline`: message processing mode, job counts, retryable jobs, and oldest pending job age.
- `pilot`: stage, reply mode, access mode, public beta enabled state,
  participant counts, waitlisted count, cap usage, invite code count, feedback
  count, and readiness gates.
- `dataOps`: pilot data-operations availability, recent export/redaction
  counts, paused/opted-out participant counts, backup checklist status,
  retention policy presence, incident runbook presence, and document warnings.
- `talentDiscovery`: availability, recent internal search count, sourcing-plan
  count, public-research-plan count, public-web research mode, and candidate
  review queue count.
- `risk`: green/yellow/red level, blockers, warnings, and recommended actions.

All outputs are passed through redaction helpers. Raw phone numbers, secrets, prompts, raw LLM outputs, and private notes should not appear.

## Invariants

`src/lib/observability/observabilityInvariants.ts` classifies risk.

Red blockers include:

- `SMS_SENDS_DISABLED=false` while `SMS_COMPLIANCE_APPROVED=false`.
- `PUBLIC_LAUNCH_ENABLED=true` outside `PILOT_STAGE=public_live`.
- `MESSAGING_PROVIDER=TWILIO` while webhook validation is disabled.
- Outbound activity detected while sends are disabled.
- `activeLiveAllowed=true` while sends are disabled.
- Raw phone numbers or known secrets in serialized observability output.
- Pipeline failed-job threshold exceeded.
- High LLM failure rate.
- Database health error.

Yellow warnings include:

- High LLM fallback rate.
- Failed jobs below the red threshold.
- A2P/compliance not approved.
- Active pilot participants while sends are disabled.

Warnings do not crash the app. They surface operator risk.

## Admin Dashboard

`/admin/observability` shows:

- System health.
- SMS safety and Twilio status.
- LLM health.
- Conversation Engine activity.
- Producer Agent activity.
- Pipeline jobs.
- Pilot readiness.
- Public beta access readiness, including caps and blocked inbound attempts.
- Pilot data operations, including export/redaction counts and runbook status.
- Talent Discovery, including internal search counts, public-research-plan
  counts, public-web mode, and candidate review queue.
- Candidate Graph, including search profile count, graph edge count,
  unverified research candidates, do-not-contact candidates, and
  public-web-only candidate count.
- Launch readiness drill status, including recommended launch stage, blocker
  count, last run, and design-partner/public-beta readiness.
- Linkage to `/admin/command-center`, the single operator console for
  go/no-go status, kill-switch posture, and safe action routing.
- Recent blocked sends and failures.
- Risk level and recommended actions.

The page is display-only. It has no send button, no environment editing controls, and no raw allowed numbers.

## Health Endpoint

`/api/health` exposes only lightweight observability fields:

- `observabilityAvailable`
- `riskLevel`
- `observabilityWarningsCount`
- `failedJobCount`
- `recentBlockedSendCount`
- `candidateGraphAvailable`
- `candidateSearchProfileCount`
- `graphEdgeCount`

It does not expose phone numbers, prompts, raw outputs, or secrets.

## Daily Report

Run:

```bash
npm run observability:daily-report
```

The report prints a redacted Markdown summary with app health, SMS safety, inbound/outbound counts, blocked send counts, LLM counts, pipeline pending/failed jobs, pilot readiness, risk level, top warnings, and recommended actions.

The observability summary also includes capped public beta counts and readiness:
waitlist count, admitted count, cap usage, daily new users, public beta blocker
count, and public number visibility. These fields are counts/statuses only and
do not expose phone numbers, emails, invite-code plaintext, prompts, outputs, or
secrets.

Production Observability also summarizes beta cohort simulation risk: latest
design-partner/private-beta/public-beta simulation readiness, over-capacity
readiness, blocker count, and latest run time. These are synthetic-only signals
used to surface launch pressure before real users are invited.

Release Candidate v0.1 adds `npm run release:rc-report`, which prints a
redacted RC Markdown report with git label, SMS safety, LLM mode, pipeline,
observability, access/public beta, data ops, launch drill, beta cohort
simulation status, blockers, warnings, next steps, and out-of-scope items. It
does not write secrets, phone numbers, prompts, raw LLM outputs, or production
Saga app data.

It is safe to run locally or in Railway SSH. If database access is missing, the report skips database-backed metrics gracefully.

For the launch command-center view, run:

```bash
npm run command-center:report
npm run release:rc-report
```

That report is also redacted and contains no SMS send behavior, Twilio send
calls, raw phone numbers, secrets, prompts, or raw LLM outputs.

## What Is Not Monitored Yet

- External uptime monitoring.
- Carrier-level Twilio delivery latency.
- Database backup freshness via Railway API.
- Cost dashboards.
- Public abuse/spam dashboards.
- Production Saga app health.

Add external monitoring only after the standalone pilot path is approved and the deployment target is stable.

## Runbooks

- `docs/incident-response-runbook.md`
- `docs/pilot-data-inventory.md`
- `docs/pilot-data-retention.md`
- `docs/pilot-backup-restore-runbook.md`
- `docs/pilot-data-incident-runbook.md`
- `docs/launch-readiness-drill.md`
- `docs/design-partner-launch-checklist.md`
- `docs/public-beta-launch-checklist.md`
- `docs/capped-public-beta-infrastructure.md`
- `docs/public-beta-landing-copy.md`
- `docs/pilot-rollback-runbook.md`
- `docs/outbound-sms-self-test-runbook.md`
- `docs/public-launch-foundations.md`
- `docs/messaging-pipeline-reliability.md`
- `docs/talent-research-quality-v0.2.md`
- `docs/public-web-research-shadow-v0.3.md`

## Talent Quality Signals

Production Observability reports whether Talent Research Quality Review is
available, pending quality review counts, public-web candidates pending review,
and the current talent-quality risk level. It never exposes raw phone numbers,
emails, private notes, public-source contents beyond admin-review-safe
summaries, prompts, raw LLM outputs, or secrets.

Public Web Research Shadow Mode, Live Dry Run, and Async Dry Run add safe
high-level signals for whether public-web research is available, enabled, ready,
blocked, allowed for a live dry run, queued, failed, or producing review-only
results. Health and observability do not expose source URLs, query text,
prompts, raw outputs, phone numbers, emails, or secrets.

Public Web Research Review & Cleanup v0.5 adds redacted counts for pending
review, needs-more-research, needs-more-contact-research, discarded, duplicate,
and do-not-contact results, plus source-quality and review risk levels.
Contactability evidence is reported only as pending-review/high-risk counts and
risk; raw email, phone, profile details, source URLs, private notes, prompts,
and provider outputs stay out of health and observability.

## Standalone Boundary

This app remains standalone. Observability is scoped to the Railway Postgres-backed SMS producer app and does not depend on the production Saga app or production Saga data.
