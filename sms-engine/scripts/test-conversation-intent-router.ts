import assert from "node:assert/strict";
import type { ConversationContext } from "@/sms-engine/conversation/conversationTypes";
import { classifyConversationIntent } from "@/sms-engine/conversation/intentRouter";
import { redactForLog } from "@/sms-engine/safeLogging";

process.on("uncaughtException", (error) => {
  console.error(redactForLog(error));
  process.exit(1);
});

function context(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    normalizedPhone: "+15550100000",
    intent: "UNKNOWN",
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

const activeContactContext: ConversationContext = context({
  normalizedPhone: "+15550100001",
  contact: { id: "contact_test" },
  activeOutreach: {
    id: "outreach_test",
    status: "SENT",
    consentToGroupChat: false,
  },
});

const knownContactContext: ConversationContext = context({
  normalizedPhone: "+15550100002",
  contact: { id: "contact_known" },
});

const noContext: ConversationContext = context({
  normalizedPhone: "+15550100003",
});

type Fixture = {
  name: string;
  body: string;
  expectedIntent:
    | "ORGANIZER_PROJECT_IDEA"
    | "GIG_SEEKER_ONBOARDING"
    | "CONTACT_REPLY"
    | "INTEREST_CHECK"
    | "CAPABILITY_FAQ"
    | "STOP_OR_OPT_OUT"
    | "START_OR_OPT_IN"
    | "HELP"
    | "SAFETY_ESCALATION"
    | "UNKNOWN";
  context?: ConversationContext;
  minConfidence?: number;
  shouldEscalate?: boolean;
};

const fixtures: Fixture[] = [
  {
    name: "stop",
    body: "STOP",
    expectedIntent: "STOP_OR_OPT_OUT",
    minConfidence: 1,
  },
  {
    name: "stopall",
    body: "STOPALL",
    expectedIntent: "STOP_OR_OPT_OUT",
    minConfidence: 1,
  },
  {
    name: "unsubscribe",
    body: "unsubscribe",
    expectedIntent: "STOP_OR_OPT_OUT",
  },
  { name: "cancel", body: "CANCEL", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "end", body: "END", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "quit", body: "QUIT", expectedIntent: "STOP_OR_OPT_OUT" },
  { name: "start", body: "START", expectedIntent: "START_OR_OPT_IN" },
  { name: "unstop", body: "UNSTOP", expectedIntent: "START_OR_OPT_IN" },
  { name: "help", body: "HELP", expectedIntent: "HELP" },
  { name: "help me", body: "help me", expectedIntent: "HELP" },
  {
    name: "organizer anime rave",
    body: "I want to throw an anime rave in LA for 200 people.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    minConfidence: 0.7,
  },
  {
    name: "organizer photoshoot",
    body: "I want to produce a creator photoshoot in Brooklyn.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "organizer pop-up",
    body: "We are planning to host a gaming pop-up in Atlanta.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "organizer meetup",
    body: "Trying to put together a cosplay meetup this summer.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "organizer launch party",
    body: "We want to do a brand launch party downtown.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "vague organizer project",
    body: "I have a project idea for a community creator night.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "gig seeker generic",
    body: "I want gigs with Saga.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "looking for gigs",
    body: "I'm looking for gigs around anime events.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "book me",
    body: "Book me for cosplay appearances.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "photographer",
    body: "I'm a photographer in LA.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "cosplayer",
    body: "I am a cosplayer looking for con gigs.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "dj",
    body: "I'm a DJ available for anime parties.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "artist",
    body: "I'm an illustrator and designer available for events.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "paid maid cafe gigs",
    body: "I want paid maid cafe gigs in NYC.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
    shouldEscalate: false,
  },
  {
    name: "paid cosplay gigs",
    body: "Looking for paid cosplay gigs in LA.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
    shouldEscalate: false,
  },
  {
    name: "join network question",
    body: "How do I join the network?",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "book me question",
    body: "Can Saga book me for anime events?",
    expectedIntent: "CAPABILITY_FAQ",
    shouldEscalate: false,
  },
  {
    name: "capability what do you do",
    body: "What do you do?",
    expectedIntent: "CAPABILITY_FAQ",
    shouldEscalate: false,
  },
  {
    name: "capability talent search",
    body: "Can you find me a photographer?",
    expectedIntent: "CAPABILITY_FAQ",
    shouldEscalate: false,
  },
  {
    name: "capability booking guarantee",
    body: "Can you guarantee I'll get booked?",
    expectedIntent: "CAPABILITY_FAQ",
    shouldEscalate: true,
  },
  {
    name: "host photography meetup stays organizer",
    body: "I want to host a photography meetup in LA.",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
  },
  {
    name: "photographer looking for gigs stays gig seeker",
    body: "I am a photographer looking for gigs in LA.",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
  },
  {
    name: "interest check explicit",
    body: "Interest check: would people come to a horror manga picnic?",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "wish someone would",
    body: "I wish someone would host an anime picnic in LA.",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "can saga check interest",
    body: "Can Saga check interest in a cosplay cafe night?",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "would attend if organized",
    body: "I'd go to a JJK cupsleeve in NYC if someone organized it.",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "do not want to host",
    body: "I don't want to host it, but I think people would show up.",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "want there to be",
    body: "I want there to be a gaming pop-up in Atlanta.",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "wish existed",
    body: "I wish someone would host a K-pop cosplay picnic.",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "can someone host",
    body: "Can someone host a gaming swap meet in Queens?",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "would people attend",
    body: "Would people be interested in a cozy anime craft night?",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "if enough people",
    body: "If enough people want this to exist, can Saga help?",
    expectedIntent: "INTEREST_CHECK",
  },
  {
    name: "contact yes active",
    body: "YES sounds good",
    context: activeContactContext,
    expectedIntent: "CONTACT_REPLY",
  },
  {
    name: "contact no active",
    body: "No thanks",
    context: activeContactContext,
    expectedIntent: "CONTACT_REPLY",
  },
  {
    name: "contact maybe active",
    body: "Maybe, send more info",
    context: activeContactContext,
    expectedIntent: "CONTACT_REPLY",
  },
  {
    name: "contact unclear active",
    body: "What is this?",
    context: activeContactContext,
    expectedIntent: "CONTACT_REPLY",
  },
  {
    name: "known contact yes",
    body: "yeah I'm open",
    context: knownContactContext,
    expectedIntent: "CONTACT_REPLY",
  },
  {
    name: "yes without context",
    body: "YES sounds good",
    context: noContext,
    expectedIntent: "UNKNOWN",
  },
  {
    name: "maybe without context",
    body: "maybe send info",
    context: noContext,
    expectedIntent: "UNKNOWN",
  },
  {
    name: "rate question",
    body: "What rate can you guarantee for this booking?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "contract",
    body: "Should I sign this contract and pay the deposit?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "permit",
    body: "Can you handle permits and insurance?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "alcohol",
    body: "Can we serve alcohol at this party?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "security",
    body: "We need security and medical support.",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "minors",
    body: "There may be minors attending.",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "weapons",
    body: "Can people bring prop weapons?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "harassment",
    body: "I want to harass a rival fandom.",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "discrimination",
    body: "Can we discriminate against non-fans?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "explicit",
    body: "This includes explicit sexual content.",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "guaranteed sales",
    body: "Can Saga guarantee 500 ticket sales?",
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "contact safety active",
    body: "YES, but can you guarantee my payment?",
    context: activeContactContext,
    expectedIntent: "SAFETY_ESCALATION",
    shouldEscalate: true,
  },
  {
    name: "stop precedence over safety",
    body: "STOP",
    context: activeContactContext,
    expectedIntent: "STOP_OR_OPT_OUT",
    shouldEscalate: false,
  },
  {
    name: "help precedence over contact",
    body: "HELP",
    context: activeContactContext,
    expectedIntent: "HELP",
    shouldEscalate: false,
  },
  {
    name: "unknown weather",
    body: "What is the weather tomorrow?",
    expectedIntent: "UNKNOWN",
  },
  {
    name: "unknown greeting",
    body: "hi",
    expectedIntent: "UNKNOWN",
  },
  {
    name: "unknown blank-ish",
    body: "   ",
    expectedIntent: "UNKNOWN",
  },
  {
    name: "unknown support vague",
    body: "Can you tell me more?",
    expectedIntent: "UNKNOWN",
  },
];

assert.ok(fixtures.length >= 50, "Expected at least 50 intent fixtures.");

for (const fixture of fixtures) {
  const classification = classifyConversationIntent({
    body: fixture.body,
    context: fixture.context,
  });

  assert.equal(
    classification.intent,
    fixture.expectedIntent,
    `${fixture.name}: expected ${fixture.expectedIntent}, got ${classification.intent}`,
  );
  assert.ok(
    classification.confidence >= (fixture.minConfidence ?? 0.2),
    `${fixture.name}: confidence too low (${classification.confidence})`,
  );
  if (fixture.shouldEscalate !== undefined) {
    assert.equal(
      classification.shouldEscalate,
      fixture.shouldEscalate,
      `${fixture.name}: unexpected escalation value`,
    );
  }
  assert.ok(
    classification.reasons.length > 0,
    `${fixture.name}: expected at least one reason`,
  );
}

console.log(
  `Conversation intent router checks passed for ${fixtures.length} deterministic fixtures.`,
);
