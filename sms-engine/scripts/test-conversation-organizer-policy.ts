import assert from "node:assert/strict";
import type { ConversationContext } from "@/sms-engine/conversation/conversationTypes";
import { evaluateOrganizerIntakePolicy } from "@/sms-engine/conversation/organizerIntakePolicy";
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

const hostComplete = context({
  hasCompletedFirstTimeHostQuestion: true,
});

const hostQuestionAlreadyAsked = context({
  priorMessages: [
    {
      id: "msg_first_time_question",
      direction: "OUTBOUND",
      channel: "SMS",
      body: "Love this. I can help turn it into an actual production plan. First — have you hosted something like this before?",
      createdAt: new Date().toISOString(),
    },
  ],
});

type Fixture = {
  name: string;
  latestMessage: string;
  context?: ConversationContext;
  expectedNextStage:
    | "NEW"
    | "ASK_FIRST_TIME_HOST"
    | "ASK_LOCATION"
    | "ASK_PROJECT_CONCEPT"
    | "ASK_SCOPE_VIBE"
    | "ASK_TIMING"
    | "ASK_BUDGET"
    | "ASK_AUDIENCE"
    | "BRIEF_READY"
    | "NEEDS_ADMIN";
  enoughInfoForBrief?: boolean;
  shouldEscalate?: boolean;
  missingIncludes?: string[];
  missingExcludes?: string[];
  expectedKnown?: Partial<{
    firstTimeHost: boolean;
    city: string;
    projectConcept: string;
    budgetRange: string;
    expectedAudienceSize: string;
  }>;
};

