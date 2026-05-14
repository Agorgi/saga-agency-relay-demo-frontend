import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { sanitizeAuditMetadata } from "@/sms-engine/audit";
import {
  buildLlmCallFailedMetadata,
  runStructuredLlmTask,
  type LlmStructuredProvider,
} from "@/sms-engine/llm/llmProvider";
import { categorizeOpenAiProviderError } from "@/sms-engine/llm/openaiProvider";
import { containsForbiddenLlmClaim } from "@/sms-engine/llm/llmTypes";
import { intakeReplySchema } from "@/sms-engine/producerAgent";

const originalEnv = { ...process.env };

const fallbackReply = intakeReplySchema.parse({
  message: "Great. What city should this happen in?",
  confidence: 0.75,
  needsAdmin: false,
});

function resetEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = { ...originalEnv, ...overrides };
  delete process.env.DATABASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODE;
  delete process.env.LLM_LOG_PROMPTS;
  delete process.env.LLM_LOG_OUTPUTS;
  Object.assign(process.env, overrides);
}

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "sk-test-secret",
    "OPENAI_API_KEY",
    "+14155550123",
    "14155550123",
    "organizer raw prompt",
    "raw model output",
    "user@example.com",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

function providerWithData(data: unknown): LlmStructuredProvider {
  return async () => ({
    ok: true,
    data,
    rawText: '{"message":"Shadow reply"}',
    responseId: "resp_test",
  }) as never;
}

function testStructuredOutputSchemaBuilds() {
  const format = zodTextFormat(
    intakeReplySchema,
    "organizer_reply_language",
  );
  assert.equal(format.type, "json_schema");
  assert.equal(format.name, "organizer_reply_language");
  assert.equal(format.strict, true);
}

async function testMockedSuccessValidates() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic organizer text; no phone numbers.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider: providerWithData({
      message: "Great. What city should this happen in?",
      confidence: 0.88,
      needsAdmin: false,
      reason: null,
    }),
  });

  assert.equal(result.source, "openai");
  assert.equal(result.openaiCalled, true);
  assert.equal(result.validationPassed, true);
  assert.equal(result.data.reason, null);
  assertNoSensitiveValues(result);
}

async function testInvalidOutputFallsBack() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic organizer text.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider: providerWithData({
      message: "",
      confidence: 0.88,
      needsAdmin: false,
      reason: null,
    }),
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.openaiCalled, true);
  assert.equal(result.validationPassed, false);
  assert.equal(result.data.message, fallbackReply.message);
  assertNoSensitiveValues(result);
}

async function testProviderSchemaErrorFallsBack() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const provider: LlmStructuredProvider = async () => ({
    ok: false,
    errorCategory: "invalid_schema",
    errorMessage: "Schema rejected by provider.",
    statusCode: 400,
    redactedMessageSnippet: "Schema rejected by provider.",
    rawText: null,
    responseId: null,
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic organizer text.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider,
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.errorCategory, "invalid_schema");
  assert.equal(result.validationPassed, false);
}

function testErrorCategorizationAndAuditMetadata() {
  const providerError = Object.assign(
    new Error(
      "Zod field at properties/reason rejected schema for +14155550123 and user@example.com using sk-test-secret.",
    ),
    { status: 400 },
  );
  const details = categorizeOpenAiProviderError(providerError);
  assert.equal(details.errorCategory, "invalid_schema");
  assert.equal(details.statusCode, 400);

  const metadata = buildLlmCallFailedMetadata({
    schemaName: "organizer_reply_language",
    config: { mode: "shadow" },
    response: {
      errorCategory: details.errorCategory,
      statusCode: details.statusCode,
      redactedMessageSnippet: details.redactedMessageSnippet,
      responseId: null,
    },
    metadata: {
      operation: "organizer_reply_language",
      rawPrompt: "organizer raw prompt",
      rawOutput: "raw model output",
    },
  });
  const safeMetadata = sanitizeAuditMetadata(metadata);

  assert.equal(
    (safeMetadata as Record<string, unknown>).errorCategory,
    "invalid_schema",
  );
  assert.equal((safeMetadata as Record<string, unknown>).requestMode, "shadow");
  assert.equal(
    (safeMetadata as Record<string, unknown>).structuredOutputRequested,
    true,
  );
  assertNoSensitiveValues(safeMetadata);
}

function testFallbackReplySafety() {
  assert.ok(fallbackReply.message.length <= 160);
  assert.equal(containsForbiddenLlmClaim(fallbackReply), false);
}

async function maybeRunLivePreflight() {
  if (
    process.env.RUN_LIVE_LLM_TESTS !== "true" ||
    !process.env.OPENAI_API_KEY
  ) {
    return;
  }

  resetEnv({
    ...process.env,
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language_live_preflight",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt:
      "Synthetic test only. User says: I want to host an anime picnic in LA. Backend question: What city should this happen in?",
    fallback: fallbackReply,
    executionContext: "mock_admin",
  });

  assert.equal(result.openaiCalled, true);
  assert.equal(result.validationPassed, true);
}

async function main() {
  testStructuredOutputSchemaBuilds();
  await testMockedSuccessValidates();
  await testInvalidOutputFallsBack();
  await testProviderSchemaErrorFallsBack();
  testErrorCategorizationAndAuditMetadata();
  testFallbackReplySafety();
  await maybeRunLivePreflight();
  resetEnv();

  console.log(
    "Organizer reply language LLM checks passed without Twilio, SMS, or production data.",
  );
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
