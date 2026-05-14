import assert from "node:assert/strict";
import {
  runStructuredLlmTask,
  safeLlmHealth,
  type LlmStructuredProvider,
} from "@/lib/llm/llmProvider";
import {
  organizerReplyLanguageSchema,
  shortlistOutreachDraftLanguageSchema,
} from "@/lib/llm/llmTypes";

const originalEnv = { ...process.env };

const fallbackReply = organizerReplyLanguageSchema.parse({
  replyText: "Great. What city should this happen in?",
  replyType: "ask_next_question",
  stage: "ASK_LOCATION",
  forbiddenClaimsDetected: false,
  shouldEscalate: false,
  confidence: 0.8,
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

function assertNoSecrets(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "sk-test-secret",
    "test-key",
    "OPENAI_API_KEY",
    "DATABASE_URL",
    "+14155550123",
    "14155550123",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

function providerWithData(data: unknown): LlmStructuredProvider {
  return async () => ({ ok: true, data } as never);
}

async function testFallbackWithoutOpenAi() {
  resetEnv();
  const result = await runStructuredLlmTask({
    operation: "test_fallback",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "User: I want to host an anime picnic in LA.",
    fallback: fallbackReply,
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.openaiCalled, false);
  assert.equal(result.data.replyText, fallbackReply.replyText);

  const health = safeLlmHealth();
  assert.equal(health.provider, "fallback");
  assert.equal(health.mode, "fallback");
  assert.equal(health.providerConfigured, "fallback");
  assert.equal(health.providerEffective, "fallback");
  assert.equal(health.modeConfigured, "fallback");
  assert.equal(health.modeEffective, "fallback");
  assert.equal(health.configured, false);
  assert.equal(health.activeLiveAllowed, false);
  assertNoSecrets(health);
}

function testOpenAiShadowResolvesWithKeyPresent() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "shadow",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-5.4-mini",
    LLM_LOG_PROMPTS: "false",
    LLM_LOG_OUTPUTS: "false",
  });

  const health = safeLlmHealth();
  assert.equal(health.configured, true);
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.provider, "openai");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "shadow");
  assert.equal(health.mode, "shadow");
  assert.equal(health.shadowMode, true);
  assert.equal(health.activeLiveAllowed, false);
  assert.equal(health.model, "gpt-5.4-mini");
  assert.deepEqual(health.warnings, []);
  assertNoSecrets(health);
}

function testOpenAiShadowResolvesFromNormalizedEnvKeys() {
  resetEnv({
    " llm_provider ": "openai",
    " llm_mode ": "shadow",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const health = safeLlmHealth();
  assert.equal(health.configured, true);
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "shadow");
  assert.equal(health.shadowMode, true);
  assert.ok(health.warnings.includes("llm_provider_env_key_normalized"));
  assert.ok(health.warnings.includes("llm_mode_env_key_normalized"));
  assertNoSecrets(health);
}

function testFallbackProviderStaysFallbackWithKeyPresent() {
  resetEnv({
    LLM_PROVIDER: "fallback",
    LLM_MODE: "shadow",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const health = safeLlmHealth();
  assert.equal(health.configured, true);
  assert.equal(health.providerConfigured, "fallback");
  assert.equal(health.providerEffective, "fallback");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "fallback");
  assert.ok(health.warnings.includes("llm_mode_inactive_without_openai_provider"));
  assertNoSecrets(health);
}

function testProviderModeNormalization() {
  resetEnv({
    LLM_PROVIDER: " OpenAI ",
    LLM_MODE: '"shadow"',
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: " gpt-5.4-mini ",
  });

  const health = safeLlmHealth();
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "shadow");
  assert.equal(health.model, "gpt-5.4-mini");
  assert.equal(health.shadowMode, true);
  assertNoSecrets(health);
}

function testInvalidProviderFailsClosed() {
  resetEnv({
    LLM_PROVIDER: "anthropic",
    LLM_MODE: "shadow",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const health = safeLlmHealth();
  assert.equal(health.configured, true);
  assert.equal(health.providerConfigured, "fallback");
  assert.equal(health.providerEffective, "fallback");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "fallback");
  assert.ok(health.warnings.includes("invalid_llm_provider"));
  assert.ok(health.warnings.includes("llm_mode_inactive_without_openai_provider"));
  assertNoSecrets(health);
}

async function testShadowNoKeyFallsBack() {
  resetEnv({ LLM_PROVIDER: "openai", LLM_MODE: "shadow" });
  let calls = 0;
  const provider: LlmStructuredProvider = async () => {
    calls += 1;
    return { ok: true, data: fallbackReply } as never;
  };
  const result = await runStructuredLlmTask({
    operation: "test_shadow_no_key",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "No key should skip provider.",
    fallback: fallbackReply,
    provider,
  });

  assert.equal(calls, 0);
  assert.equal(result.source, "fallback");
  assert.equal(result.openaiCalled, false);

  const health = safeLlmHealth();
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.providerEffective, "fallback");
  assert.equal(health.modeEffective, "fallback");
  assert.ok(health.warnings.includes("openai_api_key_missing"));
  assertNoSecrets(health);
}

function testInvalidModeFailsClosed() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "maybe_active",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const health = safeLlmHealth();
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.modeConfigured, "fallback");
  assert.equal(health.modeEffective, "fallback");
  assert.equal(health.shadowMode, false);
  assert.ok(health.warnings.includes("invalid_llm_mode"));
  assertNoSecrets(health);
}

