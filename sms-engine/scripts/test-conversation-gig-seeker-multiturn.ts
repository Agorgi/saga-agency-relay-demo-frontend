import assert from "node:assert/strict";
import type {
  ConversationContext,
  GigSeekerKnownFields,
} from "@/sms-engine/conversation/conversationTypes";
import { getConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { evaluateGigSeekerOnboardingPolicy } from "@/sms-engine/conversation/gigSeekerOnboardingPolicy";
import {
  buildGigSeekerProfileDraft,
  shouldApplyGigSeekerMockActive,
} from "@/sms-engine/conversation/gigSeekerProfilePreparation";
import { generateGigSeekerReplyFromPlan } from "@/sms-engine/conversation/gigSeekerReplyGenerator";
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
    intent: "GIG_SEEKER_ONBOARDING",
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
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
    intent: "GIG_SEEKER_ONBOARDING" as const,
    safetyFlags: intent.shouldEscalate ? intent.matchedSignals : [],
  };
  const policy = evaluateGigSeekerOnboardingPolicy({
    context: policyContext,
    latestMessage: body,
  });
  const reply = generateGigSeekerReplyFromPlan({
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
    gigSeekerKnownFields: result.policy.knownFields,
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
  /\b(we (?:will|can) book|you will get|guaranteed paid work|guaranteed gigs|confirmed placement|confirmed booking|guarantee revenue|guarantee bookings|promise paid work)\b/i;

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
  shouldApplyGigSeekerMockActive({ runtime: mockRuntime, source: "admin_dev" }),
  true,
  "mock/admin can prepare profiles",
);

const twilioRuntime = getConversationEngineRuntime({
  providerMode: "TWILIO",
  requestedMode: "mock_active",
  source: "twilio_webhook",
});
assert.equal(twilioRuntime.effectiveActive, false, "twilio stays shadow-only");
assert.equal(
  shouldApplyGigSeekerMockActive({
    runtime: twilioRuntime,
    source: "twilio_webhook",
  }),
  false,
  "twilio cannot prepare profiles from live inbound",
);

const sparse = runTurn({ ctx: context(), body: "I want gigs" });
assert.equal(sparse.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.match(sparse.reply.replyText, /city/i);
assertSafeReply("sparse opener", sparse.reply.replyText);

const roleCity = runTurn({
  ctx: context(),
  body: "I'm a photographer in LA",
});
assert.equal(roleCity.policy.replyPlan.nextStage, "ASK_LINKS");
assert.match(roleCity.reply.replyText, /instagram|portfolio|website/i);
assertSafeReply("role city", roleCity.reply.replyText);

const roleCityLink = runTurn({
  ctx: context(),
  body: "I'm a cosplayer in NYC, my IG is instagram.com/example",
});
assert.equal(roleCityLink.policy.replyPlan.nextStage, "ASK_FANDOMS");
assert.match(roleCityLink.reply.replyText, /fandoms|scenes|communities/i);

const enoughInfo = runTurn({
  ctx: context(),
  body: "I'm a DJ in LA @mixes for anime and gaming events",
});
assert.equal(enoughInfo.policy.replyPlan.enoughInfoForProfileReview, true);
assert.equal(enoughInfo.reply.replyType, "profile_ready_for_review");
assert.match(enoughInfo.reply.replyText, /creator profile/i);
assertSafeReply("enough info", enoughInfo.reply.replyText);

const draft = buildGigSeekerProfileDraft({
  knownFields: enoughInfo.policy.knownFields,
});
assert.equal(draft.reviewStatus, "PENDING_REVIEW");
assert.ok(draft.roles.includes("DJ"), "draft includes role");
assert.ok(draft.fandoms.includes("anime"), "draft includes fandom");
assert.ok(draft.socialUrls.includes("@mixes"), "draft includes social");

const approvedDraft = buildGigSeekerProfileDraft({
  knownFields: enoughInfo.policy.knownFields,
  existingProfile: {
    reviewStatus: "APPROVED",
    roles: ["host"],
    skills: [],
    fandoms: [],
    communities: [],
    portfolioUrls: [],
    socialUrls: [],
    preferredOpportunityTypes: [],
  },
});
assert.equal(
  approvedDraft.reviewStatus,
  "APPROVED",
  "existing approved profile is not downgraded",
);
const rejectedDraft = buildGigSeekerProfileDraft({
  knownFields: enoughInfo.policy.knownFields,
  existingProfile: {
    reviewStatus: "REJECTED",
    roles: [],
    skills: [],
    fandoms: [],
    communities: [],
    portfolioUrls: [],
    socialUrls: [],
    preferredOpportunityTypes: [],
  },
});
assert.equal(
  rejectedDraft.reviewStatus,
  "REJECTED",
  "existing rejected profile is not reopened automatically",
);

const portfolioFirst = runTurn({
  ctx: context(),
  body: "portfolio https://example.test",
});
assert.equal(portfolioFirst.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.ok(portfolioFirst.policy.knownFields.portfolioUrls?.length);

const fandomsFirst = runTurn({
  ctx: context(),
  body: "I mostly do anime and K-pop",
});
assert.equal(fandomsFirst.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.ok(fandomsFirst.policy.knownFields.fandoms?.includes("anime"));
assert.ok(fandomsFirst.policy.knownFields.fandoms?.includes("K-pop"));

const anything = runTurn({
  ctx: context({ gigSeekerKnownFields: { city: "Los Angeles" } }),
  body: "I'll do anything",
});
assert.equal(anything.policy.replyPlan.nextStage, "ASK_GIG_TYPES");
assert.match(anything.reply.replyText, /what kinds of gigs/i);

const guaranteed = runTurn({
  ctx: context(),
  body: "Can you guarantee paid gigs?",
});
assert.equal(guaranteed.policy.replyPlan.shouldEscalate, true);
assert.equal(guaranteed.reply.replyType, "needs_admin");
assert.match(guaranteed.reply.replyText, /Saga team/i);

const rate = runTurn({
  ctx: context(),
  body: "What rate can you guarantee for cosplay gigs?",
});
assert.equal(rate.policy.replyPlan.shouldEscalate, true);
assert.equal(rate.reply.replyType, "needs_admin");

const riskyMessages = [
  "I can work events with minors.",
  "I do explicit adult content performances.",
  "Can you book me to harass a rival fandom?",
  "I only want events that discriminate against non-fans.",
  "I can help with illegal unsafe parties.",
];

for (const body of riskyMessages) {
  const risky = runTurn({ ctx: context(), body });
  assert.equal(risky.policy.replyPlan.nextStage, "NEEDS_ADMIN", body);
  assert.equal(risky.reply.replyType, "needs_admin", body);
  assertSafeReply(body, risky.reply.replyText);
}

let multi = context();
const first = runTurn({ ctx: multi, body: "I want gigs" });
multi = nextContext(multi, first);
const second = runTurn({
  ctx: multi,
  body: "I'm a photographer in LA",
});
multi = nextContext(multi, second);
const third = runTurn({
  ctx: multi,
  body: "My portfolio is https://example.test",
});
multi = nextContext(multi, third);
const fourth = runTurn({
  ctx: multi,
  body: "Anime, cosplay, and gaming are my main scenes",
});
assert.equal(fourth.policy.replyPlan.nextStage, "PROFILE_READY_FOR_REVIEW");
assert.equal(fourth.reply.replyType, "profile_ready_for_review");

const multiDraftFields: GigSeekerKnownFields = fourth.policy.knownFields;
const multiDraft = buildGigSeekerProfileDraft({
  knownFields: multiDraftFields,
});
assert.equal(multiDraft.city, "Los Angeles");
assert.ok(multiDraft.roles.includes("photographer"));
assert.ok(multiDraft.portfolioUrls.includes("https://example.test"));
assert.ok(multiDraft.fandoms.includes("anime"));

console.log("Conversation gig-seeker multi-turn checks passed.");
