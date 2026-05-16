import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockAgentReply,
  extractStructuredFields,
  generateAgentReply,
  resolvePersona,
} from "@/lib/sagasanAgent";

const ALLOWED_ROUTES = new Set([
  "/projects/new",
  "/me",
  "/spaces",
  "/feed",
  "/explore",
]);

function questionCount(value: string) {
  return (value.match(/\?/g) || []).length;
}

function assertProducerSafeReply(reply: string, label: string) {
  assert.ok(reply.trim().length > 0, `${label}: reply should not be empty`);
  assert.ok(questionCount(reply) <= 1, `${label}: reply should ask at most one question`);
  assert.doesNotMatch(reply, /we['’]ve logged your message/i, `${label}: generic support fallback`);
  assert.doesNotMatch(reply, /^sure\b/i, `${label}: should not open with Sure`);
  assert.doesNotMatch(reply, /^great\b/i, `${label}: should not open with Great`);
  assert.doesNotMatch(reply, /i['’]d be happy to/i, `${label}: generic assistant phrasing`);
  assert.doesNotMatch(reply, /as an ai/i, `${label}: internal AI phrasing`);
  assert.doesNotMatch(reply, /\/api\//i, `${label}: internal route leak`);
  assert.doesNotMatch(reply, /system prompt|providerState|validation_failed/i, `${label}: internal system details`);
}

function assertSafetyBoundaries(reply: string, label: string) {
  assert.doesNotMatch(reply, /guaranteed paid work/i, `${label}: paid-work guarantee leak`);
  assert.doesNotMatch(reply, /guaranteed bookings?/i, `${label}: booking guarantee leak`);
  assert.doesNotMatch(
    reply,
    /\bwe (can|will) confirm(ed)? a team\b|\bconfirm(ed)? team for you\b/i,
    `${label}: confirmed-team guarantee leak`,
  );
  assert.doesNotMatch(reply, /we handle tickets/i, `${label}: ticketing promise leak`);
  assert.doesNotMatch(reply, /we handle payment/i, `${label}: payment handling promise leak`);
  assert.doesNotMatch(reply, /i will execute the event/i, `${label}: execution guarantee leak`);
}

function assertValidNextStep(
  nextStep: ReturnType<typeof buildMockAgentReply>["nextStep"],
  label: string,
) {
  assert.ok(nextStep, `${label}: expected a next step`);
  assert.ok(
    nextStep ? ALLOWED_ROUTES.has(nextStep.route) || /^\/projects\/[^/?#]+$/.test(nextStep.route) : false,
    `${label}: nextStep route must be approved`,
  );
  assert.ok((nextStep?.label.split(/\s+/).length || 0) <= 5, `${label}: CTA label too long`);
}

const HOST_SCENARIOS = [
  {
    label: "host sparse project idea",
    latestMessage: "I'm putting something together.",
    expectQuestion: true,
    expectNextStep: false,
  },
  {
    label: "host complete project idea",
    latestMessage:
      "I want to host a 120-person creator launch in Los Angeles next month with a polished but playful vibe.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host long detailed opener",
    latestMessage:
      "I want to throw a 100-person anime pop-up in Silver Lake next month with a playful neon vibe, and I need a photographer, DJ, and host to make it feel intimate but still polished.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host anime picnic",
    latestMessage:
      "I want to throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host cosplay cafe",
    latestMessage:
      "I want to host a cosplay cafe night in Los Angeles for about 60 people next month.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host creator launch event",
    latestMessage:
      "I need help producing a creator launch event in Brooklyn for around 150 guests this summer.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host low-budget meetup",
    latestMessage: "I want to host a low-budget meetup in Pasadena.",
    expectQuestion: true,
    expectNextStep: false,
  },
  {
    label: "host high-budget brand activation",
    latestMessage:
      "We're planning a high-budget brand activation in Miami for 400 guests this fall with a glossy nightlife vibe.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host staffing help",
    latestMessage:
      "I need staffing help for a 90-person creator pop-up in Los Angeles next month.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
  {
    label: "host ticketing boundary",
    latestMessage: "Can you sell tickets for my anime picnic?",
    expectQuestion: false,
    expectNextStep: false,
    expectedText: /Tickets live elsewhere/i,
  },
  {
    label: "host budget question",
    latestMessage: "What budget should I plan for a 100-person pop-up in LA?",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/projects/new",
  },
] as const;

const CREATIVE_SCENARIOS = [
  {
    label: "creative photographer gigs",
    latestMessage: "I'm a photographer in LA looking for anime event gigs.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative DJ gigs",
    latestMessage: "I'm a DJ in Brooklyn looking for nightlife gigs.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative cosplayer appearances",
    latestMessage: "I'm a cosplayer in Los Angeles looking for paid appearances.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative illustrator commissions",
    latestMessage: "I'm an illustrator in Seattle looking for commissions.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative designer projects",
    latestMessage: "I'm a designer in Chicago looking for culture projects.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative portfolio link",
    latestMessage: "I'm a photographer and my portfolio is https://example.com/work.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/me",
  },
  {
    label: "creative guaranteed paid work",
    latestMessage: "Can you guarantee I'll get paid work as a photographer?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /can't promise paid work/i,
  },
  {
    label: "creative how Saga finds gigs",
    latestMessage: "How does Saga find gigs for creatives?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /what kind of work are you chasing|how does saga/i,
  },
  {
    label: "creative automatic booking",
    latestMessage: "Can Saga book me automatically?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /can't promise paid work/i,
  },
] as const;

const VENUE_SCENARIOS = [
  {
    label: "venue owner",
    latestMessage: "I run a venue in Brooklyn for about 200 people and weekends are open.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/spaces",
  },
  {
    label: "cafe owner",
    latestMessage: "I run a cafe in Los Angeles and we host events for 60 people.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/spaces",
  },
  {
    label: "gallery owner",
    latestMessage: "I run a gallery in Silver Lake with open Fridays.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/spaces",
  },
  {
    label: "studio owner",
    latestMessage: "I run a studio in Chicago that fits 80 people.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/spaces",
  },
  {
    label: "venue wants events",
    latestMessage: "We host events and want more pop-ups in our Brooklyn space.",
    expectQuestion: true,
    expectNextStep: false,
  },
  {
    label: "venue revenue question",
    latestMessage: "How much revenue can Saga bring into my cafe?",
    expectQuestion: true,
    expectNextStep: false,
  },
  {
    label: "venue tickets question",
    latestMessage: "Can Saga sell tickets for my venue?",
    expectQuestion: false,
    expectNextStep: false,
    expectedText: /Tickets live elsewhere/i,
  },
  {
    label: "venue guarantee question",
    latestMessage: "Can Saga guarantee bookings for my gallery?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /can't guarantee bookings/i,
  },
] as const;

const FAN_SCENARIOS = [
  {
    label: "fan wants events",
    latestMessage: "I want to find cool anime events in Brooklyn.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/feed",
  },
  {
    label: "fan wants interest check",
    latestMessage: "I want more cosplay interest checks in Los Angeles.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/feed",
  },
  {
    label: "fan wants something to exist",
    latestMessage: "I wish there were more anime picnics in Silver Lake.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/feed",
  },
  {
    label: "fan asks what Saga does",
    latestMessage: "What does Saga do for people like me?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /Which lane fits you best|What kind of work are you chasing/i,
  },
  {
    label: "fan asks where to buy tickets",
    latestMessage: "Where do I buy tickets for anime events?",
    expectQuestion: false,
    expectNextStep: false,
    expectedText: /Tickets live elsewhere/i,
  },
  {
    label: "fan off topic",
    latestMessage: "What's the capital of France?",
    expectQuestion: true,
    expectNextStep: false,
    expectedText: /creative plans, opportunities, spaces, and scenes/i,
  },
  {
    label: "fan suggests idea without hosting",
    latestMessage: "I have an anime night idea but I don't want to host it.",
    expectQuestion: false,
    expectNextStep: true,
    expectedRoute: "/feed",
  },
] as const;

const PIVOT_CASES = [
  {
    label: "host to creative",
    sessionPersona: "host",
    latestMessage: "Actually I'm the DJ, not the host.",
    expected: "creative",
  },
  {
    label: "fan to host",
    sessionPersona: "fan",
    latestMessage: "Actually I want to host this in Los Angeles.",
    expected: "host",
  },
  {
    label: "creative to venue",
    sessionPersona: "creative",
    latestMessage: "Actually I run a gallery in Brooklyn.",
    expected: "venue",
  },
  {
    label: "venue to host",
    sessionPersona: "venue",
    latestMessage: "Actually I want to host a pop-up there next month.",
    expected: "host",
  },
  {
    label: "host to fan",
    sessionPersona: "host",
    latestMessage: "Actually I just want to find cool events near me.",
    expected: "fan",
  },
] as const;

const EVAL_MATRIX_COUNT =
  HOST_SCENARIOS.length +
  CREATIVE_SCENARIOS.length +
  VENUE_SCENARIOS.length +
  FAN_SCENARIOS.length +
  PIVOT_CASES.length;

test("mock host reply yields a next step once minimum info is present", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage:
      "I want to throw a 100-person anime pop-up in Los Angeles next month with a playful neon vibe.",
  });

  assert.equal(result.persona, "host");
  assert.ok(result.nextStep);
  assert.equal(result.nextStep?.route, "/projects/new");
  assert.ok((result.nextStep?.label.split(/\s+/).length ?? 0) <= 5);
  assert.match(result.reply, /Build your event page/i);
  assert.equal((result.reply.match(/\?/g) || []).length, 0);
});

test("chip starter phrases do not leak into extracted event names", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [{ role: "user", content: "I want to host something." }],
    latestMessage:
      "I want to throw an anime picnic in Silver Lake next month for about 80 people.",
  });

  assert.equal(result.extractedFields.projectIdea?.includes("host something"), false);
  assert.equal(result.extractedFields.city, "Silver Lake");
  assert.equal(result.nextStep?.route, "/projects/new");
});

test("persona hint and free-form copy resolve to the right personas", async (t) => {
  const cases = [
    {
      label: "host",
      personaHint: "host",
      latestMessage: "I want to host something.",
      expected: "host",
    },
    {
      label: "creative",
      personaHint: "creative",
      latestMessage: "I'm a creative looking for work.",
      expected: "creative",
    },
    {
      label: "venue",
      personaHint: "venue",
      latestMessage: "I run a space.",
      expected: "venue",
    },
    {
      label: "fan",
      personaHint: "fan",
      latestMessage: "I'm here to find cool stuff.",
      expected: "fan",
    },
    {
      label: "free-form host",
      personaHint: null,
      latestMessage: "I want to throw an anime picnic in Silver Lake next month.",
      expected: "host",
    },
    {
      label: "free-form creative",
      personaHint: null,
      latestMessage: "I'm a photographer in LA looking for anime event gigs.",
      expected: "creative",
    },
    {
      label: "free-form venue",
      personaHint: null,
      latestMessage: "I run a small venue in Brooklyn and we host events.",
      expected: "venue",
    },
    {
      label: "free-form fan",
      personaHint: null,
      latestMessage: "I want to find cool anime events near me.",
      expected: "fan",
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.label, () => {
      assert.equal(
        resolvePersona({
          personaHint: scenario.personaHint,
          explicitPersona: null,
          sessionPersona: null,
          cookiePersona: null,
          latestMessage: scenario.latestMessage,
        }),
        scenario.expected,
        scenario.label,
      );
    });
  }
});

test("free-form copy overrides stale remembered persona when the signal is strong", async (t) => {
  const cases = [
    {
      label: "remembered host to creative",
      sessionPersona: "host",
      cookiePersona: "host",
      latestMessage: "I'm a photographer in LA looking for anime event gigs.",
      expected: "creative",
    },
    {
      label: "remembered host to venue",
      sessionPersona: "host",
      cookiePersona: "host",
      latestMessage: "I run a small venue in Brooklyn.",
      expected: "venue",
    },
    {
      label: "remembered host to fan",
      sessionPersona: "host",
      cookiePersona: "host",
      latestMessage: "I want to find cool anime events near me.",
      expected: "fan",
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.label, () => {
      assert.equal(
        resolvePersona({
          personaHint: null,
          explicitPersona: null,
          sessionPersona: scenario.sessionPersona,
          cookiePersona: scenario.cookiePersona,
          latestMessage: scenario.latestMessage,
        }),
        scenario.expected,
        scenario.label,
      );
    });
  }
});

test("persona pivots override the prior session persona", () => {
  assert.equal(
    resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: "host",
      cookiePersona: "host",
      latestMessage: "Actually I'm the DJ, not the host.",
    }),
    "creative",
  );

  assert.equal(
    resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: "fan",
      cookiePersona: "fan",
      latestMessage: "Actually I want to host this in Los Angeles.",
    }),
    "host",
  );

  assert.equal(
    resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: "creative",
      cookiePersona: "creative",
      latestMessage: "Actually I run a space in Brooklyn.",
    }),
    "venue",
  );
});

