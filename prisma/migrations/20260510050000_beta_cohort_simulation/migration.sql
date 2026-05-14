-- Beta Cohort Simulation v0.1.
-- Additive only: stores synthetic simulation run summaries and member results.

CREATE TYPE "BetaCohortSimulationType" AS ENUM (
  'DESIGN_PARTNER_10',
  'PRIVATE_BETA_25',
  'CAPPED_PUBLIC_BETA_100',
  'OVER_CAPACITY',
  'ROLLBACK_SIMULATION',
  'INCIDENT_SIMULATION'
);

CREATE TYPE "BetaCohortSimulationStatus" AS ENUM (
  'PASSED',
  'FAILED',
  'BLOCKED',
  'COMPLETED'
);

CREATE TYPE "BetaCohortSimulationPersonaType" AS ENUM (
  'ORGANIZER',
  'CREATOR',
  'INTEREST_CHECK',
  'CONTACT_REPLY',
  'EDGE_SAFETY',
  'SPAMMY_UNKNOWN',
  'OPTED_OUT',
  'DUPLICATE',
  'NON_ALLOWLISTED',
  'WAITLIST_USER',
  'SUPPORT_CONFUSION'
);

CREATE TABLE "BetaCohortSimulationRun" (
  "id" TEXT NOT NULL,
  "cohortType" "BetaCohortSimulationType" NOT NULL,
  "status" "BetaCohortSimulationStatus" NOT NULL,
  "simulatedUserCount" INTEGER NOT NULL,
  "allowedCount" INTEGER NOT NULL DEFAULT 0,
  "waitlistedCount" INTEGER NOT NULL DEFAULT 0,
  "blockedCount" INTEGER NOT NULL DEFAULT 0,
  "escalatedCount" INTEGER NOT NULL DEFAULT 0,
  "transcriptPassRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskLevel" TEXT NOT NULL,
  "blockers" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "resultSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BetaCohortSimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BetaCohortSimulationMemberResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "personaType" "BetaCohortSimulationPersonaType" NOT NULL,
  "expectedFlow" TEXT NOT NULL,
  "actualFlow" TEXT NOT NULL,
  "accessStatus" TEXT NOT NULL,
  "conversationStatus" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskLevel" TEXT NOT NULL,
  "blockers" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BetaCohortSimulationMemberResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BetaCohortSimulationRun_cohortType_idx" ON "BetaCohortSimulationRun"("cohortType");
CREATE INDEX "BetaCohortSimulationRun_status_idx" ON "BetaCohortSimulationRun"("status");
CREATE INDEX "BetaCohortSimulationRun_riskLevel_idx" ON "BetaCohortSimulationRun"("riskLevel");
CREATE INDEX "BetaCohortSimulationRun_createdAt_idx" ON "BetaCohortSimulationRun"("createdAt");

CREATE INDEX "BetaCohortSimulationMemberResult_runId_idx" ON "BetaCohortSimulationMemberResult"("runId");
CREATE INDEX "BetaCohortSimulationMemberResult_personaType_idx" ON "BetaCohortSimulationMemberResult"("personaType");
CREATE INDEX "BetaCohortSimulationMemberResult_accessStatus_idx" ON "BetaCohortSimulationMemberResult"("accessStatus");
CREATE INDEX "BetaCohortSimulationMemberResult_riskLevel_idx" ON "BetaCohortSimulationMemberResult"("riskLevel");
CREATE INDEX "BetaCohortSimulationMemberResult_createdAt_idx" ON "BetaCohortSimulationMemberResult"("createdAt");

ALTER TABLE "BetaCohortSimulationMemberResult"
  ADD CONSTRAINT "BetaCohortSimulationMemberResult_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "BetaCohortSimulationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
