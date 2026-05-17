-- CreateEnum
CREATE TYPE "ProjectJourneyStep" AS ENUM (
    'intake',
    'brief_ready',
    'crew_reviewing',
    'outreach_prep',
    'outreach_awaiting_send',
    'outreach_sent',
    'archived'
);

-- CreateTable
CREATE TABLE "ProjectJourney" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "step" "ProjectJourneyStep" NOT NULL DEFAULT 'intake',
    "primaryAction" JSONB NOT NULL,
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "lastTransition" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectJourney_projectId_key" ON "ProjectJourney"("projectId");

-- CreateIndex
CREATE INDEX "ProjectJourney_step_idx" ON "ProjectJourney"("step");

-- AddForeignKey
ALTER TABLE "ProjectJourney" ADD CONSTRAINT "ProjectJourney_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
