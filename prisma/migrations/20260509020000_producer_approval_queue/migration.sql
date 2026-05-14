-- Producer Agent v0.2 approval queue.
-- Additive only: review metadata for candidate recommendations and draft
-- shortlist packets for admin approval. This migration does not contact
-- candidates, send SMS, or alter production Saga app data.

ALTER TYPE "CandidateRecommendationStatus" ADD VALUE 'APPROVED_FOR_SHORTLIST';
ALTER TYPE "CandidateRecommendationStatus" ADD VALUE 'NEEDS_MORE_INFO';
ALTER TYPE "CandidateRecommendationStatus" ADD VALUE 'CONTACT_LATER';
ALTER TYPE "CandidateRecommendationStatus" ADD VALUE 'DO_NOT_CONTACT';

CREATE TYPE "ShortlistPacketStatus" AS ENUM (
  'DRAFT',
  'NEEDS_REVIEW',
  'APPROVED',
  'REJECTED',
  'SENT'
);

ALTER TABLE "CandidateRecommendation"
  ADD COLUMN "adminReviewNotes" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "shortlistReasonOverride" TEXT,
  ADD COLUMN "organizerFacingSummaryOverride" TEXT;

CREATE TABLE "ShortlistPacket" (
  "id" TEXT NOT NULL,
  "projectBriefId" TEXT,
  "projectId" TEXT,
  "status" "ShortlistPacketStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "organizerFacingSummary" TEXT NOT NULL,
  "rolesCovered" JSONB NOT NULL DEFAULT '[]',
  "rolesMissing" JSONB NOT NULL DEFAULT '[]',
  "candidateSummaries" JSONB NOT NULL DEFAULT '[]',
  "adminNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShortlistPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateRecommendation_reviewedAt_idx" ON "CandidateRecommendation"("reviewedAt");
CREATE INDEX "ShortlistPacket_projectBriefId_idx" ON "ShortlistPacket"("projectBriefId");
CREATE INDEX "ShortlistPacket_projectId_idx" ON "ShortlistPacket"("projectId");
CREATE INDEX "ShortlistPacket_status_idx" ON "ShortlistPacket"("status");
CREATE INDEX "ShortlistPacket_updatedAt_idx" ON "ShortlistPacket"("updatedAt");

ALTER TABLE "ShortlistPacket"
  ADD CONSTRAINT "ShortlistPacket_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortlistPacket"
  ADD CONSTRAINT "ShortlistPacket_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
