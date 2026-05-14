-- Per-phone autonomy controls for staged SMS conversations.
-- Stores phone hashes and redacted display values only; raw phone values stay in existing models.

CREATE TYPE "ConversationAutonomyMode" AS ENUM ('MANUAL_REVIEW', 'AUTONOMOUS_UNTIL_OUTREACH', 'PAUSED');

CREATE TABLE "ConversationAutonomySetting" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "redactedPhone" TEXT NOT NULL,
    "personId" TEXT,
    "contactId" TEXT,
    "pilotParticipantId" TEXT,
    "mode" "ConversationAutonomyMode" NOT NULL DEFAULT 'MANUAL_REVIEW',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedBy" TEXT,
    "lastAutonomousReplyAt" TIMESTAMP(3),
    "lastHandoffAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationAutonomySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationAutonomySetting_phoneHash_key" ON "ConversationAutonomySetting"("phoneHash");
CREATE INDEX "ConversationAutonomySetting_mode_idx" ON "ConversationAutonomySetting"("mode");
CREATE INDEX "ConversationAutonomySetting_enabled_idx" ON "ConversationAutonomySetting"("enabled");
CREATE INDEX "ConversationAutonomySetting_personId_idx" ON "ConversationAutonomySetting"("personId");
CREATE INDEX "ConversationAutonomySetting_contactId_idx" ON "ConversationAutonomySetting"("contactId");
CREATE INDEX "ConversationAutonomySetting_pilotParticipantId_idx" ON "ConversationAutonomySetting"("pilotParticipantId");
CREATE INDEX "ConversationAutonomySetting_updatedAt_idx" ON "ConversationAutonomySetting"("updatedAt");
CREATE INDEX "ConversationAutonomySetting_lastHandoffAt_idx" ON "ConversationAutonomySetting"("lastHandoffAt");

ALTER TABLE "ConversationAutonomySetting"
ADD CONSTRAINT "ConversationAutonomySetting_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationAutonomySetting"
ADD CONSTRAINT "ConversationAutonomySetting_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationAutonomySetting"
ADD CONSTRAINT "ConversationAutonomySetting_pilotParticipantId_fkey"
FOREIGN KEY ("pilotParticipantId") REFERENCES "PilotParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
