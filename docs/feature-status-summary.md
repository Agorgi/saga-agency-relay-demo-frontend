# Feature Status Summary

Baseline: `main` after `d74dc17` (`Simplify admin information architecture and needs attention UX`), with the per-phone autonomy checkpoint updated after `71a3588` (`Add per-phone conversation autonomy controls`).

This is the quick engineer read. Status means repo state, not product launch approval. "UI verified" means recently browser-verified; most admin surfaces are implemented and build-tested but still need an operator click-through pass before pilot use.

| Feature area | Status | Routes | Models | Tests | Docs | UI verified? | Deployed verified? | Safety risk | Engineer priority | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| SMS / Twilio safety | implemented_tested_not_ui_verified | `/api/twilio/*`, admin health pages | User, Message, InboundProcessingJob, AuditLog | `test:twilio-readiness`, staging baseline | twilio/readiness/runbooks | partial | unknown | high | Staging inbound/mock tests pass; outbound remains gated. |
| Conversation Engine | implemented_tested_not_ui_verified | inbound webhook, admin transcript dry runs | Message, ProjectBrief, LlmReviewItem | `test:conversation-engine-v0.1` | conversation docs | partial | unknown | high | Deterministic policies and capability responses exist. |
| Capability / FAQ responses | implemented_tested_not_ui_verified | conversation paths | Message, ProjectBrief | `test:conversation-capability-responses` | conversation quality, pilot runbook | not recently | unknown | medium | User-facing only; no internal system exposure intended. |
| LLM provider integration | implemented_tested_not_ui_verified | `/admin/dev`, health | LlmReviewItem | `test:llm-provider` plus LLM checks | llm provider docs | partial | unknown | high | Fallback/shadow/active_mock only by default. |
| LLM Quality Review / Response Tuning | implemented_tested_not_ui_verified | `/admin/llm-review` | LlmReviewItem | `test:llm-quality-review` | llm quality docs | partial | unknown | high | Response tuning is a filtered review mode, not a separate route. |
| Producer Agent v0.1-v0.4 | implemented_tested_not_ui_verified | project/admin draft pages | ProjectBrief, CandidateRecommendation, ShortlistPacket, OutboundDraft | producer tests | producer docs | partial | unknown | high | Draft/review workflows exist; sends remain gated. |
| Candidate review / shortlist / draft workflows | implemented_tested_not_ui_verified | `/admin/recommendations`, `/admin/outbound-drafts`, project detail | CandidateRecommendation, ShortlistPacket, OutboundDraft | approval/draft/send-readiness tests | producer docs | partial | unknown | high | Review states are present; organizer/candidate send paths remain blocked by safety gates. |
| Controlled Live Reply Execution | implemented_tested_not_ui_verified | no dedicated route | Message, AuditLog | `test:controlled-live-reply-execution` | controlled-live docs | no | unknown | high | Plan/test harness only for future controlled window. |
| Outbound Self-Test Readiness | implemented_tested_not_ui_verified | Command Center, Launch Checklist | AuditLog | `test:outbound-self-test-readiness`, `test:post-a2p-self-test-plan` | self-test docs | partial | unknown | critical | A2P approval and one-number test still blockers. |
| Messaging Pipeline Reliability | implemented_tested_not_ui_verified | `/admin/pipeline` | InboundProcessingJob, Message | `test:messaging-pipeline` | pipeline docs | partial | unknown | high | Async-active mode remains disabled by default. |
| Production Observability | implemented_tested_not_ui_verified | `/admin/observability`, `/api/health` | many read-only counts | `test:production-observability` | observability docs | partial | unknown | high | Health is redacted and high-level; build has known non-blocking NFT warning. |
| Public Beta Access Control | implemented_tested_not_ui_verified | `/admin/public-beta`, `/admin/access` | BetaInviteCode, PublicBetaWaitlistEntry, ConsentEvent, PilotParticipant | `test:public-beta-access-control` | public beta docs | partial | unknown | high | Public beta/launch flags remain off. |
| Pilot Data Operations | implemented_tested_not_ui_verified | `/admin/data-ops` | PilotParticipant, PilotFeedback, ConsentEvent | `test:pilot-data-ops` | pilot data docs | partial | unknown | high | Redacted/export preview paths require privacy review before real pilot use. |
| Launch Readiness Drill | implemented_tested_not_ui_verified | `/admin/launch-drill` | AuditLog | `test:launch-readiness-drill` | launch drill docs | partial | unknown | high | Simulation-only. |
| Operator Command Center | implemented_tested_not_ui_verified | `/admin/command-center` | aggregate read-only | `test:operator-command-center` | command center docs | partial | unknown | high | v0.2 simplified and includes Needs Attention count. |
| Capped Public Beta Infrastructure | implemented_tested_not_ui_verified | `/admin/public-beta`, `/beta` | BetaInviteCode, PublicBetaWaitlistEntry | `test:capped-public-beta-infrastructure` | capped beta docs | partial | unknown | high | Infrastructure exists but launch gate off. |
| Beta Cohort Simulation | implemented_tested_not_ui_verified | `/admin/beta-simulations` | BetaCohortSimulationRun, BetaCohortSimulationMemberResult | `test:beta-cohort-simulation` | beta cohort docs | partial | unknown | medium | Synthetic only. |
| Design Partner Pilot Playbook | docs_only | docs and Command Center links | none | `test:design-partner-operator-playbook` | pilot script/checklist docs | n/a | n/a | high | Does not invite or send. |
| Post-A2P Self-Test Plan | docs_only | Command Center refs | none | `test:post-a2p-self-test-plan` | post-A2P docs | n/a | n/a | critical | Plan only; first real outbound test not run. |
| Talent Discovery Engine | implemented_tested_not_ui_verified | `/admin/sourcing` | TalentSearchRun, TalentCandidate | `test:talent-discovery` | talent discovery docs | partial | unknown | high | Internal-first; public research disabled unless gated. |
| Talent Research Quality Review | implemented_tested_not_ui_verified | `/admin/sourcing-quality` | TalentResearchReview | `test:talent-research-quality` | quality docs | partial | unknown | high | Public candidates gated. |
| Public Web Research shadow/live/async/review cleanup | implemented_tested_not_ui_verified | `/admin/sourcing/public-web`, `/admin/sourcing/public-web-review` | PublicWebResearchRun, PublicWebResearchJob, PublicWebResearchResult | public-web tests | public web docs | partial | unknown | critical | Disabled by default; live dry run only via explicit gates and CLI/worker path. |
| Contactability Evidence | implemented_tested_not_ui_verified | `/admin/sourcing/public-web-review` | ContactabilityEvidence | `test:contactability-evidence` | outreach-channel policy | partial | unknown | high | Evidence only; never permission. |
| Candidate Graph Foundation | implemented_tested_not_ui_verified | `/admin/candidate-graph` | CandidateGraphEdge, CandidateSearchProfile | `test:candidate-graph-foundation` | graph docs | partial | unknown | medium | Advanced/debug-facing. |
| Relationship-Aware Matching | implemented_tested_not_ui_verified | `/admin/matching` | CandidateGraphMatchRun, CandidateGraphMatchResult | `test:relationship-aware-matching` | matching docs | partial | unknown | high | No outreach or shortlist send. |
| Matching Evaluation & Tuning | implemented_tested_not_ui_verified | `/admin/matching-evaluation` | synthetic/in-memory plus reports | `test:matching-evaluation-tuning` | matching eval docs | partial | unknown | medium | Advanced QA; no auto-tuning. |
| Admin Navigation / Needs Attention | implemented_tested_not_ui_verified | all admin routes, `/admin/needs-attention` | read-only aggregates | `test:admin-navigation-ux`, `test:admin-info-architecture` | admin UX docs | build-tested | unknown | high | v0.2 grouped IA and badges. |
| Per-Phone Conversation Autonomy Controls | implemented_tested_deployed | Contacts, Pilot Participants, Needs Attention, Command Center | ConversationAutonomySetting, AuditLog | `test:per-phone-autonomy-controls`, `test:controlled-live-reply-execution` | per-phone autonomy doc | staging verified | staging verified after `71a3588` | critical | Ordinary conversation only when toggled; handoff before outreach, shortlists, group chats, payment/rate/legal, safety, or external actions. |
| Release Candidate Packaging | implemented_needs_qa | docs/report scripts | none | `test:release-candidate-package`, `test:release-candidate` | RC docs | n/a | unknown | high | Tagging/reporting exists historically; current checkpoint may need fresh run. |
| Internal Saga API contracts | implemented_tested_not_ui_verified | `/api/internal/saga/*` | Project, RoleOpening, Opportunity, InterestCheck, RelationshipEdge | `test:internal-api` | internal API docs | no | unknown | high | Standalone contract only; real Saga app not connected. |
| Demo / Dev Lab | deprecated_or_advanced | `/admin/dev` | many demo records | `test:demo-flow`, seed tests | demo docs | partial | unknown | medium | Useful but should remain Advanced. |
| Admin UX / Information Architecture | implemented_tested_not_ui_verified | all admin routes | nav config only | admin IA tests | admin UX/consolidation docs | build-tested | unknown | high | No route deletion or behavior change. |

Status counts in this audit:

- `implemented_tested_deployed`: 1
- `implemented_tested_not_ui_verified`: 27
- `implemented_needs_qa`: 1
- `docs_only`: 2
- `deprecated_or_advanced`: 1
- `partial`: 0
- `test_only`: 0
- `missing_unknown`: 0
