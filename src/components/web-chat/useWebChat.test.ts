import assert from "node:assert/strict";
import test from "node:test";
import { parseWebChatResponse } from "@/components/web-chat/useWebChat";

test("parseWebChatResponse accepts top-level reply", () => {
  const parsed = parseWebChatResponse({
    conversationId: "conversation-1",
    persona: "host",
    reply: "Got it. What city are you thinking?",
    turn: 0,
    mode: "holding",
    nextStep: {
      label: "Build my event",
      route: "/projects/new",
      prefill: {
        city: "Los Angeles",
      },
    },
  });

  assert.equal(parsed?.reply, "Got it. What city are you thinking?");
  assert.equal(parsed?.nextStep?.route, "/projects/new");
});

test("parseWebChatResponse accepts message and nested data.reply shapes", () => {
  const topLevelMessage = parseWebChatResponse({
    conversationId: "conversation-2",
    persona: "creative",
    message: "Got it. What city are you based in?",
    turn: 1,
    mode: "autonomous",
  });

  const nestedReply = parseWebChatResponse({
    conversationId: "conversation-3",
    data: {
      reply: "Got it. What city is the space in?",
      turn: 2,
      mode: "holding",
      persona: "venue",
      nextStep: {
        label: "List my space",
        route: "/spaces",
        prefill: {
          city: "Brooklyn",
        },
      },
    },
  });

  assert.equal(topLevelMessage?.reply, "Got it. What city are you based in?");
  assert.equal(topLevelMessage?.mode, "autonomous");
  assert.equal(nestedReply?.reply, "Got it. What city is the space in?");
  assert.equal(nestedReply?.nextStep?.route, "/spaces");
});

test("parseWebChatResponse rejects unusable payloads", () => {
  assert.equal(parseWebChatResponse(null), null);
  assert.equal(
    parseWebChatResponse({
      conversationId: "conversation-4",
      turn: 0,
      mode: "holding",
    }),
    null,
  );
});
