-- CreateEnum
CREATE TYPE "PublicWebResearchJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PublicWebResearchJob" (
    "id" TEXT NOT NULL,
    "researchRunId" TEXT,
    "projectBriefId" TEXT,
    "projectId" TEXT,
    "role" TEXT,
    "querySummary" TEXT,
    "mode" "PublicWebResearchRunMode" NOT NULL DEFAULT 'LIVE_DRY_RUN',
    "status" "PublicWebResearchJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "runAfter" TIMESTAMP(3),
    "errorCategory" TEXT,
    "lastErrorMessageRedacted" TEXT,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PublicWebResearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicWebResearchJob_researchRunId_idx" ON "PublicWebResearchJob"("researchRunId");

-- CreateIndex
CREATE INDEX "PublicWebResearchJob_status_idx" ON "PublicWebResearchJob"("status");

-- CreateIndex
CREATE INDEX "PublicWebResearchJob_runAfter_idx" ON "PublicWebResearchJob"("runAfter");

-- CreateIndex
CREATE INDEX "PublicWebResearchJob_createdAt_idx" ON "PublicWebResearchJob"("createdAt");

-- CreateIndex
CREATE INDEX "PublicWebResearchJob_mode_idx" ON "PublicWebResearchJob"("mode");

-- AddForeignKey
ALTER TABLE "PublicWebResearchJob" ADD CONSTRAINT "PublicWebResearchJob_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "PublicWebResearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