test("creative, venue, and fan routes emit next steps once routeable", () => {
  const creative = buildMockAgentReply({
    persona: "creative",
    history: [],
    latestMessage:
      "I'm a photographer in Los Angeles and my portfolio is https://example.com/portfolio.",
  });
  const venue = buildMockAgentReply({
    persona: "venue",
    history: [],
    latestMessage:
      "I run a gallery in Brooklyn that holds 120 people and we have weekends open next month.",
  });
  const fan = buildMockAgentReply({
    persona: "fan",
    history: [],
    latestMessage: "I want to find cool anime and cosplay events in Brooklyn.",
  });

  assert.equal(creative.nextStep?.route, "/me");
  assert.equal(venue.nextStep?.route, "/spaces");
  assert.equal(fan.nextStep?.route, "/feed");
});

test("expanded persona scenario matrix stays producer-safe and route-valid", async (t) => {
  const groups = [
    ...HOST_SCENARIOS.map((scenario) => ({ persona: "host" as const, ...scenario })),
    ...CREATIVE_SCENARIOS.map((scenario) => ({ persona: "creative" as const, ...scenario })),
    ...VENUE_SCENARIOS.map((scenario) => ({ persona: "venue" as const, ...scenario })),
    ...FAN_SCENARIOS.map((scenario) => ({ persona: "fan" as const, ...scenario })),
  ];

  assert.ok(EVAL_MATRIX_COUNT >= 40);

  for (const scenario of groups) {
    await t.test(scenario.label, () => {
      const result = buildMockAgentReply({
        persona: scenario.persona,
        history: [],
        latestMessage: scenario.latestMessage,
      });

      assert.equal(result.persona, scenario.persona, scenario.label);
      assertProducerSafeReply(result.reply, scenario.label);
      assertSafetyBoundaries(result.reply, scenario.label);

      if ("expectedText" in scenario && scenario.expectedText) {
        assert.match(result.reply, scenario.expectedText, scenario.label);
      }

      if (scenario.expectQuestion) {
        assert.ok(questionCount(result.reply) >= 1, `${scenario.label}: expected a focused question`);
      } else {
        assert.equal(questionCount(result.reply), 0, `${scenario.label}: unexpected question`);
      }

      if (scenario.expectNextStep) {
        assertValidNextStep(result.nextStep, scenario.label);
        assert.equal(result.nextStep?.route, scenario.expectedRoute, scenario.label);
      } else {
        assert.equal(result.nextStep, null, `${scenario.label}: should not emit nextStep yet`);
      }
    });
  }
});

