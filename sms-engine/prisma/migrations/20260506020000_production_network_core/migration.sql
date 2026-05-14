-- CreateEnum
CREATE TYPE "PersonSource" AS ENUM ('SMS', 'APP', 'ADMIN', 'IMPORT', 'PUBLIC');
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'IMPLIED', 'EXPLICIT', 'OPTED_OUT');
CREATE TYPE "ProfileReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO');
CREATE TYPE "NetworkProjectSource" AS ENUM ('SMS', 'MOBILE_APP', 'WEB_APP', 'ADMIN', 'INTEREST_CHECK', 'IMPORT');
CREATE TYPE "NetworkProjectStatus" AS ENUM ('INTAKE', 'BRIEF_READY', 'ROLE_MAPPING', 'RECRUITING', 'SHORTLIST_READY', 'TEAM_FORMING', 'IN_PRODUCTION', 'ARCHIVED', 'NEEDS_ADMIN');
CREATE TYPE "CompensationType" AS ENUM ('UNKNOWN', 'PAID', 'VOLUNTEER', 'COLLAB', 'TRADE');
CREATE TYPE "RoleOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'RECOMMENDING', 'OUTREACHING', 'FILLED', 'ARCHIVED');
CREATE TYPE "OpportunityVisibility" AS ENUM ('PRIVATE', 'FRIENDS', 'MUTUALS', 'COMMUNITY', 'PUBLIC');
CREATE TYPE "OpportunityApplicationMode" AS ENUM ('INVITE_ONLY', 'APPLY_ONLY', 'INVITE_AND_APPLY');
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FILLED', 'ARCHIVED');
CREATE TYPE "ThresholdType" AS ENUM ('INTERESTED_COUNT', 'TICKET_PLEDGE', 'ADMIN_APPROVAL');
CREATE TYPE "InterestCheckStatus" AS ENUM ('DRAFT', 'ACTIVE', 'THRESHOLD_MET', 'CONVERTED_TO_PROJECT', 'ARCHIVED');
CREATE TYPE "ProximityTier" AS ENUM ('FRIEND', 'MUTUAL', 'COMMUNITY', 'LOCAL', 'EXTENDED', 'PUBLIC', 'UNKNOWN');
CREATE TYPE "CandidateRecommendationStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'CONTACTED', 'INTERESTED', 'DECLINED', 'SHORTLISTED', 'ADDED_TO_TEAM', 'REJECTED');
CREATE TYPE "RelationshipType" AS ENUM ('FRIEND', 'MUTUAL', 'SAME_COMMUNITY', 'ATTENDED_SAME_EVENT', 'COLLABORATED', 'FOLLOWING', 'IMPORTED_CONNECTION');
CREATE TYPE "TeamStatus" AS ENUM ('FORMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'INTERESTED', 'CONFIRMED', 'REMOVED');
CREATE TYPE "ConversationProvider" AS ENUM ('MOCK', 'TWILIO', 'APP_CHAT', 'APPLE_MESSAGES', 'WHATSAPP');
CREATE TYPE "ProductionConversationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "sagaUserId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "source" "PersonSource" NOT NULL DEFAULT 'ADMIN',
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "city" TEXT,
    "roles" TEXT[],
    "skills" TEXT[],
    "fandoms" TEXT[],
    "communities" TEXT[],
    "portfolioUrls" TEXT[],
    "socialUrls" TEXT[],
    "availabilityNotes" TEXT,
    "rateNotes" TEXT,
    "preferredOpportunityTypes" TEXT[],
    "reviewStatus" "ProfileReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "source" "NetworkProjectSource" NOT NULL DEFAULT 'ADMIN',
    "existingSagaEventId" TEXT,
    "existingSagaCommunityId" TEXT,
    "legacyProjectBriefId" TEXT,
    "organizerPersonId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "city" TEXT,
    "targetDate" TEXT,
    "budgetRange" TEXT,
    "audience" TEXT,
    "fandoms" TEXT[],
    "status" "NetworkProjectStatus" NOT NULL DEFAULT 'INTAKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleOpening" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredSkills" TEXT[],
    "preferredFandoms" TEXT[],
    "locationRequirement" TEXT,
    "remoteAllowed" BOOLEAN NOT NULL DEFAULT false,
    "compensationType" "CompensationType" NOT NULL DEFAULT 'UNKNOWN',
    "budgetRange" TEXT,
    "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
    "status" "RoleOpeningStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleOpening_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "roleOpeningId" TEXT NOT NULL,
    "visibility" "OpportunityVisibility" NOT NULL DEFAULT 'PRIVATE',
    "applicationMode" "OpportunityApplicationMode" NOT NULL DEFAULT 'INVITE_ONLY',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterestCheck" (
    "id" TEXT NOT NULL,
    "creatorPersonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT,
    "fandoms" TEXT[],
    "proposedTiming" TEXT,
    "thresholdType" "ThresholdType" NOT NULL DEFAULT 'INTERESTED_COUNT',
    "thresholdValue" INTEGER,
    "currentInterestCount" INTEGER NOT NULL DEFAULT 0,
    "status" "InterestCheckStatus" NOT NULL DEFAULT 'DRAFT',
    "convertedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InterestCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateRecommendation" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "proximityTier" "ProximityTier" NOT NULL DEFAULT 'UNKNOWN',
    "matchingReasons" TEXT[],
    "risks" TEXT[],
    "status" "CandidateRecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelationshipEdge" (
    "id" TEXT NOT NULL,
    "fromPersonId" TEXT NOT NULL,
    "toPersonId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelationshipEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'FORMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleOpeningId" TEXT,
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "ConversationProvider" NOT NULL DEFAULT 'MOCK',
    "externalConversationId" TEXT,
    "status" "ProductionConversationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_phone_key" ON "Person"("phone");
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE INDEX "Person_city_idx" ON "Person"("city");
CREATE INDEX "Person_source_idx" ON "Person"("source");
CREATE INDEX "Person_consentStatus_idx" ON "Person"("consentStatus");

CREATE UNIQUE INDEX "CreatorProfile_personId_key" ON "CreatorProfile"("personId");
CREATE INDEX "CreatorProfile_city_idx" ON "CreatorProfile"("city");
CREATE INDEX "CreatorProfile_reviewStatus_idx" ON "CreatorProfile"("reviewStatus");

CREATE UNIQUE INDEX "Project_legacyProjectBriefId_key" ON "Project"("legacyProjectBriefId");
CREATE INDEX "Project_source_idx" ON "Project"("source");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_city_idx" ON "Project"("city");
CREATE INDEX "Project_organizerPersonId_idx" ON "Project"("organizerPersonId");

CREATE INDEX "RoleOpening_projectId_idx" ON "RoleOpening"("projectId");
CREATE INDEX "RoleOpening_roleType_idx" ON "RoleOpening"("roleType");
CREATE INDEX "RoleOpening_status_idx" ON "RoleOpening"("status");

CREATE INDEX "Opportunity_roleOpeningId_idx" ON "Opportunity"("roleOpeningId");
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");
CREATE INDEX "Opportunity_visibility_idx" ON "Opportunity"("visibility");

CREATE UNIQUE INDEX "InterestCheck_convertedProjectId_key" ON "InterestCheck"("convertedProjectId");
CREATE INDEX "InterestCheck_status_idx" ON "InterestCheck"("status");
CREATE INDEX "InterestCheck_city_idx" ON "InterestCheck"("city");
CREATE INDEX "InterestCheck_creatorPersonId_idx" ON "InterestCheck"("creatorPersonId");

CREATE UNIQUE INDEX "CandidateRecommendation_opportunityId_personId_key" ON "CandidateRecommendation"("opportunityId", "personId");
CREATE INDEX "CandidateRecommendation_opportunityId_idx" ON "CandidateRecommendation"("opportunityId");
CREATE INDEX "CandidateRecommendation_personId_idx" ON "CandidateRecommendation"("personId");
CREATE INDEX "CandidateRecommendation_status_idx" ON "CandidateRecommendation"("status");
CREATE INDEX "CandidateRecommendation_score_idx" ON "CandidateRecommendation"("score");

CREATE UNIQUE INDEX "RelationshipEdge_fromPersonId_toPersonId_relationshipType_key" ON "RelationshipEdge"("fromPersonId", "toPersonId", "relationshipType");
CREATE INDEX "RelationshipEdge_fromPersonId_idx" ON "RelationshipEdge"("fromPersonId");
CREATE INDEX "RelationshipEdge_toPersonId_idx" ON "RelationshipEdge"("toPersonId");
CREATE INDEX "RelationshipEdge_relationshipType_idx" ON "RelationshipEdge"("relationshipType");

CREATE UNIQUE INDEX "Team_projectId_key" ON "Team"("projectId");
CREATE INDEX "Team_status_idx" ON "Team"("status");

CREATE UNIQUE INDEX "TeamMember_teamId_personId_roleOpeningId_key" ON "TeamMember"("teamId", "personId", "roleOpeningId");
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");
CREATE INDEX "TeamMember_personId_idx" ON "TeamMember"("personId");
CREATE INDEX "TeamMember_status_idx" ON "TeamMember"("status");

CREATE INDEX "ProductionConversation_projectId_idx" ON "ProductionConversation"("projectId");
CREATE INDEX "ProductionConversation_provider_idx" ON "ProductionConversation"("provider");
CREATE INDEX "ProductionConversation_status_idx" ON "ProductionConversation"("status");

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizerPersonId_fkey" FOREIGN KEY ("organizerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoleOpening" ADD CONSTRAINT "RoleOpening_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_roleOpeningId_fkey" FOREIGN KEY ("roleOpeningId") REFERENCES "RoleOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterestCheck" ADD CONSTRAINT "InterestCheck_creatorPersonId_fkey" FOREIGN KEY ("creatorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterestCheck" ADD CONSTRAINT "InterestCheck_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CandidateRecommendation" ADD CONSTRAINT "CandidateRecommendation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateRecommendation" ADD CONSTRAINT "CandidateRecommendation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipEdge" ADD CONSTRAINT "RelationshipEdge_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipEdge" ADD CONSTRAINT "RelationshipEdge_toPersonId_fkey" FOREIGN KEY ("toPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_roleOpeningId_fkey" FOREIGN KEY ("roleOpeningId") REFERENCES "RoleOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionConversation" ADD CONSTRAINT "ProductionConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
