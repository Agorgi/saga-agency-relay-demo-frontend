-- CreateEnum
CREATE TYPE "CandidateGraphEntityType" AS ENUM ('PERSON', 'CREATOR_PROFILE', 'CONTACT', 'TALENT_CANDIDATE', 'CANDIDATE_RECOMMENDATION', 'PROJECT', 'PROJECT_BRIEF', 'ROLE_OPENING', 'OPPORTUNITY', 'INTEREST_CHECK', 'FANDOM_TAG', 'COMMUNITY_TAG', 'LOCATION', 'EVIDENCE_SOURCE', 'CONTACTABILITY_EVIDENCE');

-- CreateEnum
CREATE TYPE "CandidateGraphEdgeType" AS ENUM ('FRIEND', 'MUTUAL', 'REFERRED_BY', 'WORKED_TOGETHER', 'SAME_PROJECT', 'SAME_EVENT', 'SAME_COMMUNITY', 'SAME_FANDOM', 'SAME_CITY', 'SAME_METRO', 'SAME_ROLE', 'HAS_ROLE', 'HAS_SKILL', 'HAS_FANDOM', 'HAS_LOCATION', 'HAS_SOURCE', 'HAS_CONTACTABILITY', 'PUBLIC_PROFILE_MATCH', 'ADMIN_LINKED', 'DUPLICATE_OF', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "CandidateVerificationStatus" AS ENUM ('DISCOVERED', 'NEEDS_IDENTITY_REVIEW', 'NEEDS_CONTACTABILITY_REVIEW', 'NEEDS_QUALITY_REVIEW', 'APPROVED_FOR_INTERNAL_REVIEW', 'APPROVED_FOR_SHORTLIST', 'REJECTED', 'DUPLICATE', 'DO_NOT_CONTACT', 'ARCHIVED');

-- AlterTable
ALTER TABLE "TalentCandidate" ADD COLUMN "verificationStatus" "CandidateVerificationStatus" NOT NULL DEFAULT 'DISCOVERED';

-- CreateTable
CREATE TABLE "CandidateGraphEdge" (
    "id" TEXT NOT NULL,
    "fromEntityType" "CandidateGraphEntityType" NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityType" "CandidateGraphEntityType" NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "edgeType" "CandidateGraphEdgeType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "evidenceSummary" TEXT,
    "isInferred" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSearchProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "creatorProfileId" TEXT,
    "contactId" TEXT,
    "talentCandidateId" TEXT,
    "displayName" TEXT NOT NULL,
    "roleTags" JSONB NOT NULL DEFAULT '[]',
    "skillTags" JSONB NOT NULL DEFAULT '[]',
    "fandomTags" JSONB NOT NULL DEFAULT '[]',
    "communityTags" JSONB NOT NULL DEFAULT '[]',
    "city" TEXT,
    "metro" TEXT,
    "locationConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewStatus" "CandidateVerificationStatus" NOT NULL DEFAULT 'DISCOVERED',
    "sourceMode" TEXT NOT NULL,
    "evidenceQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contactabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateSearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentCandidate_verificationStatus_idx" ON "TalentCandidate"("verificationStatus");
CREATE INDEX "CandidateGraphEdge_fromEntityType_fromEntityId_idx" ON "CandidateGraphEdge"("fromEntityType", "fromEntityId");
CREATE INDEX "CandidateGraphEdge_toEntityType_toEntityId_idx" ON "CandidateGraphEdge"("toEntityType", "toEntityId");
CREATE INDEX "CandidateGraphEdge_edgeType_idx" ON "CandidateGraphEdge"("edgeType");
CREATE INDEX "CandidateGraphEdge_sourceType_sourceId_idx" ON "CandidateGraphEdge"("sourceType", "sourceId");
CREATE INDEX "CandidateGraphEdge_isInferred_idx" ON "CandidateGraphEdge"("isInferred");
CREATE INDEX "CandidateGraphEdge_createdAt_idx" ON "CandidateGraphEdge"("createdAt");
CREATE INDEX "CandidateSearchProfile_personId_idx" ON "CandidateSearchProfile"("personId");
CREATE INDEX "CandidateSearchProfile_creatorProfileId_idx" ON "CandidateSearchProfile"("creatorProfileId");
CREATE INDEX "CandidateSearchProfile_contactId_idx" ON "CandidateSearchProfile"("contactId");
CREATE INDEX "CandidateSearchProfile_talentCandidateId_idx" ON "CandidateSearchProfile"("talentCandidateId");
CREATE INDEX "CandidateSearchProfile_reviewStatus_idx" ON "CandidateSearchProfile"("reviewStatus");
CREATE INDEX "CandidateSearchProfile_sourceMode_idx" ON "CandidateSearchProfile"("sourceMode");
CREATE INDEX "CandidateSearchProfile_city_idx" ON "CandidateSearchProfile"("city");
CREATE INDEX "CandidateSearchProfile_metro_idx" ON "CandidateSearchProfile"("metro");
CREATE INDEX "CandidateSearchProfile_doNotContact_idx" ON "CandidateSearchProfile"("doNotContact");
CREATE INDEX "CandidateSearchProfile_optedOut_idx" ON "CandidateSearchProfile"("optedOut");
CREATE INDEX "CandidateSearchProfile_lastIndexedAt_idx" ON "CandidateSearchProfile"("lastIndexedAt");
