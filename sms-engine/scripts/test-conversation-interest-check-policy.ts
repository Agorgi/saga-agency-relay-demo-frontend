import assert from "node:assert/strict";
import type { ConversationContext } from "@/lib/conversation/conversationTypes";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import { evaluateInterestCheckPolicy } from "@/lib/conversation/interestCheckPolicy";
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

type InterestStage =
  | "NEW"
  | "ASK_LOCATION"
  | "ASK_IDEA_SCOPE"
  | "ASK_FANDOM_OR_AUDIENCE"
  | "ASK_TIMING"
  | "ASK_INTEREST_SIGNAL"
  | "INTEREST_CHECK_READY"
  | "NEEDS_ADMIN";

type Fixture = {
  name: string;
  body: string;
  context?: ConversationContext;
  expectedNextStage: InterestStage;
  expectedIntent?: "INTEREST_CHECK" | "ORGANIZER_PROJECT_IDEA" | "UNKNOWN";
  shouldEscalate?: boolean;
  enoughInfoForInterestCheck?: boolean;
  missingIncludes?: string[];
  missingExcludes?: string[];
  expectedFandoms?: string[];
  expectedCity?: string;
  ambiguityIncludes?: string;
};

const requiredKnownContext = context({
  interestCheckKnownFields: {
    title: "Anime picnic",
    description: "Anime picnic",
    city: "Los Angeles",
    fandoms: ["anime"],
    communities: ["anime"],
  },
});

const cityKnownContext = context({
  interestCheckKnownFields: { city: "Los Angeles" },
});

const conceptCityContext = context({
  interestCheckKnownFields: {
    title: "Cupsleeve",
    description: "Cupsleeve",
    city: "New York City",
  },
});