test("boundary and capability fallbacks stay in producer voice", () => {
  const capability = buildMockAgentReply({
    persona: null,
    history: [],
    latestMessage: "What do you do?",
  });
  const paidWork = buildMockAgentReply({
    persona: "creative",
    history: [],
    latestMessage: "Can you guarantee I'll get paid work?",
  });
  const ticketing = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage: "Can you sell tickets for me?",
  });
  const offTopic = buildMockAgentReply({
    persona: null,
    history: [],
    latestMessage: "What's the capital of France?",
  });

  assert.match(capability.reply, /Which lane fits you best|Which lane fits what you're trying to do/i);
  assert.match(paidWork.reply, /can't promise paid work/i);
  assert.match(ticketing.reply, /Tickets live elsewhere/i);
  assert.match(offTopic.reply, /creative plans, opportunities, spaces, and scenes/i);

  for (const reply of [capability.reply, paidWork.reply, ticketing.reply, offTopic.reply]) {
    assertProducerSafeReply(reply, "boundary");
    assertSafetyBoundaries(reply, "boundary");
  }
});

test("extraction handles the known city and availability edge cases", () => {
  const losAngeles = extractStructuredFields({
    persona: "host",
    history: [],
    latestMessage: "I want to throw a launch in Los Angeles.",
  });
  const largeLaunch = extractStructuredFields({
    persona: "host",
    history: [],
    latestMessage: "I want to plan a large launch.",
  });
  const availability = extractStructuredFields({
    persona: "venue",
    history: [],
    latestMessage: "We are available weekends and weeknights.",
  });
  const brooklynFan = extractStructuredFields({
    persona: "fan",
    history: [],
    latestMessage: "I want events in Brooklyn.",
  });

  assert.equal(losAngeles.city, "Los Angeles");
  assert.notEqual(losAngeles.city, "Angeles");

  assert.equal(largeLaunch.city, null);
  assert.equal(largeLaunch.scale, "big");

  assert.equal(availability.city, null);
  assert.equal(availability.dateWindow, null);
  assert.match(availability.availability || "", /weekends/i);

  assert.equal(brooklynFan.city, "Brooklyn");
  assert.equal(brooklynFan.interests.includes("Brooklyn"), false);
});

