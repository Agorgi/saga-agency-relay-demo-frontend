import assert from "node:assert/strict";
import {
  commandCenterAuditEvents,
  formatCommandCenterReport,
  getCommandCenterHealthSnapshot,
  getCommandCenterSummary,
  safeCommandCenterSummary,
} from "@/lib/commandCenter/commandCenterSummary";
import { assertNoRawPiiOrSecrets } from "@/lib/dataOps/dataClassification";

const originalEnv = { ...process.env };
const rawPhone = "+15551234567";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafePreA2pEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
  process.env.ADMIN_PASSWORD = "admin-secret";
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.MESSAGING_PROVIDER = "TWILIO";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.SMS_ALLOWED_NUMBERS = rawPhone;
  process.env.SMS_COMPLIANCE_APPROVED = "false";
  process.env.PUBLIC_BETA_ENABLED = "false";
  process.env.PUBLIC_LAUNCH_ENABLED = "false";
  process.env.PILOT_STAGE = "internal_test";
  process.env.PILOT_REPLY_MODE = "draft_only";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.LLM_PROVIDER = "fallback";
  process.env.LLM_MODE = "fallback";
  process.env.OPENAI_MODEL = "gpt-5.4-mini";
  process.env.TWILIO_STAGING_MODE = "true";
  process.env.TWILIO_VALIDATE_WEBHOOKS = "true";
  process.env.PILOT_SUPPORT_CONTACT = "support@example.com";
  process.env.PILOT_PRIVACY_URL = "https://example.com/privacy";
  process.env.PILOT_TERMS_URL = "https://example.com/terms";
  Object.assign(process.env, overrides);
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    rawPhone,
    "555-123-4567",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "admin-secret",
    "postgres://secret",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Leaked value: ${unsafe}`);
  }
  assert.equal(assertNoRawPiiOrSecrets(value), true);
}

async function main() {
  try {
    setSafePreA2pEnv();
    const summary = await getCommandCenterSummary();
    assert.equal(summary.currentStage, "PRE_A2P_HOLD");
    assert.equal(summary.configuredPilotStage, "internal_test");
    assert.equal(summary.sms.sendsDisabled, true);
    assert.equal(summary.sms.smsComplianceApproved, false);
    assert.equal(summary.llm.activeLiveAllowed, false);
    assert.equal(summary.pipeline.messageProcessingMode, "sync");
    assert.equal(summary.publicBeta.publicLaunchReady, false);
    assert.equal(summary.publicBeta.publicBetaReady, false);
    assert.equal(summary.publicBeta.publicBetaLandingEnabled, false);
    assert.equal(summary.publicBeta.publicBetaWaitlistEnabled, false);
    assert.equal(summary.publicBeta.publicBetaPublicNumberVisible, false);
    assert.ok(summary.publicBeta.publicBetaBlockerCount > 0);
    assert.equal(summary.betaCohortSimulation.betaCohortSimulationAvailable, true);
    assert.equal(summary.releaseCandidate.releaseCandidateVersion, "release-candidate-v0.1");
    assert.equal(summary.releaseCandidate.releaseCandidateStatus, "READY_FOR_A2P_HOLD");
    assert.equal(summary.releaseCandidate.releaseCandidateBlockerCount, 0);
    assert.equal(
      summary.betaCohortSimulation.lastDesignPartnerSimulationResult?.simulatedUserCount,
      10,
    );
    assert.equal(
      summary.betaCohortSimulation.lastPrivateBetaSimulationResult?.simulatedUserCount,
      25,
    );
    assert.equal(
      summary.betaCohortSimulation.lastCappedPublicBetaSimulationResult?.simulatedUserCount,
      100,
    );
    assert.equal(summary.talentDiscovery.talentDiscoveryAvailable, true);
    assert.equal(summary.talentDiscovery.publicWebResearchEnabled, false);
    assert.equal(summary.talentDiscovery.publicWebResearchMode, "disabled");
    assert.equal(summary.talentResearchQuality.talentResearchQualityAvailable, true);
    assert.equal(summary.talentResearchQuality.pendingTalentQualityReviewCount, null);
    assert.equal(summary.talentResearchQuality.talentQualityRiskLevel, "green");
    assert.equal(typeof summary.betaCohortSimulation.publicBetaSimulationReady, "boolean");
    assert.equal(summary.noSmsSent, true);
    assert.equal(summary.noTwilioSendCall, true);
    assert.equal(summary.noProductionSagaAppData, true);

    const oneNumber = summary.goNoGo.find(
      (item) => item.id === "one_number_self_test",
    );
    assert.equal(oneNumber?.status, "BLOCKED");
    assert.ok(
      oneNumber?.blockers.some((blocker) => blocker.includes("SMS_SENDS_DISABLED")),
      "one-number self-test should be blocked by sends-disabled",
    );

    const designPartner = summary.goNoGo.find(
      (item) => item.id === "design_partner_10",
    );
    assert.equal(designPartner?.status, "BLOCKED");
    assert.ok(
      designPartner?.blockers.some((blocker) =>
        blocker.includes("Internal team test"),
      ),
      "design partner launch should require internal team test evidence",
    );

    const publicBeta = summary.goNoGo.find(
      (item) => item.id === "capped_public_beta",
    );
    assert.equal(publicBeta?.status, "BLOCKED");
    assert.ok(
      publicBeta?.blockers.some((blocker) => blocker.includes("PUBLIC_BETA_ENABLED")),
      "public beta should be blocked while PUBLIC_BETA_ENABLED=false",
    );
    assert.ok(
      publicBeta?.blockers.some((blocker) => blocker.includes("SMS_SENDS_DISABLED")),
      "public beta should include sends-disabled readiness blocker",
    );

    const publicLaunch = summary.goNoGo.find((item) => item.id === "public_launch");
    assert.equal(publicLaunch?.status, "BLOCKED");
    assert.ok(
      publicLaunch?.blockers.some((blocker) => blocker.includes("PUBLIC_LAUNCH_ENABLED")),
      "public launch should be blocked while PUBLIC_LAUNCH_ENABLED=false",
    );

    const sendsSwitch = summary.killSwitches.find(
      (item) => item.key === "SMS_SENDS_DISABLED",
    );
    const publicLaunchSwitch = summary.killSwitches.find(
      (item) => item.key === "PUBLIC_LAUNCH_ENABLED",
    );
    const llmSwitch = summary.killSwitches.find((item) => item.key === "LLM_MODE");
    assert.equal(sendsSwitch?.safe, true);
    assert.equal(publicLaunchSwitch?.safe, true);
    assert.equal(llmSwitch?.safe, true);

    const report = formatCommandCenterReport(summary);
    assert.match(report, /Go \/ No-Go/);
    assert.match(report, /Beta Cohort Simulation/);
    assert.match(report, /Release Candidate/);
    assert.match(report, /Talent Discovery/);
    assert.match(report, /Quality review available/);
    assert.match(report, /Blockers/);
    assert.match(report, /No SMS was sent/);
    assertSafe(summary);
    assertSafe(report);

    const redacted = safeCommandCenterSummary({
      participant: {
        phone: rawPhone,
        email: "person@example.com",
        notes: "Call me at 555-123-4567",
      },
      token: "sk-test-secret",
    });
    assertSafe(redacted);

    const health = await getCommandCenterHealthSnapshot();
    assert.equal(health.commandCenterAvailable, true);
    assert.equal(health.currentRecommendedLaunchStage, "PRE_A2P_HOLD");
    assertSafe(health);

    setSafePreA2pEnv({ SMS_SENDS_DISABLED: "false" });
    const unsafe = await getCommandCenterSummary();
    assert.equal(unsafe.overallStatus, "red");
    assert.ok(
      unsafe.blockers.some((blocker) =>
        blocker.includes("sends_enabled_without_sms_compliance"),
      ),
      "sends enabled without compliance should produce a red blocker",
    );
    assert.equal(
      unsafe.killSwitches.find((item) => item.key === "SMS_SENDS_DISABLED")
        ?.safe,
      false,
    );
    assertSafe(unsafe);

    assert.equal(commandCenterAuditEvents.viewed, "command_center.viewed");
    assert.equal(
      commandCenterAuditEvents.readinessEvaluated,
      "command_center.readiness_evaluated",
    );
    assert.equal(process.env.LLM_MODE, "fallback");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log(
      "Operator command center checks passed without Twilio, SMS, invites, or production data.",
    );
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
