# Conversation Engine v0.1

This is the source-of-truth reference for Saga Producer MVP Conversation Engine
v0.1. It summarizes the implemented engine after Phases 1-8 and should be read
before changing conversation behavior.

## 1. Purpose

The conversation engine turns incoming text messages into structured,
auditable workflow decisions. It supports Saga's producer-agent experience by
letting Saga sound warm and helpful while the backend stays in control of
state, safety, consent, and admin approval.

The engine is intentionally structured rather than freeform. A text message may
look casual, but the app needs to know whether it is organizer intake,
gig-seeker onboarding, an interest check, a contact reply, a safety issue, or
something unknown. The LLM can assist with language and extraction elsewhere in
the app, but v0.1 conversation routing and safety are deterministic.

LLM Provider Integration v0.1 is documented in
`docs/llm-provider-integration.md`. It keeps fallback behavior as the default,
allows shadow-mode model evaluation, and keeps live LLM-driven Twilio replies
disabled. Shadow-mode success means model calls can succeed and validate, but
the app still uses deterministic fallback output for user-facing behavior until
a later explicitly gated mode. The organizer intake `organizer_reply_language`
operation has dedicated regression coverage so schema/request errors fall back
safely and show redacted `llm.call_failed` diagnostics.
`LLM_MODE=active_mock` is scoped to `/admin/dev` MOCK execution context. It may
use OpenAI for organizer reply language in admin simulation only; Twilio inbound
continues to fail closed/no-send, and flows without a dedicated LLM operation
report deterministic fallback explicitly.
LLM Quality Review v0.2 adds `/admin/llm-review` and
`docs/llm-quality-review.md` so operators can compare deterministic fallback
text with OpenAI output before any future live LLM-driven SMS approval.

Producer Agent v0.1 is the next layer after conversation intake. It maps a
reviewable organizer-style brief into project understanding, roles, internal
candidate recommendations, and shortlist drafts. Producer Agent v0.2 adds
candidate review and shortlist packet approval. Their source-of-truth docs are
`docs/producer-agent-v0.1.md` and `docs/producer-agent-v0.2.md`.

## 2. Core Principles

- Deterministic state and safety come first.
- LLM output may assist with writing or extraction, but backend code controls
  workflow transitions, consent, and external-facing actions.
- Saga must not make forbidden promises.
- Risky topics go to `NEEDS_ADMIN` or equivalent human review.
- Twilio staging remains shadow-only for conversation-engine behavior.
- Mock/admin mode is where active behavior is tested.
- STOP, START, and HELP take precedence over all other intent handling.
- No group chat, participant add, team placement, or real outreach is created
  automatically by conversation policy.

## 3. Flow Map

The engine recognizes these top-level flows:

- `ORGANIZER_INTAKE`: a project runner wants to host, throw, make, or produce
  an event/project.
- `GIG_SEEKER_ONBOARDING`: a creator wants gigs or wants to join Saga's network.
- `INTEREST_CHECK`: someone wants to see whether a thing should exist, but may
  not be the organizer.
- `CONTACT_REPLY`: a potential team member/vendor/creator replies to outreach.
- `ADMIN_REVIEW`: a risky, confusing, legal, safety, money, or high-stakes
  message needs a human.
- `UNKNOWN`: the message does not match a deterministic flow.

## 4. Intent Router

`src/lib/conversation/intentRouter.ts` classifies messages into:

- `ORGANIZER_PROJECT_IDEA`
- `GIG_SEEKER_ONBOARDING`
- `CONTACT_REPLY`
- `INTEREST_CHECK`
- `STOP_OR_OPT_OUT`
- `START_OR_OPT_IN`
- `HELP`
- `SAFETY_ESCALATION`
- `UNKNOWN`

Priority rules:

1. Empty messages are `UNKNOWN`.
2. STOP variants route to `STOP_OR_OPT_OUT`.
3. START/UNSTOP route to `START_OR_OPT_IN`.
4. HELP routes to `HELP`.
5. Safety escalation wins unless the phrase is a benign self-directed gig
   preference.
