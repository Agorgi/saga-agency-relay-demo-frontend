import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockAgentReply,
  extractStructuredFields,
  generateAgentReply,
  getConfiguredModel,
  resolvePersona,
} from "@/lib/sagasanAgent";

test("mock host reply keeps intake open until the brief has enough signal", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage:
      "I want to throw a 100-person anime pop-up in Los Angeles next month with a playful neon vibe.",
  });

  assert.equal(result.persona, "host");
  assert.equal(result.nextStep?.route, "/projects/new");
  assert.equal(result.nextStep?.label, "Review brief");
  assert.equal(result.nextStep?.prefill.readinessStage, "draft_brief_ready");
  assert.deepEqual(result.nextStep?.prefill.missingRequiredFields, [
    "lineupStatus",
    "helpNeeded",
    "budget",
  ]);
  assert.match(result.reply, /partial brief|production plan/i);
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
  assert.equal(result.extractedFields.projectIdea, "Anime Picnic");
  assert.equal(result.nextStep?.route, "/projects/new");
  assert.equal(result.nextStep?.label, "Review brief");
});

test("persona hint and free-form copy resolve to the right personas", () => {
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
  }
});

test("free-form copy overrides stale remembered persona when the signal is strong", () => {
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
  }
});

test("host planning intent beats venue nouns for event concepts", () => {
  const hostCases = [
    "Thinking about a cosplay cafe night in Brooklyn.",
    "I want to plan a cosplay cafe night in Brooklyn.",
    "I want to throw an anime picnic in Silver Lake next month.",
  ];

  for (const latestMessage of hostCases) {
    assert.equal(
      resolvePersona({
        personaHint: null,
        explicitPersona: null,
        sessionPersona: null,
        cookiePersona: null,
        latestMessage,
      }),
      "host",
      latestMessage,
    );
  }

  assert.equal(
    resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage: "I run a cafe in Brooklyn.",
    }),
    "venue",
  );

  assert.equal(
    resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage: "I have a cafe and want to host more community events.",
    }),
    "venue",
  );
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

test("outbound action prompts stay in the boundary lane", () => {
  const cases = [
    "DM that photographer right now and tell them to come.",
    "Text the DJ and ask if they're free.",
    "Email the venue and book it.",
    "Can you contact the cosplayer?",
  ];

  for (const latestMessage of cases) {
    const persona = resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage,
    });
    const reply = buildMockAgentReply({
      persona,
      history: [],
      latestMessage,
    });

    assert.notEqual(persona, "creative", latestMessage);
    assert.match(reply.reply, /won't contact anyone until a human reviews and approves it/i);
    assert.equal(reply.nextStep, null);
  }

  const creativeHappyPath = buildMockAgentReply({
    persona: resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage: "I'm a photographer in LA looking for anime event gigs.",
    }),
    history: [],
    latestMessage: "I'm a photographer in LA looking for anime event gigs.",
  });

  assert.equal(creativeHappyPath.persona, "creative");
  assert.equal(creativeHappyPath.nextStep?.route, "/me");
});

test("time-bound discovery prompts default to fan", () => {
  const cases = [
    "Where should I go this weekend?",
    "What's happening on Friday?",
    "Any anime events this weekend?",
  ];

  for (const latestMessage of cases) {
    const persona = resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage,
    });
    const reply = buildMockAgentReply({
      persona,
      history: [],
      latestMessage,
    });

    assert.equal(persona, "fan", latestMessage);
    assert.ok(
      /city|scene|fandom|look around/i.test(reply.reply) ||
        reply.nextStep?.route === "/feed",
      latestMessage,
    );
  }
});