const fixtures: Fixture[] = [
  {
    name: "clear idea with city asks first-time host first",
    latestMessage: "I want to throw a cozy anime picnic in LA for 80 people.",
    expectedNextStage: "ASK_FIRST_TIME_HOST",
    enoughInfoForBrief: false,
    missingExcludes: ["city", "projectConcept", "scopeOrVibe"],
  },
  {
    name: "clear idea with city and host complete is brief ready",
    latestMessage: "I want to throw a cozy anime picnic in LA for 80 people.",
    context: hostComplete,
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "clear idea without city asks location",
    latestMessage: "I want to host a polished anime art market for 100 people.",
    context: hostComplete,
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city"],
  },
  {
    name: "vague idea asks location after host complete",
    latestMessage: "I have an idea for a community creator night.",
    context: hostComplete,
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city", "scopeOrVibe"],
  },
  {
    name: "hosted before answer advances to location",
    latestMessage: "Yes, I have hosted a few pop-ups before.",
    expectedNextStage: "ASK_LOCATION",
    expectedKnown: { firstTimeHost: false },
  },
  {
    name: "first time answer advances to location",
    latestMessage: "This would be my first time hosting.",
    expectedNextStage: "ASK_LOCATION",
    expectedKnown: { firstTimeHost: true },
  },
  {
    name: "city concept timing one text asks scope",
    latestMessage: "I want to host a gaming pop-up in Atlanta next month.",
    context: hostComplete,
    expectedNextStage: "ASK_SCOPE_VIBE",
    missingExcludes: ["city", "projectConcept"],
  },
  {
    name: "city concept timing scope one text ready",
    latestMessage:
      "I want to host a cozy gaming pop-up in Atlanta next month for 120 people.",
    context: hostComplete,
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "budget is captured but does not block required fields",
    latestMessage: "Budget is probably $5k to $8k.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime creator lounge",
        scope: "Cozy community-led lounge",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
    expectedKnown: { budgetRange: "Budget is probably $5k to $8k." },
  },
  {
    name: "audience size captured",
    latestMessage: "Maybe 75 people max.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Cosplay karaoke night",
        vibe: "Playful community-led",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
    expectedKnown: { expectedAudienceSize: "Maybe 75 people max." },
  },
  {
    name: "city change overrides prior city",
    latestMessage: "Actually NYC, not LA.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime picnic",
        vibe: "Cozy and community-led",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
    expectedKnown: { city: "New York City" },
  },
  {
    name: "out of order budget before city asks location",
    latestMessage: "Probably $3k budget.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { projectConcept: "Cosplay picnic", vibe: "Casual" },
    }),
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city"],
  },
  {
    name: "idk does not overwrite known concept",
    latestMessage: "idk",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { projectConcept: "Creator photoshoot" },
    }),
    expectedNextStage: "ASK_LOCATION",
    missingIncludes: ["city", "scopeOrVibe"],
  },
  {
    name: "what Saga does falls back to next missing field",
    latestMessage: "What does Saga do?",
    context: hostComplete,
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "team recommendations too early asks scope",
    latestMessage: "Can you recommend a team already?",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime pop-up",
      },
    }),
    expectedNextStage: "ASK_SCOPE_VIBE",
    missingIncludes: ["scopeOrVibe"],
  },
  {
    name: "prior first time question is not asked twice",
    latestMessage: "I want to make a horror manga picnic in Brooklyn.",
    context: hostQuestionAlreadyAsked,
    expectedNextStage: "ASK_SCOPE_VIBE",
    missingExcludes: ["city", "projectConcept"],
  },
  {
    name: "host complete does not ask first time again",
    latestMessage: "I want to host a cozy cosplay meetup in Seattle.",
    context: hostComplete,
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "existing city asks concept",
    latestMessage: "I am still figuring it out.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { city: "Los Angeles" },
    }),
    expectedNextStage: "ASK_PROJECT_CONCEPT",
    missingIncludes: ["projectConcept"],
  },
  {
    name: "existing city concept asks scope vibe",
    latestMessage: "Thinking late summer.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime night market",
      },
    }),
    expectedNextStage: "ASK_SCOPE_VIBE",
  },
  {
    name: "existing full required fields ready",
    latestMessage: "Sounds good.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime night market",
        scope: "Polished but community-led",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "descriptive detail can satisfy scope",
    latestMessage:
      "I want to produce an anime creator day in Los Angeles with vendors, photo sets, DJs, and casual community programming.",
    context: hostComplete,
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "timing optional does not block",
    latestMessage: "Late August or early September.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Cosplay karaoke lounge",
        vibe: "Playful community-led",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "help needed optional does not block",
    latestMessage: "I need a DJ, photographer, venue lead, and vendors.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Cosplay karaoke lounge",
        vibe: "Playful community-led",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "empty unknown still asks next field",
    latestMessage: "   ",
    context: hostComplete,
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "off topic text asks next missing field",
    latestMessage: "My favorite color is blue.",
    context: hostComplete,
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "guaranteed attendance escalates",
    latestMessage: "Can Saga guarantee 500 people attend?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "payment revenue escalates",
    latestMessage: "Can you guarantee revenue and payment terms?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "contract escalates",
    latestMessage: "Should I sign this contract tonight?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "permit escalates",
    latestMessage: "Can you handle permits and insurance?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "alcohol security escalates",
    latestMessage: "We need alcohol and security handled.",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "minors medical escalates",
    latestMessage: "There may be minors and medical support needed.",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "weapons escalates",
    latestMessage: "Can people bring prop weapons or knives?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "harassment escalates",
    latestMessage: "How do we deal with harassment claims?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "discrimination escalates",
    latestMessage: "Can we discriminate who gets vendor slots?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "explicit content escalates",
    latestMessage: "I want an explicit adult content cosplay party.",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "booking guarantee escalates",
    latestMessage: "Can you promise a confirmed venue and confirmed team?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "celebrity guarantee escalates",
    latestMessage: "Can Saga guarantee celebrity participation?",
    context: hostComplete,
    expectedNextStage: "NEEDS_ADMIN",
    shouldEscalate: true,
  },
  {
    name: "strong city signal Brooklyn",
    latestMessage: "Brooklyn, probably a cozy creator picnic.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { projectConcept: "Creator picnic" },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "general city pattern",
    latestMessage: "In Denver with a small community vibe.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { projectConcept: "Gaming meetup" },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
    expectedKnown: { city: "Denver" },
  },
  {
    name: "scope answer after city and concept",
    latestMessage: "Small, polished, and community-led.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: {
        city: "Los Angeles",
        projectConcept: "Anime gallery night",
      },
    }),
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
  {
    name: "concept answer after city",
    latestMessage: "A late-night cosplay karaoke lounge with DJs.",
    context: context({
      hasCompletedFirstTimeHostQuestion: true,
      knownFields: { city: "Los Angeles" },
    }),
    expectedNextStage: "ASK_SCOPE_VIBE",
    missingExcludes: ["projectConcept"],
  },
  {
    name: "location answer after first question",
    latestMessage: "Los Angeles, probably east side.",
    context: hostQuestionAlreadyAsked,
    expectedNextStage: "ASK_PROJECT_CONCEPT",
    missingIncludes: ["projectConcept"],
  },
  {
    name: "direct first time plus event idea still asks location",
    latestMessage: "First time, but I want to host a cozy manga meetup.",
    expectedNextStage: "ASK_LOCATION",
  },
  {
    name: "experienced plus full idea ready",
    latestMessage:
      "I've hosted before. I want to throw a polished anime launch party in LA for 120 people.",
    expectedNextStage: "BRIEF_READY",
    enoughInfoForBrief: true,
  },
];

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|promise|confirmed team|confirmed venue|venue access|ticket sales|revenue|celebrity|influencer participation|paid work)\b/i;

