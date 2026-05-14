-- Capped Public Beta Infrastructure v0.1.
-- Additive only: waitlist and consent records for future public-beta admission.

CREATE TYPE "PublicBetaUseCase" AS ENUM (
  'ORGANIZER',
  'CREATOR',
  'INTEREST_CHECK',
  'OTHER',
  'UNKNOWN'
);

CREATE TYPE "PublicBetaWaitlistStatus" AS ENUM (
  'PENDING',
  'INVITED',
  'ADMITTED',
  'REJECTED',
  'PAUSED',
  'DUPLICATE',
  'OPTED_OUT'
);

CREATE TYPE "ConsentEventType" AS ENUM (
  'SMS_PILOT',
  'PUBLIC_BETA',
  'TERMS',
  'PRIVACY',
  'MARKETING_OPTIONAL'
);

CREATE TYPE "ConsentEventSource" AS ENUM (
  'ADMIN',
  'WAITLIST_FORM',
  'SMS',
  'IMPORT'
);

CREATE TABLE "PublicBetaWaitlistEntry" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "emailHash" TEXT,
  "phoneHash" TEXT,
  "redactedPhone" TEXT,
  "name" TEXT,
  "desiredUseCase" "PublicBetaUseCase" NOT NULL DEFAULT 'UNKNOWN',
  "city" TEXT,
  "fandoms" JSONB NOT NULL DEFAULT '[]',
  "source" TEXT,
  "status" "PublicBetaWaitlistStatus" NOT NULL DEFAULT 'PENDING',
  "inviteCodeId" TEXT,
  "consentCaptured" BOOLEAN NOT NULL DEFAULT false,
  "consentTextVersion" TEXT,
  "consentCapturedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicBetaWaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentEvent" (
  "id" TEXT NOT NULL,
  "participantId" TEXT,
  "waitlistEntryId" TEXT,
  "phoneHash" TEXT,
  "emailHash" TEXT,
  "consentType" "ConsentEventType" NOT NULL,
  "consentTextVersion" TEXT NOT NULL,
  "consentText" TEXT NOT NULL,
  "source" "ConsentEventSource" NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicBetaWaitlistEntry_emailHash_idx" ON "PublicBetaWaitlistEntry"("emailHash");
CREATE INDEX "PublicBetaWaitlistEntry_phoneHash_idx" ON "PublicBetaWaitlistEntry"("phoneHash");
CREATE INDEX "PublicBetaWaitlistEntry_desiredUseCase_idx" ON "PublicBetaWaitlistEntry"("desiredUseCase");
CREATE INDEX "PublicBetaWaitlistEntry_status_idx" ON "PublicBetaWaitlistEntry"("status");
CREATE INDEX "PublicBetaWaitlistEntry_inviteCodeId_idx" ON "PublicBetaWaitlistEntry"("inviteCodeId");
CREATE INDEX "PublicBetaWaitlistEntry_createdAt_idx" ON "PublicBetaWaitlistEntry"("createdAt");
CREATE INDEX "PublicBetaWaitlistEntry_updatedAt_idx" ON "PublicBetaWaitlistEntry"("updatedAt");

CREATE INDEX "ConsentEvent_participantId_idx" ON "ConsentEvent"("participantId");
CREATE INDEX "ConsentEvent_waitlistEntryId_idx" ON "ConsentEvent"("waitlistEntryId");
CREATE INDEX "ConsentEvent_phoneHash_idx" ON "ConsentEvent"("phoneHash");
CREATE INDEX "ConsentEvent_emailHash_idx" ON "ConsentEvent"("emailHash");
CREATE INDEX "ConsentEvent_consentType_idx" ON "ConsentEvent"("consentType");
CREATE INDEX "ConsentEvent_source_idx" ON "ConsentEvent"("source");
CREATE INDEX "ConsentEvent_capturedAt_idx" ON "ConsentEvent"("capturedAt");
CREATE INDEX "ConsentEvent_createdAt_idx" ON "ConsentEvent"("createdAt");

ALTER TABLE "PublicBetaWaitlistEntry"
  ADD CONSTRAINT "PublicBetaWaitlistEntry_inviteCodeId_fkey"
  FOREIGN KEY ("inviteCodeId") REFERENCES "BetaInviteCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsentEvent"
  ADD CONSTRAINT "ConsentEvent_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "PilotParticipant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsentEvent"
  ADD CONSTRAINT "ConsentEvent_waitlistEntryId_fkey"
  FOREIGN KEY ("waitlistEntryId") REFERENCES "PublicBetaWaitlistEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
