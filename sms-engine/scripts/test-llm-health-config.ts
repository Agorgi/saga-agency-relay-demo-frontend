import assert from "node:assert/strict";
import { safeLlmHealth } from "@/lib/llm/llmProvider";

const originalEnv = { ...process.env };

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
  for (const unsafe of ["test-key", "OPENAI_API_KEY", "+14155550123"]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

function testOpenAiShadowHealth() {
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
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.modeEffective, "shadow");
  assert.equal(health.provider, "openai");
  assert.equal(health.mode, "shadow");
  assert.equal(health.shadowMode, true);
  assert.equal(health.activeLiveAllowed, false);
  assert.equal(health.model, "gpt-5.4-mini");
  assert.deepEqual(health.warnings, []);
  assertNoSecrets(health);
}

function testMissingKeyFallsBackWithWarning() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "shadow",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const health = safeLlmHealth();
  assert.equal(health.providerConfigured, "openai");
  assert.equal(health.modeConfigured, "shadow");
  assert.equal(health.providerEffective, "fallback");
  assert.equal(health.modeEffective, "fallback");
  assert.ok(health.warnings.includes("openai_api_key_missing"));
}

function testActiveLiveDisabled() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_live",
    OPENAI_API_KEY: "test-key",
  });

  const health = safeLlmHealth();
  assert.equal(health.providerEffective, "openai");
  assert.equal(health.modeConfigured, "active_live");
  assert.equal(health.modeEffective, "fallback");
  assert.equal(health.activeLiveAllowed, false);
  assert.ok(health.warnings.includes("active_live_disabled"));
  assertNoSecrets(health);
}

function main() {
  testOpenAiShadowHealth();
  testMissingKeyFallsBackWithWarning();
  testActiveLiveDisabled();
  resetEnv();
  console.log("LLM health config checks passed.");
}

try {
  main();
} catch (error) {
  resetEnv();
  console.error(error);
  process.exit(1);
}
