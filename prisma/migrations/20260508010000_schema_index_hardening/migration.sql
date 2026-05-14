-- Additive schema/index hardening for staging and engineering review.
-- No columns, constraints, or relation delete behaviors are changed here.

CREATE INDEX "ProjectBrief_updatedAt_idx" ON "ProjectBrief"("updatedAt");

CREATE INDEX "Contact_city_name_idx" ON "Contact"("city", "name");

CREATE INDEX "Outreach_updatedAt_idx" ON "Outreach"("updatedAt");

CREATE INDEX "GroupChat_updatedAt_idx" ON "GroupChat"("updatedAt");

CREATE INDEX "Task_status_dueDate_updatedAt_idx" ON "Task"("status", "dueDate", "updatedAt");

CREATE INDEX "Person_updatedAt_idx" ON "Person"("updatedAt");

CREATE INDEX "CreatorProfile_updatedAt_idx" ON "CreatorProfile"("updatedAt");

CREATE INDEX "Project_existingSagaCommunityId_idx" ON "Project"("existingSagaCommunityId");
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

CREATE INDEX "RoleOpening_updatedAt_idx" ON "RoleOpening"("updatedAt");

CREATE INDEX "Opportunity_updatedAt_idx" ON "Opportunity"("updatedAt");

CREATE INDEX "InterestCheck_updatedAt_idx" ON "InterestCheck"("updatedAt");

CREATE INDEX "CandidateRecommendation_opportunityId_score_updatedAt_idx" ON "CandidateRecommendation"("opportunityId", "score", "updatedAt");
CREATE INDEX "CandidateRecommendation_personId_status_updatedAt_idx" ON "CandidateRecommendation"("personId", "status", "updatedAt");

CREATE INDEX "RelationshipEdge_fromPersonId_relationshipType_idx" ON "RelationshipEdge"("fromPersonId", "relationshipType");
CREATE INDEX "RelationshipEdge_toPersonId_relationshipType_idx" ON "RelationshipEdge"("toPersonId", "relationshipType");

CREATE INDEX "TeamMember_roleOpeningId_idx" ON "TeamMember"("roleOpeningId");

CREATE INDEX "ProductionConversation_provider_externalConversationId_idx" ON "ProductionConversation"("provider", "externalConversationId");
CREATE INDEX "ProductionConversation_updatedAt_idx" ON "ProductionConversation"("updatedAt");
