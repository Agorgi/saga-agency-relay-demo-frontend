-- AlterTable
ALTER TABLE "WebChatMessage" ADD COLUMN     "configuredMode" TEXT,
ADD COLUMN     "effectiveMode" TEXT,
ADD COLUMN     "extractedFields" JSONB,
ADD COLUMN     "fallbackReason" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "nextStep" JSONB,
ADD COLUMN     "operation" TEXT,
ADD COLUMN     "persona" TEXT,
ADD COLUMN     "providerState" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "selectedReplySource" TEXT;

-- AlterTable
ALTER TABLE "WebSession" ADD COLUMN     "persona" TEXT;

-- CreateIndex
CREATE INDEX "WebChatMessage_persona_idx" ON "WebChatMessage"("persona");

-- CreateIndex
CREATE INDEX "WebChatMessage_route_idx" ON "WebChatMessage"("route");

-- CreateIndex
CREATE INDEX "WebChatMessage_providerState_idx" ON "WebChatMessage"("providerState");

-- CreateIndex
CREATE INDEX "WebChatMessage_createdAt_idx" ON "WebChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WebSession_persona_idx" ON "WebSession"("persona");
