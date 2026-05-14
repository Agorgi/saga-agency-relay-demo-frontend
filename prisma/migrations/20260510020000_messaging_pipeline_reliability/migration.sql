-- Messaging Pipeline Reliability v0.1.
-- Additive only: records inbound processing jobs for idempotent, observable webhook handling.

CREATE TYPE "InboundProcessingJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED_DUPLICATE',
  'BLOCKED'
);

CREATE TABLE "InboundProcessingJob" (
  "id" TEXT NOT NULL,
  "inboundMessageId" TEXT,
  "inboundTwilioMessageSid" TEXT,
  "projectBriefId" TEXT,
  "userId" TEXT,
  "contactId" TEXT,
  "normalizedSenderHash" TEXT,
  "status" "InboundProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
  "processingMode" TEXT NOT NULL DEFAULT 'sync',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "runAfter" TIMESTAMP(3),
  "lastErrorCategory" TEXT,
  "lastErrorMessageRedacted" TEXT,
  "resultSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "InboundProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundProcessingJob_inboundTwilioMessageSid_key" ON "InboundProcessingJob"("inboundTwilioMessageSid");
CREATE INDEX "InboundProcessingJob_status_idx" ON "InboundProcessingJob"("status");
CREATE INDEX "InboundProcessingJob_runAfter_idx" ON "InboundProcessingJob"("runAfter");
CREATE INDEX "InboundProcessingJob_inboundMessageId_idx" ON "InboundProcessingJob"("inboundMessageId");
CREATE INDEX "InboundProcessingJob_createdAt_idx" ON "InboundProcessingJob"("createdAt");
CREATE INDEX "InboundProcessingJob_processingMode_idx" ON "InboundProcessingJob"("processingMode");
CREATE INDEX "InboundProcessingJob_projectBriefId_idx" ON "InboundProcessingJob"("projectBriefId");
CREATE INDEX "InboundProcessingJob_userId_idx" ON "InboundProcessingJob"("userId");
CREATE INDEX "InboundProcessingJob_contactId_idx" ON "InboundProcessingJob"("contactId");
CREATE INDEX "InboundProcessingJob_status_runAfter_createdAt_idx" ON "InboundProcessingJob"("status", "runAfter", "createdAt");

ALTER TABLE "InboundProcessingJob"
  ADD CONSTRAINT "InboundProcessingJob_inboundMessageId_fkey"
  FOREIGN KEY ("inboundMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundProcessingJob"
  ADD CONSTRAINT "InboundProcessingJob_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundProcessingJob"
  ADD CONSTRAINT "InboundProcessingJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundProcessingJob"
  ADD CONSTRAINT "InboundProcessingJob_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
