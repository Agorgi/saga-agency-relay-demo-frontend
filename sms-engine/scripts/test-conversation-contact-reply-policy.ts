import assert from "node:assert/strict";
import type {
  ContactReplyKind,
  ContactReplyStage,
  ConversationContext,
} from "@/lib/conversation/conversationTypes";
import { generateContactReplyFromPlan } from "@/lib/conversation/contactReplyGenerator";
import { evaluateContactReplyPolicy } from "@/lib/conversation/contactReplyPolicy";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
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
    intent: "CONTACT_REPLY",
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
    currentStage: "OUTREACH_SENT",
    ...overrides,
  };
}

function outreachContext(
  status: string | null = "SENT",
  consentToGroupChat = false,
): ConversationContext {
  return context({
    contactId: "contact_1",
    activeOutreachId: "outreach_1",
    activeOutreach: {
      id: "outreach_1",
      status,
      consentToGroupChat,
      opportunityId: "opp_1",
      candidateRecommendationId: "rec_1",
      projectBriefId: "brief_1",
    },
    contact: { id: "contact_1", smsOptedOutAt: null },
    currentStage:
      status === "INTERESTED"
        ? "CONSENT_REQUESTED"
        : status === "APPROVED_FOR_GROUPCHAT"
          ? "CONSENT_CONFIRMED"
          : "OUTREACH_SENT",
  });
}

type Fixture = {
  name: string;
  body: string;
  ctx: ConversationContext;
  expectedKind: ContactReplyKind;
  expectedNextStage: ContactReplyStage;
  shouldEscalate?: boolean;
  expectedIntent?: string;
  replyMatch?: RegExp;
};

const noActive = context({ activeOutreach: null, activeOutreachId: null });
const active = outreachContext("SENT");
const consentRequested = outreachContext("INTERESTED", false);
const consentConfirmed = outreachContext("APPROVED_FOR_GROUPCHAT", true);
const optedOut = context({
  optedOut: true,
  activeOutreach: {
    id: "outreach_1",
    status: "SENT",
    consentToGroupChat: false,
    opportunityId: null,
    candidateRecommendationId: null,
    projectBriefId: "brief_1",
  },
  contact: { id: "contact_1", smsOptedOutAt: new Date().toISOString() },
  currentStage: "OPTED_OUT",
});