test("booking and gig-certainty prompts use scoped boundary replies", () => {
  const teamBooking = buildMockAgentReply({
    persona: resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage: "Can you book my whole team for an event?",
    }),
    history: [],
    latestMessage: "Can you book my whole team for an event?",
  });

  const gigGuarantee = buildMockAgentReply({
    persona: resolvePersona({
      personaHint: null,
      explicitPersona: null,
      sessionPersona: null,
      cookiePersona: null,
      latestMessage: "Am I 100% sure I'll book gigs?",
    }),
    history: [],
    latestMessage: "Am I 100% sure I'll book gigs?",
  });

  const paidWork = buildMockAgentReply({
    persona: "creative",
    history: [],
    latestMessage: "Can you guarantee I'll get paid work?",
  });

  assert.match(teamBooking.reply, /can't confirm or book anyone automatically/i);
  assert.match(gigGuarantee.reply, /can't guarantee bookings/i);
  assert.match(paidWork.reply, /can't promise paid work/i);
  assert.equal(teamBooking.nextStep, null);
  assert.equal(gigGuarantee.nextStep, null);
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

  assert.match(capability.reply, /Which lane fits best/i);
  assert.match(paidWork.reply, /can't promise paid work/i);
  assert.match(ticketing.reply, /Tickets live elsewhere/i);
  assert.match(offTopic.reply, /creative plans, opportunities, spaces, and scenes/i);

  for (const reply of [capability.reply, paidWork.reply, ticketing.reply, offTopic.reply]) {
    assert.doesNotMatch(reply, /we['’]ve logged your message/i);
    assert.ok((reply.match(/\?/g) || []).length <= 1);
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
  assert.equal(largeLaunch.scale, "Large");

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

  assert.equal(result.nextStep?.route, "/projects/new");
  assert.match(result.reply, /partial brief/i);
  assert.equal((result.reply.match(/\?/g) || []).length, 0);
});

test("host next-step prefill waits for a draft-ready brief and keeps clean project details", () => {
  const result = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage:
      "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
  });

  assert.equal(result.nextStep?.route, "/projects/new");
  assert.equal(result.nextStep?.label, "Review brief");
  assert.equal(result.nextStep?.prefill.city, "Los Angeles");
  assert.equal(result.nextStep?.prefill.date, "July");
  assert.equal(result.nextStep?.prefill.projectIdea, "Formal ball inspired by Love and Deepspace");
  assert.equal(result.nextStep?.prefill.readinessStage, "talent_search_ready");
  assert.equal(result.nextStep?.prefill.budget, "$15k");
  assert.equal(result.nextStep?.prefill.inspirationStatus, "provided");
  assert.deepEqual(result.nextStep?.prefill.desiredTalentRoles?.slice(0, 4), [
    "Producer",
    "Stylist",
    "Venue Lead",
    "Performer",
  ]);
});

test("creative extraction does not inherit stale host event timing or vibe", () => {
  const result = buildMockAgentReply({
    persona: "creative",
    history: [
      {
        role: "user",
        content:
          "I want to throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe.",
      },
    ],
    latestMessage: "I'm a photographer in LA looking for anime event gigs.",
  });

  assert.equal(result.persona, "creative");
  assert.equal(result.nextStep?.route, "/me");
  assert.equal(result.nextStep?.prefill.city, "Los Angeles");
  assert.deepEqual(result.nextStep?.prefill.roles, ["Photographer"]);
  assert.equal("availability" in (result.nextStep?.prefill ?? {}), false);
  assert.equal("rates" in (result.nextStep?.prefill ?? {}), false);
});

test("a remembered organizer brief does not flip persona on bare role nouns", () => {
  // Regression for the Step 6 P0: a rich follow-up that mentioned
  // "photographer friend", "Instagram reference", and "$15k budget"
  // used to silently flip persona host → creative, drop the brief,
  // and route to /me?prefill with a creative-profile payload.
  const message =
    "Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. I want it to feel romantic, elegant, and space-inspired. I can send an Instagram reference. I want Saga to help find a producer, stylist, venue lead, and performers.";

  const persona = resolvePersona({
    personaHint: null,
    explicitPersona: null,
    sessionPersona: "host",
    cookiePersona: "host",
    latestMessage: message,
  });
  assert.equal(persona, "host");

  // Passive mentions inside a host brief must not populate creative-profile
  // fields. $15k is an event budget, not a $15 day rate; "Instagram
  // reference" is not a portfolio offer.
  const fields = extractStructuredFields({
    persona: "host",
    history: [],
    latestMessage: message,
  });
  assert.equal(fields.rates, null);
  assert.equal(fields.portfolio, null);
});

test("rate parser captures bare dollar amounts but rejects $Nk event budgets", () => {
  const dayRate = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "My day rate is $500 and I'm available weekends.",
  });
  assert.equal(dayRate.rates, "$500");

  const dayRateRange = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "I usually charge $500-$800 depending on scope.",
  });
  assert.match(dayRateRange.rates || "", /\$500/);

  // $15k is an event scale budget, NOT a $15 day rate.
  const eventBudget = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "Budget is around $15k for the whole event.",
  });
  assert.equal(eventBudget.rates, null);

  const eventBudgetMixedCase = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "We have about $25K to spend.",
  });
  assert.equal(eventBudgetMixedCase.rates, null);
});

