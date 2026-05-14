# Docs Truth Map

Baseline: `main` after `d74dc17`.

This map is exhaustive for files under `docs/` at audit time, including JSON examples. "Historical" means keep for context but confirm against newer truth docs before using operationally.

| File | Feature area | Currentness | Related routes/tests | Stale-risk / old behavior risk | Action | Priority |
|---|---|---|---|---|---|---|
| `docs/a2p-compliance-packet.md` | SMS compliance | current runbook | Twilio/self-test | external approval status can change | keep/update after approval | high |
| `docs/abuse-and-rate-limit-readiness.md` | safety | current | security tests | may lag new rate limits | keep | medium |
| `docs/admin-info-architecture-v0.2.md` | admin UX | current | admin IA tests | low | keep | high |
| `docs/admin-operator-ux-v0.1.md` | admin UX | historical/current | admin nav tests | superseded by v0.2 in places | keep, point to v0.2 | medium |
| `docs/admin-page-consolidation-plan-v0.2.md` | admin UX | current | admin IA tests | low | keep | high |
| `docs/admin-route-inventory-v0.2.md` | admin UX | current | admin IA tests | low | keep | high |
| `docs/admin-route-truth-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/ai-evals.md` | AI evals | current-ish | AI/LLM tests | may lag latest matching/conversation evals | review later | medium |
| `docs/architecture.md` | architecture | current-ish | broad | can lag new graph/public-web modules | update from truth maps | medium |
| `docs/beta-cohort-simulation.md` | beta simulation | current | beta simulation tests | low | keep | medium |
| `docs/candidate-graph-indexing-strategy.md` | graph | current | graph/matching tests | low | keep | medium |
| `docs/candidate-graph-v0.6a.md` | graph | current | graph tests | low | keep | medium |
| `docs/capped-public-beta-infrastructure.md` | public beta | current | capped beta tests | public beta is still off | keep | high |
| `docs/ci.md` | CI | current-ish | package scripts | may lag new test scripts | update periodically | medium |
| `docs/claude-railway-handoff.md` | handoff | historical | deployment/runtime | may contain superseded step order | archive/review before use | high |
| `docs/controlled-live-reply-execution.md` | live reply plan | current | controlled live test | first live send not run | keep | high |
| `docs/conversation-engine-plan.md` | conversation | historical | conversation tests | plan may predate v0.1 consolidation | merge/archive later | low |
| `docs/conversation-engine-v0.1.md` | conversation | current | conversation wrapper | low | keep | high |
| `docs/conversation-quality-guide.md` | conversation quality | current | capability/conversation tests | needs pilot transcript refresh | keep/update during pilot | high |
| `docs/data-model-truth-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/data-model.md` | data model | historical/current | schema tests indirectly | may lag newer graph/public-web models | update from truth map | high |
| `docs/demo-mode.md` | Dev Lab | current-ish | demo-flow | Dev Lab now advanced | keep | medium |
| `docs/deployment-runtime-truth-map.md` | deployment | current | repo truth test/build | low | keep | high |
| `docs/design-partner-feedback-questions.md` | pilot | current | operator playbook test | low | keep | high |
| `docs/design-partner-launch-checklist.md` | pilot | historical/current | pilot readiness | superseded partly by v0.8/v0.9 | merge later | medium |
| `docs/design-partner-operator-checklist.md` | pilot | current | operator playbook | low | keep | high |
| `docs/design-partner-pilot-runbook.md` | pilot | current | pilot tests | low | keep | high |
| `docs/design-partner-pilot-script-v0.8.md` | pilot | current | operator playbook | low | keep | high |
| `docs/design-partner-simulation-report-template.md` | pilot simulation | current-ish | dry run tests | may be superseded by reports | keep | low |
| `docs/design-partner-sms-pilot.md` | pilot | historical/current | pilot readiness | superseded by v0.8/v0.9 details | review before use | medium |
| `docs/design-partner-transcript-dry-runs.md` | pilot dry runs | current | transcript dry run tests | low | keep | medium |
| `docs/docs-truth-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/engineering-handoff.md` | handoff | historical | broad | likely superseded by truth audit | archive/review before use | high |
| `docs/engineering-review-priority-list.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/examples/internal-api/create-interest-check.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/examples/internal-api/create-role-openings.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/examples/internal-api/import-event.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/examples/internal-api/import-relationships.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/examples/internal-api/opportunity-interest.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/examples/internal-api/upsert-user.json` | internal API | current example | internal API tests | sample only | keep | medium |
| `docs/feature-inventory.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/feature-status-summary.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/incident-response-runbook.md` | operations | current-ish | launch/security tests | should be reread before pilot | keep | high |
| `docs/internal-api.md` | internal API | current | internal API tests | no real Saga connection | keep | high |
| `docs/known-open-items.md` | release/pilot | current-ish | RC tests | must be updated after blockers change | keep | high |
| `docs/launch-readiness-drill.md` | launch | current | launch drill tests | low | keep | high |
| `docs/llm-provider-integration.md` | LLM | current | LLM provider tests | provider API can change | keep/review before live | high |
| `docs/llm-quality-review.md` | LLM review | current | LLM quality tests | low | keep | high |
| `docs/matching-evaluation-tuning-v0.7.md` | matching eval | current | matching eval tests | synthetic only | keep | medium |
| `docs/messaging-pipeline-reliability.md` | pipeline | current | messaging pipeline tests | async-active still off | keep | high |
| `docs/mock-app-integration.md` | internal/mock | current-ish | mock integration tests | real app not connected | keep | medium |
| `docs/observability.md` | observability | historical/current | observability tests | overlaps production observability | merge later | medium |
| `docs/operator-command-center.md` | command center | current | command center tests | low | keep | high |
| `docs/outbound-self-test-checklist.md` | self-test | historical/current | self-test tests | superseded by post-A2P checklist in places | merge later | high |
| `docs/outbound-sms-self-test-runbook.md` | self-test | historical/current | controlled live/self-test tests | superseded by v0.9 details | review before use | high |
| `docs/outreach-channel-policy.md` | contactability/outreach | current | contactability tests | legal review required before sends | keep | high |
| `docs/per-phone-conversation-autonomy-v0.1.md` | conversation autonomy | current | per-phone autonomy tests | new v0.1 gate; browser QA still needed | keep | critical |
| `docs/pilot-backup-restore-runbook.md` | data ops | current-ish | pilot data tests | needs real backup verification | keep | high |
| `docs/pilot-data-incident-runbook.md` | data ops | current-ish | pilot data/security | review before pilot | keep | high |
| `docs/pilot-data-inventory.md` | data ops | current-ish | pilot data tests | may lag schema additions | update from data truth map | high |
| `docs/pilot-data-retention.md` | data ops | current-ish | pilot data tests | legal/privacy review needed | keep | high |
| `docs/pilot-infrastructure-readiness.md` | pilot ops | current-ish | readiness tests | may lag v0.9 | review before pilot | high |
| `docs/pilot-migration-checklist.md` | data ops | historical/current | deployment/data | production integration not in scope | keep as future | medium |
| `docs/pilot-rollback-runbook.md` | pilot ops | current-ish | launch drill | verify during drill | keep | high |
| `docs/post-a2p-execution-playbook.md` | post-A2P | current | self-test/launch tests | depends on external approval | keep | critical |
| `docs/post-a2p-one-number-self-test-v0.9.md` | self-test | current | post-A2P test | plan only; not executed | keep | critical |
| `docs/post-a2p-self-test-checklist.md` | self-test | current | post-A2P test | plan only; not executed | keep | critical |
| `docs/producer-agent-v0.1.md` | producer | current-ish | producer tests | early version doc | keep | medium |
| `docs/producer-agent-v0.2.md` | producer | current-ish | producer tests | early version doc | keep | medium |
| `docs/producer-agent-v0.3.md` | producer | current-ish | producer tests | early version doc | keep | medium |
| `docs/producer-agent-v0.4.md` | producer | current | producer tests | low | keep | high |
| `docs/production-observability.md` | observability | current | observability tests | overlaps `observability.md` | keep | high |
| `docs/public-beta-access-control.md` | public beta | current | public beta tests | beta off | keep | high |
| `docs/public-beta-landing-copy.md` | public beta | draft/current | public beta tests | copy may change | keep as draft | medium |
| `docs/public-beta-launch-checklist.md` | public beta | future runbook | public beta tests | launch blocked | keep | high |
| `docs/public-launch-foundations.md` | public launch | future runbook | launch/public beta tests | launch blocked | keep | high |
| `docs/public-web-research-async-dry-run-v0.4.1.md` | public web | current | async dry-run tests | low | keep | critical |
| `docs/public-web-research-live-dry-run-v0.4.md` | public web | historical/current | live dry-run tests | superseded by async/schema fix notes | keep with pointer | high |
| `docs/public-web-research-policy.md` | public web policy | current | public web tests | policy/legal review needed | keep | critical |
| `docs/public-web-research-review-cleanup-v0.5.md` | public web review | current | cleanup/contactability tests | low | keep | critical |
| `docs/public-web-research-shadow-v0.3.md` | public web | historical/current | shadow tests | superseded by later modes | keep | medium |
| `docs/rc-readiness-matrix.md` | release candidate | current-ish | RC tests | rerun after changes | keep | high |
| `docs/redundancy-and-consolidation-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/regression-testing.md` | tests | current | all scripts | must track new scripts | keep/update | high |
| `docs/relationship-aware-matching-v0.6b.md` | matching | current | matching tests | low | keep | high |
| `docs/release-candidate-v0.1.md` | release candidate | current-ish | RC tests | RC tag/checkpoint may be historical | keep | high |
| `docs/safety-critical-paths-audit.md` | repo audit | current | repo truth/security tests | low | keep | critical |
| `docs/security-review.md` | security | current-ish | security tests | review before outbound test | keep | critical |
| `docs/service-file-truth-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/staging-baseline.md` | staging | historical/current | staging baseline | may lag admin IA | keep/update | medium |
| `docs/staging-deploy-checklist.md` | staging | current-ish | build/deploy | confirm Railway specifics before deploy | keep | high |
| `docs/staging-repeatability.md` | staging | current-ish | staging repeatability | low | keep | medium |
| `docs/talent-discovery-engine-v0.1.md` | talent discovery | current | talent tests | low | keep | high |
| `docs/talent-research-quality-v0.2.md` | quality review | current | quality tests | low | keep | high |
| `docs/test-coverage-map.md` | repo audit | current | repo truth test | low | keep | high |
| `docs/twilio-readiness.md` | Twilio | current | Twilio tests | external compliance state can change | keep | critical |
| `docs/twilio-staging-pilot.md` | Twilio/pilot | historical/current | Twilio tests | superseded by post-A2P plan in places | review before use | high |
| `docs/v0.2-engineering-review.md` | engineering review | historical | broad | superseded by this audit | archive/reference | low |
| `docs/workflow-state-machine.md` | workflow | current | workflow tests | low | keep | medium |

Priority docs to refresh before pilots:

1. `docs/known-open-items.md`
2. `docs/twilio-readiness.md`
3. `docs/outbound-sms-self-test-runbook.md`
4. `docs/design-partner-pilot-runbook.md`
5. `docs/pilot-data-inventory.md`
6. `docs/staging-deploy-checklist.md`
