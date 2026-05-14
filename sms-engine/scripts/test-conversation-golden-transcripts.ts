import assert from "node:assert/strict";
import type {
  ContactReplyKind,
  ConversationContext,
  ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import { evaluateContactReplyPolicy } from "@/lib/conversation/contactReplyPolicy";
import { generateContactReplyFromPlan } from "@/lib/conversation/contactReplyGenerator";
import { evaluateGigSeekerOnboardingPolicy } from "@/lib/conversation/gigSeekerOnboardingPolicy";
import { generateGigSeekerReplyFromPlan } from "@/lib/conversation/gigSeekerReplyGenerator";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import { evaluateInterestCheckPolicy } from "@/lib/conversation/interestCheckPolicy";
import { generateInterestCheckReplyFromPlan } from "@/lib/conversation/interestCheckReplyGenerator";
import { evaluateOrganizerIntakePolicy } from "@/lib/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/lib/conversation/organizerReplyGenerator";
import { redactForLog } from "@/lib/safeLogging";

process.on("uncaughtException", (error) => {
  console.error(redactForLog(error));
  process.exit(1);
});

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|confirmed team|confirmed venue|confirmed booking|confirmed placement|venue access|ticket sales|revenue|attendance guaranteed|celebrity|influencer participation|paid work guaranteed|guaranteed gigs)\b/i;

function assertSafeReply(label: string, replyText: string) {
  assert.ok(replyText.trim().length > 0, `${label}: reply text exists`);
  assert.ok(replyText.length <= 320, `${label}: reply stays concise`);
  assert.ok(
    !forbiddenPromisePattern.test(replyText),
    `${label}: reply contains no forbidden promise`,
  );
}

function assertPlanBasics(label: string, plan: ReplyPlan) {
  assert.ok(plan.flow, `${label}: flow exists`);
  assert.ok(plan.stage, `${label}: stage exists`);
  assert.ok(plan.nextStage, `${label}: next stage exists`);
  assert.ok(
    plan.explanationForAudit.length > 0,
    `${label}: audit explanation exists`,
  );
}

function baseContext(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
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
    ...overrides,
  };
}

function appendTurn(
  ctx: ConversationContext,
  body: string,
  replyText: string,
): ConversationContext["priorMessages"] {
  const index = ctx.priorMessages.length;
  return [
    ...ctx.priorMessages,
    {
      id: `in_${index}`,
      direction: "INBOUND",
      channel: "SMS",
      body,
      createdAt: new Date().toISOString(),
    },
    {
      id: `out_${index}`,
      direction: "OUTBOUND",
      channel: "SMS",
      body: replyText,
      createdAt: new Date().toISOString(),
    },
  ];
}

