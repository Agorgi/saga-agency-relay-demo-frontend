import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GET as healthGet } from "@/app/api/health/route";
import { getDesignPartnerPilotReadinessSnapshot } from "@/sms-engine/pilotReadiness";
import { redactForLog } from "@/sms-engine/safeLogging";

type HealthShape = {
  sms?: {
    providerMode?: string;
    twilioStagingMode?: boolean;
    sendsDisabled?: boolean;
    allowlistRequired?: boolean;
    allowedNumbersCount?: number;
  };
  pilot?: {
    pilotStage?: string;
    pilotReplyMode?: string;
    publicLaunchEnabled?: boolean;
    stageAllowsPublicDistribution?: boolean;
    autoRepliesEnabled?: boolean;
  };
  app?: {
    appBaseUrlConfigured?: boolean;
  };
};

function rawSensitiveValues() {
  return [
    process.env.TWILIO_AUTH_TOKEN,
    process.env.TWILIO_ACCOUNT_SID,
    process.env.INTERNAL_API_KEY,
    process.env.ADMIN_PASSWORD,
    process.env.OPENAI_API_KEY,
    process.env.DATABASE_URL,
    process.env.TWILIO_PHONE_NUMBER,
    ...(process.env.SMS_ALLOWED_NUMBERS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter((value): value is string => Boolean(value && value.length >= 4));
}

function assertNoSensitiveValues(text: string) {
  for (const value of rawSensitiveValues()) {
    if (text.includes(value)) {
      throw new Error("Preflight output exposed a raw secret or phone number.");
    }
  }
}

async function readLocalHealth() {
  const response = await healthGet();
  const text = await response.text();
  assertNoSensitiveValues(text);
  return JSON.parse(text) as HealthShape;
}

async function readRemoteHealth() {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!appBaseUrl) return null;
  if (!process.env.PILOT_PREFLIGHT_REMOTE_HEALTH) return null;

  const response = await fetch(`${appBaseUrl}/api/health`, {
    headers: { "cache-control": "no-cache" },
  });
  const text = await response.text();
  assertNoSensitiveValues(text);
  if (!response.ok) {
    throw new Error(`Remote /api/health returned ${response.status}.`);
  }

  return JSON.parse(text) as HealthShape;
}

function assertSafePilotState(health: HealthShape, label: string) {
  assert.equal(
    health.pilot?.publicLaunchEnabled,
    false,
    `${label} public launch must be disabled.`,
  );
  assert.equal(
    health.pilot?.stageAllowsPublicDistribution,
    false,
    `${label} public distribution must be disabled.`,
  );
  assert.equal(
    health.pilot?.autoRepliesEnabled,
    false,
    `${label} auto replies must be disabled.`,
  );
  assert.ok(
    [
      "internal_test",
      "design_partner",
      "private_beta",
      "public_candidate",
      "capped_public_beta",
    ].includes(health.pilot?.pilotStage || ""),
    `${label} pilot stage must not be public_live for readiness preflight.`,
  );
  assert.ok(
    ["draft_only", "manual_approval", "auto_allowlisted"].includes(
      health.pilot?.pilotReplyMode || "",
    ),
    `${label} pilot reply mode missing.`,
  );
  assert.equal(
    typeof health.sms?.allowedNumbersCount,
    "number",
    `${label} health must report allowedNumbersCount.`,
  );
  assert.equal(
    "allowedNumbers" in ((health.sms || {}) as Record<string, unknown>),
    false,
    `${label} health must not expose allowedNumbers.`,
  );
}

function assertTwilioStageIfConfigured(health: HealthShape, label: string) {
  if (health.sms?.providerMode !== "TWILIO") return;

  assert.equal(health.sms?.sendsDisabled, true, `${label} sends must be disabled.`);
  assert.equal(
    health.sms?.allowlistRequired,
    true,
    `${label} allowlist must be required.`,
  );
  assert.equal(
    health.sms?.twilioStagingMode,
    true,
    `${label} Twilio staging mode must be true.`,
  );
}

function assertDocsExistAndBoundaries() {
  const docs = [
    "docs/design-partner-pilot-runbook.md",
    "docs/conversation-quality-guide.md",
    "docs/pilot-infrastructure-readiness.md",
    "docs/public-launch-foundations.md",
    "docs/abuse-and-rate-limit-readiness.md",
    "docs/pilot-data-retention.md",
    "docs/pilot-rollback-runbook.md",
  ];

  for (const doc of docs) {
    const absolutePath = path.join(process.cwd(), doc);
    assert.ok(existsSync(absolutePath), `${doc} missing`);
    const body = readFileSync(absolutePath, "utf8");
    assert.ok(
      /not active|disabled|not approval|future|do not/i.test(body),
      `${doc} must clearly say the pilot/public launch is not active.`,
    );
  }

  const combined = docs
    .map((doc) => readFileSync(path.join(process.cwd(), doc), "utf8"))
    .join("\n");

  for (const boundary of [
    "no production Saga app integration",
    "no ticketing",
    "no RSVP",
    "no QR",
    "no payments",
    "no event publishing",
  ]) {
    assert.ok(
      combined.toLowerCase().includes(boundary.toLowerCase()),
      `Docs missing boundary: ${boundary}`,
    );
  }
}

async function main() {
  const localHealth = await readLocalHealth();
  assertSafePilotState(localHealth, "local");
  assertTwilioStageIfConfigured(localHealth, "local");

  const readiness = getDesignPartnerPilotReadinessSnapshot();
  assertNoSensitiveValues(JSON.stringify(readiness));
  assert.equal(readiness.publicLaunchEnabled, false);
  assert.equal(readiness.stageAllowsPublicDistribution, false);
  assert.equal(readiness.autoRepliesEnabled, false);

  const remoteHealth = await readRemoteHealth();
  if (remoteHealth) {
    assertSafePilotState(remoteHealth, "remote");
    assertTwilioStageIfConfigured(remoteHealth, "remote");
  }

  assertDocsExistAndBoundaries();

  console.log(
    `Design partner pilot preflight passed. Remote health ${
      remoteHealth ? "checked" : "skipped"
    }.`,
  );
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
