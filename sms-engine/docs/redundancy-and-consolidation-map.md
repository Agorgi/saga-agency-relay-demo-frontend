# Redundancy and Consolidation Map

Baseline: `main` after `d74dc17`.

This is an audit only. Do not merge/delete pages or models from this document.

## Likely Duplicate or Confusing Pages

| Area | Current pages | Issue | Recommendation | Timing |
|---|---|---|---|---|
| Project intake vs canonical projects | `/admin/projects`, `/admin/network-projects` | Operators may not know why there are two project pages. | Fold Network Projects into Projects as a "Canonical Projects" tab or a secondary detail panel. | before design partners if time permits, otherwise after pilot |
| Staffing | `/admin/role-openings`, `/admin/opportunities` | Two-layer model is correct but UI labels are too technical. | Combine into "Staffing Needs" with role rows and opportunity state. | before private beta |
| Matching | `/admin/matching`, `/admin/candidate-graph`, `/admin/recommendations` | Matching is operator-facing; graph/recommendations are diagnostic/legacy-adjacent. | Make Smart Matching the primary page; keep Talent Map and Recommendations under Advanced or as tabs. | after pilot QA |
| AI review | `/admin/llm-review`, nav filter for Response Tuning | Response Tuning is a filtered view of the same review items. | Keep one AI Reply Review page with filters/tabs. | already mostly done |
| Health | `/admin/observability`, `/admin/pipeline` | Operators want one "is the system okay?" answer. | Combine visually into System Health with Pipeline tab/details. | before public beta |
| Public web research | `/admin/sourcing/public-web`, `/admin/sourcing/public-web-review` | Queue/review cleanup is split across pages. | Make one tabbed Public Talent Research page: Plan/Jobs/Results/Cleanup. | before broader beta |
| Pilot ops | `/admin/pilot`, `/admin/pilot-participants`, `/admin/pilot-feedback` | Three pages may be okay but could be tabs. | Keep during pilot; revisit after feedback. | after design partner pilot |
| Public beta | `/admin/public-beta`, `/admin/access`, `/admin/beta-simulations` | Access/simulation are related but different operator moments. | Keep grouped under Operations; consider Public Beta tabs later. | before public beta |
| Outreach | `/admin/outbound-drafts`, `/admin/outreach` | OutboundDraft is current safe draft model; Outreach is legacy state. | Keep Outreach Log under Advanced until consolidation. | after pilot |

## Likely Model Overlaps

| Models | Overlap | Current truth | Recommendation |
|---|---|---|---|
| User, Person, Contact | All represent people/contact identity from different eras. | User is SMS organizer, Person is future canonical, Contact is legacy contact. | Keep bridge until pilot; design identity consolidation before production app integration. |
| ProjectBrief, Project | Brief is conversation intake; Project is canonical network project. | Both are valid today. | Fold UI, not schema, first. |
| RoleOpening, Opportunity | Role need vs opportunity/application layer. | Correct separation but confusing to operators. | One "Staffing Needs" UI. |
| CandidateRecommendation, TalentCandidate, CandidateGraphMatchResult, PublicWebResearchResult | Stages of candidate discovery/review/matching. | All have distinct provenance today. | Define promotion lifecycle before merging models. |
| Outreach, OutboundDraft | Legacy outreach state vs safe draft content. | OutboundDraft is safer current surface. | Treat Outreach as advanced/legacy until send path reviewed. |
| GroupChat, ProductionConversation | Legacy group chat vs future provider-agnostic conversation. | Both exist; no auto creation. | Keep gated; revisit before group-chat product work. |

## Docs That Overlap

- `docs/observability.md` and `docs/production-observability.md`
- `docs/outbound-self-test-checklist.md`, `docs/outbound-sms-self-test-runbook.md`, and post-A2P self-test docs
- public web v0.3/v0.4/v0.4.1/v0.5 docs
- design partner pilot runbook/checklist/script docs
- staging baseline/repeatability/deploy/checklist docs

Keep historical docs for now, but add a top-level "current runbook" pointer before pilots.

## Test Script Overlaps

- `test:agent`, `test:intake`, and `test:producer-agent` cover related producer/intake paths.
- `test:security` and `test:security-hardening` are aliases/wrappers.
- `test:workflow` and `test:workflow-state-machine` are aliases/wrappers.
- `test:contactability-evidence` currently points to the public-web cleanup test file.
- Conversation tests are intentionally granular and wrapped by `test:conversation-engine-v0.1`.

## Powerful Pages That Should Stay Advanced

- Dev Lab
- Talent Map / Candidate Graph
- Recommendations
- Matching Evaluation
- Outreach Log

## Core Pages to Surface in Command Center / Needs Attention

- Needs Attention
- Outreach Drafts / pending replies
- Candidate Reviews
- Research Cleanup
- Pipeline failures
- Launch Checklist
- System Health

## Direct Answers

- **Should Network Projects be folded into Projects?** Yes, as a tab or secondary view. Do not remove the route until detail-page behavior is unified.
- **Should Role Openings + Opportunities become Staffing Needs?** Yes, in the UI. Keep the two-model data structure.
- **Should Recommendations + Matching + Candidate Graph become Smart Matching?** Yes for operators. Candidate Graph should remain an advanced diagnostic surface.
- **Should LLM Review + Response Tuning become AI Reply Review?** Yes. Response Tuning is best represented as a filter.
- **Should Observability + Pipeline become System Health?** Yes as an operator surface, with Pipeline details still available.
- **Should Public Web Research + Research Cleanup be one tabbed page?** Yes once the review workflow has pilot usage feedback.
- **Which pages should non-technical operators never need?** Dev Lab, Talent Map, Matching Evaluation, Outreach Log, and possibly Recommendations once Smart Matching absorbs review flow.

