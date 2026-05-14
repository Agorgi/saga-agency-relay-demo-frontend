import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PilotFeedback, PilotParticipant } from "@prisma/client";
import { GET as healthGet } from "@/app/api/health/route";
import {
  getDesignPartnerPilotReadinessSnapshot,
  safePilotParticipantSummary,
  safePilotFeedbackSummary,
} from "@/lib/pilotReadiness";

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

function assertNoRawSensitiveValues(serialized: string) {
  for (const unsafe of [
    "+15551234567",
    "+15557654321",
    "+15550001111",
    "15551234567",
    "15557654321",
    "15550001111",
    "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "twilio-auth-token-test",
    "internal-api-key-test",
    "admin-password-test",
    "postgresql://user:password@example.test:5432/db",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

async function testHealthAndReadinessDoNotExposeAllowedNumbers() {
  await withEnv(
    {
      DATABASE_URL: undefined,
      MESSAGING_PROVIDER: "TWILIO",
      TWILIO_STAGING_MODE: "true",
      TWILIO_VALIDATE_WEBHOOKS: "true",
      SMS_SENDS_DISABLED: "true",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15551234567,+15557654321",
      TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      TWILIO_AUTH_TOKEN: "twilio-auth-token-test",
      TWILIO_PHONE_NUMBER: "+15550001111",
      ADMIN_PASSWORD: "admin-password-test",
      INTERNAL_API_KEY: "internal-api-key-test",
      APP_BASE_URL: "https://saga.example.test",
      PILOT_STAGE: "design_partner",
      PILOT_REPLY_MODE: "draft_only",
      PUBLIC_LAUNCH_ENABLED: "false",
      SMS_COMPLIANCE_APPROVED: "false",
      PILOT_SUPPORT_CONTACT: "support@example.test",
      PILOT_PRIVACY_URL: "https://example.test/privacy",
      PILOT_TERMS_URL: "https://example.test/terms",
    },
    async () => {
      const response = await healthGet();
      const healthText = await response.text();
      assertNoRawSensitiveValues(healthText);
      const health = JSON.parse(healthText);

      assert.equal(health.sms.providerMode, "TWILIO");
      assert.equal(health.sms.sendsDisabled, true);
      assert.equal(health.sms.allowlistRequired, true);
      assert.equal(health.sms.allowedNumbersCount, 2);
      assert.equal("allowedNumbers" in health.sms, false);
      assert.equal(health.pilot.pilotStage, "design_partner");
      assert.equal(health.pilot.pilotReplyMode, "draft_only");
      assert.equal(health.pilot.publicLaunchEnabled, false);
      assert.equal(health.pilot.stageAllowsPublicDistribution, false);
      assert.equal(health.pilot.stageRequiresAllowlist, true);
      assert.equal(health.pilot.stageRequiresComplianceApproval, true);
      assert.equal(health.pilot.autoRepliesEnabled, false);

      const readiness = getDesignPartnerPilotReadinessSnapshot();
      const readinessText = JSON.stringify(readiness);
      assertNoRawSensitiveValues(readinessText);
      assert.equal(readiness.providerMode, "TWILIO");
      assert.equal(readiness.sendsDisabled, true);
      assert.equal(readiness.allowlistRequired, true);
      assert.equal(readiness.allowedNumbersCount, 2);
      assert.equal(readiness.pilotStage, "design_partner");
      assert.equal(readiness.pilotReplyMode, "draft_only");
      assert.equal(readiness.publicLaunchEnabled, false);
      assert.equal(readiness.stageAllowsPublicDistribution, false);
      assert.equal(readiness.autoRepliesEnabled, false);
      assert.equal(
        "allowedNumbers" in (readiness as unknown as Record<string, unknown>),
        false,
      );
      assert.ok(
        readiness.manualGates.some((gate) =>
          gate.label.includes("A2P/compliance"),
        ),
      );
    },
  );
}

function testPublicLiveFailsClosed() {
  return withEnv(
    {
      PILOT_STAGE: "public_live",
      PILOT_REPLY_MODE: "auto_allowlisted",
      PUBLIC_LAUNCH_ENABLED: "false",
      SMS_COMPLIANCE_APPROVED: "false",
      SMS_SENDS_DISABLED: "true",
    },
    () => {
      const readiness = getDesignPartnerPilotReadinessSnapshot();
      assert.equal(readiness.pilotStage, "public_live");
      assert.equal(readiness.publicLaunchEnabled, false);
      assert.equal(readiness.publicLaunchReady, false);
      assert.equal(readiness.stageAllowsPublicDistribution, false);
      assert.equal(readiness.autoRepliesEnabled, false);
      assert.ok(readiness.publicLaunchBlockers.length > 0);
    },
  );
}

function testPilotFeedbackSummaryIsSafe() {
  const now = new Date("2026-05-09T00:00:00.000Z");
  const feedback = {
    id: "feedback_test",
    projectBriefId: "brief_test",
    personId: "person_test",
    pilotParticipantId: "participant_test",
    category: "tone",
    rating: 4,
    notes:
      "Private note with +15551234567, internal-api-key-test, and production details.",
    createdAt: now,
    updatedAt: now,
  } satisfies PilotFeedback;

  const summary = safePilotFeedbackSummary(feedback);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.category, "tone");
  assert.equal(summary.rating, 4);
  assert.equal("notes" in summary, false);
  assertNoRawSensitiveValues(serialized);
  assert.ok(!serialized.includes("Private note"));
  assert.ok(!serialized.includes("production details"));
}

function testPilotParticipantSummaryIsSafe() {
  const now = new Date("2026-05-09T00:00:00.000Z");
  const participant = {
    id: "participant_test",
    personId: "person_test",
    projectBriefId: "brief_test",
    inviteCodeId: null,
    phoneHash: "hashed-private-phone",
    redactedPhone: "+1 555•••4567",
    name: "Pilot Tester",
    email: null,
    role: "ORGANIZER",
    cohort: "design_partner",
    status: "INVITED",
    consentSource: "private invite",
    consentTimestamp: now,
    joinedAt: null,
    lastActiveAt: null,
    notes: "Private note with +15551234567 and internal-api-key-test.",
    createdAt: now,
    updatedAt: now,
  } satisfies PilotParticipant;

  const summary = safePilotParticipantSummary(participant);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.redactedPhone, "+1 555•••4567");
  assert.equal("phoneHash" in summary, false);
  assert.equal("notes" in summary, false);
  assertNoRawSensitiveValues(serialized);
  assert.ok(!serialized.includes("hashed-private-phone"));
  assert.ok(!serialized.includes("Private note"));
}

function testPilotDocsExist() {
  const requiredDocs = [
    "docs/design-partner-pilot-runbook.md",
    "docs/conversation-quality-guide.md",
    "docs/pilot-infrastructure-readiness.md",
    "docs/public-launch-foundations.md",
    "docs/abuse-and-rate-limit-readiness.md",
    "docs/pilot-data-retention.md",
    "docs/pilot-rollback-runbook.md",
    "docs/twilio-staging-pilot.md",
    "docs/twilio-readiness.md",
    "docs/engineering-handoff.md",
  ];

  for (const doc of requiredDocs) {
    assert.ok(existsSync(path.join(process.cwd(), doc)), `${doc} missing`);
  }
}

async function main() {
  await testHealthAndReadinessDoNotExposeAllowedNumbers();
  await testPublicLiveFailsClosed();
  testPilotFeedbackSummaryIsSafe();
  testPilotParticipantSummaryIsSafe();
  testPilotDocsExist();
  console.log("Design partner pilot readiness checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
