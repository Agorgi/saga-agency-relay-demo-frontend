# Data Model

## Canonical Production-Network Models

- `Person`: canonical identity for app users, SMS leads, imported contacts, creators, and public candidates. `sagaUserId` links to the existing Saga app. `phone` and `email` are unique when present.
- `CreatorProfile`: creator supply profile attached one-to-one to `Person`. Contains roles, skills, fandoms, communities, links, opportunity preferences, and human review status. `internalNotes` must not be exposed publicly.
- `Project`: canonical creative production object. Imported Saga events use `existingSagaEventId`; imported communities use `existingSagaCommunityId`.
- `RoleOpening`: structured missing role for a project.
- `Opportunity`: invite/apply surface for a role opening.
- `CandidateRecommendation`: deterministic match between a person and an opportunity. Includes total score, score breakdown, proximity tier, reasons, risks, and approval status.
- `ShortlistPacket`: admin-reviewed organizer-facing draft shortlist packet
  linked optionally to a `ProjectBrief` and/or `Project`. It stores role
  coverage and safe candidate summaries, not raw phone numbers, emails, or
  private notes.
- `OutboundDraft`: admin-reviewed organizer shortlist and candidate outreach
  copy. It links optionally to `ProjectBrief`, `Project`, `ShortlistPacket`,
  `CandidateRecommendation`, `Contact`, and/or `Person`. `SENT` exists for
  future compatibility only; the current app does not send these drafts.
- `RelationshipEdge`: proximity graph edge between people.
- `Team` and `TeamMember`: confirmed or forming production team.
- `ProductionConversation`: canonical project conversation across mock, Twilio, app chat, Apple Messages, or WhatsApp providers.
- `PilotFeedback`: admin-only staging/design-partner feedback notes linked
  optionally to a `ProjectBrief`, `Person`, and/or `PilotParticipant`. This is
  not public-facing and must not store production Saga app, ticketing, payment,
  or sensitive personal data.
- `PilotParticipant`: admin-only standalone pilot/private beta participant
  record. It stores `phoneHash` and `redactedPhone`, not raw phone numbers, and
  is not connected to production Saga users.

## Legacy SMS-Specific Models

- `User`: SMS organizer identity.
- `ProjectBrief`: SMS intake object and transcript anchor.
- `Contact`: imported SMS outreach contact.
- `Outreach`: legacy contact outreach record.
- `GroupChat`: Twilio Conversations implementation for SMS group chat.
- `GroupChatParticipant`: participants in legacy group chat.
- `Message`: inbound/outbound message ledger for SMS/group/admin.
- `Task`: production task. It now supports both legacy and canonical attachments.

These models remain because the SMS MVP already uses them. New app-facing functionality should bridge into canonical models rather than duplicating role/opportunity/team state.

## Bridge Decisions

### ProjectBrief to Project

`ProjectBrief.projectId` links a legacy SMS brief to a canonical `Project`. `Project.legacyProjectBriefId` remains as a lookup key. When intake reaches `BRIEF_READY_FOR_REVIEW`, `ensureProjectForProjectBrief` creates or updates the canonical project with organizer, title, description, city, timing, budget, audience, inferred fandoms, and mapped status.

`ProjectBrief` remains useful for the intake transcript, SMS workflow state, and admin review. `Project` is the source for role openings, opportunities, recommendations, teams, and production conversations.

### Contact to Person and CreatorProfile

`Contact.personId` links imported contacts to canonical `Person`. `syncContactToPersonCreatorProfile` creates or updates a `Person` by normalized phone/email, then creates or updates a `CreatorProfile` using contact roles, tags, portfolio, Instagram, city, and opt-out state.

### Outreach to Opportunity and CandidateRecommendation

`Outreach.opportunityId` and `Outreach.candidateRecommendationId` link legacy outreach to canonical staffing objects. `ensureNetworkLinksForOutreach` creates a role opening/opportunity/recommendation when legacy outreach is drafted or sent.

### Task to Project and ProductionConversation

`Task.projectBriefId` is now optional for legacy tasks. `Task.projectId` and `Task.productionConversationId` let new demo/network tasks attach to canonical `Project` and `ProductionConversation`. Legacy group SMS tasks can still attach to `ProjectBrief` and `GroupChat`.

### GroupChat and ProductionConversation

`GroupChat` is the SMS/Twilio implementation record. `ProductionConversation` is canonical. `GroupChat.productionConversationId` links the legacy Twilio conversation to the canonical conversation object.

## Schema Safety and Index Notes

The schema keeps production-network records canonical while preserving the legacy SMS tables. The latest index-hardening migration is additive only: it adds indexes and does not change columns, nullability, uniqueness, foreign keys, or delete behavior.

Indexes intentionally cover:

- Legacy/canonical bridge lookups: `ProjectBrief.projectId`, `Contact.personId`, `Outreach.opportunityId`, `Outreach.candidateRecommendationId`, `GroupChat.productionConversationId`, `Task.projectId`, and `Task.productionConversationId`.
- Existing Saga app import/link keys: `Person.sagaUserId`, `Project.existingSagaEventId`, `Project.existingSagaCommunityId`, and `Project.organizerPersonId`.
- Matching and graph queries: `CandidateRecommendation.opportunityId`, `CandidateRecommendation.personId`, `CandidateRecommendation.opportunityId/score/updatedAt`, `CandidateRecommendation.personId/status/updatedAt`, `RelationshipEdge.fromPersonId`, `RelationshipEdge.toPersonId`, and relationship-type composites.
- Producer approval queues: `CandidateRecommendation.reviewedAt`,
  `ShortlistPacket.projectBriefId`, `ShortlistPacket.projectId`,
  `ShortlistPacket.status`, and `ShortlistPacket.updatedAt`.
