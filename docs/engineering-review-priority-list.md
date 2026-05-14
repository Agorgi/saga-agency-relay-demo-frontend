# Engineering Review Priority List

Baseline: `main` after `d74dc17`, with the per-phone autonomy checkpoint updated after `71a3588`.

## 1. Must Review Before A2P Outbound Self-Test

- `src/lib/smsSafety.ts`
- `src/lib/messagingProvider.ts`
- `src/lib/twilio.ts`
- `src/lib/twilioWebhook.ts`
- `src/app/api/twilio/inbound/route.ts`
- `src/app/api/twilio/status/route.ts`
- `src/lib/conversation/conversationAutonomy.ts`
- `src/lib/conversation/liveReplyExecutor.ts`
- `src/lib/producer/outboundSelfTestReadiness.ts`
- `src/lib/producer/sendReadiness.ts`
- `docs/post-a2p-one-number-self-test-v0.9.md`
- `docs/post-a2p-self-test-checklist.md`

## 2. Must Review Before Design Partners

- Command Center top status and blockers.
- Needs Attention summaries and links.
- Per-phone autonomy settings and handoff behavior.
- Conversation capability/FAQ responses.
- STOP/HELP/opt-out behavior.
- Transcript dry-run output.
- LLM review and fallback behavior.
- Pilot participant/allowlist docs and data handling.
- Data Tools redaction paths.
- Launch Checklist design partner stage.

## 3. Must Review Before Public Beta

- Public beta admission/cap logic.
- Waitlist and invite-code privacy.
- Public beta landing copy.
- Public launch gates.
- System Health and Pipeline combined operator workflow.
- Incident response and data retention runbooks.
- Cost/rate limits.
- Public web research policy if used for beta operations.

## 4. Can Review Later

- Matching Evaluation UI polish.
- Candidate Graph advanced debug UX.
- Dev Lab layout cleanup.
- Report script formatting.
- Historical docs archival.

## 5. Features Likely Partial or Scaffold

- ProductionConversation provider-backed flow.
- Team/TeamMember production workflow.
- Real Saga app integration contracts.
- Public web admin_active mode.
- Group chat automation.
- Role/Opportunity public application flows.

## 6. Features Likely Docs-Only

- Design Partner Pilot Script v0.8.
- Post-A2P One-Number Self-Test v0.9.
- Some incident/backup/rollback runbooks.
- Public beta launch checklist and landing copy.

## 7. Features Likely Redundant

- Network Projects vs Project Briefs.
- Role Openings vs Opportunities.
- Recommendations vs Smart Matching.
- Talent Map vs Smart Matching debug info.
- Outreach Log vs Outbound Drafts.
- Observability vs Pipeline.
- Public Web Research vs Research Cleanup.

## 8. Safety-Critical Files

- `src/lib/smsSafety.ts`
- `src/lib/messagingProvider.ts`
- `src/lib/twilio.ts`
- `src/lib/twilioWebhook.ts`
- `src/lib/safeLogging.ts`
- `src/lib/audit.ts`
- `src/lib/phone.ts`
- `src/lib/conversation/conversationAutonomy.ts`
- `src/lib/conversation/liveReplyExecutor.ts`
- `src/lib/producer/sendReadiness.ts`
- `src/lib/sourcing/publicWebResearchSafety.ts`
- `src/lib/dataOps/dataClassification.ts`

## 9. Data / Privacy-Sensitive Files

- `prisma/schema.prisma`
- `src/lib/dataOps/*`
- `src/lib/adminPrivacy.ts`
- `src/lib/admin/needsAttention.ts`
- `src/lib/conversation/conversationAutonomy.ts`
- `src/app/admin/(dashboard)/contacts/page.tsx`
- `src/app/admin/(dashboard)/people/page.tsx`
- `src/app/admin/(dashboard)/pilot-participants/page.tsx`
- `src/app/admin/(dashboard)/data-ops/page.tsx`
- `src/app/admin/(dashboard)/audit/page.tsx`
- `src/lib/sourcing/contactabilityEvidence.ts`

## 10. Performance-Sensitive Files

- `src/lib/observability/observabilitySummary.ts`
- `src/lib/admin/needsAttention.ts`
- `src/lib/graph/candidateRetrieval.ts`
- `src/lib/graph/projectCandidateMatcher.ts`
- `src/lib/graph/candidateSearchProfile.ts`
- `src/lib/matchingEval/runMatchingEvaluation.ts`
- `src/app/api/health/route.ts`

## Next Review Order

1. SMS send path and one-number test readiness.
2. Needs Attention redaction and review-link correctness.
3. Admin route consolidation plan for Projects/Staffing/Smart Matching.
4. Public web research/contactability privacy review.
5. Public beta access and data retention before broader testing.