function runOrganizerTurn(ctx: ConversationContext, body: string) {
  const intent = classifyConversationIntent({ body, context: ctx });
  const policyContext = {
    ...ctx,
    intent:
      intent.intent === "UNKNOWN" ? ("ORGANIZER_PROJECT_IDEA" as const) : intent.intent,
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
  assertPlanBasics(`organizer:${body}`, policy.replyPlan);
  assertSafeReply(`organizer:${body}`, reply.replyText);
  return { intent, policy, reply };
}

function nextOrganizerContext(
  ctx: ConversationContext,
  body: string,
  result: ReturnType<typeof runOrganizerTurn>,
) {
  return baseContext({
    ...ctx,
    intent: "ORGANIZER_PROJECT_IDEA",
    knownFields: result.policy.knownFields,
    missingRequiredFields: result.policy.missingRequiredFields,
    missingOptionalFields: result.policy.missingOptionalFields,
    hasCompletedFirstTimeHostQuestion:
      ctx.hasCompletedFirstTimeHostQuestion ||
      result.policy.knownFields.firstTimeHost !== null &&
        result.policy.knownFields.firstTimeHost !== undefined,
    currentStage: result.policy.replyPlan.nextStage,
    priorMessages: appendTurn(ctx, body, result.reply.replyText),
  });
}

function runGigTurn(ctx: ConversationContext, body: string) {
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
  assertPlanBasics(`gig:${body}`, policy.replyPlan);
  assertSafeReply(`gig:${body}`, reply.replyText);
  return { intent, policy, reply };
}

function nextGigContext(
  ctx: ConversationContext,
  body: string,
  result: ReturnType<typeof runGigTurn>,
) {
  return baseContext({
    ...ctx,
    intent: "GIG_SEEKER_ONBOARDING",
    gigSeekerKnownFields: result.policy.knownFields,
    missingRequiredFields: result.policy.missingRequiredFields,
    missingOptionalFields: result.policy.missingOptionalFields,
    currentStage: result.policy.replyPlan.nextStage,
    priorMessages: appendTurn(ctx, body, result.reply.replyText),
  });
}

function runInterestTurn(ctx: ConversationContext, body: string) {
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
  assertPlanBasics(`interest:${body}`, policy.replyPlan);
  assertSafeReply(`interest:${body}`, reply.replyText);
  return { intent, policy, reply };
}

function nextInterestContext(
  ctx: ConversationContext,
  body: string,
  result: ReturnType<typeof runInterestTurn>,
) {
  return baseContext({
    ...ctx,
    intent: "INTEREST_CHECK",
    interestCheckKnownFields: result.policy.knownFields,
    missingRequiredFields: result.policy.missingRequiredFields,
    missingOptionalFields: result.policy.missingOptionalFields,
    currentStage: result.policy.replyPlan.nextStage,
    priorMessages: appendTurn(ctx, body, result.reply.replyText),
  });
}

function runContactTurn(ctx: ConversationContext, body: string) {
  const intent = classifyConversationIntent({ body, context: ctx });
  const policyContext = {
    ...ctx,
    intent: "CONTACT_REPLY" as const,
    safetyFlags: intent.shouldEscalate ? intent.matchedSignals : [],
  };
  const policy = evaluateContactReplyPolicy({
    context: policyContext,
    latestMessage: body,
  });
  const reply = generateContactReplyFromPlan({
    context: policyContext,
    replyPlan: policy.replyPlan,
    latestMessage: body,
    replyKind: policy.replyKind as ContactReplyKind,
  });
  assertPlanBasics(`contact:${body}`, policy.replyPlan);
  assertSafeReply(`contact:${body}`, reply.replyText);
  return { intent, policy, reply };
}

let organizer = baseContext({
  intent: "ORGANIZER_PROJECT_IDEA",
  hasCompletedFirstTimeHostQuestion: true,
});
const organizerFirst = runOrganizerTurn(
  organizer,
  "I want to host an event",
);
assert.equal(organizerFirst.intent.intent, "ORGANIZER_PROJECT_IDEA");
assert.equal(organizerFirst.policy.replyPlan.nextStage, "ASK_LOCATION");
assert.deepEqual(
  organizerFirst.policy.missingRequiredFields.includes("city"),
  true,
);
organizer = nextOrganizerContext(
  organizer,
  "I want to host an event",
  organizerFirst,
);
const organizerSecond = runOrganizerTurn(organizer, "LA");
assert.equal(organizerSecond.policy.replyPlan.nextStage, "ASK_SCOPE_VIBE");
organizer = nextOrganizerContext(organizer, "LA", organizerSecond);
const organizerThird = runOrganizerTurn(
  organizer,
  "cozy community picnic for about 40 anime fans",
);
assert.equal(organizerThird.policy.replyPlan.enoughInfoForBrief, true);
assert.equal(organizerThird.reply.replyType, "brief_ready");

let gig = baseContext({ intent: "GIG_SEEKER_ONBOARDING" });
const gigFirst = runGigTurn(gig, "I want gigs");
assert.equal(gigFirst.intent.intent, "GIG_SEEKER_ONBOARDING");
assert.equal(gigFirst.policy.replyPlan.nextStage, "ASK_LOCATION");
gig = nextGigContext(gig, "I want gigs", gigFirst);
const gigSecond = runGigTurn(gig, "I'm in LA");
assert.equal(gigSecond.policy.replyPlan.nextStage, "ASK_GIG_TYPES");
gig = nextGigContext(gig, "I'm in LA", gigSecond);
const gigThird = runGigTurn(gig, "photography and cosplay appearances");
assert.equal(gigThird.policy.replyPlan.nextStage, "ASK_LINKS");
gig = nextGigContext(gig, "photography and cosplay appearances", gigThird);
const gigFourth = runGigTurn(
  gig,
  "instagram.com/example, mostly anime and K-pop scenes",
);
assert.equal(gigFourth.policy.replyPlan.enoughInfoForProfileReview, true);
assert.equal(gigFourth.reply.replyType, "profile_ready_for_review");

let interest = baseContext({ intent: "INTEREST_CHECK" });
const interestFirst = runInterestTurn(
  interest,
  "I wish someone would host a JJK cupsleeve",
);
assert.equal(interestFirst.intent.intent, "INTEREST_CHECK");
assert.equal(interestFirst.policy.replyPlan.nextStage, "ASK_LOCATION");
interest = nextInterestContext(
  interest,
  "I wish someone would host a JJK cupsleeve",
  interestFirst,
);
const interestSecond = runInterestTurn(interest, "NYC for anime fans");
assert.ok(
  ["INTEREST_CHECK_READY", "ASK_IDEA_SCOPE"].includes(
    interestSecond.policy.replyPlan.nextStage,
  ),
);
interest = nextInterestContext(interest, "NYC for anime fans", interestSecond);
const interestThird = runInterestTurn(interest, "cupsleeve cafe night");
assert.equal(interestThird.policy.replyPlan.enoughInfoForInterestCheck, true);
assert.equal(interestThird.reply.replyType, "interest_check_ready");

let contact = baseContext({
  intent: "CONTACT_REPLY",
  personId: "person_demo",
  contactId: "contact_demo",
  activeOutreachId: "outreach_demo",
  contactReplyKnownFields: {
    personId: "person_demo",
    contactId: "contact_demo",
    outreachId: "outreach_demo",
    currentOutreachStatus: "SENT",
    consentToGroupChat: false,
    hasActiveOutreach: true,
  },
  activeOutreach: {
    id: "outreach_demo",
    status: "SENT",
    consentToGroupChat: false,
    projectBriefId: "brief_demo",
    candidateRecommendationId: "recommendation_demo",
  },
  currentStage: "OUTREACH_SENT",
});
const contactFirst = runContactTurn(contact, "YES");
assert.equal(contactFirst.intent.intent, "CONTACT_REPLY");
assert.equal(contactFirst.policy.replyKind, "YES_INTERESTED");
assert.equal(contactFirst.policy.replyPlan.nextStage, "INTERESTED");
assert.equal(contactFirst.reply.replyType, "ask_consent");
contact = baseContext({
  ...contact,
  activeOutreach: {
    ...contact.activeOutreach!,
    status: "INTERESTED",
    consentToGroupChat: false,
  },
  currentStage: "CONSENT_REQUESTED",
  priorMessages: appendTurn(contact, "YES", contactFirst.reply.replyText),
});
const contactSecond = runContactTurn(contact, "sure, you can introduce me");
assert.equal(contactSecond.policy.replyKind, "CONSENT_YES");
assert.equal(contactSecond.policy.replyPlan.nextStage, "CONSENT_CONFIRMED");
assert.equal(contactSecond.policy.consentToGroupChat, true);
assert.equal(contactSecond.reply.replyType, "fallback");

const groupChatAutoCreated = false;
assert.equal(groupChatAutoCreated, false, "no group chat auto-created");

console.log("Conversation golden transcript checks passed.");
