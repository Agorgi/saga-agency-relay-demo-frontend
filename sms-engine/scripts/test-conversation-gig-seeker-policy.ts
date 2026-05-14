import assert from "node:assert/strict";
import type { ConversationContext } from "@/sms-engine/conversation/conversationTypes";
import { classifyConversationIntent } from "@/sms-engine/conversation/intentRouter";
import { evaluateGigSeekerOnboardingPolicy } from "@/sms-engine/conversation/gigSeekerOnboardingPolicy";
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

type GigSeekerStage =
  | "NEW"
  | "ASK_LOCATION"
  | "ASK_GIG_TYPES"
  | "ASK_SKILLS"
  | "ASK_FANDOMS"
  | "ASK_LINKS"
  | "ASK_AVAILABILITY"
  | "PROFILE_READY_FOR_REVIEW"
  | "NEEDS_ADMIN";

type Fixture = {
  name: string;
  body: string;
  context?: ConversationContext;
  expectedNextStage: GigSeekerStage;
  shouldEscalate?: boolean;
  enoughInfoForProfileReview?: boolean;
  missingIncludes?: string[];
  missingExcludes?: string[];
  expectedRoles?: string[];
  expectedFandoms?: string[];
  expectedCity?: string;
};

const readyContext = context({
  gigSeekerKnownFields: {
    city: "Los Angeles",
    desiredRoles: ["photographer"],
    skills: ["photography"],
    fandoms: ["anime"],
    socialUrls: ["@photo"],
    compensationPreference: "unknown",
  },
});

const cityKnownContext = context({
  gigSeekerKnownFields: { city: "Los Angeles" },
});

const roleKnownContext = context({
  gigSeekerKnownFields: {
    desiredRoles: ["DJ"],
    skills: ["DJing"],
  },
});

const linkKnownContext = context({
  gigSeekerKnownFields: {
    socialUrls: ["@creator"],
  },
});

const cityRoleLinkContext = context({
  gigSeekerKnownFields: {
    city: "Los Angeles",
    desiredRoles: ["cosplayer"],
    socialUrls: ["@cosplay"],
  },
});

const fixtures: Fixture[] = [
  {
    name: "generic wants gigs asks location",
    body: "I want gigs",
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city"],
  },
  {
    name: "paid cosplay gigs without city asks location",
    body: "I'm looking for paid cosplay gigs",
    expectedNextStage: "ASK_LOCATION",
    expectedRoles: ["cosplayer"],
  },
  {
    name: "photographer in LA asks for links",
    body: "I'm a photographer in LA",
    expectedNextStage: "ASK_LINKS",
    expectedCity: "Los Angeles",
    expectedRoles: ["photographer"],
  },
  {
    name: "maid cafe gigs asks location",
    body: "I want maid cafe gigs",
    expectedNextStage: "ASK_LOCATION",
    expectedRoles: ["maid cafe performer"],
  },
  {
    name: "join network asks location",
    body: "How do I join the network?",
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "book me is self-directed and asks location",
    body: "Can Saga book me for anime events?",
    expectedNextStage: "ASK_LOCATION",
    shouldEscalate: false,
    expectedFandoms: ["anime"],
  },
  {
    name: "photographer role",
    body: "photographer available for conventions",
    context: cityKnownContext,
    expectedNextStage: "ASK_LINKS",
    expectedRoles: ["photographer"],
  },
  {
    name: "videographer role",
    body: "I am a videographer in NYC with anime event experience",
    expectedNextStage: "ASK_LINKS",
    expectedRoles: ["videographer"],
  },
  {
    name: "cosplayer role",
    body: "I'm a cosplayer in LA @cosplay with anime experience",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["cosplayer"],
  },
  {
    name: "dj role",
    body: "I'm a DJ in Atlanta @mixes and I know gaming events",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["DJ"],
  },
  {
    name: "illustrator role",
    body: "Illustrator in Chicago, portfolio https://example.test, comics fan",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["illustrator"],
  },
  {
    name: "graphic designer role",
    body: "Graphic designer based in Seattle @design for K-pop events",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["graphic designer"],
  },
  {
    name: "host role",
    body: "Host and MC in Austin @host, anime and gaming communities",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["host"],
  },
  {
    name: "vendor role",
    body: "Vendor booth support in Portland @vendor, cosplay markets",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["vendor"],
  },
  {
    name: "volunteer role",
    body: "Volunteer in Miami with experience helping horror pop-ups",
    expectedNextStage: "ASK_LINKS",
    expectedRoles: ["volunteer"],
  },
  {
    name: "venue owner role",
    body: "I own a venue in Boston @space and host comics events",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["venue owner", "host"],
  },
  {
    name: "production assistant role",
    body: "Production assistant in Dallas @pa for anime events",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    expectedRoles: ["production assistant"],
  },
  {
    name: "role city instagram asks fandom",
    body: "I'm a DJ in LA @dj",
    expectedNextStage: "ASK_FANDOMS",
    missingIncludes: ["fandoms"],
  },
  {
    name: "role city instagram fandom ready",
    body: "I'm a DJ in LA @dj for anime and cosplay parties",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
  },
  {
    name: "fandoms first with context ready",
    body: "Anime, manga, and cosplay are my main scenes",
    context: cityRoleLinkContext,
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
  },
  {
    name: "portfolio but no city",
    body: "portfolio https://example.test, I shoot cosplay events",
    context: roleKnownContext,
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city"],
  },
  {
    name: "city but no role",
    body: "I'm based in Denver",
    context: linkKnownContext,
    expectedNextStage: "ASK_GIG_TYPES",
    missingIncludes: ["desiredRoles"],
  },
  {
    name: "anything with city asks role",
    body: "I'll do anything",
    context: cityKnownContext,
    expectedNextStage: "ASK_GIG_TYPES",
  },
  {
    name: "self description can replace links but still asks fandom",
    body:
      "I'm an experienced photographer in LA who shoots community events and creator portraits.",
    expectedNextStage: "ASK_FANDOMS",
    missingExcludes: ["portfolioOrSelfDescription"],
  },
  {
    name: "paid only preference captured",
    body: "I am a cosplayer in LA @cosplay anime, paid gigs only",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    missingExcludes: ["compensationPreference"],
  },
  {
    name: "paid or collab preference captured",
    body: "Photographer in NYC @photo, anime events, paid or collab is okay",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    missingExcludes: ["compensationPreference"],
  },
  {
    name: "volunteer collab preference captured",
    body: "Volunteer in LA @volunteer for cosplay events, collab is okay",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    missingExcludes: ["compensationPreference"],
  },
  {
    name: "availability captured",
    body: "I'm available weekends as a photographer in LA @photo anime",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
    missingExcludes: ["availabilityNotes"],
  },
  {
    name: "existing ready context stays ready",
    body: "Sounds good",
    context: readyContext,
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
  },
  {
    name: "missing link after city role fandom",
    body: "I am a cosplayer in LA for anime events",
    expectedNextStage: "ASK_LINKS",
    missingIncludes: ["portfolioOrSelfDescription"],
  },
  {
    name: "guaranteed paid work escalates",
    body: "Can you guarantee paid work for me?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "money amount escalates",
    body: "How much money will I make?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "contract escalates",
    body: "Should I sign this contract?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "minors escalates",
    body: "I can work events with minors.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "explicit content escalates",
    body: "I do explicit adult content performances.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "harassment escalates",
    body: "Can you book me to harass a rival fandom?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "discrimination escalates",
    body: "I only want events that discriminate against non-fans.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "illegal unsafe escalates",
    body: "I can help with illegal unsafe parties.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "permit escalates",
    body: "Can you tell me if I need permits as a performer?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "weapon escalates",
    body: "I perform with prop weapons.",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "rate notes escalate when asking firm terms",
    body: "What rate can you guarantee for cosplay gigs?",
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "vague role request with city",
    body: "I want to help events in LA",
    expectedNextStage: "ASK_GIG_TYPES",
  },
  {
    name: "portfolio word without url counts as link signal",
    body: "I'm a designer in LA with a portfolio and I love anime",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
  },
  {
    name: "website word without url counts as link signal",
    body: "I'm a photographer in NYC with a website for cosplay shoots",
    expectedNextStage: "PROFILE_READY_FOR_REVIEW",
    enoughInfoForProfileReview: true,
  },
];