const fixtures: Fixture[] = [
  { name: "yes", body: "yes", ctx: active, expectedKind: "YES_INTERESTED", expectedNextStage: "INTERESTED", expectedIntent: "CONTACT_REPLY", replyMatch: /introduce/i },
  { name: "yes interested", body: "yes interested", ctx: active, expectedKind: "YES_INTERESTED", expectedNextStage: "INTERESTED" },
  { name: "sounds good", body: "sounds good", ctx: active, expectedKind: "YES_INTERESTED", expectedNextStage: "INTERESTED" },
  { name: "no", body: "no", ctx: active, expectedKind: "NO_DECLINED", expectedNextStage: "DECLINED" },
  { name: "no thanks", body: "no thanks", ctx: active, expectedKind: "NO_DECLINED", expectedNextStage: "DECLINED", replyMatch: /understood|thanks/i },
  { name: "maybe", body: "maybe", ctx: active, expectedKind: "MAYBE_INTERESTED", expectedNextStage: "MAYBE" },
  { name: "maybe depending date", body: "maybe depending on the date", ctx: active, expectedKind: "MAYBE_INTERESTED", expectedNextStage: "MAYBE" },
  { name: "tell me more", body: "tell me more", ctx: active, expectedKind: "QUESTION", expectedNextStage: "QUESTION_OR_CLARIFICATION" },
  { name: "what is this", body: "what is this?", ctx: active, expectedKind: "QUESTION", expectedNextStage: "QUESTION_OR_CLARIFICATION" },
  { name: "how much pay", body: "how much does it pay?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "is this paid", body: "is this paid?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "rate", body: "what is the rate?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "contract", body: "do I need to sign a contract?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "guarantee booked", body: "can you guarantee I'll get booked?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "consent yes", body: "yes", ctx: consentRequested, expectedKind: "CONSENT_YES", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "consent sure", body: "sure", ctx: consentRequested, expectedKind: "CONSENT_YES", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "consent go for it", body: "go for it", ctx: consentRequested, expectedKind: "CONSENT_YES", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "consent no", body: "no", ctx: consentRequested, expectedKind: "CONSENT_NO", expectedNextStage: "CONSENT_DECLINED" },
  { name: "consent not yet", body: "not yet", ctx: consentRequested, expectedKind: "CONSENT_NO", expectedNextStage: "CONSENT_DECLINED" },
  { name: "consent just info", body: "just send me info", ctx: consentRequested, expectedKind: "CONSENT_NO", expectedNextStage: "CONSENT_DECLINED" },
  { name: "no consent requested yes", body: "yes", ctx: active, expectedKind: "YES_INTERESTED", expectedNextStage: "INTERESTED" },
  { name: "already consent yes", body: "yes", ctx: consentConfirmed, expectedKind: "YES_INTERESTED", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "random yes no active", body: "yes", ctx: noActive, expectedKind: "UNKNOWN", expectedNextStage: "NO_ACTIVE_OUTREACH" },
  { name: "random maybe no active", body: "maybe", ctx: noActive, expectedKind: "UNKNOWN", expectedNextStage: "NO_ACTIVE_OUTREACH" },
  { name: "no active question", body: "what is this?", ctx: noActive, expectedKind: "UNKNOWN", expectedNextStage: "NO_ACTIVE_OUTREACH" },
  { name: "opted out stays opted out", body: "yes", ctx: optedOut, expectedKind: "YES_INTERESTED", expectedNextStage: "OPTED_OUT" },
  { name: "stop", body: "STOP", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "stopall", body: "STOPALL", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "unsubscribe", body: "UNSUBSCRIBE", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "cancel", body: "CANCEL", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "end", body: "END", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "quit", body: "QUIT", ctx: active, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "start", body: "START", ctx: active, expectedKind: "START", expectedNextStage: "OUTREACH_SENT", expectedIntent: "START_OR_OPT_IN" },
  { name: "unstop", body: "UNSTOP", ctx: active, expectedKind: "START", expectedNextStage: "OUTREACH_SENT", expectedIntent: "START_OR_OPT_IN" },
  { name: "help", body: "HELP", ctx: active, expectedKind: "HELP", expectedNextStage: "HELP_REQUESTED", expectedIntent: "HELP" },
  { name: "minors", body: "will minors be there?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "alcohol", body: "is there alcohol?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "security", body: "what is the security plan?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "permits", body: "are permits handled?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "weapons", body: "are weapons allowed?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "harassment", body: "can we harass rival fans?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "discrimination", body: "can it discriminate against non-fans?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "explicit", body: "is there explicit adult content?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "illegal", body: "is it an illegal unsafe party?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "availability", body: "what dates are they looking at?", ctx: active, expectedKind: "AVAILABILITY_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "unknown", body: "hmmmm", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "QUESTION_OR_CLARIFICATION" },
  { name: "active maybe info", body: "send info", ctx: active, expectedKind: "MAYBE_INTERESTED", expectedNextStage: "MAYBE" },
  { name: "active open to", body: "I'm open to it", ctx: active, expectedKind: "YES_INTERESTED", expectedNextStage: "INTERESTED" },
  { name: "active pass", body: "pass", ctx: active, expectedKind: "NO_DECLINED", expectedNextStage: "DECLINED" },
  { name: "consent introduce", body: "you can introduce me", ctx: consentRequested, expectedKind: "CONSENT_YES", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "consent add me", body: "add me", ctx: consentRequested, expectedKind: "CONSENT_YES", expectedNextStage: "CONSENT_CONFIRMED" },
  { name: "consent do not add", body: "don't add me", ctx: consentRequested, expectedKind: "CONSENT_NO", expectedNextStage: "CONSENT_DECLINED" },
  { name: "no active stop", body: "STOP", ctx: noActive, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "no active help", body: "HELP", ctx: noActive, expectedKind: "HELP", expectedNextStage: "HELP_REQUESTED", expectedIntent: "HELP" },
  { name: "no active payment", body: "how much does it pay?", ctx: noActive, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "yes with stop precedence", body: "STOP", ctx: consentRequested, expectedKind: "STOP", expectedNextStage: "OPTED_OUT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "start with yes not consent", body: "START", ctx: consentRequested, expectedKind: "START", expectedNextStage: "OUTREACH_SENT", expectedIntent: "START_OR_OPT_IN" },
  { name: "maybe not consent", body: "maybe", ctx: consentRequested, expectedKind: "MAYBE_INTERESTED", expectedNextStage: "MAYBE" },
  { name: "question consent prompt", body: "what project is this?", ctx: consentRequested, expectedKind: "QUESTION", expectedNextStage: "QUESTION_OR_CLARIFICATION" },
  { name: "booking promise", body: "will I get confirmed placement?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "venue access", body: "can you guarantee venue access?", ctx: active, expectedKind: "RATE_OR_PAYMENT_QUESTION", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
  { name: "celebrity", body: "will there be celebrity participation?", ctx: active, expectedKind: "UNKNOWN", expectedNextStage: "NEEDS_ADMIN", shouldEscalate: true },
];

assert.ok(fixtures.length >= 60, "Expected at least 60 contact reply fixtures.");

const forbiddenPromisePattern =
  /\b(guaranteed|guarantee|confirmed placement|confirmed team|confirmed booking|you will get|ticket sales|revenue|venue access|celebrity|influencer|paid work guaranteed)\b/i;

for (const fixture of fixtures) {
  const intent = classifyConversationIntent({
    body: fixture.body,
    context: fixture.ctx,
  });
  const policy = evaluateContactReplyPolicy({
    context: {
      ...fixture.ctx,
      intent: "CONTACT_REPLY",
      safetyFlags: intent.shouldEscalate ? intent.matchedSignals : [],
    },
    latestMessage: fixture.body,
  });
  const reply = generateContactReplyFromPlan({
    context: fixture.ctx,
    replyPlan: policy.replyPlan,
    latestMessage: fixture.body,
    replyKind: policy.replyKind,
  });

  if (fixture.expectedIntent) {
    assert.equal(intent.intent, fixture.expectedIntent, fixture.name);
  }
  assert.equal(policy.replyKind, fixture.expectedKind, fixture.name);
  assert.equal(policy.replyPlan.nextStage, fixture.expectedNextStage, fixture.name);
  if (fixture.shouldEscalate !== undefined) {
    assert.equal(policy.replyPlan.shouldEscalate, fixture.shouldEscalate, fixture.name);
  }
  if (!policy.hasActiveOutreach && !["STOP", "START", "HELP", "RATE_OR_PAYMENT_QUESTION", "AVAILABILITY_QUESTION"].includes(policy.replyKind)) {
    assert.equal(policy.replyKind, "UNKNOWN", `${fixture.name}: no active outreach cannot imply interest`);
  }
  if (policy.replyPlan.nextStage === "CONSENT_CONFIRMED") {
    assert.equal(
      fixture.ctx.activeOutreach?.status === "INTERESTED" ||
        fixture.ctx.activeOutreach?.consentToGroupChat,
      true,
      `${fixture.name}: consent requires active consent prompt`,
    );
  }
  assert.ok(
    policy.replyPlan.blockedActions.includes("create_group_chat"),
    `${fixture.name}: group chat remains blocked`,
  );
  assert.ok(
    policy.replyPlan.blockedActions.includes("add_to_team"),
    `${fixture.name}: team membership remains blocked`,
  );
  assert.ok(!forbiddenPromisePattern.test(reply.replyText), fixture.name);
  if (fixture.replyMatch) assert.match(reply.replyText, fixture.replyMatch, fixture.name);
}

console.log(
  `Conversation contact reply policy checks passed for ${fixtures.length} deterministic fixtures.`,
);