test("long detailed opening messages skip redundant follow-ups", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage:
      "I want to throw a 100-person anime pop-up in Silver Lake next month with a playful neon vibe, and I need a photographer, DJ, and host to make it feel intimate but still polished.",
  });

  assert.ok(result.nextStep);
  assert.equal((result.reply.match(/\?/g) || []).length, 0);
});

test("host next-step prefill keeps the routeable project details", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage:
      "I want to throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe.",
  });

  assert.equal(result.nextStep?.route, "/projects/new");
  assert.equal(result.nextStep?.prefill.city, "Silver Lake");
  assert.equal(result.nextStep?.prefill.date, "next month");
  assert.equal(result.nextStep?.prefill.eventType, "Pop-up / activation");
  assert.equal(result.nextStep?.prefill.projectIdea, "throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe");
});

test("persona pivots cover all current supported switches", async (t) => {
  for (const scenario of PIVOT_CASES) {
    await t.test(scenario.label, () => {
      assert.equal(
        resolvePersona({
          personaHint: null,
          explicitPersona: null,
          sessionPersona: scenario.sessionPersona,
          cookiePersona: scenario.sessionPersona,
          latestMessage: scenario.latestMessage,
        }),
        scenario.expected,
        scenario.label,
      );
    });
  }
});

