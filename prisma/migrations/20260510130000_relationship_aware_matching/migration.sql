-- CreateEnum
CREATE TYPE "CandidateGraphMatchRunStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CandidateGraphMatchSourceMode" AS ENUM ('INTERNAL_DB', 'PUBLIC_WEB_RESEARCH', 'MIXED', 'ADMIN_ADDED');

-- CreateEnum
CREATE TYPE "CandidateGraphMatchReviewStatus" AS ENUM ('SUGGESTED', 'NEEDS_REVIEW', 'APPROVED_FOR_SHORTLIST', 'REJECTED', 'DO_NOT_CONTACT');

-- CreateTable
CREATE TABLE "CandidateGraphMatchRun" (
    "id" TEXT NOT NULL,
    "projectBriefId" TEXT,
    "projectId" TEXT,
    "roleOpeningId" TEXT,
    "requestedByPersonId" TEXT,
    "requestedByUserId" TEXT,
    "status" "CandidateGraphMatchRunStatus" NOT NULL DEFAULT 'DRAFT',
    "roleTargets" JSONB NOT NULL DEFAULT '[]',
    "candidatePoolSize" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "filtersApplied" JSONB NOT NULL DEFAULT '{}',
    "scoringVersion" TEXT NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "CandidateGraphMatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateGraphMatchResult" (
    "id" TEXT NOT NULL,
    "matchRunId" TEXT NOT NULL,
    "candidateSearchProfileId" TEXT,
    "personId" TEXT,
    "creatorProfileId" TEXT,
    "contactId" TEXT,
    "talentCandidateId" TEXT,
    "candidateRecommendationId" TEXT,
    "publicWebResearchResultId" TEXT,
    "role" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreBreakdown" JSONB NOT NULL DEFAULT '{}',
    "proximityTier" TEXT NOT NULL,
    "relationshipPath" JSONB,
    "matchReasons" JSONB NOT NULL DEFAULT '[]',
    "riskFlags" JSONB NOT NULL DEFAULT '[]',
    "missingEvidence" JSONB NOT NULL DEFAULT '[]',
    "contactabilitySummary" JSONB NOT NULL DEFAULT '{}',
    "sourceMode" "CandidateGraphMatchSourceMode" NOT NULL,
    "reviewStatus" "CandidateGraphMatchReviewStatus" NOT NULL DEFAULT 'SUGGESTED',
    "organizerSafeSummary" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateGraphMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateGraphMatchRun_projectBriefId_idx" ON "CandidateGraphMatchRun"("projectBriefId");
CREATE INDEX "CandidateGraphMatchRun_projectId_idx" ON "CandidateGraphMatchRun"("projectId");
CREATE INDEX "CandidateGraphMatchRun_roleOpeningId_idx" ON "CandidateGraphMatchRun"("roleOpeningId");
CREATE INDEX "CandidateGraphMatchRun_requestedByPersonId_idx" ON "CandidateGraphMatchRun"("requestedByPersonId");
CREATE INDEX "CandidateGraphMatchRun_requestedByUserId_idx" ON "CandidateGraphMatchRun"("requestedByUserId");
CREATE INDEX "CandidateGraphMatchRun_status_idx" ON "CandidateGraphMatchRun"("status");
CREATE INDEX "CandidateGraphMatchRun_createdAt_idx" ON "CandidateGraphMatchRun"("createdAt");
CREATE INDEX "CandidateGraphMatchResult_matchRunId_idx" ON "CandidateGraphMatchResult"("matchRunId");
CREATE INDEX "CandidateGraphMatchResult_candidateSearchProfileId_idx" ON "CandidateGraphMatchResult"("candidateSearchProfileId");
CREATE INDEX "CandidateGraphMatchResult_personId_idx" ON "CandidateGraphMatchResult"("personId");
CREATE INDEX "CandidateGraphMatchResult_creatorProfileId_idx" ON "CandidateGraphMatchResult"("creatorProfileId");
CREATE INDEX "CandidateGraphMatchResult_contactId_idx" ON "CandidateGraphMatchResult"("contactId");
CREATE INDEX "CandidateGraphMatchResult_talentCandidateId_idx" ON "CandidateGraphMatchResult"("talentCandidateId");
CREATE INDEX "CandidateGraphMatchResult_candidateRecommendationId_idx" ON "CandidateGraphMatchResult"("candidateRecommendationId");
CREATE INDEX "CandidateGraphMatchResult_publicWebResearchResultId_idx" ON "CandidateGraphMatchResult"("publicWebResearchResultId");
CREATE INDEX "CandidateGraphMatchResult_role_idx" ON "CandidateGraphMatchResult"("role");
CREATE INDEX "CandidateGraphMatchResult_totalScore_idx" ON "CandidateGraphMatchResult"("totalScore");
CREATE INDEX "CandidateGraphMatchResult_proximityTier_idx" ON "CandidateGraphMatchResult"("proximityTier");
CREATE INDEX "CandidateGraphMatchResult_sourceMode_idx" ON "CandidateGraphMatchResult"("sourceMode");
CREATE INDEX "CandidateGraphMatchResult_reviewStatus_idx" ON "CandidateGraphMatchResult"("reviewStatus");
CREATE INDEX "CandidateGraphMatchResult_createdAt_idx" ON "CandidateGraphMatchResult"("createdAt");

-- AddForeignKey
ALTER TABLE "CandidateGraphMatchResult" ADD CONSTRAINT "CandidateGraphMatchResult_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "CandidateGraphMatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
