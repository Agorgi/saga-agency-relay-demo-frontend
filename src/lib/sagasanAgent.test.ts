import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockAgentReply,
  extractStructuredFields,
  generateAgentReply,
  resolvePersona,
} from "@/lib/sagasanAgent";

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
  assert.match(result.reply, /draft event brief/i);
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
  assert.equal(result.nextStep?.prefill.projectIdea, "throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe");
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
