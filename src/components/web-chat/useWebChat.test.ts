import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFreshConversationFlag,
  isUiChatFallbackReply,
  mergeRestoredMessages,
  parseWebChatHistoryResponse,
  parseWebChatResponse,
  resolveRestoredPersona,
} from "@/components/web-chat/useWebChat";

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

test("parseWebChatHistoryResponse accepts content, reply, and message shapes", () => {
  const parsed = parseWebChatHistoryResponse({
    conversationId: "conversation-4",
    persona: "host",
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        reply: "Got it. I shaped that into a draft event brief.",
        mode: "holding",
        nextStep: {
          label: "Build my event",
          route: "/projects/new",
          prefill: {
            city: "Silver Lake",
          },
        },
        turn: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "assistant-2",
        role: "assistant",
        message: "Got it — I shaped that into your creative profile draft.",
        mode: "holding",
        turn: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(parsed?.messages[0]?.content, "Got it. I shaped that into a draft event brief.");
  assert.equal(parsed?.messages[0]?.nextStep?.route, "/projects/new");
  assert.equal(
    parsed?.messages[1]?.content,
    "Got it — I shaped that into your creative profile draft.",
  );
});

test("mergeRestoredMessages preserves pending handoff when legacy GET omits nextStep", () => {
  const merged = mergeRestoredMessages({
    restoredMessages: [
      {
        id: "user-1",
        role: "user",
        content:
          "I want to throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe.",
        persona: "host",
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Got it. I shaped that into a draft event brief.",
        persona: null,
        mode: "holding",
        nextStep: null,
      },
    ],
    cachedMessages: [
      {
        id: "user-cache-1",
        role: "user",
        content:
          "I want to throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe.",
        persona: "host",
      },
      {
        id: "assistant-cache-1",
        role: "assistant",
        content: "Got it. I shaped that into a draft event brief.",
        persona: "host",
        mode: "holding",
        nextStep: {
          label: "Build my event",
          route: "/projects/new",
          prefill: {
            city: "Silver Lake",
            projectIdea: "anime picnic",
          },
        },
      },
    ],
    pendingNextStep: {
      label: "Build my event",
      route: "/projects/new",
      prefill: {
        city: "Silver Lake",
        projectIdea: "anime picnic",
      },
    },
  });

  assert.equal(merged[1]?.content, "Got it. I shaped that into a draft event brief.");
  assert.equal(merged[1]?.nextStep?.route, "/projects/new");
  assert.equal(merged[1]?.nextStep?.prefill.city, "Silver Lake");
});

test("mergeRestoredMessages prefers backend content over weaker UI fallback", () => {
  const merged = mergeRestoredMessages({
    restoredMessages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "Got it — I shaped that into your creative profile draft.",
        persona: "creative",
        mode: "holding",
        nextStep: {
          label: "Open my feed",
          route: "/me",
          prefill: {
            city: "Los Angeles",
          },
        },
      },
    ],
    cachedMessages: [
      {
        id: "assistant-cache-1",
        role: "assistant",
        content: "Got it — I lost that turn for a second. What city are you based in?",
        persona: "host",
        mode: "holding",
        nextStep: null,
      },
    ],
  });

  assert.equal(
    merged[0]?.content,
    "Got it — I shaped that into your creative profile draft.",
  );
  assert.equal(isUiChatFallbackReply(merged[0]?.content), false);
});

test("resolveRestoredPersona clears stale host state when server restores a creative thread", () => {
  const persona = resolveRestoredPersona({
    responsePersona: null,
    cachedPersona: "host",
    mergedMessages: [
      {
        id: "assistant-creative",
        role: "assistant",
        content: "Got it — I shaped that into your creative profile draft.",
        persona: "creative",
        mode: "holding",
        nextStep: {
          label: "Open my feed",
          route: "/me",
          prefill: {
            city: "Los Angeles",
          },
        },
      },
    ],
    fallbackPersona: null,
  });

  assert.equal(persona, "creative");
});

test("parseWebChatResponse rejects unusable payloads", () => {
  assert.equal(parseWebChatResponse(null), null);
  assert.equal(
    parseWebChatResponse({
      conversationId: "conversation-5",
      turn: 0,
      mode: "holding",
    }),
    null,
  );
});

test("fresh conversation flags suppress restore when requested", () => {
  assert.equal(hasFreshConversationFlag("?new=1"), true);
  assert.equal(hasFreshConversationFlag("?fresh=true"), true);
  assert.equal(hasFreshConversationFlag("?new=&intent=host"), true);
  assert.equal(hasFreshConversationFlag("?intent=host"), false);
});
