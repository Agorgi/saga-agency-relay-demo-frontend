# Safety-Critical Paths Audit

Baseline: `main` after `d74dc17`, with the per-phone autonomy checkpoint updated after `71a3588`.

This audit asks whether any path can contact people or expose sensitive data. Current expected answer for external sends/contact is **no, unless a future operator explicitly opens a reviewed test window and all gates pass**.

| Path | Current code/files | Current gates | Tests | Known caveats | Review priority | Can send/contact externally now? |
|---|---|---|---|---|---|---|
| Inbound Twilio webhook | `src/app/api/twilio/inbound/route.ts`, `src/lib/twilioWebhook.ts`, `src/lib/conversation/*`, `src/lib/messagingPipeline.ts` | signature validation, staging mode, allowlist, processing mode, SMS send gates | `test:twilio-readiness`, inbound no-reply/staging tests, conversation tests | Inbound can persist records; outbound must stay gated. | critical before A2P | no live send by default |
| Outbound SMS send path | `src/lib/messagingProvider.ts`, `src/lib/smsSafety.ts`, producer send readiness, live reply executor | `SMS_SENDS_DISABLED`, compliance, allowlist, opt-out, provider mode | controlled live reply, outbound self-test, Twilio tests | First real one-number test not run. | critical before A2P | blocked by default |
| `SMS_SENDS_DISABLED` | `src/lib/smsSafety.ts`, command center, launch drill, health | must be true except approved test window | security, readiness, launch tests | Env is external to repo; audit can only assert code expectations. | critical | if false plus other gates, future sends may be possible |
| `SMS_REQUIRE_ALLOWLIST` | `smsSafety`, Twilio/preflight/readiness | require allowlisted numbers for pilot/self-test | Twilio/pilot tests | Allowlist contents are runtime env; never document real values. | critical | protects recipient scope |
| STOP / START / opt-out | conversation/contact reply policies, User/Contact/Person/PilotParticipant opt-out fields | opt-out fields override contactability/outreach | Twilio/conversation/access tests | Needs real carrier behavior test after A2P. | critical | opt-out should block |
| Candidate outreach | Producer drafts, OutboundDraft, Outreach, send readiness | admin review, do-not-contact, opt-out, SMS disabled | producer outreach/drafts/send readiness | Outreach model is legacy; keep advanced. | critical | no automatic send |
| Group chat creation | `src/lib/groupChat.ts`, workflow state machine, GroupChat/ProductionConversation | consent, admin state transitions, no auto-create | workflow tests | Future provider-backed conversation work is scaffolded. | high | no automatic group chat |
| Public web research live dry run | sourcing provider/job/CLI files | public web enabled, live dry-run mode, dry-run allowed, citation required, OpenAI configured, CLI/worker path | public web live/async/provider tests | Live call must never run from normal user text or by default. | critical | no contact; web call only under explicit flags |
| Public beta / public launch gates | public beta config/admission, launch drill, command center | public beta and public launch disabled by default | public beta/capped beta/launch tests | Env flags external; no admin toggle should exist. | high | no public launch by default |
| LLM active live gate | LLM provider resolver, conversation engine mode | active_live disabled; fallback/shadow/active_mock expected | LLM provider/model/shadow/mock tests | active_mock exists in admin/dev only. | high | no active live replies by default |
| Message processing async active gate | messaging pipeline, inbound route, env resolver | sync/async-shadow only unless explicit async_active | messaging pipeline tests | Async worker scripts exist; active mode not default. | high | no automatic live send by default |
| Data export/redaction | dataOps modules, Data Tools page | classification/redaction helpers, admin auth | pilot data ops/security tests | Review before real pilot data exports. | high | no external contact |
| Needs Attention items that could lead to sends | `src/lib/admin/needsAttention.ts`, `/admin/needs-attention`, Outbound Drafts links | read-only summary, redaction, send gates on destination pages | admin info architecture tests | Needs Attention links to review pages; approving still cannot bypass SMS gates. | high | no direct send button |
| Per-phone conversation autonomy | `src/lib/conversation/conversationAutonomy.ts`, `src/lib/conversation/liveReplyExecutor.ts`, Contacts/Pilot Participants admin forms | unknown numbers default manual; ON only applies to ordinary flows; global send gates, opt-out, outreach, shortlist, group-chat, rate/payment/legal, and safety boundaries still win | `test:per-phone-autonomy-controls`, controlled live reply tests; staging verification passed after `71a3588` | It is a permission gate, not a send-safety override; re-check runtime env before any post-A2P window. | critical before design partners | no send by default |
| Admin actions that mutate data | admin action files across dashboard | admin auth, domain-specific gates, audit logs | feature tests by page | Some pages are advanced and powerful; operator roles are not yet granular. | high | no external contact by default |

Highest-risk files for review:

- `src/lib/smsSafety.ts`
- `src/lib/messagingProvider.ts`
- `src/lib/conversation/conversationAutonomy.ts`
- `src/lib/conversation/liveReplyExecutor.ts`
- `src/app/api/twilio/inbound/route.ts`
- `src/lib/producer/sendReadiness.ts`
- `src/lib/producer/outboundSelfTestReadiness.ts`
- `src/lib/sourcing/publicWebResearchProvider.ts`
- `src/lib/sourcing/openaiWebResearchProvider.ts`
- `src/lib/sourcing/publicWebResearchSafety.ts`
- `src/lib/admin/needsAttention.ts`
- `src/lib/dataOps/*`
