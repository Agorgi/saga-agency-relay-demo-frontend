import assert from "node:assert/strict";
import { evaluateAndExecuteLiveReply } from "@/sms-engine/conversation/liveReplyExecutor";
import {
  runStructuredLlmTask,
  type LlmStructuredProvider,
} from "@/sms-engine/llm/llmProvider";
import {
  extractBriefFieldsSchema,
  intakeReplySchema,
} from "@/sms-engine/producerAgent";

const originalEnv = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = { ...originalEnv, ...overrides };
  delete process.env.DATABASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODE;
  delete process.env.SMS_SENDS_DISABLED;
  Object.assign(process.env, overrides);
}

function assertNoSmsState(sendCalls: number) {
  assert.equal(sendCalls, 0);
  assert.equal(process.env.SMS_SENDS_DISABLED, "true");
}

async function main() {
  resetEnv({
    LLM_PROVIDER: "openai",
    LLM_MODE: "shadow",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-5.4-mini",
    LLM_LOG_PROMPTS: "false",
    LLM_LOG_OUTPUTS: "false",
    SMS_SENDS_DISABLED: "true",
  });

  const inboundText = "I want to throw an anime picnic in LA next month.";
  const extractionFallback = extractBriefFieldsSchema.parse({
    city: "LA",
    description: inboundText,
    title: "Anime picnic in LA",
    confidence: 0.55,
    needsAdmin: false,
    safetyFlags: [],
  });
  const extractionProvider: LlmStructuredProvider = async () => ({
    ok: true,
    data: {
      city: "Los Angeles",
      description: inboundText,
      title: "Anime picnic in Los Angeles",
      confidence: 0.9,
      needsAdmin: false,
      safetyFlags: [],
    },
    rawText: '{"city":"Los Angeles"}',
    responseId: "resp_extract",
  }) as never;

  const extraction = await runStructuredLlmTask({
    operation: "brief_field_extraction",
    schema: extractBriefFieldsSchema,
    schemaName: "brief_field_extraction",
    prompt: "Synthetic organizer inbound. No phone numbers.",
    fallback: extractionFallback,
    provider: extractionProvider,
  });

  assert.equal(extraction.openaiCalled, true);
  assert.equal(extraction.source, "fallback");
  assert.equal(extraction.validationPassed, true);
  assert.equal(extraction.data.city, "LA");
  assert.equal(extraction.shadowOutput?.city, "Los Angeles");

  const replyFallback = intakeReplySchema.parse({
    message:
      "Love this. Have you hosted something like this before?",
    confidence: 0.75,
    needsAdmin: false,
  });
  const replyProvider: LlmStructuredProvider = async () => ({
    ok: true,
    data: {
      message:
        "Love this. Have you hosted something like this before?",
      confidence: 0.91,
      needsAdmin: false,
      reason: null,
    },
    rawText: '{"message":"Love this."}',
    responseId: "resp_reply",
  }) as never;

  const reply = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: "Synthetic organizer reply language prompt. No phone numbers.",
    fallback: replyFallback,
    provider: replyProvider,
  });

  assert.equal(reply.openaiCalled, true);
  assert.equal(reply.source, "fallback");
  assert.equal(reply.validationPassed, true);
  assert.equal(reply.data.message, replyFallback.message);
  assert.equal(reply.shadowOutput?.reason, null);

  let sendCalls = 0;
  const liveReply = await evaluateAndExecuteLiveReply({
    flow: "ORGANIZER_INTAKE",
    replyText: reply.data.message,
    recipientPhone: "+14155550123",
    config: {
      providerMode: "TWILIO",
      sendsDisabled: true,
      allowlistRequired: true,
      allowedNumbers: ["+14155550123"],
      allowedNumbersCount: 1,
      twilioStagingMode: true,
      webhookValidationEnabled: true,
      smsComplianceApproved: true,
      pilotStage: "internal_test",
      pilotReplyMode: "auto_allowlisted",
      publicLaunchEnabled: false,
      twilioConfigured: true,
    },
    dryRun: false,
    sendMessage: async () => {
      sendCalls += 1;
      return { messageId: "should-not-send" };
    },
  });

  assert.equal(liveReply.action, "blocked");
  assert.equal(liveReply.status, "BLOCKED_BY_SENDS_DISABLED");
  assertNoSmsState(sendCalls);

  resetEnv();
  console.log(
    "LLM shadow organizer inbound checks passed without Twilio, SMS, or production data.",
  );
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
