import assert from "node:assert/strict";
import {
  buildLlmReviewItemData,
  buildLlmReviewUpdateData,
  recordLlmReviewItem,
  safeLlmReviewItemForDisplay,
  safeLlmReviewText,
  suggestLlmToneReviewStatus,
} from "@/sms-engine/llm/qualityReview";
import {
  runStructuredLlmTask,
  safeLlmHealth,
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
  Object.assign(process.env, overrides);
}

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+14155550123",
    "14155550123",
    "sk-test-secret",
    "OPENAI_API_KEY",
    "TWILIO_AUTH_TOKEN",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

const fallbackReply = intakeReplySchema.parse({
  message: "Great. What city should this happen in?",
  confidence: 0.8,
  needsAdmin: false,
  reason: null,
});

function providerWithData(data: unknown): LlmStructuredProvider {
  return async () => ({
    ok: true,
    data,
    rawText: JSON.stringify(data),
    responseId: "resp_quality_review",
  }) as never;
}

function comparisonFor(flow: string) {
  return buildLlmReviewItemData({
    operation: `${flow}_reply_language`,
    flow,
    provider: "openai",
    model: "gpt-5.4-mini",
    mode: "shadow",
    fallbackValue: { message: "Great. What city should this happen in?" },
    llmValue: { message: "Love it. What city should this happen in?" },
    selectedValue: { message: "Great. What city should this happen in?" },
    selectedReplySource: "deterministic_fallback",
    validationStatus: "VALID",
    fallbackUsed: true,
    fallbackReason: "shadow_mode_not_user_facing",
    metadata: { flow, nextQuestion: "What city should this happen in?" },
  });
}

function testFlowComparisons() {
  const organizer = comparisonFor("ORGANIZER_INTAKE");
  assert.equal(organizer.flow, "organizer");
  assert.match(organizer.deterministicText || "", /city/);
  assert.match(organizer.llmText || "", /Love it/);
  assert.equal(organizer.selectedReplySource, "deterministic_fallback");

  const gigSeeker = comparisonFor("GIG_SEEKER_ONBOARDING");
  assert.equal(gigSeeker.flow, "gig_seeker");

  const interest = comparisonFor("INTEREST_CHECK");
  assert.equal(interest.flow, "interest_check");

  const contact = buildLlmReviewItemData({
    operation: "contact_reply_language",
    flow: "CONTACT_REPLY",
    provider: "openai",
    model: "gpt-5.4-mini",
    mode: "active_mock",
    fallbackValue: {
      message:
        "Good question. I don't want to guess on terms - I'm going to flag this for the Saga team before moving forward.",
    },
    llmValue: {
      message:
        "Good question. I don't want to guess on terms - I'm going to flag this for the Saga team before moving forward.",
    },
    selectedValue: {
      message:
        "Good question. I don't want to guess on terms - I'm going to flag this for the Saga team before moving forward.",
    },
    selectedReplySource: "deterministic_fallback",
    validationStatus: "VALID",
    safetyFlags: ["money_or_contract"],
    fallbackUsed: true,
    fallbackReason: "llm_operation_unavailable",
    metadata: { flow: "CONTACT_REPLY" },
  });
  assert.equal(contact.flow, "contact_reply");
  assert.deepEqual(contact.safetyFlags, ["money_or_contract"]);
  assertNoSensitiveValues([organizer, gigSeeker, interest, contact]);
}

async function testFallbackBeatsUnsafeLlmOutput() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic organizer prompt.",
    fallback: fallbackReply,
    executionContext: "mock_admin",
    provider: providerWithData({
      message: "We guarantee bookings and paid work.",
      confidence: 0.9,
      needsAdmin: false,
      reason: null,
    }),
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.validationPassed, false);
  assert.equal(result.errorCategory, "ForbiddenClaimsDetected");
  assert.equal(result.data.message, fallbackReply.message);
  assertNoSensitiveValues(result);
}

