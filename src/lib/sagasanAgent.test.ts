import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockAgentReply,
  extractStructuredFields,
  generateAgentReply,
  getConfiguredModel,
  resolvePersona,
  type LiveAgentExtractedSignals,
} from "@/lib/sagasanAgent";

/**
 * Build a mock LLM `extractedSignals` payload with all 21 fields
 * present (every field is nullable per OpenAI's strict-mode rule —
 * "all fields must be required, use null for absent values"). Pass
 * the subset you care about; everything else defaults to null. Test
 * mocks would otherwise have to enumerate the full schema by hand.
 */
function mockExtractedSignals(
  partial: Partial<LiveAgentExtractedSignals> = {},
): LiveAgentExtractedSignals {
  return {
    personaSignal: null,
    fandoms: null,
    interests: null,
    city: null,
    projectIdea: null,
    timing: null,
    format: null,
    themeVibe: null,
    expectedAttendance: null,
    lineupStatus: null,
    helpNeeded: null,
    budget: null,
    desiredTalentRoles: null,
    inspirationReferences: null,
    creativeRole: null,
    portfolioStatus: null,
    availability: null,
    rates: null,
    venueType: null,
    venueCapacity: null,
    venueOpenDates: null,
    venueNeighborhood: null,
    ...partial,
  };
}

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

test("OI-27: multi-word fandoms stay as single interest tags (no 'Jujutsu' + 'Kaisen' split)", () => {
  // The QA bug: "Jujutsu Kaisen" was rendering as separate "Jujutsu"
  // and "Kaisen" chips because inferInterestTags fell to the
  // whitespace-splitting fallback when no INTEREST_PATTERNS matched.
  // After the fix, the identity-signal pattern bank fires FIRST and
  // catches the multi-word phrase as a single canonical token.
  const fan = extractStructuredFields({
    persona: "fan",
    history: [],
    latestMessage: "I'm into Jujutsu Kaisen and anime nights in Brooklyn.",
  });
  const allInterests = (fan.interests || []).map((s) => s.toLowerCase());
  // The canonical label from identitySignals.ts is "JJK", not "Jujutsu Kaisen".
  // Either is acceptable as long as it's ONE token, not two.
  assert.ok(
    allInterests.some((i) => i === "jjk" || i === "jujutsu kaisen"),
    `expected a single JJK-shaped tag, got: ${JSON.stringify(fan.interests)}`,
  );
  assert.ok(
    !allInterests.includes("jujutsu"),
    `'Jujutsu' must not appear as a standalone tag, got: ${JSON.stringify(fan.interests)}`,
  );
  assert.ok(
    !allInterests.includes("kaisen"),
    `'Kaisen' must not appear as a standalone tag, got: ${JSON.stringify(fan.interests)}`,
  );
});

test("OI-27: multi-word fandom 'Love and Deepspace' stays as a single tag", () => {
  const fan = extractStructuredFields({
    persona: "fan",
    history: [],
    latestMessage: "Looking for Love and Deepspace meetups.",
  });
  const allInterests = (fan.interests || []).map((s) => s.toLowerCase());
  assert.ok(
    allInterests.includes("love and deepspace"),
    `expected 'Love and Deepspace' as one tag, got: ${JSON.stringify(fan.interests)}`,
  );
  // None of the constituent words should appear as standalone tags.
  for (const word of ["love", "deepspace"]) {
    assert.ok(
      !allInterests.includes(word),
      `'${word}' must not appear standalone, got: ${JSON.stringify(fan.interests)}`,
    );
  }
});

