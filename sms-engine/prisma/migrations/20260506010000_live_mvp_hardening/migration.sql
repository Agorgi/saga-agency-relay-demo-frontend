-- AlterTable
ALTER TABLE "ProjectBrief" ADD COLUMN "previousStatus" "ProjectStatus";
ALTER TABLE "ProjectBrief" ADD COLUMN "escalationReason" TEXT;
ALTER TABLE "ProjectBrief" ADD COLUMN "escalationFlags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ProjectBrief" ADD COLUMN "escalationResolvedAt" TIMESTAMP(3);
