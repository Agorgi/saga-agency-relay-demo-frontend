CREATE TYPE "PublicWebResearchRunStatus" AS ENUM (
  'DRAFT',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW',
  'DISCARDED'
);

CREATE TYPE "PublicWebResearchRunMode" AS ENUM (
  'SHADOW',
  'ADMIN_ACTIVE'
);

CREATE TYPE "PublicWebResearchResultStatus" AS ENUM (
  'SHADOW_RESULT',
  'NEEDS_REVIEW',
  'APPROVED_FOR_REVIEW',
  'REJECTED',
  'DISCARDED'
);

CREATE TABLE "PublicWebResearchRun" (
  "id" TEXT NOT NULL,
  "projectBriefId" TEXT,
  "projectId" TEXT,
  "roleOpeningId" TEXT,
  "talentSearchRunId" TEXT,
  "status" "PublicWebResearchRunStatus" NOT NULL DEFAULT 'DRAFT',
  "mode" "PublicWebResearchRunMode" NOT NULL DEFAULT 'SHADOW',
  "provider" TEXT NOT NULL,
  "queryPlan" JSONB NOT NULL DEFAULT '[]',
  "roleTargets" JSONB NOT NULL DEFAULT '[]',
  "allowedDomains" JSONB,
  "blockedDomains" JSONB,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "citationCount" INTEGER NOT NULL DEFAULT 0,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "errorCategory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PublicWebResearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicWebResearchResult" (
  "id" TEXT NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "city" TEXT,
  "publicProfileUrls" JSONB NOT NULL DEFAULT '[]',
  "sourceUrls" JSONB NOT NULL DEFAULT '[]',
  "sourceTitles" JSONB,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "candidateCard" JSONB NOT NULL DEFAULT '{}',
  "status" "PublicWebResearchResultStatus" NOT NULL DEFAULT 'SHADOW_RESULT',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceReliability" "TalentResearchSourceReliability" NOT NULL DEFAULT 'UNKNOWN',
  "riskFlags" JSONB NOT NULL DEFAULT '[]',
  "missingEvidence" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicWebResearchResult_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TalentCandidate"
  ADD COLUMN "publicWebResearchResultId" TEXT;

CREATE INDEX "PublicWebResearchRun_projectBriefId_idx" ON "PublicWebResearchRun"("projectBriefId");
CREATE INDEX "PublicWebResearchRun_projectId_idx" ON "PublicWebResearchRun"("projectId");
CREATE INDEX "PublicWebResearchRun_roleOpeningId_idx" ON "PublicWebResearchRun"("roleOpeningId");
CREATE INDEX "PublicWebResearchRun_talentSearchRunId_idx" ON "PublicWebResearchRun"("talentSearchRunId");
CREATE INDEX "PublicWebResearchRun_status_idx" ON "PublicWebResearchRun"("status");
CREATE INDEX "PublicWebResearchRun_mode_idx" ON "PublicWebResearchRun"("mode");
CREATE INDEX "PublicWebResearchRun_provider_idx" ON "PublicWebResearchRun"("provider");
CREATE INDEX "PublicWebResearchRun_createdAt_idx" ON "PublicWebResearchRun"("createdAt");

CREATE INDEX "PublicWebResearchResult_researchRunId_idx" ON "PublicWebResearchResult"("researchRunId");
CREATE INDEX "PublicWebResearchResult_role_idx" ON "PublicWebResearchResult"("role");
CREATE INDEX "PublicWebResearchResult_status_idx" ON "PublicWebResearchResult"("status");
CREATE INDEX "PublicWebResearchResult_confidence_idx" ON "PublicWebResearchResult"("confidence");
CREATE INDEX "PublicWebResearchResult_sourceReliability_idx" ON "PublicWebResearchResult"("sourceReliability");
CREATE INDEX "PublicWebResearchResult_createdAt_idx" ON "PublicWebResearchResult"("createdAt");

CREATE INDEX "TalentCandidate_publicWebResearchResultId_idx" ON "TalentCandidate"("publicWebResearchResultId");

ALTER TABLE "PublicWebResearchRun"
  ADD CONSTRAINT "PublicWebResearchRun_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId")
  REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "PublicWebResearchRun"
  ADD CONSTRAINT "PublicWebResearchRun_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "PublicWebResearchRun"
  ADD CONSTRAINT "PublicWebResearchRun_roleOpeningId_fkey"
  FOREIGN KEY ("roleOpeningId")
  REFERENCES "RoleOpening"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "PublicWebResearchRun"
  ADD CONSTRAINT "PublicWebResearchRun_talentSearchRunId_fkey"
  FOREIGN KEY ("talentSearchRunId")
  REFERENCES "TalentSearchRun"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "PublicWebResearchResult"
  ADD CONSTRAINT "PublicWebResearchResult_researchRunId_fkey"
  FOREIGN KEY ("researchRunId")
  REFERENCES "PublicWebResearchRun"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "TalentCandidate"
  ADD CONSTRAINT "TalentCandidate_publicWebResearchResultId_fkey"
  FOREIGN KEY ("publicWebResearchResultId")
  REFERENCES "PublicWebResearchResult"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