6. YES/NO/MAYBE contact replies only route to `CONTACT_REPLY` when active
   outreach/contact context exists.
7. Gig-seeker signals route to `GIG_SEEKER_ONBOARDING`.
8. Interest-check signals route to `INTEREST_CHECK`.
9. Organizer/project signals route to `ORGANIZER_PROJECT_IDEA`.
10. Everything else is `UNKNOWN`.

Safety escalation includes money/legal/contract, payment disputes, permits,
insurance, alcohol, security, medical/safety, minors, weapons, explicit sexual
content, harassment/discrimination, illegal activity, and guarantees of booking,
attendance, revenue, venue access, celebrity/influencer participation, or paid
work.

## 5. Conversation Context

`src/lib/conversation/conversationContext.ts` loads a read-only
`ConversationContext` from a normalized phone number. It may include:

- `User`
- `Person`
- `Contact`
- active `ProjectBrief`
- linked canonical `Project`
- active `Outreach`
- recent `Message` records
- opted-out state
- first-time-host completion state
- creator profile fields
- provider/safety mode

Context loading does not create users, people, contacts, briefs, profiles,
interest checks, projects, outreach, teams, group chats, or messages. It only
reads what exists and returns a Zod-validated context object.

## 6. ReplyPlan Model

All policies return a Zod-validated `ReplyPlan` with common fields:

- `flow`
- `stage`
- `nextStage`
- `enoughInfoForBrief`
- `enoughInfoForProfileReview`
- `enoughInfoForInterestCheck`
- `shouldEscalate`
- `escalationReason`
- `nextQuestion`
- `ambiguityNotes`
- `replyTone`
- `allowedActions`
- `blockedActions`
- `explanationForAudit`
- `confidence`

Policies may also return flow-specific known fields, missing required fields,
missing optional fields, reply kinds, ambiguity notes, and safety flags.

## 7. Flow Summaries

### Organizer Intake

Files:

- `src/lib/conversation/organizerIntakePolicy.ts`
- `src/lib/conversation/organizerReplyGenerator.ts`

Stages:

- `NEW`
- `ASK_FIRST_TIME_HOST`
- `ASK_LOCATION`
- `ASK_PROJECT_CONCEPT`
- `ASK_SCOPE_VIBE`
- `ASK_TIMING`
- `ASK_BUDGET`
- `ASK_AUDIENCE`
- `BRIEF_READY`
- `NEEDS_ADMIN`

Required fields:

- project/event concept
- city/location
- scope/vibe or enough descriptive detail

Optional fields:

- timing/date
- budget
- expected audience size
- roles/help needed

The first-time-host question is asked early unless it was already completed or
already asked. Once answered, it should not be asked again for that user/phone.

In mock/admin mode, organizer `ReplyPlan` can drive the actual simulated reply
and update demo intake state. In live Twilio staging, it is shadowed/audited
only; legacy intake behavior remains in place and any provider send is blocked
while `SMS_SENDS_DISABLED=true`.

### Gig-Seeker Onboarding

Files:

- `src/lib/conversation/gigSeekerOnboardingPolicy.ts`
- `src/lib/conversation/gigSeekerReplyGenerator.ts`
- `src/lib/conversation/gigSeekerProfilePreparation.ts`

Stages:

- `NEW`
- `ASK_LOCATION`
- `ASK_GIG_TYPES`
- `ASK_SKILLS`
- `ASK_FANDOMS`
- `ASK_LINKS`
- `ASK_AVAILABILITY`
- `PROFILE_READY_FOR_REVIEW`
- `NEEDS_ADMIN`

Required fields:

- city/location
- desired roles/gig types
- portfolio/social/link or enough self-description

Optional fields:

- skills
- fandoms/scenes/communities
- availability
- rate notes
- compensation preference

In mock/admin mode, the flow can create or update a pending `CreatorProfile`.
It never approves a profile automatically and does not promise paid work,
booking, placement, or income. In live Twilio staging, it is shadowed/audited
only and does not create profiles.