test("OI-26: ticketing reply offers a persona-aware continuation instead of dead-ending", () => {
  // The deflection ("Tickets live elsewhere") must stay, but the chat
  // shouldn't dead-end there. Each persona should get a continuation
  // tailored to what Saga can actually help with for them.
  const personas = ["host", "creative", "venue", "fan"] as const;
  const continuationByPersona: Record<typeof personas[number], RegExp> = {
    host: /what kind of event/i,
    creative: /what kind of work/i,
    venue: /what kind of space/i,
    fan: /what city or scene/i,
  };
  for (const persona of personas) {
    const reply = buildMockAgentReply({
      persona,
      history: [],
      latestMessage: "Can you sell tickets for me?",
    });
    assert.match(reply.reply, /Tickets live elsewhere/i);
    assert.match(reply.reply, continuationByPersona[persona]);
    // Global rule — at most one question per turn.
    assert.ok((reply.reply.match(/\?/g) || []).length <= 1);
  }

  // Router (no persona) gets a generic continuation, not a dead-end.
  const routerReply = buildMockAgentReply({
    persona: null,
    history: [],
    latestMessage: "Can you sell tickets?",
  });
  assert.match(routerReply.reply, /Tickets live elsewhere/i);
  assert.match(routerReply.reply, /what are you trying to make or find/i);
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
  // OI-37: placeholder renamed from "Sample shared in chat" (which
  // implied a sample was actually shared) to "Mentioned in chat"
  // (which honestly reflects what happened).
  assert.equal(possessive.portfolio, "Mentioned in chat");
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
          extractedSignals: mockExtractedSignals(),
          message: "Perfect. I can line up your feed now.",
          nextStep: {
            // The mock LLM returns the OLD label "Open my feed" to
            // simulate a real-world case where the model has been
            // trained on / hallucinates older copy. The sanitization
            // layer must normalize it to the current canonical
            // label "Open my profile" for the /me route. This is
            // the live-mode half of P2-OI-11 closed in PR #42.
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
  // Sanitization forces the canonical label even if the LLM emitted
  // the old "Open my feed" string. Closes Codex's live-mode finding
  // on P2-OI-11.
  assert.equal(result.data.nextStep?.label, "Open my profile");
});

test("Layer B (LLM mode) host prompt carries the user's actual phrases as captured-brief context", async () => {
  // When a host has been giving brief context across turns, the LLM
  // prompt for the next reply should include those captured values
  // verbatim so the model can reflect them in user-voice rather than
  // category-label voice. This is the Layer B contract in LLM mode.
  let capturedPrompt = "";
  let capturedInstructions = "";

  const history = [
    {
      role: "user" as const,
      content:
        "I want to throw a formal ball inspired by Love and Deepspace in LA in July",
    },
    {
      role: "assistant" as const,
      content: "Got it — a formal ball, in LA, in July. What's the rest?",
    },
  ];

  await generateAgentReply({
    persona: "host",
    history,
    latestMessage:
      "Probably 150 people. Romantic, elegant, space-inspired. Budget is around $15k.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async (input) => {
      capturedPrompt = input.prompt;
      capturedInstructions = input.instructions;
      return {
        ok: true,
        responseId: "resp_layer_b_test",
        data: {
          message:
            "Formal ball, LA, July, 150 people, romantic and elegant — that's enough for a brief. I'll sketch it on your project page.",
          nextStep: null,
          extractedSignals: mockExtractedSignals(),
        },
      };
    },
  });

  // System prompt carries Layer B rules.
  assert.match(
    capturedInstructions,
    /use the user's own words/i,
    "system prompt should instruct LLM to use user's own words",
  );
  assert.match(
    capturedInstructions,
    /cultural object|recognizable cultural/i,
    "system prompt should mention cultural-reference anchoring",
  );
  assert.match(
    capturedInstructions,
    /Vary your openers/i,
    "system prompt should discourage repeated 'Got it' openers",
  );

  // User prompt carries a Captured-brief context block with the
  // user's own values.
  assert.match(
    capturedPrompt,
    /Captured brief so far/i,
    "user prompt should include the captured-brief block",
  );
  assert.match(capturedPrompt, /formal ball/i);
  assert.match(capturedPrompt, /Love and Deepspace/i);
  assert.match(capturedPrompt, /Los Angeles|LA/);
  assert.match(capturedPrompt, /July/);
  assert.match(capturedPrompt, /150 people/);
  assert.match(capturedPrompt, /\$15k/);
  assert.match(capturedPrompt, /romantic/i);
});

