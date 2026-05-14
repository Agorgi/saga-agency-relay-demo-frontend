import assert from "node:assert/strict";
import {
  adminDevDeterministicLlmUnavailableMetadata,
  generateAdminDevOrganizerReplyWithLlm,
  resolveAdminDevLlmExecution,
} from "@/sms-engine/conversation/adminDevLlmReplies";
import { generateContactReplyFromPlan } from "@/sms-engine/conversation/contactReplyGenerator";
import type {
  ConversationContext,
  ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";
import {
  resolveLlmExecutionContext,
  runStructuredLlmTask,
  type LlmStructuredProvider,
} from "@/sms-engine/llm/llmProvider";
import { intakeReplySchema } from "@/sms-engine/producerAgent";

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

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "sk-test-secret",
    "OPENAI_API_KEY",
    "+14155550123",
    "14155550123",
    "raw prompt",
    "raw output",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

function providerWithData(data: unknown): LlmStructuredProvider {
  return async () => ({
    ok: true,
    data,
    rawText: '{"message":"Mock admin LLM reply"}',
    responseId: "resp_admin_dev_mock",
  }) as never;
}

function failingProvider(): LlmStructuredProvider {
  return async () => ({
    ok: false,
    errorCategory: "invalid_request",
    statusCode: 400,
    redactedMessageSnippet: "Synthetic provider failure",
  }) as never;
}

const organizerContext = {
  normalizedPhone: null,
  intent: "ORGANIZER_PROJECT_IDEA",
  priorMessages: [],
  knownFields: {
    city: "LA",
    projectConcept: "anime picnic",
    scope: null,
    vibe: null,
  },
  gigSeekerKnownFields: {},
  interestCheckKnownFields: {},
  contactReplyKnownFields: {},
  missingRequiredFields: ["scopeOrVibe"],
  missingOptionalFields: ["targetDate"],
  hasCompletedFirstTimeHostQuestion: true,
  optedOut: false,
  safetyFlags: [],
  providerMode: "MOCK",
  sendsDisabled: true,
  allowlistResult: "not_applicable",
  currentStage: "ASK_SCOPE_VIBE",
} as ConversationContext;

const organizerReplyPlan = {
  flow: "ORGANIZER_INTAKE",
  stage: "ASK_SCOPE_VIBE",
  nextStage: "ASK_SCOPE_VIBE",
  enoughInfoForBrief: false,
  shouldEscalate: false,
  nextQuestion:
    "What kind of vibe are you imagining - casual meetup, polished production, pop-up, photoshoot, party, or something else?",
  replyTone: "warm",
  allowedActions: ["ask_next_question"],
  blockedActions: ["send_sms_live"],
  explanationForAudit: "Admin/dev mock organizer language.",
  confidence: 0.82,
} as ReplyPlan;

const fallbackOrganizerReply = {
  replyText:
    "What kind of vibe are you imagining - casual meetup, polished production, pop-up, photoshoot, party, or something else?",
  replyType: "ask_next_question",
  source: "conversation_engine",
  metadata: {
    stage: "ASK_SCOPE_VIBE",
    nextStage: "ASK_SCOPE_VIBE",
    enoughInfoForBrief: false,
    shouldEscalate: false,
    confidence: 0.82,
  },
} as const;

async function testAdminDevAllowsActiveMock() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const resolved = resolveAdminDevLlmExecution({
    conversationEngineMode: "mock_active",
  });
  assert.equal(resolved.executionContext, "mock_admin");
  assert.equal(resolved.details.surface, "admin_dev");
  assert.equal(resolved.details.providerMode, "MOCK");
  assert.equal(resolved.details.allowActiveMock, true);
  assert.equal(resolved.details.allowActiveLive, false);
  assertNoSensitiveValues(resolved);
}

async function testTwilioSurfaceBlocksActiveMock() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const resolved = resolveLlmExecutionContext({
    surface: "twilio_inbound",
    providerMode: "TWILIO",
    conversationEngineMode: "shadow",
    sendsDisabled: true,
    dryRun: false,
  });
  let calls = 0;
  const provider: LlmStructuredProvider = async () => {
    calls += 1;
    return { ok: true, data: { message: "Should not run." } } as never;
  };
  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic Twilio input.",
    fallback: intakeReplySchema.parse({
      message: "Fallback stays in control.",
      confidence: 0.7,
      needsAdmin: false,
      reason: null,
    }),
    executionContext: resolved.executionContext,
    executionContextDetails: resolved.details,
    provider,
  });

  assert.equal(calls, 0);
  assert.equal(result.openaiCalled, false);
  assert.equal(result.source, "fallback");
  assert.equal(result.fallbackReason, "unsupported_surface");
  assert.equal(resolved.details.allowActiveMock, false);
  assertNoSensitiveValues(result);
}

