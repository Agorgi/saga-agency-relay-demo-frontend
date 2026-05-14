-- CreateTable
CREATE TABLE "WebChatRuntimeSetting" (
    "key" TEXT NOT NULL,
    "autonomous_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_admin_session_id" TEXT,

    CONSTRAINT "WebChatRuntimeSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WebChatRuntimeSettingAudit" (
    "id" TEXT NOT NULL,
    "old_value" BOOLEAN NOT NULL,
    "new_value" BOOLEAN NOT NULL,
    "actor_admin_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebChatRuntimeSettingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebChatRuntimeSettingAudit_created_at_idx" ON "WebChatRuntimeSettingAudit"("created_at");