- Producer outbound draft queues: `OutboundDraft.type`, `OutboundDraft.status`,
  `OutboundDraft.source`, `OutboundDraft.projectBriefId`,
  `OutboundDraft.projectId`, `OutboundDraft.shortlistPacketId`,
  `OutboundDraft.candidateRecommendationId`, `OutboundDraft.contactId`,
  `OutboundDraft.personId`, and `OutboundDraft.updatedAt`.
- Admin list sorting and operational queues: `updatedAt` indexes on canonical/admin-list models, task status/due-date ordering, and contact city/name ordering.
- Provider conversation lookup: `ProductionConversation.provider/externalConversationId`. This is intentionally indexed, not unique, until provider-specific ID semantics are reviewed.

Production review caveats:

- `Person.sagaUserId`, `Person.phone`, and `Person.email` are nullable unique fields. PostgreSQL allows multiple nulls, but real imports must normalize and dedupe non-null values before migration.
- `Project.existingSagaEventId` is unique because one canonical production project should map to one existing Saga event. Production imports need a duplicate-event audit first.
- `Contact.personId`, `ProjectBrief.projectId`, and `GroupChat.productionConversationId` are unique bridge fields. That preserves one-to-one bridge semantics but can reject dirty legacy/import data that maps multiple rows to the same canonical record.
- `Outreach.projectBriefId/contactId` remains unique for the legacy SMS workflow. That prevents duplicate outreach rows for the same contact and brief; future repeated outreach attempts should be modeled explicitly before changing it.
- `CandidateRecommendation.status` now includes review states
  (`APPROVED_FOR_SHORTLIST`, `NEEDS_MORE_INFO`, `CONTACT_LATER`,
  `DO_NOT_CONTACT`) alongside outreach/team states. Engineers should review
  whether a separate review enum is preferable before production-scale imports.
- `ShortlistPacket.SENT` exists for future compatibility only. The current app
  does not send shortlist packets.
- `OutboundDraft.SENT` exists for future compatibility only. The current app
  never sends outbound drafts; approval means internal copy readiness only.
- Several relations still use cascade deletes from legacy MVP behavior. Production systems should prefer archival/retention policies and avoid hard deletes until a data retention review is complete.
- `ThresholdType.TICKET_PLEDGE` exists for interest-check modeling only. This service does not own ticketing, ticket sales, RSVPs, QR codes, or payments.
- `PilotParticipant.phoneHash` is for duplicate detection/operator review only;
  raw pilot phone numbers should remain in allowlist/provider configuration and
  not be stored in this admin table.

## ERD

```mermaid
erDiagram
  User ||--o{ ProjectBrief : owns
  User ||--o{ Message : sends
  ProjectBrief ||--o{ Message : anchors
  ProjectBrief ||--o{ Outreach : legacy_outreach
  ProjectBrief ||--o{ GroupChat : legacy_groupchat
  ProjectBrief ||--o{ Task : legacy_tasks
  ProjectBrief ||--o{ PilotFeedback : pilot_notes
  ProjectBrief ||--o{ PilotParticipant : pilot_participants
  ProjectBrief ||--o{ OutboundDraft : outbound_drafts
  ProjectBrief o|--|| Project : bridges_to

  Contact o|--|| Person : bridges_to
  Contact ||--o{ Outreach : receives
  Contact ||--o{ Message : sends
  Contact ||--o{ OutboundDraft : outbound_drafts

  Person ||--o| CreatorProfile : has
  Person ||--o{ Project : organizes
  Person ||--o{ CandidateRecommendation : matched
  Person ||--o{ RelationshipEdge : from
  Person ||--o{ RelationshipEdge : to
  Person ||--o{ TeamMember : joins
  Person ||--o{ PilotFeedback : pilot_notes
  Person ||--o{ PilotParticipant : pilot_participants
  Person ||--o{ OutboundDraft : outbound_drafts
  PilotParticipant ||--o{ PilotFeedback : pilot_notes

  Project ||--o{ RoleOpening : needs
  Project ||--o{ ProductionConversation : discusses
  Project ||--o| Team : forms
  Project ||--o{ Task : tracks
  Project ||--o| InterestCheck : converted_from
  Project ||--o{ ShortlistPacket : shortlist_packets
  Project ||--o{ OutboundDraft : outbound_drafts

  RoleOpening ||--o{ Opportunity : publishes
  RoleOpening ||--o{ TeamMember : fills
  Opportunity ||--o{ CandidateRecommendation : recommends
  Opportunity ||--o{ Outreach : legacy_link
  CandidateRecommendation ||--o{ Outreach : legacy_link
  CandidateRecommendation ||--o{ OutboundDraft : outbound_drafts
  ShortlistPacket ||--o{ OutboundDraft : outbound_drafts

  Team ||--o{ TeamMember : includes
  ProductionConversation ||--o{ Task : tracks
  ProductionConversation o|--o| GroupChat : implemented_by
  GroupChat ||--o{ GroupChatParticipant : includes
  GroupChat ||--o{ Task : legacy_group_tasks
```

## State Notes

Legacy `ProjectBrief.status` controls SMS intake and live outreach safety. Canonical `Project.status` controls production-network state. Bridge services map legacy status into canonical status, but the backend still owns transitions. The LLM never decides status directly.
