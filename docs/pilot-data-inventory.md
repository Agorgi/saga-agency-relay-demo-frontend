# Pilot Data Inventory

This inventory covers the standalone Saga SMS Producer pilot database only. It
must not be connected to the production Saga app database, production Saga user
permissions, event publishing, ticketing, RSVP, QR, or payment systems.

## Inventory

| Data item | Purpose | Stored in | PII | Visibility | Export | Redaction/deletion | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phone numbers, redacted phones, phone hashes | Allowlist, opt-out, participant lookup | `User`, `Contact`, `PilotParticipant`, access metadata | Yes | Admin/internal | Redacted only | Redact display/hash unless needed for opt-out compliance | Review after pilot window |
| Inbound SMS bodies | Intake and transcript review | `Message.body` | Possible | Admin-only | Redacted transcript | Redact bodies by project/participant | Pilot plus review window |
| Generated replies | Compare deterministic/LLM behavior | `Message`, audit metadata, review items | Possible | Admin-only | Redacted | Redact body/output fields | Pilot plus review window |
| ProjectBriefs | Structured organizer intake | `ProjectBrief` | Possible | Admin-only | Safe project export | Redact admin notes and message bodies | Pilot plus review window |
| Messages | Conversation transcript | `Message` | Possible | Admin-only | Redacted transcript | Redact body; keep IDs/timestamps | Pilot plus review window |
| AuditLogs | Safety and incident history | `AuditLog` | Internal metadata, should not include raw PII | Internal-only | Summary only | Preserve by default; do not keep redacted PII | Longer incident review window |
| Intents and ReplyPlans | Debug Conversation Engine decisions | `AuditLog.metadata`, LLM review metadata | Possible | Internal-only | Summary only | Redact bodies and private fields | Pilot plus review window |
| LLM review items | Compare fallback vs OpenAI | `LlmReviewItem` | Possible if text stored | Admin-only | Redacted review export | Redact unsafe/private text | Prompt tuning review window |
| Producer Agent outputs | Role maps, sourcing plans, shortlist drafts | `ProjectBrief.requiredRoles`, `RoleOpening`, `CandidateRecommendation`, `ShortlistPacket`, `OutboundDraft`, audit logs | Possible | Admin-only | Summary only | Redact private notes and contact details | Pilot plus review window |
| CandidateRecommendations | Internal candidate review | `CandidateRecommendation` | Possible | Admin-only | Summary only | Redact private/internal notes from exports | Pilot plus review window |
| ShortlistPackets | Organizer-facing shortlist drafts | `ShortlistPacket` | Possible | Admin-only | Organizer-safe text only | Redact private notes | Pilot plus review window |
| OutboundDrafts | Draft messages, never sent in current phase | `OutboundDraft` | Possible | Admin-only | Draft summary only | Redact body/admin notes if requested | Pilot plus review window |
| Send readiness events | Dry-run safety evidence | `AuditLog` | No raw PII intended | Internal-only | Summary | Preserve blockers/status, not PII | Incident review window |
| InboundProcessingJobs | Queue/retry observability | `InboundProcessingJob` | Has sender hash/SID, no raw phone | Internal-only | Summary | Preserve job status; no body stored | Operational review window |
| PilotParticipants | Pilot cohort/access state | `PilotParticipant` | Yes | Admin-only | Redacted summary | Pause, complete, opt out, redact phone/notes | Review after pilot |
| BetaInviteCodes | Access control | `BetaInviteCode` | No plaintext code by default | Admin-only | Summary only | Pause/expire; never expose hash publicly | Through beta cohort |
| Public beta waitlist entries | Future capped public beta request review | `PublicBetaWaitlistEntry` | Yes, email optional; phone hashed/redacted | Admin-only | Redacted summary | Mark duplicate/paused/rejected/admitted; redact notes/contact fields | Public beta review window |
| Consent events | Auditable SMS/public beta consent capture | `ConsentEvent` | Has hashes, consent text, no raw phone by default | Internal/admin | Summary only | Preserve consent evidence; redact unnecessary metadata | As required for consent/audit review |
| Beta cohort simulation runs | Synthetic staged rollout pressure results | `BetaCohortSimulationRun`, `BetaCohortSimulationMemberResult`, or generated JSON | No real PII; synthetic only | Admin/internal | Safe summary | Archive/delete simulation-only records if needed; never mix with real pilot participants | Planning window |
| PilotFeedback | Product feedback | `PilotFeedback` | Possible | Admin-only | Redacted feedback export | Redact notes | Pilot plus synthesis window |
| Contact/Person/CreatorProfile | Internal standalone network records | `Contact`, `Person`, `CreatorProfile` | Possible | Admin-only | Summary only | Redact contact fields where needed | Pilot plus review window |
| Admin notes | Operator context | Many admin-only fields | Possible/sensitive | Admin-only | Excluded by default | Redact by default | Shortest practical window |
| Opt-out state | Compliance and safety | `User.smsOptedOutAt`, `Contact.smsOptedOutAt`, `PilotParticipant.status` | Yes | Admin/internal | Status only | Preserve minimal opt-out proof | As required for compliance |
| Blocked sends | Safety proof | `AuditLog`, `Message.metadata` | No raw PII intended | Internal-only | Summary | Preserve blockers/status, not body | Incident review window |
| Twilio MessageSid references | Idempotency/debugging | `Message.twilioMessageSid`, `InboundProcessingJob.inboundTwilioMessageSid` | Not a phone number | Internal-only | Allowed in summary | Preserve for webhook/idempotency review | Operational review window |
| Launch drill reports and evidence | Launch rehearsal and operator readiness | `AuditLog` (`launch_drill.*`) and `/admin/launch-drill` generated summaries | No raw PII intended | Internal-only | Redacted report | Preserve stage/status/blocker counts, not private notes | Pilot planning review window |

## Export Rules

Exports are admin-only and redacted by default. They must not include raw phone
numbers, raw emails, secrets, raw prompts, production Saga app data, payment
data, ticketing data, RSVP data, QR data, or event-publishing state.

## Separation Rule

Pilot, demo, and test data remain in the standalone Railway Postgres database.
They must never be joined to or backfilled into the main Saga production app
unless a later engineering review explicitly approves a migration path.
