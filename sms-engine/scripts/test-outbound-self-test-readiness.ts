import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { GET as healthGet } from "@/app/api/health/route";
import {
  evaluateOutboundSelfTestReadiness,
  outboundSelfTestReadinessAuditEvent,
  safeOutboundSelfTestHealthSummary,
} from "@/sms-engine/producer/outboundSelfTestReadiness";

const validConfig = {
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
  activeDesignPartnerCount: 0,
  rollbackRunbookExists: true,
  auditLoggingAvailable: true,
  approvedDraftExists: true,
  approvedDraftReadinessStatus: "READY_IN_DRY_RUN",
  approvedDraftRecipientAllowlisted: true,
  approvedDraftRecipientOptedOut: false,
};

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  run: () => T | Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(updates).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function evaluate(config: Partial<typeof validConfig> = {}) {
  return evaluateOutboundSelfTestReadiness({
    config: { ...validConfig, ...config },
  });
}

function assertNoRawSensitiveValues(serialized: string) {
  for (const unsafe of [
    "+15551234567",
    "15551234567",
    "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "twilio-auth-token-test",
    "internal-api-key-test",
    "admin-password-test",
    "postgresql://user:password@example.test:5432/db",
    "SMS_ALLOWED_NUMBERS",
    "TWILIO_AUTH_TOKEN",
    "DATABASE_URL",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

function testSafeDefaultBlockedBySendsDisabled() {
  const result = evaluate({
    sendsDisabled: true,
    smsComplianceApproved: false,
  });
  assert.equal(result.ready, false);
  assert.equal(result.readinessStatus, "BLOCKED_BY_SENDS_DISABLED");
  assert.equal(result.dryRunOnly, true);
}

function testComplianceGate() {
  const result = evaluate({ smsComplianceApproved: false });
  assert.equal(result.readinessStatus, "BLOCKED_BY_COMPLIANCE");
  assert.ok(result.blockers.join(" ").includes("SMS_COMPLIANCE_APPROVED"));
}

function testAllowlistAndRecipientCountGates() {
  assert.equal(
    evaluate({ allowedNumbersCount: 0 }).readinessStatus,
    "BLOCKED_BY_RECIPIENT_COUNT",
  );
  assert.equal(
    evaluate({ allowedNumbersCount: 2 }).readinessStatus,
    "BLOCKED_BY_RECIPIENT_COUNT",
  );
  assert.equal(
    evaluate({ allowlistRequired: false }).readinessStatus,
    "BLOCKED_BY_ALLOWLIST",
  );
}

function testPilotStageAndReplyModeGates() {
  assert.equal(
    evaluate({ pilotStage: "design_partner" }).readinessStatus,
    "BLOCKED_BY_PILOT_STAGE",
  );
  assert.equal(
    evaluate({ pilotReplyMode: "draft_only" }).readinessStatus,
    "BLOCKED_BY_REPLY_MODE",
  );
  assert.equal(
    evaluate({ publicLaunchEnabled: true }).readinessStatus,
    "BLOCKED_BY_PILOT_STAGE",
  );
}

function testTwilioConfigGates() {
  assert.equal(
    evaluate({ twilioConfigured: false }).readinessStatus,
    "BLOCKED_BY_TWILIO_CONFIG",
  );
  assert.equal(
    evaluate({ webhookValidationEnabled: false }).readinessStatus,
    "BLOCKED_BY_WEBHOOK_VALIDATION",
  );
  assert.equal(
    evaluate({ providerMode: "MOCK" }).readinessStatus,
    "BLOCKED_BY_TWILIO_CONFIG",
  );
}

function testDraftAndRecipientGates() {
  assert.equal(
    evaluate({ approvedDraftExists: false }).readinessStatus,
    "BLOCKED_BY_MISSING_APPROVED_DRAFT",
  );
  assert.equal(
    evaluate({
      approvedDraftReadinessStatus: "BLOCKED_BY_FORBIDDEN_CLAIMS",
    }).readinessStatus,
    "BLOCKED_BY_MISSING_APPROVED_DRAFT",
  );
  assert.equal(
    evaluate({
      approvedDraftRecipientAllowlisted: false,
    }).readinessStatus,
    "BLOCKED_BY_ALLOWLIST",
  );

  const optedOut = evaluate({ approvedDraftRecipientOptedOut: true });
  assert.equal(optedOut.ready, false);
  assert.ok(optedOut.blockers.join(" ").includes("opted out"));
}

function testOperationalReadinessGates() {
  assert.equal(
    evaluate({ activeDesignPartnerCount: 1 }).readinessStatus,
    "BLOCKED_BY_PILOT_STAGE",
  );
  assert.equal(
    evaluate({ rollbackRunbookExists: false }).readinessStatus,
    "BLOCKED_BY_UNKNOWN",
  );
  assert.equal(
    evaluate({ auditLoggingAvailable: false }).readinessStatus,
    "BLOCKED_BY_UNKNOWN",
  );
}

function testReadyInDryRun() {
  const result = evaluate();
  assert.equal(result.ready, true);
  assert.equal(result.readinessStatus, "READY_FOR_ONE_NUMBER_SELF_TEST");
  assert.equal(result.dryRunOnly, true);
  assert.equal(result.safetySnapshot.allowedNumbersCount, 1);
  assert.ok(result.recommendedNextStep.includes("operator approval"));
}

function testNoSideEffectShape() {
  const result = evaluate();
  const serialized = JSON.stringify(result);
  assertNoRawSensitiveValues(serialized);
  assert.ok(!serialized.toLowerCase().includes("sms sent"));
  assert.ok(!serialized.toLowerCase().includes("twilio api call"));
  assert.ok(!serialized.toLowerCase().includes("outreach sent"));
  assert.ok(!serialized.toLowerCase().includes("group chat created"));
}

function testHealthSummaryIsSafe() {
  const result = evaluate({
    sendsDisabled: true,
    smsComplianceApproved: false,
  });
  const health = safeOutboundSelfTestHealthSummary(result);
  const serialized = JSON.stringify(health);
  assertNoRawSensitiveValues(serialized);
  assert.equal(health.outboundSelfTestReadinessAvailable, true);
  assert.equal(health.outboundSelfTestReady, false);
  assert.equal(health.outboundSelfTestMode, "dry_run_only");
  assert.equal("allowedNumbers" in health, false);
}

async function testHealthEndpointDoesNotExposeAllowedNumbers() {
  await withEnv(
    {
      DATABASE_URL: undefined,
      MESSAGING_PROVIDER: "TWILIO",
      TWILIO_STAGING_MODE: "true",
      TWILIO_VALIDATE_WEBHOOKS: "true",
      SMS_SENDS_DISABLED: "true",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15551234567",
      TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      TWILIO_AUTH_TOKEN: "twilio-auth-token-test",
      TWILIO_PHONE_NUMBER: "+15550001111",
      ADMIN_PASSWORD: "admin-password-test",
      INTERNAL_API_KEY: "internal-api-key-test",
      APP_BASE_URL: "https://saga.example.test",
      SMS_COMPLIANCE_APPROVED: "false",
      PILOT_STAGE: "internal_test",
      PILOT_REPLY_MODE: "draft_only",
      PUBLIC_LAUNCH_ENABLED: "false",
    },
    async () => {
      const response = await healthGet();
      const text = await response.text();
      assertNoRawSensitiveValues(text);
      const health = JSON.parse(text);
      assert.equal(health.sms.outboundSelfTestReadinessAvailable, true);
      assert.equal(health.sms.outboundSelfTestReady, false);
      assert.equal(health.sms.outboundSelfTestMode, "dry_run_only");
      assert.equal(health.outboundSelfTest.outboundSelfTestReady, false);
      assert.equal("allowedNumbers" in health.sms, false);
    },
  );
}

function testDocsExist() {
  for (const doc of [
    "docs/outbound-sms-self-test-runbook.md",
    "docs/outbound-self-test-checklist.md",
    "docs/pilot-rollback-runbook.md",
  ]) {
    assert.ok(existsSync(path.join(process.cwd(), doc)), `${doc} missing`);
  }
}

function testAuditEventName() {
  assert.equal(
    outboundSelfTestReadinessAuditEvent,
    "pilot.outbound_self_test_readiness_evaluated",
  );
}

async function main() {
  testSafeDefaultBlockedBySendsDisabled();
  testComplianceGate();
  testAllowlistAndRecipientCountGates();
  testPilotStageAndReplyModeGates();
  testTwilioConfigGates();
  testDraftAndRecipientGates();
  testOperationalReadinessGates();
  testReadyInDryRun();
  testNoSideEffectShape();
  testHealthSummaryIsSafe();
  await testHealthEndpointDoesNotExposeAllowedNumbers();
  testDocsExist();
  testAuditEventName();

  console.log(
    "Outbound self-test readiness checks passed without SMS, Twilio calls, outreach sends, group chat creation, or production data.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
