import assert from "node:assert/strict";
import { GET as healthGet } from "@/app/api/health/route";
import {
  getMessageProcessingMode,
  getMessageProcessingModeHealth,
  hashNormalizedSender,
  processInboundProcessingJob,
  recordInboundProcessingDuplicate,
  upsertInboundProcessingJob,
} from "@/lib/messagingPipeline";

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  run: () => T | Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(updates).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function assertNoSensitiveValues(serialized: string) {
  for (const unsafe of [
    "+15551234567",
    "15551234567",
    "twilio-auth-token-test",
    "openai-key-test",
    "postgresql://user:password@example.test:5432/db",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

async function testProcessingModeDefaultsAndWarnings() {
  await withEnv({ MESSAGE_PROCESSING_MODE: undefined }, () => {
    assert.equal(getMessageProcessingMode(), "sync");
    assert.equal(getMessageProcessingModeHealth().messageProcessingMode, "sync");
  });

  await withEnv({ MESSAGE_PROCESSING_MODE: "async_shadow" }, () => {
    assert.equal(getMessageProcessingMode(), "async_shadow");
    assert.equal(
      getMessageProcessingModeHealth().asyncProcessingAvailable,
      true,
    );
  });

  await withEnv({ MESSAGE_PROCESSING_MODE: "async_active" }, () => {
    const health = getMessageProcessingModeHealth();
    assert.equal(health.messageProcessingMode, "async_active");
    assert.equal(health.asyncActiveEnabled, true);
  });

  await withEnv({ MESSAGE_PROCESSING_MODE: "launch_now" }, () => {
    const health = getMessageProcessingModeHealth();
    assert.equal(health.messageProcessingMode, "sync");
    assert.ok(health.warnings.includes("invalid_message_processing_mode"));
  });
}

function testSenderHashing() {
  const hashed = hashNormalizedSender("+15551234567");
  assert.ok(hashed);
  assert.notEqual(hashed, "+15551234567");
  assert.equal(hashNormalizedSender(null), null);
  assertNoSensitiveValues(JSON.stringify({ hashed }));
}

async function testNoDatabaseSafeFallbacks() {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const upsert = await upsertInboundProcessingJob({
      inboundTwilioMessageSid: "SM_TEST_PIPELINE",
      normalizedSender: "+15551234567",
      status: "PENDING",
    });
    assert.equal(upsert, null);

    const duplicate = await recordInboundProcessingDuplicate({
      inboundTwilioMessageSid: "SM_TEST_PIPELINE",
      normalizedSender: "+15551234567",
    });
    assert.equal(duplicate, null);

    const result = await processInboundProcessingJob("missing-job");
    assert.equal(result.processed, false);
    assert.equal(result.errorCategory, "db_error");
  });
}

async function testHealthOutput() {
  await withEnv(
    {
      DATABASE_URL: undefined,
      MESSAGE_PROCESSING_MODE: "async_shadow",
      MESSAGING_PROVIDER: "TWILIO",
      TWILIO_STAGING_MODE: "true",
      TWILIO_VALIDATE_WEBHOOKS: "true",
      SMS_SENDS_DISABLED: "true",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15551234567",
      TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      TWILIO_AUTH_TOKEN: "twilio-auth-token-test",
      TWILIO_PHONE_NUMBER: "+15550001111",
      OPENAI_API_KEY: "openai-key-test",
      ADMIN_PASSWORD: "admin-password-test",
      APP_BASE_URL: "https://saga.example.test",
      PUBLIC_LAUNCH_ENABLED: "false",
      SMS_COMPLIANCE_APPROVED: "false",
    },
    async () => {
      const response = await healthGet();
      const text = await response.text();
      assertNoSensitiveValues(text);
      const health = JSON.parse(text);
      assert.equal(health.messagingPipeline.messageProcessingMode, "async_shadow");
      assert.equal(health.messagingPipeline.asyncProcessingAvailable, true);
      assert.equal(health.messagingPipeline.queueDepth, null);
      assert.equal(health.app.messageProcessingMode, "async_shadow");
      assert.equal(health.app.asyncProcessingAvailable, true);
    },
  );
}

async function main() {
  await testProcessingModeDefaultsAndWarnings();
  testSenderHashing();
  await testNoDatabaseSafeFallbacks();
  await testHealthOutput();

  console.log("Messaging pipeline reliability checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