async function testOrganizerAdminDevUsesOpenAiReply() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-5.4-mini",
  });

  const reply = await generateAdminDevOrganizerReplyWithLlm({
    context: organizerContext,
    replyPlan: organizerReplyPlan,
    latestMessage: "I want to throw an anime picnic in LA.",
    fallbackReply: fallbackOrganizerReply,
    provider: providerWithData({
      message: "Love it. What kind of vibe are you imagining for the picnic?",
      confidence: 0.91,
      needsAdmin: false,
      reason: null,
    }),
  });

  assert.equal(reply.source, "openai_active_mock");
  assert.equal(reply.metadata.llmOperation, "organizer_reply_language");
  assert.equal(reply.metadata.llmExecutionSurface, "admin_dev");
  assert.equal(reply.metadata.llmValidationPassed, true);
  assert.equal(reply.metadata.llmFallbackUsed, false);
  assert.equal(reply.metadata.llmFallbackReason, null);
  assert.match(reply.replyText, /vibe/i);
  assertNoSensitiveValues(reply);
}

async function testOrganizerAdminDevFallsBackWhenProviderFails() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const reply = await generateAdminDevOrganizerReplyWithLlm({
    context: organizerContext,
    replyPlan: organizerReplyPlan,
    latestMessage: "I want to throw an anime picnic in LA.",
    fallbackReply: fallbackOrganizerReply,
    provider: failingProvider(),
  });

  assert.equal(reply.source, "deterministic_fallback");
  assert.equal(reply.replyText, fallbackOrganizerReply.replyText);
  assert.equal(reply.metadata.llmFallbackUsed, true);
  assert.equal(reply.metadata.llmFallbackReason, "provider_call_failed");
  assertNoSensitiveValues(reply);
}

function testUnavailableOperationsReportDeterministicFallback() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const metadata = adminDevDeterministicLlmUnavailableMetadata();
  assert.equal(metadata.replySourceDetail, "deterministic_fallback");
  assert.equal(metadata.llmOperation, null);
  assert.equal(metadata.llmOperationUnavailable, true);
  assert.equal(metadata.llmFallbackReason, "llm_operation_unavailable");
  assert.equal(metadata.llmExecutionSurface, "admin_dev");
  assertNoSensitiveValues(metadata);
}

function testContactPaymentQuestionRemainsSafe() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const context = {
    normalizedPhone: null,
    personId: "person_test",
    intent: "CONTACT_REPLY",
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {
      hasActiveOutreach: true,
      currentOutreachStatus: "SENT",
      consentToGroupChat: false,
    },
    missingRequiredFields: [],
    missingOptionalFields: [],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage: "OUTREACH_SENT",
    activeOutreach: {
      id: "outreach_test",
      status: "SENT",
      consentToGroupChat: false,
    },
  } as ConversationContext;
  const replyPlan = {
    flow: "CONTACT_REPLY",
    stage: "OUTREACH_SENT",
    nextStage: "NEEDS_ADMIN",
    enoughInfoForBrief: false,
    shouldEscalate: true,
    escalationReason: "payment question",
    replyTone: "safe",
    allowedActions: ["flag_admin"],
    blockedActions: ["promise_payment"],
    explanationForAudit: "Payment question requires admin review.",
    confidence: 0.9,
  } as ReplyPlan;

  const reply = generateContactReplyFromPlan({
    context,
    replyPlan,
    latestMessage: "How much does it pay?",
    replyKind: "RATE_OR_PAYMENT_QUESTION",
  });

  assert.equal(reply.replyType, "needs_admin");
  assert.match(reply.replyText, /flag this for the Saga team/i);
  assert.doesNotMatch(reply.replyText, /guarantee|rate is|will pay|booked/i);
  assertNoSensitiveValues(reply);
}

async function testActiveLiveRemainsDisabled() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_live",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Active live is disabled.",
    fallback: intakeReplySchema.parse({
      message: "Fallback stays in control.",
      confidence: 0.7,
      needsAdmin: false,
      reason: null,
    }),
    executionContext: "live",
    provider: providerWithData({
      message: "Should not be used.",
      confidence: 0.9,
      needsAdmin: false,
      reason: null,
    }),
  });

  assert.equal(result.activeLiveAllowed, false);
  assert.equal(result.openaiCalled, false);
  assert.equal(result.source, "fallback");
  assertNoSensitiveValues(result);
}

async function main() {
  await testAdminDevAllowsActiveMock();
  await testTwilioSurfaceBlocksActiveMock();
  await testOrganizerAdminDevUsesOpenAiReply();
  await testOrganizerAdminDevFallsBackWhenProviderFails();
  testUnavailableOperationsReportDeterministicFallback();
  testContactPaymentQuestionRemainsSafe();
  await testActiveLiveRemainsDisabled();
  resetEnv();
  console.log("LLM active_mock admin/dev tests passed.");
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
