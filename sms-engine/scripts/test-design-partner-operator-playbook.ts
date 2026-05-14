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

const originalEnv = { ...process.env };
const docs = {
  script: "docs/design-partner-pilot-script-v0.8.md",
  feedback: "docs/design-partner-feedback-questions.md",
  checklist: "docs/design-partner-operator-checklist.md",
} as const;

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafePreA2pEnv() {
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
  process.env.PILOT_SUPPORT_CONTACT = "support@example.test";
  process.env.PILOT_PRIVACY_URL = "https://example.test/privacy";
  process.env.PILOT_TERMS_URL = "https://example.test/terms";
}

function readDoc(path: string) {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, "utf8");
}

function assertNoUnsafeDocValues(label: string, text: string) {
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "postgres://secret",
    "TWILIO_AUTH_TOKEN=",
    "OPENAI_API_KEY=",
  ]) {
    assert.equal(text.includes(unsafe), false, `${label} leaked ${unsafe}`);
  }
}

function assertNoUnsafePromises(text: string) {
  const unsafePromisePatterns = [
    /\bwe (?:will|can) guarantee (?:bookings|paid work|a confirmed team|event execution|ticket sales|venue access|revenue)\b/i,
    /\b(?:bookings|paid work|confirmed team|event execution|ticket sales|venue access|revenue) (?:are|is) guaranteed\b/i,
    /\byou will (?:get booked|get paid|have a confirmed team|sell tickets|get venue access|make revenue)\b/i,
    /\bSaga will (?:make the event happen|confirm the team|book the venue|sell tickets)\b/i,
  ];

  for (const pattern of unsafePromisePatterns) {
    assert.doesNotMatch(text, pattern, `unsafe promise pattern matched ${pattern}`);
  }
}

function assertSafeSerialized(label: string, value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "admin-secret",
    "postgres://secret",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `${label} leaked ${unsafe}`);
  }
  assert.equal(assertNoRawPiiOrSecrets(value), true, `${label} should be redacted`);
}

async function main() {
  try {
    setSafePreA2pEnv();

    const script = readDoc(docs.script);
    const feedback = readDoc(docs.feedback);
    const checklist = readDoc(docs.checklist);
    const allDocs = [script, feedback, checklist].join("\n\n");

    assert.match(script, /Reply STOP to opt out/i);
    assert.match(script, /HELP/i);
    assert.match(script, /Saga SMS is in a private pilot/i);
    assert.match(script, /does not guarantee bookings/i);
    assert.match(script, /team formation/i);
    assert.match(script, /logistics/i);
    assert.match(script, /unexpected outbound SMS/i);
    assert.match(script, /STOP is not respected/i);
    assert.match(script, /SMS_SENDS_DISABLED=true/i);
    assert.match(feedback, /Did Saga overpromise anything/i);
    assert.match(checklist, /Post-A2P, Pre-Self-Test/i);
    assert.match(checklist, /Design Partner Launch/i);

    assertNoUnsafePromises(script);
    assertNoUnsafePromises(allDocs);
    assertNoUnsafeDocValues("pilot script", script);
    assertNoUnsafeDocValues("feedback questions", feedback);
    assertNoUnsafeDocValues("operator checklist", checklist);

    const documentStatus = getLaunchDrillDocumentStatus();
    assert.equal(documentStatus.designPartnerPilotScriptExists, true);
    assert.equal(documentStatus.designPartnerFeedbackQuestionsExists, true);
    assert.equal(documentStatus.designPartnerOperatorChecklistExists, true);

    const drill = await evaluateLaunchReadinessDrill();
    const designPartnerStage = drill.stages.find(
      (stage) => stage.id === "DESIGN_PARTNER_10",
    );
    assert.equal(designPartnerStage?.status, "BLOCKED");
    assert.ok(
      designPartnerStage?.blockers.some((blocker) =>
        blocker.includes("One-number self-test is not marked passed"),
      ),
      "design partner stage should require one-number self-test",
    );
    assert.ok(
      designPartnerStage?.blockers.some((blocker) =>
        blocker.includes("Internal team test is not marked passed"),
      ),
      "design partner stage should require internal team test",
    );
    assertSafeSerialized("launch drill", drill);

    const summary = await getCommandCenterSummary();
    assert.equal(
      summary.designPartnerPilot.designPartnerPilotScriptAvailable,
      true,
    );
    assert.equal(
      summary.designPartnerPilot.designPartnerFeedbackQuestionsAvailable,
      true,
    );
    assert.equal(
      summary.designPartnerPilot.designPartnerOperatorChecklistAvailable,
      true,
    );
    assert.equal(summary.designPartnerPilot.designPartnerPilotReady, false);
    assert.ok(summary.designPartnerPilot.designPartnerPilotBlockers.length > 0);
    assert.match(
      summary.designPartnerPilot.nextOperatorAction,
      /Keep the design-partner pilot blocked until A2P/i,
    );
    assert.equal(summary.noSmsSent, true);
    assert.equal(summary.noTwilioSendCall, true);
    assert.equal(summary.noProductionSagaAppData, true);
    assertSafeSerialized("command center", summary);

    const redacted = safeCommandCenterSummary({
      candidate: {
        phone: "+15551234567",
        email: "person@example.test",
        notes: "Private note with 555-123-4567",
      },
      token: "sk-test-secret",
    });
    assertSafeSerialized("redacted command center", redacted);

    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log(
      "Design partner operator playbook checks passed without SMS, Twilio, invites, or production data.",
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
