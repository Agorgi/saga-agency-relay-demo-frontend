-- Producer Agent v0.3 outbound draft queue.
-- Additive only: stores admin-reviewable outbound drafts without sending SMS,
-- creating outreach, contacting candidates, or creating group chats.

CREATE TYPE "OutboundDraftType" AS ENUM (
  'ORGANIZER_SHORTLIST',
  'CANDIDATE_OUTREACH',
  'ADMIN_MANUAL'
);

CREATE TYPE "OutboundDraftStatus" AS ENUM (
  'DRAFT',
  'NEEDS_REVIEW',
  'APPROVED',
  'REJECTED',
  'BLOCKED',
  'SENT'
);

CREATE TYPE "OutboundDraftSource" AS ENUM (
  'PRODUCER_AGENT',
  'ADMIN_MANUAL',
  'CONVERSATION_ENGINE'
);

CREATE TYPE "OutboundDraftRecipientKind" AS ENUM (
  'ORGANIZER',
  'CANDIDATE',
  'CONTACT'
);

CREATE TABLE "OutboundDraft" (
  "id" TEXT NOT NULL,
  "type" "OutboundDraftType" NOT NULL,
  "status" "OutboundDraftStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "body" TEXT NOT NULL,
  "editedBody" TEXT,
  "source" "OutboundDraftSource" NOT NULL DEFAULT 'PRODUCER_AGENT',
  "projectBriefId" TEXT,
  "projectId" TEXT,
  "shortlistPacketId" TEXT,
  "candidateRecommendationId" TEXT,
  "contactId" TEXT,
  "personId" TEXT,
  "recipientKind" "OutboundDraftRecipientKind" NOT NULL,
  "adminNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "blockReason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutboundDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundDraft_type_idx" ON "OutboundDraft"("type");
CREATE INDEX "OutboundDraft_status_idx" ON "OutboundDraft"("status");
CREATE INDEX "OutboundDraft_source_idx" ON "OutboundDraft"("source");
CREATE INDEX "OutboundDraft_projectBriefId_idx" ON "OutboundDraft"("projectBriefId");
CREATE INDEX "OutboundDraft_projectId_idx" ON "OutboundDraft"("projectId");
CREATE INDEX "OutboundDraft_shortlistPacketId_idx" ON "OutboundDraft"("shortlistPacketId");
CREATE INDEX "OutboundDraft_candidateRecommendationId_idx" ON "OutboundDraft"("candidateRecommendationId");
CREATE INDEX "OutboundDraft_contactId_idx" ON "OutboundDraft"("contactId");
CREATE INDEX "OutboundDraft_personId_idx" ON "OutboundDraft"("personId");
CREATE INDEX "OutboundDraft_updatedAt_idx" ON "OutboundDraft"("updatedAt");

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_shortlistPacketId_fkey"
  FOREIGN KEY ("shortlistPacketId") REFERENCES "ShortlistPacket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_candidateRecommendationId_fkey"
  FOREIGN KEY ("candidateRecommendationId") REFERENCES "CandidateRecommendation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDraft"
  ADD CONSTRAINT "OutboundDraft_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
