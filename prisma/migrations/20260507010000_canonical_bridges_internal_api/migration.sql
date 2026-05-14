-- Canonical production-network bridge fields.
-- These keep the SMS-specific MVP tables intact while allowing canonical
-- Project/Person/Opportunity/ProductionConversation records to become the
-- integration surface for the Saga app.

ALTER TABLE "ProjectBrief" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "personId" TEXT;
ALTER TABLE "Outreach" ADD COLUMN "opportunityId" TEXT;
ALTER TABLE "Outreach" ADD COLUMN "candidateRecommendationId" TEXT;
ALTER TABLE "GroupChat" ADD COLUMN "productionConversationId" TEXT;
ALTER TABLE "CandidateRecommendation" ADD COLUMN "scoreBreakdown" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Task" DROP CONSTRAINT "Task_projectBriefId_fkey";
ALTER TABLE "Task" ALTER COLUMN "projectBriefId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Task" ADD COLUMN "productionConversationId" TEXT;

CREATE UNIQUE INDEX "ProjectBrief_projectId_key" ON "ProjectBrief"("projectId");
CREATE UNIQUE INDEX "Contact_personId_key" ON "Contact"("personId");
CREATE UNIQUE INDEX "GroupChat_productionConversationId_key" ON "GroupChat"("productionConversationId");
CREATE UNIQUE INDEX "Person_sagaUserId_key" ON "Person"("sagaUserId");
CREATE UNIQUE INDEX "Project_existingSagaEventId_key" ON "Project"("existingSagaEventId");

CREATE INDEX "Outreach_opportunityId_idx" ON "Outreach"("opportunityId");
CREATE INDEX "Outreach_candidateRecommendationId_idx" ON "Outreach"("candidateRecommendationId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_productionConversationId_idx" ON "Task"("productionConversationId");

ALTER TABLE "ProjectBrief" ADD CONSTRAINT "ProjectBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_candidateRecommendationId_fkey" FOREIGN KEY ("candidateRecommendationId") REFERENCES "CandidateRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_productionConversationId_fkey" FOREIGN KEY ("productionConversationId") REFERENCES "ProductionConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectBriefId_fkey" FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_productionConversationId_fkey" FOREIGN KEY ("productionConversationId") REFERENCES "ProductionConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