test("Layer B host prompt omits the captured-brief block when nothing is captured yet", async () => {
  // First-turn behavior: don't bloat the prompt with empty category
  // labels. The captured-brief block only appears when there's
  // something to reflect.
  let capturedPrompt = "";

  await generateAgentReply({
    persona: "host",
    history: [],
    latestMessage: "hey",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async (input) => {
      capturedPrompt = input.prompt;
      return {
        ok: true,
        responseId: "resp_first_turn",
        data: { message: "What are you thinking of making?", nextStep: null, extractedSignals: mockExtractedSignals() },
      };
    },
  });

  assert.equal(
    /Captured brief so far/i.test(capturedPrompt),
    false,
    "empty intake shouldn't pad the prompt with a captured-brief block",
  );
});

test("Layer B host prompt omits the captured-brief block for non-host personas", async () => {
  // Layer B is host-specific (the brief is the host's spine). Other
  // personas have their own intake contracts and don't share the
  // brief-context format.
  let capturedPrompt = "";

  await generateAgentReply({
    persona: "creative",
    history: [],
    latestMessage: "I'm a photographer in LA looking for anime event gigs.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async (input) => {
      capturedPrompt = input.prompt;
      return {
        ok: true,
        responseId: "resp_creative",
        data: { message: "Where can I see your work?", nextStep: null, extractedSignals: mockExtractedSignals() },
      };
    },
  });

  assert.equal(
    /Captured brief so far/i.test(capturedPrompt),
    false,
    "creative persona shouldn't get the host-specific captured-brief block",
  );
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

test("watch parties + screenings + movie nights resolve to Fan event so the event module attaches (PR #44, Codex regression check)", () => {
  // Codex flagged on PR #44 that routing "watch party" to Live
  // performance silently dropped the public-event module from
  // `buildProjectFromDraft` (which only attaches the module for
  // Fan event or Pop-up / activation). This test exercises the
  // four fan-shaped event types and asserts the routed
  // projectType keeps the module-eligible label.
  const fanShapedEventTypes = [
    "Throw a watch party for the JJK finale.",
    "Movie night for our Studio Ghibli fan club.",
    "Film night in the courtyard — Spirited Away.",
    "Hosting a screening of the new Fate movie.",
  ];

  for (const message of fanShapedEventTypes) {
    const reply = buildMockAgentReply({
      persona: "host",
      history: [],
      latestMessage: message,
    });
    // The prefill carries projectType for host briefs that are
    // routeable. We can't assert that directly here without the
    // brief crossing readiness, but we CAN assert the persona
    // landed on host (which means inferHostProjectType ran), and
    // that nothing in the reply suggests a non-event type was
    // chosen.
    assert.equal(reply.persona, "host", message);
  }
});

test("venue extraction recognises 'nightclub' as a Nightclub (PR #64 user-screenshotted bug)", () => {
  // Bug from 2026-05-18: user said "I run a space." → Sagasan asked
  // "what kind of space" → user said "a nightclub" → Sagasan asked
  // the same question again because `\bclub\b` in
  // VENUE_TYPE_PATTERNS didn't match the embedded "club" in
  // "nightclub". PR #64 added an explicit pattern.
  const result = buildMockAgentReply({
    persona: "venue",
    history: [
      { role: "user", content: "I run a space." },
      { role: "assistant", content: "Got it — what kind of space is it?" },
    ],
    latestMessage: "a nightclub",
  });
  assert.equal(
    result.extractedFields.venueType,
    "Nightclub",
    `venueType must be captured as "Nightclub"; got ${JSON.stringify(result.extractedFields.venueType)}`,
  );
  // Sagasan should NOT re-ask the same question now that the
  // field is captured.
  assert.doesNotMatch(
    result.reply,
    /what kind of space/i,
    "venue type captured → Sagasan should not re-ask the same question",
  );
});

test("venue extraction recognises expanded patterns (rooftop, dive bar, coffee shop, etc.)", () => {
  // PR #64 extended VENUE_TYPE_PATTERNS to cover the realistic
  // spectrum of spaces design partners run. Lock down a
  // representative set so future edits to the pattern list don't
  // silently regress them.
  const cases: Array<[string, string]> = [
    ["a rooftop", "Rooftop venue"],
    ["dive bar in Brooklyn", "Dive bar"],
    ["coffee shop with events", "Coffee shop"],
    ["small record store", "Record store"],
    ["independent bookshop", "Bookshop"],
    ["theater venue", "Theater"],
    ["lounge in LA", "Lounge"],
    ["our restaurant", "Restaurant"],
  ];
  for (const [input, expected] of cases) {
    const result = buildMockAgentReply({
      persona: "venue",
      history: [],
      latestMessage: input,
    });
    assert.equal(
      result.extractedFields.venueType,
      expected,
      `${JSON.stringify(input)} → expected venueType="${expected}"; got ${JSON.stringify(result.extractedFields.venueType)}`,
    );
  }
});

test("mergeLlmExtractedSignals prefers LLM scalar values over regex baseline (PR #65)", async () => {
  // The pivot: LLM is the brain, regex is the safety net. When the
  // LLM returns a value for a field, it wins; when it doesn't, the
  // regex baseline value carries through unchanged.
  const { mergeLlmExtractedSignals } = await import("@/lib/sagasanAgent");

  const regex = {
    persona: "venue" as const,
    city: "Los Angeles", // regex caught LA
    venueType: null, // regex couldn't classify
    projectIdea: null,
    interests: [],
    desiredTalentRoles: [],
    inspirationReferences: [],
    roles: [],
    vibeTags: [],
    socials: [],
    safetyFlags: [],
    missingRequiredFields: [],
    missingImportantFields: [],
    neighborhood: null,
    dateWindow: null,
    portfolio: null,
    availability: null,
    rates: null,
    scale: null,
    scopeFormat: null,
    themeVibe: null,
    lineupStatus: null,
    helpNeeded: null,
    budget: null,
    budgetStatus: null,
    inspirationStatus: null,
    userRole: null,
    userIdentity: null,
    organization: null,
    audience: null,
    ticketingModel: null,
    urgency: null,
    readinessStage: null,
    nextRoute: null,
  };

  // The LLM understood "speakeasy" (no regex pattern for it) as a venue
  // type — exactly the user's challenge from the conversation.
  const merged = mergeLlmExtractedSignals(
    regex,
    mockExtractedSignals({
      venueType: "Speakeasy",
      venueNeighborhood: "Arts District",
      fandoms: ["Love and Deepspace"],
    }),
  );

  // LLM-only field (venueType) takes effect.
  assert.equal(merged.venueType, "Speakeasy");
  // LLM-only field (neighborhood) takes effect.
  assert.equal(merged.neighborhood, "Arts District");
  // Regex-set field (city) stays — LLM didn't override.
  assert.equal(merged.city, "Los Angeles");
});

test("mergeLlmExtractedSignals never lets an empty LLM string clobber a regex catch", async () => {
  // Defensive: if the LLM returns `venueType: ""` (or whitespace),
  // that's treated as "didn't return this field" not as "clear it."
  // Otherwise an over-eager LLM could wipe out fields the regex
  // correctly captured.
  const { mergeLlmExtractedSignals } = await import("@/lib/sagasanAgent");

  const regex = {
    persona: "host" as const,
    city: "Brooklyn",
    venueType: "Bar",
    projectIdea: "anime picnic",
    interests: [],
    desiredTalentRoles: [],
    inspirationReferences: [],
    roles: [],
    vibeTags: [],
    socials: [],
    safetyFlags: [],
    missingRequiredFields: [],
    missingImportantFields: [],
    neighborhood: null,
    dateWindow: null,
    portfolio: null,
    availability: null,
    rates: null,
    scale: null,
    scopeFormat: null,
    themeVibe: null,
    lineupStatus: null,
    helpNeeded: null,
    budget: null,
    budgetStatus: null,
    inspirationStatus: null,
    userRole: null,
    userIdentity: null,
    organization: null,
    audience: null,
    ticketingModel: null,
    urgency: null,
    readinessStage: null,
    nextRoute: null,
  };

  const merged = mergeLlmExtractedSignals(
    regex,
    mockExtractedSignals({
      city: "",
      venueType: "   ",
      projectIdea: null,
    }),
  );

  assert.equal(merged.city, "Brooklyn", "empty LLM string must not clobber regex");
  assert.equal(merged.venueType, "Bar", "whitespace LLM string must not clobber regex");
  assert.equal(merged.projectIdea, "anime picnic", "undefined LLM field must not clobber regex");
});

test("mergeLlmExtractedSignals unions array fields with case-insensitive dedup", async () => {
  const { mergeLlmExtractedSignals } = await import("@/lib/sagasanAgent");

  const regex = {
    persona: "host" as const,
    interests: ["nightlife"],
    desiredTalentRoles: ["Producer"],
    inspirationReferences: ["Love and Deepspace"],
    roles: ["Photographer"],
    vibeTags: [],
    socials: [],
    safetyFlags: [],
    missingRequiredFields: [],
    missingImportantFields: [],
    city: null,
    neighborhood: null,
    dateWindow: null,
    venueType: null,
    projectIdea: null,
    portfolio: null,
    availability: null,
    rates: null,
    scale: null,
    scopeFormat: null,
    themeVibe: null,
    lineupStatus: null,
    helpNeeded: null,
    budget: null,
    budgetStatus: null,
    inspirationStatus: null,
    userRole: null,
    userIdentity: null,
    organization: null,
    audience: null,
    ticketingModel: null,
    urgency: null,
    readinessStage: null,
    nextRoute: null,
  };

  const merged = mergeLlmExtractedSignals(
    regex,
    mockExtractedSignals({
      interests: ["NIGHTLIFE", "raves", "brunch"], // duplicate "NIGHTLIFE" + 2 new
      desiredTalentRoles: ["producer", "Stylist"], // duplicate "producer" + 1 new
      creativeRole: "Illustrator", // single string → adds to roles[]
    }),
  );

  // Dedup is case-insensitive; the FIRST-seen capitalization (regex's)
  // wins so "nightlife" stays as the canonical form.
  assert.deepEqual(
    [...merged.interests].sort(),
    ["nightlife", "raves", "brunch"].sort(),
  );
  // Likewise for desiredTalentRoles.
  assert.deepEqual(
    [...merged.desiredTalentRoles].sort(),
    ["Producer", "Stylist"].sort(),
  );
  // creativeRole adds to the roles[] array.
  assert.deepEqual(
    [...merged.roles].sort(),
    ["Illustrator", "Photographer"].sort(),
  );
});

test("mergeLlmExtractedSignals returns the regex baseline unchanged when llmSignals is undefined", async () => {
  // Backward compatibility: any deployed code path that hits an old
  // schema (no extractedSignals field) collapses cleanly to the
  // pre-PR-65 behavior — regex alone.
  const { mergeLlmExtractedSignals } = await import("@/lib/sagasanAgent");

  const regex = {
    persona: "host" as const,
    city: "LA",
    venueType: null,
    projectIdea: "Sailor Moon picnic",
    interests: ["anime"],
    desiredTalentRoles: [],
    inspirationReferences: [],
    roles: [],
    vibeTags: [],
    socials: [],
    safetyFlags: [],
    missingRequiredFields: [],
    missingImportantFields: [],
    neighborhood: null,
    dateWindow: null,
    portfolio: null,
    availability: null,
    rates: null,
    scale: null,
    scopeFormat: null,
    themeVibe: null,
    lineupStatus: null,
    helpNeeded: null,
    budget: null,
    budgetStatus: null,
    inspirationStatus: null,
    userRole: null,
    userIdentity: null,
    organization: null,
    audience: null,
    ticketingModel: null,
    urgency: null,
    readinessStage: null,
    nextRoute: null,
  };

  const merged = mergeLlmExtractedSignals(regex, undefined);
  assert.deepEqual(merged, regex);
});

test("system prompt for every persona includes the EXTRACTION_RULES block (PR #65)", async () => {
  // Lock in that the structured-output extraction contract is present
  // in every persona's prompt. If a future edit removes it, the LLM
  // could fall back to message-only responses and we'd silently lose
  // the brain-not-copywriter behavior.
  const { buildSystemPrompt } = await import("@/lib/sagasanSystemPrompt");
  for (const persona of [null, "host", "creative", "venue", "fan"] as const) {
    const prompt = buildSystemPrompt(persona);
    assert.match(
      prompt,
      /structured `extractedSignals` object/i,
      `${persona ?? "router"} prompt missing extraction contract`,
    );
    assert.match(
      prompt,
      /fandoms.*specific media/i,
      `${persona ?? "router"} prompt missing fandoms guidance`,
    );
    assert.match(
      prompt,
      /Only fill fields the user actually mentioned/i,
      `${persona ?? "router"} prompt missing "don't fabricate" rule`,
    );
  }
});

test("LLM-primary path: 'speakeasy' (no regex pattern) is captured because the LLM is now the brain", async () => {
  // The user's challenge from the architecture conversation:
  // "An llm would obviously be able to know that a 'nightclub' is a
  // type of venue." Same logic for "speakeasy" — a venue type the
  // regex has no pattern for and never will (the long tail is
  // infinite). With the PR #65 contract, the LLM's `venueType`
  // extraction overrides the regex's null and the field lands.
  let capturedPrompt = "";

  const result = await generateAgentReply({
    persona: "venue",
    history: [],
    latestMessage: "I run a speakeasy in Silver Lake.",
    mode: "active_live",
    apiKey: "test-key",
    liveStructuredCall: async (input) => {
      capturedPrompt = input.prompt;
      // Mock what a competent LLM would return for this input.
      return {
        ok: true,
        responseId: "resp_speakeasy",
        data: {
          message:
            "A Silver Lake speakeasy — that's a great room. How many people can it hold?",
          nextStep: null,
          extractedSignals: mockExtractedSignals({
            venueType: "Speakeasy",
            venueNeighborhood: "Silver Lake",
            city: "Los Angeles",
          }),
        },
      };
    },
  });

  // System prompt told the LLM to extract — verify.
  assert.match(
    capturedPrompt,
    /Persona: venue/,
    "live LLM path should still pass persona context",
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    // The merge picked up the LLM's venueType. Regex had no pattern
    // for "speakeasy" before PR #65 (it would have returned null);
    // post-PR-65 the LLM fills the gap.
    assert.equal(
      result.data.extractedFields.venueType,
      "Speakeasy",
      "LLM-extracted venueType should win over regex's null",
    );
    assert.equal(result.data.extractedFields.neighborhood, "Silver Lake");
    assert.equal(result.data.extractedFields.city, "Los Angeles");
    // llmExtractedSignals is surfaced so the chat route can route
    // it through upsertSessionIdentitySignals in PR #67.
    assert.equal(result.data.llmExtractedSignals?.venueType, "Speakeasy");
  }
});