async function testShadowCallsButDoesNotUseOutput() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "shadow",
    OPENAI_API_KEY: "sk-test-secret",
  });
  let calls = 0;
  const provider: LlmStructuredProvider = async () => {
    calls += 1;
    return {
      ok: true,
      data: {
        ...fallbackReply,
        replyText: "Shadow-only model answer.",
      },
      rawText: '{"replyText":"Shadow-only model answer."}',
      responseId: "resp_shadow",
    } as never;
  };
  const result = await runStructuredLlmTask({
    operation: "test_shadow",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Call in shadow but keep fallback.",
    fallback: fallbackReply,
    provider,
  });

  assert.equal(calls, 1);
  assert.equal(result.openaiCalled, true);
  assert.equal(result.source, "fallback");
  assert.equal(result.data.replyText, fallbackReply.replyText);
  assert.equal(result.shadowOutput?.replyText, "Shadow-only model answer.");
  assertNoSecrets(result);
}

async function testInvalidOutputAndTimeoutFallback() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });
  const invalidProvider: LlmStructuredProvider = async () =>
    ({ ok: true, data: { replyText: "" } }) as never;
  const invalid = await runStructuredLlmTask({
    operation: "test_invalid",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Invalid output should fallback.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider: invalidProvider,
  });
  assert.equal(invalid.source, "fallback");
  assert.equal(invalid.validationPassed, false);

  const timeoutProvider: LlmStructuredProvider = async () => ({
    ok: false,
    errorCategory: "TimeoutError",
    errorMessage: "Timed out.",
    rawText: null,
    responseId: null,
  });
  const timeout = await runStructuredLlmTask({
    operation: "test_timeout",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Timeout should fallback.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider: timeoutProvider,
  });
  assert.equal(timeout.source, "fallback");
  assert.equal(timeout.errorCategory, "TimeoutError");
}

async function testForbiddenClaimsFallback() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });
  const provider = providerWithData({
    ...fallbackReply,
    replyText: "You are guaranteed a paid booking and confirmed team spot.",
  });
  const result = await runStructuredLlmTask({
    operation: "test_forbidden",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Forbidden claim should fallback.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider,
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.errorCategory, "ForbiddenClaimsDetected");
}

async function testActiveMockAndActiveLive() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });
  let calls = 0;
  const provider: LlmStructuredProvider = async () => {
    calls += 1;
    return {
      ok: true,
      data: {
        ...fallbackReply,
        replyText: "Mock admin model answer.",
      },
    } as never;
  };

  const runtime = await runStructuredLlmTask({
    operation: "test_active_mock_runtime",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Runtime should not use active mock.",
    fallback: fallbackReply,
    provider,
  });
  assert.equal(runtime.openaiCalled, false);
  assert.equal(runtime.source, "fallback");

  const mockAdmin = await runStructuredLlmTask({
    operation: "test_active_mock_admin",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Mock admin can use active mock.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider,
  });
  assert.equal(calls, 1);
  assert.equal(mockAdmin.source, "openai");
  assert.equal(mockAdmin.data.replyText, "Mock admin model answer.");

  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_live",
    OPENAI_API_KEY: "sk-test-secret",
  });
  const activeLive = await runStructuredLlmTask({
    operation: "test_active_live",
    schema: organizerReplyLanguageSchema,
    schemaName: "organizer_reply_language",
    prompt: "Active live is future only.",
    fallback: fallbackReply,
    executionContext: "live",
    provider,
  });
  assert.equal(activeLive.activeLiveAllowed, false);
  assert.equal(activeLive.openaiCalled, false);
  assert.equal(activeLive.source, "fallback");

  const health = safeLlmHealth();
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.modeConfigured, "active_live");
  assert.equal(health.modeEffective, "fallback");
  assert.equal(health.activeLiveAllowed, false);
  assert.ok(health.warnings.includes("active_live_disabled"));
  assertNoSecrets(health);
}

function testStructuredSchemaValidation() {
  const parsed = shortlistOutreachDraftLanguageSchema.parse({
    body: "Here is a draft for admin review only.",
    forbiddenClaimsDetected: false,
    privateInfoDetected: false,
    adminReviewRequired: true,
    confidence: 0.8,
  });
  assert.equal(parsed.adminReviewRequired, true);
}

async function main() {
  await testFallbackWithoutOpenAi();
  testOpenAiShadowResolvesWithKeyPresent();
  testOpenAiShadowResolvesFromNormalizedEnvKeys();
  testFallbackProviderStaysFallbackWithKeyPresent();
  testProviderModeNormalization();
  testInvalidProviderFailsClosed();
  await testShadowNoKeyFallsBack();
  testInvalidModeFailsClosed();
  await testShadowCallsButDoesNotUseOutput();
  await testInvalidOutputAndTimeoutFallback();
  await testForbiddenClaimsFallback();
  await testActiveMockAndActiveLive();
  testStructuredSchemaValidation();
  resetEnv();

  console.log(
    "LLM provider checks passed without OpenAI, Twilio, SMS, or production data.",
  );
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