assert.ok(fixtures.length >= 40, "Expected at least 40 gig-seeker fixtures.");

const forbiddenPromisePattern =
  /\b(we (?:will|can) book|you will get|guaranteed paid work|guaranteed gigs|confirmed placement|confirmed booking|guarantee revenue|guarantee bookings)\b/i;

for (const fixture of fixtures) {
  const ctx = fixture.context || context();
  const classification = classifyConversationIntent({
    body: fixture.body,
    context: ctx,
  });
  const policy = evaluateGigSeekerOnboardingPolicy({
    context: {
      ...ctx,
      intent:
        classification.intent === "GIG_SEEKER_ONBOARDING"
          ? classification.intent
          : "GIG_SEEKER_ONBOARDING",
      safetyFlags: classification.shouldEscalate
        ? classification.matchedSignals
        : [],
    },
    latestMessage: fixture.body,
  });

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
  if (fixture.enoughInfoForProfileReview !== undefined) {
    assert.equal(
      policy.replyPlan.enoughInfoForProfileReview,
      fixture.enoughInfoForProfileReview,
      `${fixture.name}: unexpected profile-review readiness`,
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
  for (const role of fixture.expectedRoles || []) {
    assert.ok(
      policy.knownFields.desiredRoles?.includes(role),
      `${fixture.name}: expected role ${role}`,
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
  if (policy.replyPlan.nextQuestion) {
    assert.ok(
      policy.replyPlan.nextQuestion.length <= 260,
      `${fixture.name}: next question should be concise`,
    );
    assert.ok(
      !forbiddenPromisePattern.test(policy.replyPlan.nextQuestion),
      `${fixture.name}: next question should not promise work or placement`,
    );
  }
  assert.ok(
    policy.replyPlan.allowedActions.includes("audit_reply_plan") ||
      policy.replyPlan.allowedActions.includes("audit_escalation"),
    `${fixture.name}: reply plan stays auditable`,
  );
  assert.ok(
    policy.replyPlan.blockedActions.includes("promise_paid_work"),
    `${fixture.name}: paid-work promises remain blocked`,
  );
}

console.log(
  `Conversation gig-seeker policy checks passed for ${fixtures.length} deterministic fixtures.`,
);