### Interest Check

Files:

- `src/lib/conversation/interestCheckPolicy.ts`
- `src/lib/conversation/interestCheckReplyGenerator.ts`
- `src/lib/conversation/interestCheckPreparation.ts`

Stages:

- `NEW`
- `ASK_LOCATION`
- `ASK_IDEA_SCOPE`
- `ASK_FANDOM_OR_AUDIENCE`
- `ASK_TIMING`
- `ASK_INTEREST_SIGNAL`
- `INTEREST_CHECK_READY`
- `NEEDS_ADMIN`

Required fields:

- idea/concept
- city/location
- fandom/audience or enough descriptive detail to infer likely audience

Optional fields:

- timing
- preferred format
- expected audience size
- willingness to help organize
- willingness to RSVP or show interest, without touching real RSVP/ticketing

In mock/admin mode, the flow can create or update a draft `InterestCheck`.
It does not publish, activate, increment real interest, convert to `Project`,
create role openings, create opportunities, or touch event publishing,
ticketing, RSVPs, QR codes, sales, or payments. In live Twilio staging, it is
shadowed/audited only.

### Contact Reply / Consent

Files:

- `src/lib/conversation/contactReplyPolicy.ts`
- `src/lib/conversation/contactReplyGenerator.ts`
- `src/lib/contactReplies.ts`
- `src/lib/networkCore.ts`

Reply kinds:

- `YES_INTERESTED`
- `NO_DECLINED`
- `MAYBE_INTERESTED`
- `QUESTION`
- `RATE_OR_PAYMENT_QUESTION`
- `AVAILABILITY_QUESTION`
- `CONSENT_YES`
- `CONSENT_NO`
- `HELP`
- `STOP`
- `START`
- `UNKNOWN`

Consent rules:

- Random yes/no/maybe texts are not contact replies without active outreach or
  contact context.
- YES to outreach can mark interest and asks for group-intro consent.
- Consent is only confirmed when the active prompt is consent and the response
  is explicit.
- Consent does not create a group chat, add a participant, add anyone to a team,
  or confirm placement.
- Money/rate/legal/logistics/safety questions escalate or require human review.

In mock/admin mode, `/admin/dev` can re-arm mock outreach, simulate replies,
update mock `CandidateRecommendation`/`Outreach` state, and record explicit
consent. In live Twilio staging, the policy is shadowed/audited while legacy
contact handling remains guarded by SMS safety. No real SMS should be sent.

## 8. Mode Matrix

| Action | `MESSAGING_PROVIDER=MOCK` | `MESSAGING_PROVIDER=TWILIO` | `CONVERSATION_ENGINE_MODE=shadow` | `CONVERSATION_ENGINE_MODE=mock_active` | `SMS_SENDS_DISABLED=true` | `SMS_SENDS_DISABLED=false` future only |
| --- | --- | --- | --- | --- | --- | --- |
| Classify intent | Yes | Yes | Yes | Yes | N/A | N/A |
| Produce ReplyPlan | Yes | Yes | Yes | Yes | N/A | N/A |
| Generate actual conversation-engine reply | Yes in admin/mock flows | No; shadow-only | No | Only in MOCK/admin, fails closed for Twilio webhooks | Does not allow real send | Future pilot only after approval |
| Create ProjectBrief | Existing mock/admin and legacy intake paths | Existing legacy inbound path may persist intake; engine does not actively create | Engine does not create | Mock/admin only where implemented | Send still blocked | Future review required |
| Create CreatorProfile | Mock/admin gig-seeker only | No | No | Mock/admin only | Send still blocked | Future review required |
| Create InterestCheck | Mock/admin interest-check only as DRAFT | No | No | Mock/admin only | Send still blocked | Future review required |
| Update Outreach | Mock/admin contact simulator and legacy contact paths | Legacy contact path only; engine shadows | Engine does not actively update | Mock/admin only | Send still blocked | Future review required |
| Confirm consent | Mock/admin explicit contact consent, or legacy admin-reviewed paths | Legacy path only; no group auto-create | Engine does not actively confirm | Mock/admin only | Send still blocked | Future review required |
| Send SMS | Mock provider only | Blocked while sends disabled | Not controlled by engine | Not allowed for Twilio webhooks | Blocked | Future allowlisted pilot only |
| Create group chat | Existing admin action only | Not automatic | No | No automatic creation | Conversation sends blocked | Future admin-only review required |

