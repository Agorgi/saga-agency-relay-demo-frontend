import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  getCommandCenterSummary,
  safeCommandCenterSummary,
} from "@/sms-engine/commandCenter/commandCenterSummary";
import { assertNoRawPiiOrSecrets } from "@/sms-engine/dataOps/dataClassification";
import {
  evaluateLaunchReadinessDrill,
  getLaunchDrillDocumentStatus,
} from "@/sms-engine/launchDrill/launchReadinessDrill";
import {
  evaluatePostA2POneNumberSelfTestReadiness,
  type OutboundSelfTestConfigInput,
} from "@/sms-engine/producer/outboundSelfTestReadiness";

const originalEnv = { ...process.env };
const docs = [
  "docs/post-a2p-one-number-self-test-v0.9.md",
  "docs/post-a2p-self-test-checklist.md",
] as const;

const readyConfig: OutboundSelfTestConfigInput = {
  providerMode: "TWILIO",
  sendsDisabled: false,
  allowlistRequired: true,
  allowedNumbersCount: 1,
  twilioStagingMode: true,
  webhookValidationEnabled: true,
  twilioConfigured: true,
  smsComplianceApproved: true,
  pilotStage: "internal_test",
  pilotReplyMode: "manual_approval",
  publicLaunchEnabled: false,
  publicBetaEnabled: false,
  activeDesignPartnerCount: 0,
  rollbackRunbookExists: true,
  auditLoggingAvailable: true,
  approvedDraftExists: true,
  approvedDraftReadinessStatus: "READY_IN_DRY_RUN",
  approvedDraftRecipientAllowlisted: true,
  approvedDraftRecipientOptedOut: false,
};

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafeCurrentEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
  process.env.ADMIN_PASSWORD = "admin-secret";
  process.env.MESSAGING_PROVIDER = "TWILIO";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.SMS_ALLOWED_NUMBERS = "+15551234567";
  process.env.SMS_COMPLIANCE_APPROVED = "false";
  process.env.PUBLIC_BETA_ENABLED = "false";
  process.env.PUBLIC_LAUNCH_ENABLED = "false";
  process.env.PILOT_STAGE = "internal_test";
  process.env.PILOT_REPLY_MODE = "draft_only";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.LLM_PROVIDER = "fallback";
  process.env.LLM_MODE = "fallback";
  process.env.TWILIO_STAGING_MODE = "true";
  process.env.TWILIO_VALIDATE_WEBHOOKS = "true";
}

function evaluate(config: Partial<OutboundSelfTestConfigInput> = {}) {
  return evaluatePostA2POneNumberSelfTestReadiness({
    config: { ...readyConfig, ...config },
  });
}

function assertSafe(label: string, value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "15551234567",
    "555-123-4567",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "admin-secret",
    "postgres://secret",
    "TWILIO_AUTH_TOKEN=",
    "OPENAI_API_KEY=",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `${label} leaked ${unsafe}`);
  }
  assert.equal(assertNoRawPiiOrSecrets(value), true, `${label} should be redacted`);
}

async function main() {
  try {
    setSafeCurrentEnv();

    for (const doc of docs) {
      assert.equal(existsSync(doc), true, `${doc} should exist`);
      assertSafe(doc, readFileSync(doc, "utf8"));
    }

    const playbook = readFileSync(docs[0], "utf8");
    const checklist = readFileSync(docs[1], "utf8");
    assert.match(playbook, /validate one controlled outbound SMS/i);
    assert.match(playbook, /restore `SMS_SENDS_DISABLED=true`/i);
    assert.match(checklist, /duplicate/i);
    assert.match(checklist, /Twilio outbound log/i);
    assert.match(checklist, /Rollback/i);

    const complianceBlocked = evaluate({ smsComplianceApproved: false });
    assert.equal(complianceBlocked.ready, false);
    assert.ok(
      complianceBlocked.blockers.some((blocker) =>
        blocker.includes("SMS_COMPLIANCE_APPROVED"),
      ),
    );

    const sendsDisabledBlocked = evaluate({ sendsDisabled: true });
    assert.equal(sendsDisabledBlocked.ready, false);
    assert.ok(
      sendsDisabledBlocked.blockers.some((blocker) =>
        blocker.includes("SMS_SENDS_DISABLED"),
      ),
    );

    assert.equal(evaluate({ allowlistRequired: false }).ready, false);
    assert.ok(
      evaluate({ allowedNumbersCount: 0 }).blockers.some((blocker) =>
        blocker.includes("exactly one allowlisted number"),
      ),
    );
    assert.ok(
      evaluate({ allowedNumbersCount: 2 }).blockers.some((blocker) =>
        blocker.includes("exactly one allowlisted number"),
      ),
    );
    assert.equal(evaluate({ publicLaunchEnabled: true }).ready, false);
    assert.ok(
      evaluate({ publicBetaEnabled: true }).blockers.some((blocker) =>
        blocker.includes("PUBLIC_BETA_ENABLED"),
      ),
    );
    assert.ok(
      evaluate({ activeDesignPartnerCount: 1 }).blockers.some((blocker) =>
        blocker.includes("Design partner participants"),
      ),
    );
    assert.equal(evaluate().ready, true);
    assert.equal(evaluate().oneNumberSelfTestReady, true);
    assert.equal(evaluate().postA2PSelfTestPlanAvailable, true);
    assert.equal(evaluate().postA2PSelfTestChecklistAvailable, true);
    assertSafe("readiness", evaluate());

    const documentStatus = getLaunchDrillDocumentStatus();
    assert.equal(documentStatus.postA2POneNumberSelfTestPlanExists, true);
    assert.equal(documentStatus.postA2PSelfTestChecklistExists, true);

    const drill = await evaluateLaunchReadinessDrill();
    const a2pStage = drill.stages.find((stage) => stage.id === "A2P_APPROVED_REVIEW");
    const selfTestStage = drill.stages.find((stage) => stage.id === "ONE_NUMBER_SELF_TEST");
    assert.ok(
      a2pStage?.relatedDocs.includes("docs/post-a2p-one-number-self-test-v0.9.md"),
    );
    assert.ok(
      selfTestStage?.relatedDocs.includes("docs/post-a2p-self-test-checklist.md"),
    );
    assert.equal(selfTestStage?.status, "BLOCKED");
    assertSafe("launch drill", drill);

    const summary = await getCommandCenterSummary();
    assert.equal(summary.postA2PSelfTest.postA2PSelfTestPlanAvailable, true);
    assert.equal(summary.postA2PSelfTest.postA2PSelfTestChecklistAvailable, true);
    assert.equal(summary.postA2PSelfTest.oneNumberSelfTestReady, false);
    assert.ok(summary.postA2PSelfTest.oneNumberSelfTestBlockers.length > 0);
    assert.equal(summary.noSmsSent, true);
    assert.equal(summary.noTwilioSendCall, true);
    assert.equal(summary.noProductionSagaAppData, true);
    assertSafe("command center", summary);

    const redacted = safeCommandCenterSummary({
      phone: "+15551234567",
      token: "sk-test-secret",
      notes: "Private note with 555-123-4567",
    });
    assertSafe("redacted summary", redacted);

    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log(
      "Post-A2P one-number self-test plan checks passed without SMS, Twilio calls, or production data.",
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
