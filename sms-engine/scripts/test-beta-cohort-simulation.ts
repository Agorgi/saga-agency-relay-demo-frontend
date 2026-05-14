import assert from "node:assert/strict";
import { getCommandCenterSummary } from "@/sms-engine/commandCenter/commandCenterSummary";
import {
  formatBetaCohortSimulationReport,
  getBetaCohortSimulationHealthSnapshot,
  runAllBetaCohortSimulations,
  runBetaCohortSimulation,
} from "@/sms-engine/cohortSimulation/runCohortSimulation";
import { evaluateLaunchReadinessDrill } from "@/sms-engine/launchDrill/launchReadinessDrill";

const previousEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...previousEnv };
}

function setSafeSimulationEnv() {
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.SMS_COMPLIANCE_APPROVED = "false";
  process.env.PUBLIC_BETA_ENABLED = "false";
  process.env.PUBLIC_LAUNCH_ENABLED = "false";
  process.env.LLM_MODE = "fallback";
  process.env.LLM_PROVIDER = "fallback";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  delete process.env.OPENAI_API_KEY;
  delete process.env.TWILIO_AUTH_TOKEN;
}

function assertNoUnsafeSerializedOutput(value: unknown) {
  const serialized = JSON.stringify(value);
  assert(!/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(serialized), "raw phone leaked");
  assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), "raw email leaked");
  assert(!serialized.includes("OPENAI_API_KEY"), "OpenAI key name leaked");
  assert(!serialized.includes("TWILIO_AUTH_TOKEN"), "Twilio auth token name leaked");
  assert(!serialized.includes("DATABASE_URL"), "database URL key leaked");
  assert(!serialized.includes("production_saga"), "production Saga app marker leaked");
}

async function main() {
  setSafeSimulationEnv();

  const design = await runBetaCohortSimulation("DESIGN_PARTNER_10");
  assert.equal(design.simulatedUserCount, 10);
  assert.equal(design.status, "PASSED");
  assert(design.allowedCount >= 8);
  assert(design.escalatedCount >= 1);
  assert(design.transcriptPassRate >= 0.8);
  assert.equal(design.forbiddenClaimsCount, 0);
  assert.equal(design.noSmsSent, true);
  assert.equal(design.noTwilioCalls, true);
  assert.equal(design.noProductionData, true);

  const privateBeta = await runBetaCohortSimulation("PRIVATE_BETA_25");
  assert.equal(privateBeta.simulatedUserCount, 25);
  assert(privateBeta.duplicateCount >= 1, "private beta duplicate should be detected");
  assert(privateBeta.optedOutCount >= 1, "private beta opted-out user should block");
  assert(privateBeta.escalatedCount >= 3, "private beta safety cases should escalate");

  const capped = await runBetaCohortSimulation("CAPPED_PUBLIC_BETA_100");
  assert.equal(capped.simulatedUserCount, 100);
  assert.equal(capped.launchBlockedByCurrentGates, true);
  assert(capped.duplicateCount >= 1, "capped beta duplicate should be detected");
  assert(capped.optedOutCount >= 1, "capped beta opt-out should block");
  assert(capped.memberResults.some((member) => member.conversationStatus === "CONTROL_KEYWORD_HANDLED"));
  assert.equal(capped.publicBetaReady, false);
  assert(capped.launchGateBlockers.some((blocker) => blocker.includes("SMS_COMPLIANCE_APPROVED")));
  assert(capped.launchGateBlockers.some((blocker) => blocker.includes("SMS_SENDS_DISABLED")));

  const overCapacity = await runBetaCohortSimulation("OVER_CAPACITY");
  assert.equal(overCapacity.simulatedUserCount, 16);
  assert(overCapacity.waitlistedCount >= 1, "over-capacity should waitlist/block users");
  assert(
    overCapacity.memberResults.some(
      (member) =>
        member.accessStatus === "BLOCKED_CAP_REACHED" ||
        member.accessStatus === "DAILY_CAP_REACHED" ||
        member.conversationStatus === "WAITLISTED",
    ),
    "cap behavior should be visible",
  );

  const all = await runAllBetaCohortSimulations();
  assert.equal(all.length, 4);
  const report = formatBetaCohortSimulationReport(all);
  assert(report.includes("Beta Cohort Simulation Report"));
  assert(/no SMS/i.test(report));

  const snapshot = await getBetaCohortSimulationHealthSnapshot();
  assert.equal(snapshot.betaCohortSimulationAvailable, true);
  assert.equal(snapshot.lastDesignPartnerSimulationResult?.simulatedUserCount, 10);
  assert.equal(snapshot.lastPrivateBetaSimulationResult?.simulatedUserCount, 25);
  assert.equal(snapshot.lastCappedPublicBetaSimulationResult?.simulatedUserCount, 100);

  const commandCenter = await getCommandCenterSummary();
  assert.equal(commandCenter.betaCohortSimulation.betaCohortSimulationAvailable, true);
  assert.equal(commandCenter.noSmsSent, true);

  const launchDrill = await evaluateLaunchReadinessDrill();
  assert("betaCohortSimulation" in launchDrill.evidenceSummary);
  const designStage = launchDrill.stages.find((stage) => stage.id === "DESIGN_PARTNER_10");
  assert(designStage?.blockers.some((blocker) => blocker.includes("Internal team test")));
  const publicStage = launchDrill.stages.find((stage) => stage.id === "PUBLIC_BETA_CANDIDATE");
  assert(publicStage?.blockers.some((blocker) => blocker.includes("PUBLIC_BETA_ENABLED")));

  assertNoUnsafeSerializedOutput({ design, privateBeta, capped, overCapacity, snapshot, commandCenter, launchDrill, report });

  console.log("Beta cohort simulation checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restoreEnv);
