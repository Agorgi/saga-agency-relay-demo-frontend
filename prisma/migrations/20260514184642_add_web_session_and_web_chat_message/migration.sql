-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mode" TEXT,
    "turn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebSession_createdAt_idx" ON "WebSession"("createdAt");

-- CreateIndex
CREATE INDEX "WebChatMessage_sessionId_conversationId_createdAt_idx" ON "WebChatMessage"("sessionId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "WebChatMessage" ADD CONSTRAINT "WebChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WebSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
