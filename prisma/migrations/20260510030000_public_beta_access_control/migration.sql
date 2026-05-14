-- Public Beta Access Control v0.1
-- Additive only: extends pilot participant metadata and adds hashed invite codes.

ALTER TYPE "PilotParticipantRole" ADD VALUE IF NOT EXISTS 'BOTH';
ALTER TYPE "PilotParticipantStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';
ALTER TYPE "PilotParticipantStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

DO $$ BEGIN
  CREATE TYPE "BetaInviteCodeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BetaInviteCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "label" TEXT,
  "cohort" TEXT NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "status" "BetaInviteCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaInviteCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BetaInviteCode_codeHash_key" ON "BetaInviteCode"("codeHash");
CREATE INDEX IF NOT EXISTS "BetaInviteCode_cohort_idx" ON "BetaInviteCode"("cohort");
CREATE INDEX IF NOT EXISTS "BetaInviteCode_status_idx" ON "BetaInviteCode"("status");
CREATE INDEX IF NOT EXISTS "BetaInviteCode_expiresAt_idx" ON "BetaInviteCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "BetaInviteCode_createdAt_idx" ON "BetaInviteCode"("createdAt");

ALTER TABLE "PilotParticipant" ADD COLUMN IF NOT EXISTS "inviteCodeId" TEXT;
ALTER TABLE "PilotParticipant" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "PilotParticipant" ADD COLUMN IF NOT EXISTS "cohort" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "PilotParticipant" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
ALTER TABLE "PilotParticipant" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PilotParticipant_inviteCodeId_idx" ON "PilotParticipant"("inviteCodeId");
CREATE INDEX IF NOT EXISTS "PilotParticipant_email_idx" ON "PilotParticipant"("email");
CREATE INDEX IF NOT EXISTS "PilotParticipant_cohort_idx" ON "PilotParticipant"("cohort");
CREATE INDEX IF NOT EXISTS "PilotParticipant_status_cohort_idx" ON "PilotParticipant"("status", "cohort");

DO $$ BEGIN
  ALTER TABLE "PilotParticipant"
    ADD CONSTRAINT "PilotParticipant_inviteCodeId_fkey"
    FOREIGN KEY ("inviteCodeId") REFERENCES "BetaInviteCode"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
