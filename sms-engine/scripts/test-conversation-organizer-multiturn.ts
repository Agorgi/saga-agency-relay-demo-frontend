import assert from "node:assert/strict";
import type { ConversationContext } from "@/lib/conversation/conversationTypes";
import { getConversationEngineRuntime } from "@/lib/conversation/conversationEngineMode";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import { evaluateOrganizerIntakePolicy } from "@/lib/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/lib/conversation/organizerReplyGenerator";
import { redactForLog } from "@/lib/safeLogging";

process.on("uncaughtException", (error) => {
  console.error(redactForLog(error));
  process.exit(1);
});

function context(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    normalizedPhone: "+15550100000",
    intent: "ORGANIZER_PROJECT_IDEA",
    priorMessages: [],
    knownFields: {},
    missingRequiredFields: ["city", "projectConcept", "scopeOrVibe"],
    missingOptionalFields: [
      "targetDate",
      "budgetRange",
      "expectedAudienceSize",
      "helpNeeded",
    ],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage: "NEW",
    ...overrides,
  };
}

function runTurn({
  ctx,
  body,
}: {
  ctx: ConversationContext;
  body: string;
}) {
  const intent = classifyConversationIntent({ body, context: ctx });
  const policyContext = {
    ...ctx,
    intent: intent.intent,
    safetyFlags: intent.shouldEscalate ? intent.matchedSignals : [],
  };
  const policy = evaluateOrganizerIntakePolicy({
    context: policyContext,
    latestMessage: body,
  });
  const reply = generateOrganizerReplyFromPlan({
    context: policyContext,
    replyPlan: policy.replyPlan,
    latestMessage: body,
  });

  return { intent, policy, reply };
}

