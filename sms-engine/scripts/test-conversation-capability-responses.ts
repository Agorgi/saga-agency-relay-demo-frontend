import assert from "node:assert/strict";
import {
  detectCapabilityFaq,
  evaluateCapabilityFaqPolicy,
  generateCapabilityResponse,
} from "@/sms-engine/conversation/capabilityResponses";
import type { ConversationContext } from "@/sms-engine/conversation/conversationTypes";
import { classifyConversationIntent } from "@/sms-engine/conversation/intentRouter";
import { redactForLog } from "@/sms-engine/safeLogging";

process.on("uncaughtException", (error) => {
  console.error(redactForLog(error));
  process.exit(1);
});

const forbiddenPromisePattern =
  /\b(we will book|you will get|guaranteed paid|guaranteed booking|confirmed team|confirmed venue|confirmed booking|confirmed placement|venue access is confirmed|ticket sales are guaranteed|event will happen|we will make it happen)\b/i;

const internalDetailsPattern =
  /\b(candidate graph|openai|twilio|admin tools?|review queues?|llm|prompt|internal api|database|railway|postgres)\b/i;

const rawContactPattern =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i;

function baseContext(): ConversationContext {
  return {
    normalizedPhone: "+15550100000",
    intent: "UNKNOWN",
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {},
    missingRequiredFields: [],
    missingOptionalFields: [],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage: "NEW",
  };
}

function assertSafe(label: string, replyText: string) {
  assert.ok(replyText.trim().length > 0, `${label}: reply text exists`);
  assert.ok(replyText.length <= 320, `${label}: reply is concise`);
  assert.doesNotMatch(replyText, forbiddenPromisePattern, `${label}: no forbidden promises`);
  assert.doesNotMatch(replyText, internalDetailsPattern, `${label}: no internal details`);
  assert.doesNotMatch(replyText, rawContactPattern, `${label}: no raw contact data`);
}

function runCase(input: {
  label: string;
  body: string;
  expectedIntent: "CAPABILITY_FAQ" | "HELP";
  expectedKind: string;
  expectedFlow: string;
  shouldEscalate?: boolean;
  expectedText?: RegExp;
}) {
  const context = baseContext();
  const classification = classifyConversationIntent({ body: input.body, context });
  assert.equal(classification.intent, input.expectedIntent, `${input.label}: intent`);
  assert.equal(
    classification.shouldEscalate,
    Boolean(input.shouldEscalate),
    `${input.label}: escalation`,
  );

  const detected = detectCapabilityFaq(input.body);
  assert.equal(detected.kind, input.expectedKind, `${input.label}: response kind`);
  assert.equal(detected.suggestedFlow, input.expectedFlow, `${input.label}: suggested flow`);

  const policy = evaluateCapabilityFaqPolicy({
    context: {
      ...context,
      intent: classification.intent,
      safetyFlags: classification.shouldEscalate ? classification.matchedSignals : [],
    },
    latestMessage: input.body,
  });
  const response = generateCapabilityResponse({ body: input.body });

  assert.equal(policy.response.responseKind, input.expectedKind, `${input.label}: policy kind`);
  assert.equal(response.responseKind, input.expectedKind, `${input.label}: generated kind`);
  assert.equal(policy.replyPlan.shouldEscalate, Boolean(input.shouldEscalate));
  if (input.shouldEscalate) {
    assert.equal(policy.replyPlan.nextStage, "NEEDS_ADMIN");
  }
  if (input.expectedText) {
    assert.match(response.replyText, input.expectedText, `${input.label}: reply content`);
  }
  assertSafe(input.label, response.replyText);
  return response.replyText;
}

const replies = [
  runCase({
    label: "what do you do",
    body: "what do you do",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "GENERAL",
    expectedFlow: "capability_faq",
    expectedText: /creative project ideas/i,
  }),
  runCase({
    label: "how does this work",
    body: "how does this work",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "HOW_IT_WORKS",
    expectedFlow: "capability_faq",
    expectedText: /ask a few basics/i,
  }),
  runCase({
    label: "can you find me a photographer",
    body: "can you find me a photographer",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "TALENT_SEARCH",
    expectedFlow: "organizer_intake",
    expectedText: /relevant people/i,
  }),
  runCase({
    label: "can you get me paid gigs",
    body: "can you get me paid gigs",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "GIG_SEEKER",
    expectedFlow: "creator_onboarding",
    expectedText: /creator profile/i,
  }),
  runCase({
    label: "can you guarantee I'll get booked",
    body: "can you guarantee I'll get booked",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "GUARANTEE",
    expectedFlow: "admin_review",
    shouldEscalate: true,
    expectedText: /cannot make firm commitments/i,
  }),
  runCase({
    label: "can you make this event happen",
    body: "can you make this event happen",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "EVENT_PLANNING",
    expectedFlow: "organizer_intake",
    expectedText: /clear brief/i,
  }),
  runCase({
    label: "help",
    body: "help",
    expectedIntent: "HELP",
    expectedKind: "HELP",
    expectedFlow: "help",
    expectedText: /project ideas/i,
  }),
  runCase({
    label: "what can I ask you",
    body: "what can I ask you",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "WHAT_CAN_I_ASK",
    expectedFlow: "capability_faq",
    expectedText: /interest/i,
  }),
  runCase({
    label: "are you a bot",
    body: "are you a bot",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "BOT_DISCLOSURE",
    expectedFlow: "capability_faq",
    expectedText: /text assistant/i,
  }),
  runCase({
    label: "what happens next",
    body: "what happens next",
    expectedIntent: "CAPABILITY_FAQ",
    expectedKind: "NEXT_STEPS",
    expectedFlow: "capability_faq",
    expectedText: /which lane fits/i,
  }),
];

for (const reply of replies) {
  assertSafe("all replies", reply);
}

assert.equal(replies.some((reply) => /candidate graph|OpenAI|Twilio|review queue/i.test(reply)), false);

console.log(
  JSON.stringify(
    {
      capabilityResponseCount: replies.length,
      noForbiddenPromises: true,
      noInternalSystemDetails: true,
      noSmsSent: true,
      noTwilioRequired: true,
    },
    null,
    2,
  ),
);