const fixtures: Fixture[] = [
  {
    name: "love and deepspace picnic ready",
    body: "I wish someone would host a Love and Deepspace picnic in LA.",
    expectedNextStage: "INTEREST_CHECK_READY",
    expectedIntent: "INTEREST_CHECK",
    enoughInfoForInterestCheck: true,
    expectedCity: "Los Angeles",
    expectedFandoms: ["Love and Deepspace"],
  },
  {
    name: "one piece beach day asks location",
    body: "Would people come to a One Piece beach day?",
    expectedNextStage: "ASK_LOCATION",
    expectedIntent: "INTEREST_CHECK",
    missingIncludes: ["city"],
  },
  {
    name: "cosplay cafe asks location",
    body: "Can Saga see if people would be interested in a cosplay cafe night?",
    expectedNextStage: "ASK_LOCATION",
    expectedIntent: "INTEREST_CHECK",
    expectedFandoms: ["cosplay"],
  },
  {
    name: "jjk cupsleeve in nyc ready",
    body: "I'd go to a JJK cupsleeve in NYC if someone organized it.",
    expectedNextStage: "INTEREST_CHECK_READY",
    expectedIntent: "INTEREST_CHECK",
    enoughInfoForInterestCheck: true,
    expectedCity: "New York City",
    expectedFandoms: ["JJK"],
  },
  {
    name: "check anime rave interest ready",
    body: "Can you check if there's interest in an anime rave in LA?",
    expectedNextStage: "INTEREST_CHECK_READY",
    expectedIntent: "INTEREST_CHECK",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "does not want to host asks location",
    body: "I don't want to host it, but I think people would show up.",
    expectedNextStage: "ASK_LOCATION",
    expectedIntent: "INTEREST_CHECK",
    missingIncludes: ["city"],
  },
  {
    name: "kpop market asks location",
    body: "Someone should do a K-pop cosplay market.",
    expectedNextStage: "ASK_LOCATION",
    expectedIntent: "INTEREST_CHECK",
    expectedFandoms: ["K-pop", "cosplay"],
  },
  {
    name: "horror anime photoshoot asks location",
    body: "Would anyone be down for a horror anime photoshoot?",
    expectedNextStage: "ASK_LOCATION",
    expectedIntent: "INTEREST_CHECK",
    expectedFandoms: ["horror", "anime"],
  },
  {
    name: "gaming popup atlanta ready",
    body: "I want there to be a gaming pop-up in Atlanta.",
    expectedNextStage: "INTEREST_CHECK_READY",
    expectedIntent: "INTEREST_CHECK",
    enoughInfoForInterestCheck: true,
    expectedCity: "Atlanta",
  },
  {
    name: "organizer host remains organizer",
    body: "I want to host an anime picnic in LA",
    expectedNextStage: "ASK_INTEREST_SIGNAL",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    ambiguityIncludes: "organizer language",
  },
  {
    name: "wish host remains interest",
    body: "I wish someone would host an anime picnic in LA",
    expectedNextStage: "INTEREST_CHECK_READY",
    expectedIntent: "INTEREST_CHECK",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "might organize produces ambiguity",
    body: "I might organize it if people are interested.",
    context: requiredKnownContext,
    expectedNextStage: "INTEREST_CHECK_READY",
    ambiguityIncludes: "might organize",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "help me make it happen asks interest signal",
    body: "Can you help me make this happen?",
    context: requiredKnownContext,
    expectedNextStage: "ASK_INTEREST_SIGNAL",
    ambiguityIncludes: "help me make it happen",
  },
  {
    name: "idea no city",
    body: "Would people come to an anime craft night?",
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city"],
  },
  {
    name: "city vague idea asks concept",
    body: "LA maybe?",
    context: context({
      interestCheckKnownFields: { city: "Los Angeles", fandoms: ["anime"] },
    }),
    expectedNextStage: "ASK_IDEA_SCOPE",
    missingIncludes: ["ideaConcept"],
  },
  {
    name: "city concept no fandom asks audience",
    body: "A cupsleeve meetup.",
    context: cityKnownContext,
    expectedNextStage: "ASK_FANDOM_OR_AUDIENCE",
    missingIncludes: ["fandomOrAudience"],
  },
  {
    name: "format no audience asks location first",
    body: "Would anyone go to a cafe night?",
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "audience later makes ready",
    body: "JJK fans.",
    context: conceptCityContext,
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
    expectedFandoms: ["JJK"],
  },
  {
    name: "timing optional does not block readiness",
    body: "I wish someone would host a cosplay picnic in LA this summer.",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
    missingExcludes: ["proposedTiming"],
  },
  {
    name: "format optional does not block readiness",
    body: "Would people come to an anime thing in LA?",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "interest signal optional does not block readiness",
    body: "There should be a manga market in Brooklyn.",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "target audience inferred",
    body: "Can you check interest in a cafe night in LA for anime fans?",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "expected audience optional",
    body: "I wish someone would do a cosplay meetup in LA for 50 people.",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
    missingExcludes: ["expectedAudienceSize"],
  },
  {
    name: "guaranteed attendance escalates",
    body: "Can Saga guarantee attendance for an anime rave?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "guaranteed ticket sales escalates",
    body: "Can Saga guarantee 500 ticket sales?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "alcohol security permits escalates",
    body: "Can this include alcohol, security, and permits?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "minors escalates",
    body: "Would people come if minors attend?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "weapons escalates",
    body: "Would people bring weapons to a cosplay meetup?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "harassment escalates",
    body: "Someone should host a meetup to harass another fandom.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "discrimination escalates",
    body: "Would people come to an event that discriminates against non-fans?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "explicit escalates",
    body: "Can you check interest in explicit adult content?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "illegal unsafe escalates",
    body: "Would people come to an illegal unsafe warehouse rave?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "venue guarantee escalates",
    body: "Can Saga guarantee venue access if enough people want this?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "celebrity guarantee escalates",
    body: "Can Saga guarantee celebrity participation?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "city from context with idea audience ready",
    body: "Would people come to a One Piece beach day?",
    context: context({
      interestCheckKnownFields: { city: "Los Angeles" },
    }),
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "audience from context with idea city ready",
    body: "Would people come to a beach day in LA?",
    context: context({
      interestCheckKnownFields: { fandoms: ["One Piece"] },
    }),
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "concept from context with city audience ready",
    body: "In LA for anime fans.",
    context: context({
      interestCheckKnownFields: { title: "Cafe night", description: "Cafe night" },
    }),
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "unknown still can be policy-planned as missing location",
    body: "Maybe something cute?",
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city", "fandomOrAudience"],
  },
  {
    name: "comics market ready",
    body: "There should be a comics vendor market in Chicago.",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "fantasy photoshoot ready",
    body: "Would people come to a fantasy photoshoot in Seattle?",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "maid cafe popup ready",
    body: "Can Saga check interest in a maid cafe pop-up in NYC?",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
  {
    name: "no event promise wording",
    body: "I wish someone would host a K-pop party in LA.",
    expectedNextStage: "INTEREST_CHECK_READY",
    enoughInfoForInterestCheck: true,
  },
];

assert.ok(fixtures.length >= 40, "Expected at least 40 interest-check fixtures.");

const forbiddenPromisePattern =
  /\b(will happen|guarantee|guaranteed|confirmed venue|confirmed team|ticket sales|revenue|we will find an organizer|we'll find an organizer|promise)\b/i;

for (const fixture of fixtures) {
  const ctx = fixture.context || context();
  const classification = classifyConversationIntent({
    body: fixture.body,
    context: ctx,
  });
  const policy = evaluateInterestCheckPolicy({
    context: {
      ...ctx,
      intent: "INTEREST_CHECK",
      safetyFlags: classification.shouldEscalate
        ? classification.matchedSignals
        : [],
    },
    latestMessage: fixture.body,
  });

  if (fixture.expectedIntent) {
    assert.equal(
      classification.intent,
      fixture.expectedIntent,
      `${fixture.name}: expected intent ${fixture.expectedIntent}, got ${classification.intent}`,
    );
  }
  assert.equal(
    policy.replyPlan.nextStage,
    fixture.expectedNextStage,
    `${fixture.name}: expected ${fixture.expectedNextStage}, got ${policy.replyPlan.nextStage}`,
  );
  if (fixture.shouldEscalate !== undefined) {
    assert.equal(
      policy.replyPlan.shouldEscalate,
      fixture.shouldEscalate,
      `${fixture.name}: unexpected escalation value`,
    );
  }
  if (fixture.enoughInfoForInterestCheck !== undefined) {
    assert.equal(
      policy.replyPlan.enoughInfoForInterestCheck,
      fixture.enoughInfoForInterestCheck,
      `${fixture.name}: unexpected interest-check readiness`,
    );
  }
  for (const field of fixture.missingIncludes || []) {
    assert.ok(
      policy.missingRequiredFields.includes(field) ||
        policy.missingOptionalFields.includes(field),
      `${fixture.name}: expected missing field ${field}`,
    );
  }
  for (const field of fixture.missingExcludes || []) {
    assert.ok(
      !policy.missingRequiredFields.includes(field) &&
        !policy.missingOptionalFields.includes(field),
      `${fixture.name}: did not expect missing field ${field}`,
    );
  }
  for (const fandom of fixture.expectedFandoms || []) {
    assert.ok(
      policy.knownFields.fandoms?.includes(fandom),
      `${fixture.name}: expected fandom ${fandom}`,
    );
  }
  if (fixture.expectedCity) {
    assert.equal(policy.knownFields.city, fixture.expectedCity, fixture.name);
  }
  if (fixture.ambiguityIncludes) {
    assert.ok(
      policy.ambiguityNotes.some((note) =>
        note.toLowerCase().includes(fixture.ambiguityIncludes!.toLowerCase()),
      ),
      `${fixture.name}: expected ambiguity note containing ${fixture.ambiguityIncludes}`,
    );
  }
  if (policy.replyPlan.nextQuestion) {
    assert.ok(
      policy.replyPlan.nextQuestion.length <= 280,
      `${fixture.name}: next question should be concise`,
    );
    assert.ok(
      !forbiddenPromisePattern.test(policy.replyPlan.nextQuestion),
      `${fixture.name}: next question should not promise outcomes`,
    );
  }
  assert.ok(
    policy.replyPlan.allowedActions.includes("audit_reply_plan") ||
      policy.replyPlan.allowedActions.includes("audit_escalation"),
    `${fixture.name}: reply plan stays auditable`,
  );
  assert.ok(
    policy.replyPlan.blockedActions.includes("convert_interest_check_to_project"),
    `${fixture.name}: conversion remains blocked in shadow mode`,
  );
  assert.ok(
    policy.replyPlan.blockedActions.includes("touch_ticketing_or_rsvp"),
    `${fixture.name}: ticketing/RSVP remains blocked`,
  );
}

console.log(
  `Conversation interest-check policy checks passed for ${fixtures.length} deterministic fixtures.`,
);
