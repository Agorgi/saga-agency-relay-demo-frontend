-- Talent Discovery & Research Engine v0.1.
-- Additive only: stores internal/public research search runs and admin-reviewed candidate cards.

CREATE TYPE "TalentSearchRunStatus" AS ENUM (
  'DRAFT',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW'
);

CREATE TYPE "TalentSearchSourceMode" AS ENUM (
  'INTERNAL_ONLY',
  'INTERNAL_PLUS_RESEARCH_PLAN',
  'WEB_RESEARCH_SHADOW',
  'WEB_RESEARCH_ACTIVE_ADMIN'
);

CREATE TYPE "TalentCandidateSource" AS ENUM (
  'INTERNAL_DB',
  'PUBLIC_WEB_RESEARCH',
  'ADMIN_ADDED'
);

CREATE TYPE "TalentCandidateStatus" AS ENUM (
  'SUGGESTED',
  'APPROVED_FOR_SHORTLIST',
  'REJECTED',
  'NEEDS_MORE_INFO',
  'DO_NOT_CONTACT'
);

CREATE TABLE "TalentSearchRun" (
  "id" TEXT NOT NULL,
  "projectBriefId" TEXT,
  "projectId" TEXT,
  "roleOpeningId" TEXT,
  "status" "TalentSearchRunStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceMode" "TalentSearchSourceMode" NOT NULL DEFAULT 'INTERNAL_ONLY',
  "querySummary" TEXT NOT NULL,
  "rolesSearched" JSONB NOT NULL DEFAULT '[]',
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TalentSearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TalentCandidate" (
  "id" TEXT NOT NULL,
  "searchRunId" TEXT NOT NULL,
  "personId" TEXT,
  "creatorProfileId" TEXT,
  "contactId" TEXT,
  "candidateRecommendationId" TEXT,
  "source" "TalentCandidateSource" NOT NULL DEFAULT 'INTERNAL_DB',
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "city" TEXT,
  "fandoms" JSONB NOT NULL DEFAULT '[]',
  "skills" JSONB NOT NULL DEFAULT '[]',
  "portfolioUrls" JSONB NOT NULL DEFAULT '[]',
  "publicSourceUrls" JSONB NOT NULL DEFAULT '[]',
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scoreBreakdown" JSONB NOT NULL DEFAULT '{}',
  "status" "TalentCandidateStatus" NOT NULL DEFAULT 'SUGGESTED',
  "risks" JSONB NOT NULL DEFAULT '[]',
  "missingInfo" JSONB NOT NULL DEFAULT '[]',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TalentCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentSearchRun_projectBriefId_idx" ON "TalentSearchRun"("projectBriefId");
CREATE INDEX "TalentSearchRun_projectId_idx" ON "TalentSearchRun"("projectId");
CREATE INDEX "TalentSearchRun_roleOpeningId_idx" ON "TalentSearchRun"("roleOpeningId");
CREATE INDEX "TalentSearchRun_status_idx" ON "TalentSearchRun"("status");
CREATE INDEX "TalentSearchRun_sourceMode_idx" ON "TalentSearchRun"("sourceMode");
CREATE INDEX "TalentSearchRun_createdAt_idx" ON "TalentSearchRun"("createdAt");

CREATE INDEX "TalentCandidate_searchRunId_idx" ON "TalentCandidate"("searchRunId");
CREATE INDEX "TalentCandidate_personId_idx" ON "TalentCandidate"("personId");
CREATE INDEX "TalentCandidate_creatorProfileId_idx" ON "TalentCandidate"("creatorProfileId");
CREATE INDEX "TalentCandidate_contactId_idx" ON "TalentCandidate"("contactId");
CREATE INDEX "TalentCandidate_candidateRecommendationId_idx" ON "TalentCandidate"("candidateRecommendationId");
CREATE INDEX "TalentCandidate_source_idx" ON "TalentCandidate"("source");
CREATE INDEX "TalentCandidate_status_idx" ON "TalentCandidate"("status");
CREATE INDEX "TalentCandidate_score_idx" ON "TalentCandidate"("score");
CREATE INDEX "TalentCandidate_createdAt_idx" ON "TalentCandidate"("createdAt");

ALTER TABLE "TalentSearchRun"
  ADD CONSTRAINT "TalentSearchRun_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentSearchRun"
  ADD CONSTRAINT "TalentSearchRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentSearchRun"
  ADD CONSTRAINT "TalentSearchRun_roleOpeningId_fkey"
  FOREIGN KEY ("roleOpeningId") REFERENCES "RoleOpening"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_searchRunId_fkey"
  FOREIGN KEY ("searchRunId") REFERENCES "TalentSearchRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_candidateRecommendationId_fkey"
  FOREIGN KEY ("candidateRecommendationId") REFERENCES "CandidateRecommendation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
