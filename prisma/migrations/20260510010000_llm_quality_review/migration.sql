-- LLM Quality Review v0.2.
-- Additive only: captures admin-reviewable comparison records for LLM output
-- without enabling live SMS, active_live, Twilio sends, or production app integration.

CREATE TYPE "LlmReviewStatus" AS ENUM (
  'UNREVIEWED',
  'GOOD',
  'TOO_VERBOSE',
  'WRONG_NEXT_QUESTION',
  'UNSAFE',
  'CONFUSING',
  'BETTER_THAN_FALLBACK',
  'WORSE_THAN_FALLBACK',
  'NEEDS_PROMPT_TUNING'
);

CREATE TABLE "LlmReviewItem" (
  "id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "flow" TEXT NOT NULL,
  "projectBriefId" TEXT,
  "personId" TEXT,
  "messageId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "deterministicText" TEXT,
  "llmText" TEXT,
  "selectedText" TEXT,
  "selectedReplySource" TEXT,
  "validationStatus" TEXT NOT NULL,
  "safetyFlags" JSONB NOT NULL DEFAULT '[]',
  "forbiddenClaimsDetected" BOOLEAN NOT NULL DEFAULT false,
  "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
  "fallbackReason" TEXT,
  "toneReviewStatus" TEXT,
  "needsReview" BOOLEAN NOT NULL DEFAULT true,
  "reviewStatus" "LlmReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LlmReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LlmReviewItem_operation_idx" ON "LlmReviewItem"("operation");
CREATE INDEX "LlmReviewItem_flow_idx" ON "LlmReviewItem"("flow");
CREATE INDEX "LlmReviewItem_projectBriefId_idx" ON "LlmReviewItem"("projectBriefId");
CREATE INDEX "LlmReviewItem_personId_idx" ON "LlmReviewItem"("personId");
CREATE INDEX "LlmReviewItem_messageId_idx" ON "LlmReviewItem"("messageId");
CREATE INDEX "LlmReviewItem_reviewStatus_idx" ON "LlmReviewItem"("reviewStatus");
CREATE INDEX "LlmReviewItem_createdAt_idx" ON "LlmReviewItem"("createdAt");

ALTER TABLE "LlmReviewItem"
  ADD CONSTRAINT "LlmReviewItem_projectBriefId_fkey"
  FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LlmReviewItem"
  ADD CONSTRAINT "LlmReviewItem_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LlmReviewItem"
  ADD CONSTRAINT "LlmReviewItem_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
