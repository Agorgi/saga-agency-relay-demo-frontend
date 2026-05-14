import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assertNoRawPiiOrSecrets } from "@/lib/dataOps/dataClassification";
import {
  formatReleaseCandidateReport,
  getReleaseCandidateSummary,
  releaseCandidateTag,
  releaseCandidateTagMessage,
  releaseCandidateVersion,
} from "@/lib/releaseCandidate/releaseCandidate";

const originalEnv = { ...process.env };
const rawPhone = "+15551234567";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafeRcEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
  process.env.ADMIN_PASSWORD = "admin-secret";
  process.env.MESSAGING_PROVIDER = "TWILIO";
  process.env.TWILIO_STAGING_MODE = "true";
  process.env.TWILIO_VALIDATE_WEBHOOKS = "true";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.SMS_ALLOWED_NUMBERS = rawPhone;
  process.env.SMS_COMPLIANCE_APPROVED = "false";
  process.env.PUBLIC_BETA_ENABLED = "false";
  process.env.PUBLIC_BETA_LANDING_ENABLED = "false";
  process.env.PUBLIC_BETA_WAITLIST_ENABLED = "false";
  process.env.PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE = "false";
  process.env.PUBLIC_LAUNCH_ENABLED = "false";
  process.env.LLM_PROVIDER = "openai";
  process.env.LLM_MODE = "shadow";
  process.env.OPENAI_MODEL = "gpt-5.4-mini";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.PILOT_STAGE = "internal_test";
  process.env.PILOT_REPLY_MODE = "draft_only";
  process.env.PILOT_SUPPORT_CONTACT = "support@example.com";
  process.env.PILOT_PRIVACY_URL = "https://example.com/privacy";
  process.env.PILOT_TERMS_URL = "https://example.com/terms";
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

function readPackageJson() {
  return JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
}

async function main() {
  try {
    setSafeRcEnv();

    const requiredDocs = [
      "docs/release-candidate-v0.1.md",
      "docs/rc-readiness-matrix.md",
      "docs/post-a2p-execution-playbook.md",
      "docs/known-open-items.md",
    ];
    for (const doc of requiredDocs) {
      assert.equal(existsSync(join(process.cwd(), doc)), true, `${doc} missing`);
    }

    const packageJson = readPackageJson();
    assert.ok(packageJson.scripts?.["test:release-candidate"]);
    assert.ok(packageJson.scripts?.["test:release-candidate-package"]);
    assert.ok(packageJson.scripts?.["release:rc-report"]);
    assert.match(
      packageJson.scripts["test:release-candidate"],
      /test:beta-cohort-simulation/,
    );
    assert.match(
      packageJson.scripts["test:release-candidate"],
      /test:security-hardening/,
    );

    const summary = await getReleaseCandidateSummary();
    assert.equal(summary.releaseCandidateVersion, releaseCandidateVersion);
    assert.equal(summary.releaseCandidateTag, releaseCandidateTag);
    assert.equal(summary.releaseCandidateTagMessage, releaseCandidateTagMessage);
    assert.equal(summary.releaseCandidateStatus, "READY_FOR_A2P_HOLD");
    assert.equal(summary.sms.sendsDisabled, true);
    assert.equal(summary.sms.allowlistRequired, true);
    assert.equal(summary.sms.smsComplianceApproved, false);
    assert.equal(summary.publicBeta.publicBetaEnabled, false);
    assert.equal(summary.publicBeta.publicBetaPublicNumberVisible, false);
    assert.equal(summary.llm.activeLiveAllowed, false);
    assert.equal(summary.pipeline.messageProcessingMode, "sync");
    assert.equal(summary.pipeline.asyncActiveEnabled, false);
    assert.equal(summary.noSmsSent, true);
    assert.equal(summary.noTwilioSendCall, true);
    assert.equal(summary.noProductionSagaAppData, true);
    assert.ok(
      summary.currentExpectedBlockers.some((blocker) =>
        blocker.includes("A2P"),
      ),
    );
    assert.ok(
      summary.currentExpectedBlockers.some((blocker) =>
        blocker.includes("SMS_SENDS_DISABLED"),
      ),
    );
    assert.ok(summary.explicitlyDisabled.includes("live outbound SMS"));
    assert.ok(summary.outOfScope.includes("production Saga database"));
    assertSafe(summary);

    const report = formatReleaseCandidateReport({
      summary,
      git: {
        commit: "test-commit",
        branch: "main",
        tag: releaseCandidateTag,
      },
    });
    assert.match(report, /Release Candidate v0\.1/);
    assert.match(report, /No SMS was sent/);
    assert.match(report, /A2P/);
    assertSafe(report);

    process.env.SMS_SENDS_DISABLED = "false";
    const unsafe = await getReleaseCandidateSummary();
    assert.equal(unsafe.releaseCandidateStatus, "BLOCKED_UNSAFE_CONFIG");
    assert.ok(
      unsafe.blockers.some((blocker) =>
        blocker.includes("SMS sends are enabled before compliance approval"),
      ),
    );
    assertSafe(unsafe);

    console.log(
      "Release candidate package checks passed without SMS, Twilio sends, public launch, or production data.",
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
