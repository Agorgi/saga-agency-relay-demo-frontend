ALTER TYPE "PublicWebResearchRunMode" ADD VALUE IF NOT EXISTS 'LIVE_DRY_RUN';

ALTER TABLE "PublicWebResearchRun"
  ADD COLUMN "sourceTag" TEXT;

CREATE INDEX "PublicWebResearchRun_sourceTag_idx"
  ON "PublicWebResearchRun"("sourceTag");