for (const fixture of fixtures) {
  const result = evaluateOrganizerIntakePolicy({
    context: fixture.context || context(),
    latestMessage: fixture.latestMessage,
  });
  const { replyPlan } = result;

  assert.equal(
    replyPlan.nextStage,
    fixture.expectedNextStage,
    `${fixture.name}: nextStage`,
  );

  if (fixture.enoughInfoForBrief !== undefined) {
    assert.equal(
      replyPlan.enoughInfoForBrief,
      fixture.enoughInfoForBrief,
      `${fixture.name}: enoughInfoForBrief`,
    );
  }

  if (fixture.shouldEscalate !== undefined) {
    assert.equal(
      replyPlan.shouldEscalate,
      fixture.shouldEscalate,
      `${fixture.name}: shouldEscalate`,
    );
  }

  for (const field of fixture.missingIncludes || []) {
    assert.ok(
      result.missingRequiredFields.includes(field),
      `${fixture.name}: expected missing field ${field}`,
    );
  }

  for (const field of fixture.missingExcludes || []) {
    assert.ok(
      !result.missingRequiredFields.includes(field),
      `${fixture.name}: expected field not missing ${field}`,
    );
  }

  if (fixture.expectedKnown?.firstTimeHost !== undefined) {
    assert.equal(
      result.knownFields.firstTimeHost,
      fixture.expectedKnown.firstTimeHost,
      `${fixture.name}: firstTimeHost`,
    );
  }

  if (fixture.expectedKnown?.city) {
    assert.equal(result.knownFields.city, fixture.expectedKnown.city, fixture.name);
  }

  if (fixture.expectedKnown?.budgetRange) {
    assert.equal(
      result.knownFields.budgetRange,
      fixture.expectedKnown.budgetRange,
      fixture.name,
    );
  }

  if (fixture.expectedKnown?.expectedAudienceSize) {
    assert.equal(
      result.knownFields.expectedAudienceSize,
      fixture.expectedKnown.expectedAudienceSize,
      fixture.name,
    );
  }

  assert.ok(
    replyPlan.confidence >= 0 && replyPlan.confidence <= 1,
    `${fixture.name}: confidence range`,
  );

  if (replyPlan.nextQuestion) {
    assert.ok(
      replyPlan.nextQuestion.length <= 240,
      `${fixture.name}: concise next question`,
    );
    if (!replyPlan.shouldEscalate) {
      assert.ok(
        !forbiddenPromisePattern.test(replyPlan.nextQuestion),
        `${fixture.name}: next question must not overpromise`,
      );
    }
  }
}

console.log(
  `Organizer intake policy checks passed for ${fixtures.length} deterministic fixtures.`,
);
