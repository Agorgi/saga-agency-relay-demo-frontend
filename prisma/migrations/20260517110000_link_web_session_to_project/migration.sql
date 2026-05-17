-- AlterTable
ALTER TABLE "WebSession" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "WebSession_projectId_idx" ON "WebSession"("projectId");

-- AddForeignKey
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
