# RC Readiness Matrix

| Area | Status | Test script | Docs | Admin UI | Key safety gates | Known caveats | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Conversation Engine v0.1 | complete | `test:conversation-engine-v0.1` | `docs/conversation-engine-v0.1.md` | `/admin/dev` | deterministic routing, safety escalation, no send decision authority | live SMS remains blocked | continue transcript review |
| Producer Agent v0.1 | complete | `test:producer-agent` | `docs/producer-agent-v0.1.md` | `/admin/projects` | dry-run recommendations only | demo/seed candidate data only | review quality before pilot |
| Producer Agent v0.2 | complete | `test:producer-approval-queue` | `docs/producer-agent-v0.2.md` | `/admin/recommendations` | candidate approval queue, no sends | admin review required | keep approval gated |
| Producer Agent v0.3 | complete | `test:producer-outreach-drafts` | `docs/producer-agent-v0.3.md` | `/admin/outbound-drafts` | drafts only, no outreach sends | organizer/candidate copy must remain review-only | continue draft QA |
| Producer Agent v0.4 | complete | `test:producer-send-readiness` | `docs/producer-agent-v0.4.md` | `/admin/outbound-drafts` | approved draft send-readiness dry runs | no live execution | use before self-test |
| LLM Provider Integration | complete | `test:llm-provider` | `docs/llm-provider-integration.md` | `/admin/dev`, `/admin/pilot` | fallback, shadow, active_mock; active_live disabled | live LLM replies not enabled | keep active_mock/admin-only |
| LLM Quality Review | complete | `test:llm-quality-review` | `docs/llm-quality-review.md` | `/admin/llm-review` | forbidden claims, fallback comparison | review volume still manual | keep reviewing transcripts |
| Design Partner Transcript Dry Runs | complete | `test:design-partner-transcript-dry-runs` | `docs/design-partner-transcript-dry-runs.md` | `/admin/transcript-dry-runs` | simulation only, no SMS | synthetic coverage only | rerun before pilot |
| Messaging Pipeline Reliability | complete | `test:messaging-pipeline` | `docs/messaging-pipeline-reliability.md` | `/admin/pipeline` | default sync, async_active future-only, idempotency | no worker service required yet | test async_shadow manually |
| Production Observability | complete | `test:production-observability` | `docs/production-observability.md` | `/admin/observability` | redacted risk dashboard, no env editing | external alerting not yet added | run daily reports |
| Public Beta Access Control | complete | `test:public-beta-access-control` | `docs/public-beta-access-control.md` | `/admin/access` | allowlist/invite/caps/closed public gates | public beta disabled | keep closed until approved |
| Pilot Data Operations | complete | `test:pilot-data-ops` | data ops docs | `/admin/data-ops` | redacted exports, soft redaction, audit preserved | backup steps require operator/Railway action | confirm backups pre-pilot |
| Launch Readiness Drill | complete | `test:launch-readiness-drill` | `docs/launch-readiness-drill.md` | `/admin/launch-drill` | simulation only, stage blockers | manual evidence still required | run after A2P |
| Operator Command Center | complete | `test:operator-command-center` | `docs/operator-command-center.md` | `/admin/command-center` | safe action hub, no dangerous controls | status aggregation only | use as operator home |
| Capped Public Beta Infrastructure | complete | `test:capped-public-beta-infrastructure` | `docs/capped-public-beta-infrastructure.md` | `/admin/public-beta`, `/beta` | disabled defaults, consent, caps, hidden number | not activated | keep public beta disabled |
| Beta Cohort Simulation | complete | `test:beta-cohort-simulation` | `docs/beta-cohort-simulation.md` | `/admin/beta-simulations` | fake data only, no real users | modeled pressure, not live traffic | rerun before each stage |
| Outbound Self-Test Readiness | complete | `test:outbound-self-test-readiness` | `docs/outbound-sms-self-test-runbook.md` | `/admin/pilot` | compliance, one allowlisted recipient, dry-run readiness | blocked while sends disabled | run after A2P |
| Twilio Readiness | complete | `test:twilio-readiness` | `docs/twilio-readiness.md` | `/admin/pilot` | inbound staging, webhook validation, no-send posture | no outbound test yet | verify after deployment |
| Security Hardening | complete | `test:security-hardening` | `docs/security-review.md` | `/admin/audit` | redaction, auth checks, safe logs | admin auth remains simple | review before wider beta |
| Regression Harness | complete | `test:release-candidate` | `docs/regression-testing.md` | n/a | safe test wrapper only | long-running suite | run before tagging/deploy |

Outbound live send remains blocked by A2P/compliance and
`SMS_SENDS_DISABLED=true`. Production integration is intentionally not started.
