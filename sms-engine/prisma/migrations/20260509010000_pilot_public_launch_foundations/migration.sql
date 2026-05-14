-- Add admin-only pilot participant tracking for future invite-only testing.
-- This is additive and stores a hash/redacted phone only, not raw participant
-- phone numbers.

CREATE TYPE "PilotParticipantRole" AS ENUM ('ORGANIZER', 'CREATOR', 'OBSERVER', 'INTERNAL_TEST');

CREATE TYPE "PilotParticipantStatus" AS ENUM ('INVITED', 'ACTIVE', 'PAUSED', 'OPTED_OUT', 'COMPLETED');

CREATE TABLE "PilotParticipant" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "projectBriefId" TEXT,
    "phoneHash" TEXT,
    "redactedPhone" TEXT,
    "name" TEXT,
    "role" "PilotParticipantRole" NOT NULL DEFAULT 'INTERNAL_TEST',
    "status" "PilotParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "consentSource" TEXT,
    "consentTimestamp" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PilotFeedback" ADD COLUMN "pilotParticipantId" TEXT;

CREATE INDEX "PilotParticipant_personId_idx" ON "PilotParticipant"("personId");
CREATE INDEX "PilotParticipant_projectBriefId_idx" ON "PilotParticipant"("projectBriefId");
CREATE INDEX "PilotParticipant_phoneHash_idx" ON "PilotParticipant"("phoneHash");
CREATE INDEX "PilotParticipant_role_idx" ON "PilotParticipant"("role");
CREATE INDEX "PilotParticipant_status_idx" ON "PilotParticipant"("status");
CREATE INDEX "PilotParticipant_updatedAt_idx" ON "PilotParticipant"("updatedAt");
CREATE INDEX "PilotFeedback_pilotParticipantId_idx" ON "PilotFeedback"("pilotParticipantId");

ALTER TABLE "PilotParticipant"
ADD CONSTRAINT "PilotParticipant_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PilotParticipant"
ADD CONSTRAINT "PilotParticipant_projectBriefId_fkey"
FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
ADD CONSTRAINT "PilotFeedback_pilotParticipantId_fkey"
FOREIGN KEY ("pilotParticipantId") REFERENCES "PilotParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