## 9. Audit Events

Conversation-related audit events:

- `conversation.intent_classified`: deterministic intent classification ran.
- `conversation.intent_classification_failed`: shadow classification failed and
  was safely logged.
- `conversation.reply_plan_shadowed`: organizer ReplyPlan generated in shadow.
- `conversation.reply_plan_applied`: organizer ReplyPlan applied in mock/admin.
- `conversation.gig_seeker_reply_plan_shadowed`: gig-seeker ReplyPlan generated
  in shadow.
- `conversation.gig_seeker_reply_plan_applied`: gig-seeker ReplyPlan applied in
  mock/admin.
- `conversation.gig_seeker_profile_prepared`: pending creator profile prepared
  in mock/admin.
- `conversation.interest_check_reply_plan_shadowed`: interest-check ReplyPlan
  generated in shadow.
- `conversation.interest_check_reply_plan_applied`: interest-check ReplyPlan
  applied in mock/admin.
- `conversation.interest_check_prepared`: draft interest check prepared in
  mock/admin.
- `conversation.contact_reply_plan_shadowed`: contact ReplyPlan generated in
  shadow.
- `conversation.contact_reply_plan_applied`: contact ReplyPlan applied in
  mock/admin.
- `conversation.engine_active_blocked_for_provider`: active engine mode was
  requested where provider/source safety does not allow it, especially Twilio.

Related SMS/provider events such as `sms.inbound_webhook_received`,
`sms.inbound_signature_passed`, `sms.inbound_allowlist_checked`,
`sms.inbound_processed`, and `message.send_blocked` remain part of the broader
messaging audit trail.

## 10. Forbidden Claims

Saga may not promise:

- bookings
- paid work
- rates
- revenue
- ticket sales
- attendance
- venue access
- confirmed team placement
- celebrity/influencer participation
- group-chat inclusion without explicit consent and admin action

## 11. Known Limitations

- Live Twilio replies remain disabled.
- Twilio design-partner pilot is not active.
- Design Partner Pilot Readiness v0.1 is a documentation/operator-readiness
  package only; it does not approve live SMS or invite design partners.
- Public launch foundations are present for future review only. Current defaults
  remain `PILOT_STAGE=internal_test`, `PILOT_REPLY_MODE=draft_only`, and
  `PUBLIC_LAUNCH_ENABLED=false`.
- A2P/10DLC, toll-free, or provider compliance is not resolved in this repo.
- The real Saga app is not connected.
- No production Saga data is used.
- Interest checks do not convert to projects through conversation flow.
- There is no public internet sourcing.
- There is no autonomous outreach.
- Design Partner Transcript Dry Runs are available as simulation only; they do
  not invite users, send SMS, or activate live LLM replies.
- The internal API and admin auth remain MVP-grade and need engineering review
  before production integration.

## 12. Recommended Next Milestones

1. Review the design-partner pilot runbook and conversation quality guide with
   product, engineering, and compliance.
2. Review public launch foundations, abuse/rate-limit readiness, data retention,
   and rollback docs before any private beta expansion.
3. Review Producer Agent v0.1/v0.2 project understanding, role mapping,
   internal recommendations, candidate review states, and shortlist packets with
   engineers before using them in a design-partner operating window.
4. After compliance approval, run a controlled one-number outbound self-test
   with sends intentionally enabled in an isolated Twilio staging environment.
5. Schedule internal engineering review of schema, auth, provider boundaries,
   and migration safety.
6. Plan v0.2/v0.3 integration with the existing Saga app without touching
   production ticketing, RSVP, QR, publishing, or payments.