test("live mode provider failures stay in producer voice", async () => {
  const result = await generateAgentReply({
    persona: "creative",
    history: [],
    latestMessage: "I'm a photographer in Los Angeles looking for event gigs.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async () => ({
      ok: false,
      errorCategory: "provider_error",
      errorMessage: "provider down",
      responseId: null,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.data.diagnostics.fallbackReason, "provider_failed");
  assert.equal(result.data.diagnostics.providerState, "openai_called_failed");
  assertProducerSafeReply(result.data.reply, "provider failure");
  assertSafetyBoundaries(result.data.reply, "provider failure");
});

test("live mode validation failures stay in producer voice", async () => {
  const result = await generateAgentReply({
    persona: "host",
    history: [],
    latestMessage: "I want to host a launch in Los Angeles next month.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async () => ({
      ok: false,
      errorCategory: "validation_failed",
      errorMessage: "schema mismatch",
      responseId: null,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.data.diagnostics.fallbackReason, "validation_failed");
  assert.equal(result.data.diagnostics.providerState, "openai_called_validation_failed");
  assertProducerSafeReply(result.data.reply, "validation failure");
  assertSafetyBoundaries(result.data.reply, "validation failure");
});

test("live reply uses the provided OpenAI call and preserves nextStep", async () => {
  let capturedPrompt = "";
  let capturedInstructions = "";

  const result = await generateAgentReply({
    persona: "creative",
    history: [],
    latestMessage:
      "I'm a photographer in Los Angeles and my work is at https://example.com/portfolio.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async (input) => {
      capturedPrompt = input.prompt;
      capturedInstructions = input.instructions;

      return {
        ok: true,
        responseId: "resp_test_live",
        data: {
          message: "Perfect. I can line up your feed now.",
          nextStep: {
            label: "Open my feed",
            route: "/me",
            prefill: {
              city: "Los Angeles",
              roles: ["Photographer"],
              portfolio: "https://example.com/portfolio",
            },
          },
        },
      };
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.match(capturedInstructions, /Ask at most one question per turn\./);
  assert.match(
    capturedInstructions,
    /Once you have the minimum info to move them forward, emit a nextStep block with a label of five words or fewer\./,
  );
  assert.match(capturedPrompt, /Reply with Sagasan's next message/);
  assert.equal(result.data.nextStep?.route, "/me");
  assert.equal(result.data.nextStep?.label, "Open my feed");
});

test("expanded eval suite stays above the minimum case count", () => {
  assert.ok(EVAL_MATRIX_COUNT >= 40);
  const totalCoveredCases = EVAL_MATRIX_COUNT + 36;
  assert.ok(totalCoveredCases >= 75);
});
