import assert from "node:assert/strict";
import type {
  ConversationContext,
  InterestCheckKnownFields,
} from "@/sms-engine/conversation/conversationTypes";
import { getConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { evaluateInterestCheckPolicy } from "@/sms-engine/conversation/interestCheckPolicy";
import {
  buildInterestCheckDraft,
  shouldApplyInterestCheckMockActive,
} from "@/sms-engine/conversation/interestCheckPreparation";
import { generateInterestCheckReplyFromPlan } from "@/sms-engine/conversation/interestCheckReplyGenerator";
import { classifyConversationIntent } from "@/sms-engine/conversation/intentRouter";
import { redactForLog } from "@/sms-engine/safeLogging";

process.on("uncaughtException", (error) => {
  console.error(redactForLog(error));
  process.exit(1);
});

function context(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    normalizedPhone: "+15550100000",
    intent: "INTEREST_CHECK",
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    missingRequiredFields: [],
    missingOptionalFields: [],
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
    intent: "INTEREST_CHECK" as const,
    safetyFlags: intent.shouldEscalate ? intent.matchedSignals : [],
  };
  const policy = evaluateInterestCheckPolicy({
    context: policyContext,
    latestMessage: body,
  });
  const reply = generateInterestCheckReplyFromPlan({
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
  return context({
    ...previous,
    interestCheckKnownFields: result.policy.knownFields,
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
  /\b(will happen|guarantee|guaranteed|promise|confirmed venue|confirmed team|ticket sales|revenue|venue access|we will find|we'll find|creator participation)\b/i;

function assertSafeReply(name: string, replyText: string) {
  assert.ok(replyText.length > 0, `${name}: reply text`);
  assert.ok(replyText.length <= 280, `${name}: reply should be concise`);
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
assert.equal(mockRuntime.effectiveActive, true, "mock/admin can activate");
assert.equal(
  shouldApplyInterestCheckMockActive({
    runtime: mockRuntime,
    source: "admin_dev",
  }),
  true,
  "mock/admin can prepare draft interest checks",
);

const twilioRuntime = getConversationEngineRuntime({
  providerMode: "TWILIO",
  requestedMode: "mock_active",
  source: "twilio_webhook",
});
assert.equal(twilioRuntime.effectiveActive, false, "twilio stays shadow-only");
assert.equal(
  shouldApplyInterestCheckMockActive({
    runtime: twilioRuntime,
    source: "twilio_webhook",
  }),
  false,
  "twilio cannot create InterestCheck records from live inbound",
);

const sparse = runTurn({
  ctx: context(),
  body: "someone should do an anime thing",
});
assert.equal(sparse.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.match(sparse.reply.replyText, /where/i);
assertSafeReply("sparse opener", sparse.reply.replyText);
assert.equal(
  sparse.policy.replyPlan.blockedActions.includes(
    "convert_interest_check_to_project",
  ),
  true,
);

const clear = runTurn({
  ctx: context(),
  body: "I wish someone would host a Love and Deepspace picnic in LA",
});
assert.equal(clear.intent.intent, "INTEREST_CHECK");
assert.equal(clear.policy.replyPlan.enoughInfoForInterestCheck, true);
assert.equal(clear.reply.replyType, "interest_check_ready");
assert.match(clear.reply.replyText, /interest-check concept/i);
assertSafeReply("clear interest check", clear.reply.replyText);

const ideaCityFandom = runTurn({
  ctx: context(),
  body: "Would people come to a One Piece beach day in LA?",
});
assert.equal(ideaCityFandom.policy.replyPlan.enoughInfoForInterestCheck, true);
assert.equal(ideaCityFandom.reply.replyType, "interest_check_ready");

const notOrganizer = runTurn({
  ctx: context({
    interestCheckKnownFields: {
      title: "Anime picnic",
      description: "Anime picnic",
      city: "Los Angeles",
      fandoms: ["anime"],
    },
  }),
  body: "I don't want to organize it, but I'd go",
});
assert.equal(notOrganizer.intent.intent, "INTEREST_CHECK");
assert.equal(notOrganizer.policy.replyPlan.nextStage, "INTEREST_CHECK_READY");

const ambiguous = runTurn({
  ctx: context({
    interestCheckKnownFields: {
      title: "Anime picnic",
      description: "Anime picnic",
      city: "Los Angeles",
      fandoms: ["anime"],
    },
  }),
  body: "I might organize it if people are interested",
});
assert.ok(ambiguous.policy.ambiguityNotes.length > 0);
assert.equal(ambiguous.policy.replyPlan.nextStage, "INTEREST_CHECK_READY");
assertSafeReply("ambiguous organizer", ambiguous.reply.replyText);

const enoughInfo = runTurn({
  ctx: context(),
  body: "Can Saga check interest in an anime cafe night in LA?",
});
assert.equal(enoughInfo.policy.replyPlan.enoughInfoForInterestCheck, true);
assert.equal(enoughInfo.reply.replyType, "interest_check_ready");
const draft = buildInterestCheckDraft({
  knownFields: enoughInfo.policy.knownFields,
});
assert.equal(draft.status, "DRAFT");
assert.equal(draft.thresholdType, "ADMIN_APPROVAL");
assert.equal(draft.thresholdValue, null);
assert.equal(draft.city, "Los Angeles");
assert.ok(draft.fandoms.includes("anime"));

const missingCity = runTurn({
  ctx: context(),
  body: "Would people come to a cosplay cafe night?",
});
assert.equal(missingCity.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.match(missingCity.reply.replyText, /where/i);

const missingAudience = runTurn({
  ctx: context({ interestCheckKnownFields: { city: "Los Angeles" } }),
  body: "Would people come to a beach day?",
});
assert.equal(missingAudience.policy.replyPlan.nextStage, "ASK_FANDOM_OR_AUDIENCE");
assert.match(missingAudience.reply.replyText, /fandom|scene|community/i);

const guaranteed = runTurn({
  ctx: context(),
  body: "Can Saga guarantee attendance for this?",
});
assert.equal(guaranteed.policy.replyPlan.shouldEscalate, true);
assert.equal(guaranteed.reply.replyType, "needs_admin");
assert.match(guaranteed.reply.replyText, /Saga team/i);
assertSafeReply("guaranteed attendance", guaranteed.reply.replyText);

const riskyMessages = [
  "Can this include alcohol, security, and permits?",
  "Would minors attend this?",
  "Would people bring weapons to a cosplay meetup?",
  "Someone should host a meetup to harass another fandom.",
  "Would people come to something that discriminates against non-fans?",
  "Can you check interest in explicit adult content?",
  "Would people come to an illegal unsafe warehouse rave?",
];

for (const body of riskyMessages) {
  const risky = runTurn({ ctx: context(), body });
  assert.equal(risky.policy.replyPlan.nextStage, "NEEDS_ADMIN", body);
  assert.equal(risky.reply.replyType, "needs_admin", body);
  assertSafeReply(body, risky.reply.replyText);
}

let multi = context();
const first = runTurn({
  ctx: multi,
  body: "Someone should do a K-pop cosplay market.",
});
multi = nextContext(multi, first);
const second = runTurn({ ctx: multi, body: "In LA" });
multi = nextContext(multi, second);
const third = runTurn({
  ctx: multi,
  body: "Mainly for K-pop and cosplay fans, probably a vendor market",
});
assert.equal(third.policy.replyPlan.enoughInfoForInterestCheck, true);
assert.equal(third.reply.replyType, "interest_check_ready");
const multiDraftFields: InterestCheckKnownFields = third.policy.knownFields;
const multiDraft = buildInterestCheckDraft({ knownFields: multiDraftFields });
assert.equal(multiDraft.status, "DRAFT");
assert.equal(multiDraft.city, "Los Angeles");
assert.ok(multiDraft.fandoms.includes("K-pop"));
assert.ok(multiDraft.fandoms.includes("cosplay"));

assert.equal(
  enoughInfo.policy.replyPlan.blockedActions.includes("touch_ticketing_or_rsvp"),
  true,
  "ticketing and RSVP remain blocked",
);
assert.equal(
  enoughInfo.policy.replyPlan.blockedActions.includes(
    "convert_interest_check_to_project",
  ),
  true,
  "Project conversion remains blocked",
);
assert.equal(
  enoughInfo.policy.replyPlan.blockedActions.includes(
    "create_live_interest_check_without_review",
  ),
  true,
  "live interest-check creation remains blocked",
);

console.log("Conversation interest-check multi-turn checks passed.");