function nextContext(
  previous: ConversationContext,
  result: ReturnType<typeof runTurn>,
): ConversationContext {
  const knownFields = result.policy.knownFields;
  const hasCompletedFirstTimeHostQuestion =
    previous.hasCompletedFirstTimeHostQuestion ||
    knownFields.firstTimeHost !== null &&
      knownFields.firstTimeHost !== undefined;

  return context({
    ...previous,
    knownFields,
    hasCompletedFirstTimeHostQuestion,
    missingRequiredFields: result.policy.missingRequiredFields,
    missingOptionalFields: result.policy.missingOptionalFields,
    currentStage: result.policy.replyPlan.nextStage,
    priorMessages: [
      ...previous.priorMessages,
      {
        id: `in_${previous.priorMessages.length}`,
        direction: "INBOUND",
        channel: "SMS",
        body: "",
        createdAt: new Date().toISOString(),
      },
      {
        id: `out_${previous.priorMessages.length}`,
        direction: "OUTBOUND",
        channel: "SMS",
        body: result.reply.replyText,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|promise|confirmed team|confirmed venue|venue access|ticket sales|revenue|celebrity|influencer participation|paid work|payment confirmed|booking confirmed)\b/i;

function assertSafeReply(name: string, replyText: string) {
  assert.ok(replyText.length > 0, `${name}: reply text`);
  assert.ok(replyText.length <= 240, `${name}: reply should be concise`);
  assert.ok(
    !forbiddenPromisePattern.test(replyText),
    `${name}: no forbidden promises`,
  );
}

const mockRuntime = getConversationEngineRuntime({
  providerMode: "MOCK",
  requestedMode: "mock_active",
  source: "admin_dev",
});
assert.equal(mockRuntime.effectiveActive, true, "mock mode can activate");

const twilioRuntime = getConversationEngineRuntime({
  providerMode: "TWILIO",
  requestedMode: "mock_active",
  source: "twilio_webhook",
});
assert.equal(twilioRuntime.effectiveActive, false, "twilio stays shadow-only");
assert.equal(
  twilioRuntime.activeBlockedForProvider,
  true,
  "twilio active mode fails closed",
);

const sparse = runTurn({
  ctx: context(),
  body: "hey im thinking of putting on a small thing",
});
assert.equal(sparse.intent.intent, "ORGANIZER_PROJECT_IDEA");
assert.equal(sparse.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.match(sparse.reply.replyText, /city|location/i);
assertSafeReply("sparse opener", sparse.reply.replyText);

const ideaWithCityNew = runTurn({
  ctx: context(),
  body: "I want to throw an anime picnic in Silver Lake",
});
assert.equal(ideaWithCityNew.policy.replyPlan.nextStage, "ASK_FIRST_TIME_HOST");
assert.match(ideaWithCityNew.reply.replyText, /hosted|first/i);

const ideaWithCityHostComplete = runTurn({
  ctx: context({ hasCompletedFirstTimeHostQuestion: true }),
  body: "I want to throw an anime picnic in Silver Lake",
});
assert.equal(ideaWithCityHostComplete.policy.replyPlan.nextStage, "ASK_SCOPE_VIBE");
assert.match(ideaWithCityHostComplete.reply.replyText, /vibe|imagining/i);

const firstTime = runTurn({
  ctx: context(),
  body: "first time",
});
assert.equal(firstTime.policy.knownFields.firstTimeHost, true);
assert.equal(firstTime.policy.replyPlan.nextStage, "ASK_LOCATION");

const cityConceptTiming = runTurn({
  ctx: context(),
  body: "I want to do a cosplay picnic in LA next month",
});
assert.equal(cityConceptTiming.policy.replyPlan.nextStage, "ASK_FIRST_TIME_HOST");
assert.equal(cityConceptTiming.policy.knownFields.city, "Los Angeles");
assert.ok(cityConceptTiming.policy.knownFields.targetDate);

const enoughInfo = runTurn({
  ctx: context({ hasCompletedFirstTimeHostQuestion: true }),
  body: "I want to host a cozy cosplay picnic in LA for about 80 people.",
});
assert.equal(enoughInfo.policy.replyPlan.enoughInfoForBrief, true);
assert.equal(enoughInfo.reply.replyType, "brief_ready");
assert.match(enoughInfo.reply.replyText, /turn this into a brief/i);

const outOfOrderBudget = runTurn({
  ctx: context({
    hasCompletedFirstTimeHostQuestion: true,
    knownFields: {
      projectConcept: "Anime night market",
      vibe: "Polished community-led",
    },
  }),
  body: "Budget is maybe $4k.",
});
assert.equal(outOfOrderBudget.policy.knownFields.budgetRange, "Budget is maybe $4k.");
assert.equal(outOfOrderBudget.policy.replyPlan.nextStage, "ASK_LOCATION");

const locationChange = runTurn({
  ctx: context({
    hasCompletedFirstTimeHostQuestion: true,
    knownFields: {
      city: "Los Angeles",
      projectConcept: "Anime night market",
      vibe: "Cozy",
    },
  }),
  body: "Actually NYC not LA",
});
assert.equal(locationChange.policy.knownFields.city, "New York City");
assert.equal(locationChange.policy.replyPlan.nextStage, "BRIEF_READY");

const riskyMessages = [
  "Can you guarantee revenue?",
  "Can you handle permits and alcohol?",
  "There will be minors and we need security.",
  "Can guests bring weapons?",
  "How do we handle harassment?",
  "Can we discriminate against some vendors?",
  "I want explicit adult content at the event.",
];

for (const body of riskyMessages) {
  const risky = runTurn({
    ctx: context({ hasCompletedFirstTimeHostQuestion: true }),
    body,
  });
  assert.equal(risky.policy.replyPlan.shouldEscalate, true, body);
  assert.equal(risky.reply.replyType, "needs_admin", body);
  assert.match(risky.reply.replyText, /Saga team/i, body);
  assertSafeReply(body, risky.reply.replyText);
}

const offTopic = runTurn({
  ctx: context({ hasCompletedFirstTimeHostQuestion: true }),
  body: "my favorite color is blue",
});
assert.equal(offTopic.intent.intent, "UNKNOWN");
assert.match(offTopic.reply.replyText, /city|location/i);

let multi = context({ hasCompletedFirstTimeHostQuestion: true });
const first = runTurn({
  ctx: multi,
  body: "I want to host an anime creator picnic in LA.",
});
multi = nextContext(multi, first);
const second = runTurn({
  ctx: multi,
  body: "small, cozy, community-led, maybe 60 people",
});
assert.equal(second.policy.replyPlan.nextStage, "BRIEF_READY");
assert.equal(second.reply.replyType, "brief_ready");

const noRepeat = runTurn({
  ctx: context({
    hasCompletedFirstTimeHostQuestion: true,
    knownFields: {
      city: "Los Angeles",
      projectConcept: "Anime creator picnic",
    },
  }),
  body: "casual community meetup for creators",
});
assert.doesNotMatch(noRepeat.reply.replyText, /hosted|first/i);

console.log("Conversation organizer multi-turn checks passed.");