function testForbiddenAndToneFlags() {
  const unsafe = buildLlmReviewItemData({
    operation: "organizer_reply_language",
    provider: "openai",
    model: "gpt-5.4-mini",
    mode: "active_mock",
    fallbackValue: { message: "What city should this happen in?" },
    llmValue: { message: "We guarantee 500 ticket sales." },
    selectedValue: { message: "What city should this happen in?" },
    selectedReplySource: "deterministic_fallback",
    validationStatus: "FORBIDDEN_CLAIMS",
    fallbackUsed: true,
    fallbackReason: "forbidden_claims_detected",
  });
  assert.equal(unsafe.forbiddenClaimsDetected, true);
  assert.equal(unsafe.toneReviewStatus, "UNSAFE");

  assert.equal(
    suggestLlmToneReviewStatus({
      llmText: "This is a very long reply. ".repeat(40),
    }),
    "TOO_VERBOSE",
  );
  assert.equal(
    suggestLlmToneReviewStatus({
      llmText: "Cool. Tell me your budget.",
      expectedNextQuestion: "What city should this happen in?",
    }),
    "WRONG_NEXT_QUESTION",
  );
}

function testSerializerAndReviewUpdateSafety() {
  resetEnv({ OPENAI_API_KEY: "sk-test-secret" });
  const now = new Date();
  const safe = safeLlmReviewItemForDisplay({
    id: "review_test",
    operation: "organizer_reply_language",
    flow: "organizer",
    provider: "openai",
    model: "gpt-5.4-mini",
    mode: "active_mock",
    deterministicText: "Text me at +14155550123.",
    llmText: "No secrets: sk-test-secret.",
    selectedText: "Email user@example.com.",
    selectedReplySource: "openai_active_mock",
    validationStatus: "VALID",
    safetyFlags: [],
    forbiddenClaimsDetected: false,
    fallbackUsed: false,
    fallbackReason: null,
    toneReviewStatus: "GOOD",
    needsReview: false,
    reviewStatus: "GOOD",
    reviewerNotes: "Call +14155550123 with sk-test-secret.",
    projectBriefId: null,
    personId: null,
    messageId: null,
    createdAt: now,
    updatedAt: now,
  });

  assertNoSensitiveValues(safe);
  const update = buildLlmReviewUpdateData({
    reviewStatus: "BETTER_THAN_FALLBACK",
    reviewerNotes: "Safe note with +14155550123 and sk-test-secret.",
  });
  assert.equal(update.reviewStatus, "BETTER_THAN_FALLBACK");
  assertNoSensitiveValues(update);
}

async function testNoDbAndActiveLiveDisabled() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_live",
    OPENAI_API_KEY: "sk-test-secret",
  });

  const skipped = await recordLlmReviewItem({
    operation: "organizer_reply_language",
    provider: "openai",
    model: "gpt-5.4-mini",
    mode: "shadow",
    fallbackValue: fallbackReply,
    selectedValue: fallbackReply,
    selectedReplySource: "deterministic_fallback",
    validationStatus: "VALID",
    fallbackUsed: true,
  });
  assert.equal(skipped, null);
  const health = safeLlmHealth();
  assert.equal(health.activeLiveAllowed, false);
  assertNoSensitiveValues(health);
}

function testSafeLlmReviewTextExtraction() {
  // Plain string passes through.
  assert.equal(safeLlmReviewText("Hello there"), "Hello there");

  // Sagasan-shaped output: `message` is the text field.
  assert.equal(
    safeLlmReviewText({ message: "Hi", nextStep: null }),
    "Hi",
  );

  // Reply-shaped output: `reply` is the text field.
  // Regression for the bug where /admin/llm-review surfaced
  // "Structured output fields: reply, nextStep, persona"
  // because `reply` was not in the textFromValue key list.
  assert.equal(
    safeLlmReviewText({ reply: "Got it.", nextStep: null, persona: "host" }),
    "Got it.",
  );

  // Unknown shape still produces a debuggable placeholder.
  const placeholder = safeLlmReviewText({ unknownField: "x", another: 1 });
  assert.match(
    placeholder || "",
    /Structured output fields: /,
  );

  // Empty / nullish input returns null.
  assert.equal(safeLlmReviewText(null), null);
  assert.equal(safeLlmReviewText(undefined), null);
  assert.equal(safeLlmReviewText({}), null);
}

async function main() {
  testFlowComparisons();
  await testFallbackBeatsUnsafeLlmOutput();
  testForbiddenAndToneFlags();
  testSerializerAndReviewUpdateSafety();
  testSafeLlmReviewTextExtraction();
  await testNoDbAndActiveLiveDisabled();
  resetEnv();
  console.log(
    "LLM quality review checks passed without Twilio, SMS, or production data.",
  );
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
