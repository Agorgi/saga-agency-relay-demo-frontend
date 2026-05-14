import assert from "node:assert/strict";
import {
  evaluateObservabilityRisk,
  serializedObservabilityContainsSensitiveValue,
  type ObservabilityRiskInput,
} from "@/sms-engine/observability/observabilityInvariants";
import {
  formatObservabilityDailyReport,
  getObservabilitySummary,
  safeObservabilitySummaryForAdmin,
} from "@/sms-engine/observability/observabilitySummary";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

function baseRiskInput(): ObservabilityRiskInput {
  return {
    database: "connected",
    serializedOutput: "{}",
    sms: {
      providerMode: "MOCK",
      sendsDisabled: true,
      smsComplianceApproved: true,
      publicLaunchEnabled: false,
      recentOutboundCount: 0,
      webhookValidationEnabled: true,
    },
    llm: {
      activeLiveAllowed: false,
      recentCallCount: 0,
      recentFailureCount: 0,
      recentFallbackCount: 0,
      fallbackRate: 0,
    },
    pipeline: {
      failedJobs: 0,
    },
    pilot: {
      pilotStage: "internal_test",
      activeParticipants: 0,
    },
  };
}

function assertNoSecretsOrPhones(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(
    serialized.includes("sk-test-secret"),
    false,
    "serialized output must not include OpenAI key",
  );
  assert.equal(
    serialized.includes("twilio-secret-token"),
    false,
    "serialized output must not include Twilio auth token",
  );
  assert.equal(
    serialized.includes("internal-secret-key"),
    false,
    "serialized output must not include internal API key",
  );
  assert.equal(
    /\+15551234567|555[-.\s]?123[-.\s]?4567/.test(serialized),
    false,
    "serialized output must not include raw phone numbers",
  );
}

async function main() {
  try {
    process.env.DATABASE_URL = "";
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
    process.env.INTERNAL_API_KEY = "internal-secret-key";
    process.env.ADMIN_PASSWORD = "admin-password";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.MESSAGING_PROVIDER = "MOCK";
    process.env.SMS_SENDS_DISABLED = "true";
    process.env.SMS_REQUIRE_ALLOWLIST = "true";
    process.env.SMS_ALLOWED_NUMBERS = "+15551234567";
    process.env.SMS_COMPLIANCE_APPROVED = "false";
    process.env.PUBLIC_LAUNCH_ENABLED = "false";
    process.env.PILOT_STAGE = "internal_test";
    process.env.PILOT_REPLY_MODE = "draft_only";
    process.env.LLM_PROVIDER = "fallback";
    process.env.LLM_MODE = "fallback";

    const summary = await getObservabilitySummary();
    assertNoSecretsOrPhones(summary);
    assert.equal(summary.sms.allowedNumbersCount, 1);
    assert.equal(summary.publicBeta.publicBetaReadiness, false);
    assert.equal(summary.publicBeta.publicBetaPublicNumberVisible, false);
    assert.equal(summary.publicBeta.publicBetaCapUsage.max, 100);
    assert.equal(summary.betaCohortSimulation.betaCohortSimulationAvailable, true);
    assert.equal(typeof summary.betaCohortSimulation.simulationRiskLevel, "string");
    assert.equal(summary.talentDiscovery.talentDiscoveryAvailable, true);
    assert.equal(summary.talentDiscovery.publicWebResearchEnabled, false);
    assert.equal(summary.talentDiscovery.publicWebResearchMode, "disabled");
    assert.equal(summary.talentResearchQuality.talentResearchQualityAvailable, true);
    assert.equal(summary.talentResearchQuality.pendingTalentQualityReviewCount, null);
    assert.equal(summary.talentResearchQuality.talentQualityRiskLevel, "green");

    const serializedUnsafe = JSON.stringify({
      recipient: "+15551234567",
      token: "sk-test-secret",
    });
    assert.equal(
      serializedObservabilityContainsSensitiveValue(serializedUnsafe),
      true,
      "sensitive output detector should catch phones and known secrets",
    );

    const redacted = safeObservabilitySummaryForAdmin({
      phone: "+15551234567",
      nested: { note: "call me at 555-123-4567" },
      token: "sk-test-secret",
    });
    assertNoSecretsOrPhones(redacted);

    const green = evaluateObservabilityRisk(baseRiskInput());
    assert.equal(
      green.level,
      "green",
      "sends-disabled true with no outbound activity should be green for SMS safety",
    );

    const outboundWhileDisabled = evaluateObservabilityRisk({
      ...baseRiskInput(),
      sms: {
        ...baseRiskInput().sms,
        sendsDisabled: true,
        recentOutboundCount: 1,
      },
    });
    assert.equal(outboundWhileDisabled.level, "red");
    assert.ok(
      outboundWhileDisabled.blockers.includes(
        "outbound_activity_detected_while_sends_disabled",
      ),
    );

    const sendsWithoutCompliance = evaluateObservabilityRisk({
      ...baseRiskInput(),
      sms: {
        ...baseRiskInput().sms,
        sendsDisabled: false,
        smsComplianceApproved: false,
      },
    });
    assert.equal(sendsWithoutCompliance.level, "red");
    assert.ok(
      sendsWithoutCompliance.blockers.includes(
        "sends_enabled_without_sms_compliance",
      ),
    );

    const webhookDisabled = evaluateObservabilityRisk({
      ...baseRiskInput(),
      sms: {
        ...baseRiskInput().sms,
        providerMode: "TWILIO",
        webhookValidationEnabled: false,
      },
    });
    assert.equal(webhookDisabled.level, "red");
    assert.ok(webhookDisabled.blockers.includes("twilio_webhook_validation_disabled"));

    const llmFailureRate = evaluateObservabilityRisk({
      ...baseRiskInput(),
      llm: {
        activeLiveAllowed: false,
        recentCallCount: 10,
        recentFailureCount: 6,
        recentFallbackCount: 1,
      },
    });
    assert.equal(llmFailureRate.level, "red");
    assert.ok(llmFailureRate.blockers.includes("llm_failure_rate_high"));

    const pipelineWarning = evaluateObservabilityRisk({
      ...baseRiskInput(),
      pipeline: { failedJobs: 1 },
    });
    assert.equal(pipelineWarning.level, "yellow");
    assert.ok(pipelineWarning.warnings.includes("pipeline_failed_jobs_present"));

    const publicLaunchMismatch = evaluateObservabilityRisk({
      ...baseRiskInput(),
      sms: {
        ...baseRiskInput().sms,
        publicLaunchEnabled: true,
      },
      pilot: {
        pilotStage: "design_partner",
        activeParticipants: 0,
      },
    });
    assert.equal(publicLaunchMismatch.level, "red");
    assert.ok(
      publicLaunchMismatch.blockers.includes(
        "public_launch_enabled_outside_public_live_stage",
      ),
    );

    const report = formatObservabilityDailyReport(summary);
    assertNoSecretsOrPhones(report);
    assert.match(report, /Risk level:/);
    assert.match(report, /SMS Safety/);
    assert.match(report, /Public Beta/);
    assert.match(report, /Talent Discovery/);
    assert.match(report, /Quality review available/);

    assert.equal(summary.llm.activeLiveAllowed, false);
    assert.equal(summary.sms.sendsDisabled, true);
    assert.equal(summary.sms.providerMode, "MOCK");

    console.log("Production observability tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
