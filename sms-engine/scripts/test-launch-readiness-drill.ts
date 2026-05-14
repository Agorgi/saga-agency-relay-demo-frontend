import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  evaluateLaunchReadinessDrill,
  formatLaunchDrillReport,
  getLaunchDrillHealthSnapshot,
  getLaunchDrillStageDefinitions,
  launchDrillAuditEvents,
  simulateIncidentDrill,
  simulateRollbackDrill,
} from "@/lib/launchDrill/launchReadinessDrill";
import { assertNoRawPiiOrSecrets } from "@/lib/dataOps/dataClassification";

const originalEnv = { ...process.env };
const rawPhone = "+15551234567";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(rawPhone), false, "raw phone leaked");
  assert.equal(serialized.includes("555-123-4567"), false, "formatted phone leaked");
  assert.equal(serialized.includes("sk-test-secret"), false, "OpenAI key leaked");
  assert.equal(serialized.includes("twilio-secret-token"), false, "Twilio token leaked");
  assert.equal(serialized.includes("postgres://secret"), false, "database URL leaked");
  assert.equal(assertNoRawPiiOrSecrets(value), true);
}

async function main() {
  try {
    process.env.DATABASE_URL = "";
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
    process.env.INTERNAL_API_KEY = "internal-secret";
    process.env.ADMIN_PASSWORD = "admin-secret";
    process.env.MESSAGING_PROVIDER = "TWILIO";
    process.env.SMS_SENDS_DISABLED = "true";
    process.env.SMS_REQUIRE_ALLOWLIST = "true";
    process.env.SMS_ALLOWED_NUMBERS = rawPhone;
    process.env.SMS_COMPLIANCE_APPROVED = "false";
    process.env.PUBLIC_LAUNCH_ENABLED = "false";
    process.env.PUBLIC_BETA_ENABLED = "false";
    process.env.PILOT_STAGE = "internal_test";
    process.env.PILOT_REPLY_MODE = "draft_only";
    process.env.MESSAGE_PROCESSING_MODE = "sync";
    process.env.LLM_PROVIDER = "fallback";
    process.env.LLM_MODE = "fallback";
    process.env.TWILIO_STAGING_MODE = "true";
    process.env.TWILIO_VALIDATE_WEBHOOKS = "true";

    const definitions = getLaunchDrillStageDefinitions();
    assert.equal(definitions.length, 10);
    assert.deepEqual(
      definitions.map((stage) => stage.id),
      [
        "PRE_A2P_HOLD",
        "A2P_APPROVED_REVIEW",
        "ONE_NUMBER_SELF_TEST",
        "INTERNAL_TEAM_TEST",
        "DESIGN_PARTNER_10",
        "PRIVATE_BETA_25",
        "PUBLIC_BETA_CANDIDATE",
        "ROLLBACK_DRILL",
        "INCIDENT_DRILL",
        "COMPLETE",
      ],
    );

    const drill = await evaluateLaunchReadinessDrill();
    assert.equal(drill.currentRecommendedStage, "PRE_A2P_HOLD");
    assert.equal(drill.overallReady, false);
    assert.notEqual(drill.launchRiskLevel, "green");
    assert.ok("betaCohortSimulation" in drill.evidenceSummary);

    const selfTest = drill.stages.find((stage) => stage.id === "ONE_NUMBER_SELF_TEST");
    assert.equal(selfTest?.status, "BLOCKED");
    assert.ok(
      selfTest?.blockers.some((blocker) => blocker.includes("SMS_SENDS_DISABLED")),
      "sends disabled should block outbound self-test",
    );
    assert.ok(
      selfTest?.blockers.some((blocker) => blocker.includes("SMS_COMPLIANCE_APPROVED")),
      "compliance should block outbound self-test",
    );

    const publicStage = drill.stages.find(
      (stage) => stage.id === "PUBLIC_BETA_CANDIDATE",
    );
    assert.equal(publicStage?.status, "BLOCKED");
    assert.ok(
      publicStage?.blockers.some((blocker) => blocker.includes("PUBLIC_BETA_ENABLED")),
      "public beta should be blocked unless explicit gates are set",
    );

    const designPartner = drill.stages.find((stage) => stage.id === "DESIGN_PARTNER_10");
    assert.equal(designPartner?.status, "BLOCKED");
    assert.ok(
      designPartner?.blockers.some((blocker) =>
        blocker.includes("Internal team test is not marked passed"),
      ),
      "design partner launch should require internal test pass",
    );

    assert.equal(
      drill.stages.find((stage) => stage.id === "PRE_A2P_HOLD")?.status,
      "PASSED",
    );
    assert.equal(
      drill.stages.find((stage) => stage.id === "A2P_APPROVED_REVIEW")?.status,
      "BLOCKED",
    );

    const rollback = simulateRollbackDrill();
    assert.equal(rollback.noEnvChanged, true);
    assert.equal(rollback.noSmsSent, true);
    assert.equal(
      rollback.actions.some((action) => action.includes("SMS_SENDS_DISABLED=true")),
      true,
    );
    assertSafe(rollback);

    const incident = simulateIncidentDrill();
    assert.equal(incident.noTwilioSendCall, true);
    assert.equal(
      incident.scenarios.some(
        (scenario) => scenario.scenario === "unexpected_outbound_sms",
      ),
      true,
    );
    assertSafe(incident);

    const report = formatLaunchDrillReport(drill);
    assert.match(report, /No SMS was sent/);
    assert.match(report, /PRE_A2P_HOLD/);
    assertSafe(report);
    assertSafe(drill);

    for (const doc of [
      "docs/launch-readiness-drill.md",
      "docs/design-partner-launch-checklist.md",
      "docs/public-beta-launch-checklist.md",
      "docs/beta-cohort-simulation.md",
      "docs/design-partner-simulation-report-template.md",
      "docs/pilot-rollback-runbook.md",
      "docs/incident-response-runbook.md",
      "docs/pilot-data-incident-runbook.md",
    ]) {
      assert.equal(existsSync(doc), true, `${doc} should exist`);
    }

    const health = await getLaunchDrillHealthSnapshot();
    assert.equal(health.launchDrillAvailable, true);
    assert.equal(health.currentRecommendedLaunchStage, "PRE_A2P_HOLD");
    assert.equal(health.designPartnerLaunchReady, false);
    assert.equal(health.publicBetaCandidateReady, false);
    assertSafe(health);

    assert.equal(launchDrillAuditEvents.runStarted, "launch_drill.run_started");
    assert.equal(launchDrillAuditEvents.blockerDetected, "launch_drill.blocker_detected");
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.equal(process.env.MESSAGE_PROCESSING_MODE, "sync");
    assert.equal(process.env.LLM_MODE, "fallback");

    console.log("Launch readiness drill checks passed without SMS, Twilio sends, invites, or production data.");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
