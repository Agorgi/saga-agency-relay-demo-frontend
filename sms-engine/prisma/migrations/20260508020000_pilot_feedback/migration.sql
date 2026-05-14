-- Add admin-only pilot feedback capture for staging/design-partner rehearsals.
CREATE TABLE "PilotFeedback" (
    "id" TEXT NOT NULL,
    "projectBriefId" TEXT,
    "personId" TEXT,
    "category" TEXT NOT NULL,
    "rating" INTEGER,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotFeedback_projectBriefId_idx" ON "PilotFeedback"("projectBriefId");
CREATE INDEX "PilotFeedback_personId_idx" ON "PilotFeedback"("personId");
CREATE INDEX "PilotFeedback_category_idx" ON "PilotFeedback"("category");
CREATE INDEX "PilotFeedback_createdAt_idx" ON "PilotFeedback"("createdAt");

ALTER TABLE "PilotFeedback"
ADD CONSTRAINT "PilotFeedback_projectBriefId_fkey"
FOREIGN KEY ("projectBriefId") REFERENCES "ProjectBrief"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
ADD CONSTRAINT "PilotFeedback_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
