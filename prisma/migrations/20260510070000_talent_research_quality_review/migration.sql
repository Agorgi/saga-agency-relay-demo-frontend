CREATE TYPE "TalentResearchReviewStatus" AS ENUM (
  'UNREVIEWED',
  'APPROVED_FOR_SHORTLIST',
  'NEEDS_MORE_RESEARCH',
  'REJECTED',
  'DO_NOT_CONTACT',
  'NEEDS_ADMIN'
);

CREATE TYPE "TalentResearchReviewSourceMode" AS ENUM (
  'INTERNAL_DB',
  'PUBLIC_WEB_RESEARCH',
  'MIXED',
  'ADMIN_ADDED'
);

CREATE TYPE "TalentResearchSourceReliability" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN'
);

CREATE TABLE "TalentResearchReview" (
  "id" TEXT NOT NULL,
  "candidateRecommendationId" TEXT,
  "talentCandidateId" TEXT,
  "searchRunId" TEXT,
  "projectBriefId" TEXT,
  "projectId" TEXT,
  "sourceMode" "TalentResearchReviewSourceMode" NOT NULL DEFAULT 'INTERNAL_DB',
  "reviewStatus" "TalentResearchReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scoreBreakdown" JSONB NOT NULL DEFAULT '{}',
  "evidenceChecklist" JSONB NOT NULL DEFAULT '{}',
  "sourceReliability" "TalentResearchSourceReliability" NOT NULL DEFAULT 'UNKNOWN',
  "identityConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskFlags" JSONB NOT NULL DEFAULT '[]',
  "reviewerNotes" TEXT,
  "organizerFacingSummary" TEXT,
  "privateReviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TalentResearchReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentResearchReview_candidateRecommendationId_idx"
  ON "TalentResearchReview"("candidateRecommendationId");

CREATE INDEX "TalentResearchReview_talentCandidateId_idx"
  ON "TalentResearchReview"("talentCandidateId");

CREATE INDEX "TalentResearchReview_searchRunId_idx"
  ON "TalentResearchReview"("searchRunId");

CREATE INDEX "TalentResearchReview_projectBriefId_idx"
  ON "TalentResearchReview"("projectBriefId");

CREATE INDEX "TalentResearchReview_projectId_idx"
  ON "TalentResearchReview"("projectId");

CREATE INDEX "TalentResearchReview_sourceMode_idx"
  ON "TalentResearchReview"("sourceMode");

CREATE INDEX "TalentResearchReview_reviewStatus_idx"
  ON "TalentResearchReview"("reviewStatus");

CREATE INDEX "TalentResearchReview_totalScore_idx"
  ON "TalentResearchReview"("totalScore");

CREATE INDEX "TalentResearchReview_createdAt_idx"
  ON "TalentResearchReview"("createdAt");

ALTER TABLE "TalentResearchReview"
  ADD CONSTRAINT "TalentResearchReview_candidateRecommendationId_fkey"
  FOREIGN KEY ("candidateRecommendationId")
  REFERENCES "CandidateRecommendation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentResearchReview"
  ADD CONSTRAINT "TalentResearchReview_talentCandidateId_fkey"
  FOREIGN KEY ("talentCandidateId")
  REFERENCES "TalentCandidate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentResearchReview"
  ADD CONSTRAINT "TalentResearchReview_searchRunId_fkey"
  FOREIGN KEY ("searchRunId")
  REFERENCES "TalentSearchRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentResearchReview"
  ADD CONSTRAINT "TalentResearchReview_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId")
  REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TalentResearchReview"
  ADD CONSTRAINT "TalentResearchReview_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
