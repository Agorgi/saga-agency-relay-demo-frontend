import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockAgentReply,
  generateAgentReply,
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
  assert.match(result.reply, /draft crew brief/i);
});

test("generic persona starters do not get mistaken for intake answers", () => {
  const hostResult = buildMockAgentReply({
    persona: "host",
    history: [],
    latestMessage: "I want to host something.",
  });

  const fanResult = buildMockAgentReply({
    persona: "fan",
    history: [],
    latestMessage: "I'm here to find cool stuff.",
  });

  assert.equal(hostResult.nextStep, null);
  assert.equal(fanResult.nextStep, null);
  assert.match(hostResult.reply, /What are you hosting\?/);
  assert.match(fanResult.reply, /What city should Saga tune for you\?/);
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
  assert.match(capturedPrompt, /Reply with Sagasan's next message/);
  assert.equal(result.data.nextStep?.route, "/me");
  assert.equal(result.data.nextStep?.label, "Open my feed");
});
