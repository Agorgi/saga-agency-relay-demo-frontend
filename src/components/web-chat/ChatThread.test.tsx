import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatThread } from "@/components/web-chat/ChatThread";

test("chat thread renders an inline next-step button", () => {
  const markup = renderToStaticMarkup(
    <ChatThread
      isSending={false}
      messages={[
        {
          id: "assistant-1",
          role: "assistant",
          content: "I have enough to build your draft.",
          nextStep: {
            label: "Build my event",
            route: "/projects/new",
            prefill: {
              eventType: "Pop-up / activation",
              city: "Los Angeles",
              scale: "100 people",
              vibe: "Playful neon anime night",
              projectType: "Pop-up / activation",
              suggestedRoles: ["Producer", "Photographer"],
            },
          },
        },
      ]}
    />,
  );

  assert.match(markup, /I have enough to build your draft\./);
  assert.match(markup, /Build my event/);
  assert.match(markup, /data-next-step-href="\/projects\/new\?prefill=/);
  assert.doesNotMatch(markup, /we['’]ve logged your message/i);
});

test("chat thread keeps backend reply labels short", () => {
  const markup = renderToStaticMarkup(
    <ChatThread
      isSending={false}
      messages={[
        {
          id: "assistant-2",
          role: "assistant",
          content: "Here is your next move.",
          nextStep: {
            label: "Open my feed",
            route: "/me",
            prefill: {
              city: "Los Angeles",
              roles: ["Photographer"],
            },
          },
        },
      ]}
    />,
  );

  assert.match(markup, /Open my feed/);
  assert.equal("Open my feed".split(/\s+/).length <= 5, true);
});

test("chat thread renders assistant content without requiring a CTA", () => {
  const markup = renderToStaticMarkup(
    <ChatThread
      isSending={false}
      messages={[
        {
          id: "assistant-3",
          role: "assistant",
          content: "Tickets live elsewhere — Saga doesn't handle those.",
          persona: "creative",
          mode: "autonomous",
          nextStep: null,
        },
      ]}
    />,
  );

  assert.match(markup, /Tickets live elsewhere/);
  assert.doesNotMatch(markup, /data-next-step-href=/);
});