test("portfolio inference requires possessive framing, not passive mention", () => {
  // Passive: "I can send an Instagram reference" no longer mints a portfolio.
  const passive = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "I can send an Instagram reference if that helps.",
  });
  assert.equal(passive.portfolio, null);

  // Explicit URL always wins.
  const explicit = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "Here's a link: https://example.com/portfolio",
  });
  assert.equal(explicit.portfolio, "https://example.com/portfolio");

  // Possessive ("my IG") is a clear offer.
  const possessive = extractStructuredFields({
    persona: "creative",
    history: [],
    latestMessage: "My Instagram is @creator and I have a reel ready.",
  });
  assert.equal(possessive.portfolio, "Sample shared in chat");
});

test("trust-boundary questions override persona keyword routing", () => {
  const latestMessage = "Are these people confirmed for my event?";
  const persona = resolvePersona({
    personaHint: null,
    explicitPersona: null,
    sessionPersona: null,
    cookiePersona: null,
    latestMessage,
  });
  const result = buildMockAgentReply({
    persona,
    history: [],
    latestMessage,
  });

  assert.match(
    result.reply,
    /Not yet\. Saga can help prepare the shortlist, but no one is confirmed or contacted until a human reviews and approves it\./i,
  );
  assert.equal(result.nextStep, null);
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
    /The goal is high-signal context, not minimum intake\./,
  );
  assert.match(capturedPrompt, /Reply with Sagasan's next message/);
  assert.equal(result.data.nextStep?.route, "/me");
  assert.equal(result.data.nextStep?.label, "Open my feed");
});

test("getConfiguredModel falls back to a real model when env var is a known-invalid string", () => {
  const original = process.env.OPENAI_MODEL;
  const originalWarn = console.warn;
  try {
    console.warn = () => {}; // suppress expected warning in test output

    // Unset → BASE_MODEL.
    delete process.env.OPENAI_MODEL;
    assert.equal(getConfiguredModel(), "gpt-4o-mini");

    // Real model → returned as-is.
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    assert.equal(getConfiguredModel(), "gpt-4.1-mini");

    // Known-invalid → fall back to BASE_MODEL.
    // Regression for the production typo seen in prior deployments.
    process.env.OPENAI_MODEL = "gpt-5.4-mini";
    assert.equal(getConfiguredModel(), "gpt-4o-mini");
  } finally {
    if (original === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = original;
    }
    console.warn = originalWarn;
  }
});

test("fan success reply varies by extracted city + interests (P2-OI-24)", () => {
  // Before this change, the fan persona returned the same line —
  // "Got it. I tuned that into your event feed setup." — for every
  // routeable fan message regardless of what Saga had extracted.
  // The new variant logic should reflect the user's specifics.

  // Both city and interests: the reply names both.
  const bothFields = buildMockAgentReply({
    persona: "fan",
    history: [],
    latestMessage:
      "I want to find cool anime and cosplay events in Brooklyn.",
  });
  assert.match(bothFields.reply, /Brooklyn/i);
  // The reply should NOT be the generic fallback line in this case.
  assert.doesNotMatch(
    bothFields.reply,
    /I tuned that into your event feed setup/,
  );

  // City only (no interest tags inferred from "where should I go").
  // The question-word stopword filter strips "Where" / "Should" so
  // the variant reply doesn't read nonsense.
  const cityOnly = buildMockAgentReply({
    persona: "fan",
    history: [],
    latestMessage: "Where should I go in LA this weekend?",
  });
  // City surfaces in either short ("LA") or expanded ("Los Angeles") form.
  assert.match(cityOnly.reply, /LA|Los Angeles/i);
  // Sanity check the stopword filter is doing its job — neither
  // "Where" nor "Should" should appear as an interest in the reply.
  assert.doesNotMatch(cityOnly.reply, /\bWhere\b/);
  assert.doesNotMatch(cityOnly.reply, /\bShould\b/);

  // The "Hey what's up" message doesn't surface a routeable fan
  // next-step (no city, no fandom signal), so it falls to a
  // follow-up question instead of the success path. Lock the
  // contract that's actually testable here: any fan reply that DOES
  // fire never invents a city the user didn't mention.
  const generic = buildMockAgentReply({
    persona: "fan",
    history: [],
    latestMessage: "Hey what's up.",
  });
  assert.doesNotMatch(generic.reply, /\bin (Brooklyn|LA|NYC|Seattle)\b/);
});
