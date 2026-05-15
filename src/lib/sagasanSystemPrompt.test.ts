import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "@/lib/sagasanSystemPrompt";

test("system prompt enforces one question per turn", () => {
  const prompt = buildSystemPrompt("host");
  assert.match(prompt, /Ask at most one question per turn\./);
});

test("system prompt blocks ticket handling", () => {
  const prompt = buildSystemPrompt("fan");
  assert.match(
    prompt,
    /Tickets live elsewhere — Saga doesn't handle those\./,
  );
});
