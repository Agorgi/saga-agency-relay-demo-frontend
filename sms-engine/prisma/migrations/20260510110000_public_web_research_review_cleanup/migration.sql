-- AlterEnum
ALTER TYPE "PublicWebResearchRunStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- AlterEnum
ALTER TYPE "PublicWebResearchResultStatus" ADD VALUE IF NOT EXISTS 'IN_QUALITY_REVIEW';
ALTER TYPE "PublicWebResearchResultStatus" ADD VALUE IF NOT EXISTS 'APPROVED_FOR_INTERNAL_REVIEW';
ALTER TYPE "PublicWebResearchResultStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "PublicWebResearchResultStatus" ADD VALUE IF NOT EXISTS 'DUPLICATE';
ALTER TYPE "PublicWebResearchResultStatus" ADD VALUE IF NOT EXISTS 'DO_NOT_CONTACT';

-- CreateEnum
CREATE TYPE "ContactabilityChannel" AS ENUM ('INTERNAL_CONTACT', 'PUBLIC_EMAIL', 'PUBLIC_CONTACT_FORM', 'PUBLIC_WEBSITE', 'INSTAGRAM_PROFILE', 'TIKTOK_PROFILE', 'YOUTUBE_PROFILE', 'LINKEDIN_PROFILE', 'BOOKING_LINK', 'AGENCY_OR_MANAGER_CONTACT', 'PUBLIC_BUSINESS_PHONE', 'OTHER_PUBLIC_PROFILE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContactabilityOutreachRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ContactabilityReviewStatus" AS ENUM ('UNREVIEWED', 'VERIFIED', 'UNSAFE', 'NEEDS_MORE_RESEARCH', 'DO_NOT_CONTACT');

-- AlterTable
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "sourceQualityScore" DOUBLE PRECISION;
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "sourceQualityBand" TEXT;
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "duplicateStatus" TEXT;
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "duplicateMatchedType" TEXT;
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "duplicateMatchedId" TEXT;
ALTER TABLE "PublicWebResearchResult" ADD COLUMN "reviewNotes" TEXT;

-- CreateTable
CREATE TABLE "ContactabilityEvidence" (
    "id" TEXT NOT NULL,
    "publicWebResearchResultId" TEXT,
    "talentCandidateId" TEXT,
    "channel" "ContactabilityChannel" NOT NULL DEFAULT 'UNKNOWN',
    "valueRedacted" TEXT,
    "rawValueEncryptedOrAdminOnly" TEXT,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "evidenceTextSummary" TEXT,
    "isPubliclyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isBusinessFacing" BOOLEAN NOT NULL DEFAULT false,
    "isPersonalContact" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "outreachAllowed" BOOLEAN NOT NULL DEFAULT false,
    "outreachRisk" "ContactabilityOutreachRisk" NOT NULL DEFAULT 'HIGH',
    "reviewStatus" "ContactabilityReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "complianceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactabilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicWebResearchResult_sourceQualityBand_idx" ON "PublicWebResearchResult"("sourceQualityBand");

-- CreateIndex
CREATE INDEX "PublicWebResearchResult_duplicateStatus_idx" ON "PublicWebResearchResult"("duplicateStatus");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_publicWebResearchResultId_idx" ON "ContactabilityEvidence"("publicWebResearchResultId");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_talentCandidateId_idx" ON "ContactabilityEvidence"("talentCandidateId");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_channel_idx" ON "ContactabilityEvidence"("channel");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_outreachRisk_idx" ON "ContactabilityEvidence"("outreachRisk");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_reviewStatus_idx" ON "ContactabilityEvidence"("reviewStatus");

-- CreateIndex
CREATE INDEX "ContactabilityEvidence_createdAt_idx" ON "ContactabilityEvidence"("createdAt");

-- AddForeignKey
ALTER TABLE "ContactabilityEvidence" ADD CONSTRAINT "ContactabilityEvidence_publicWebResearchResultId_fkey" FOREIGN KEY ("publicWebResearchResultId") REFERENCES "PublicWebResearchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactabilityEvidence" ADD CONSTRAINT "ContactabilityEvidence_talentCandidateId_fkey" FOREIGN KEY ("talentCandidateId") REFERENCES "TalentCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
