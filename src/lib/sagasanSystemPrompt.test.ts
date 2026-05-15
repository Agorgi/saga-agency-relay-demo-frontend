import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "@/lib/sagasanSystemPrompt";

test("system prompt enforces one question per turn", () => {
  const prompt = buildSystemPrompt("host");
  assert.match(prompt, /Ask at most one question per turn\./);
});

test("every persona prompt keeps one-question rule", () => {
  for (const persona of ["host", "creative", "venue", "fan"] as const) {
    const prompt = buildSystemPrompt(persona);
    assert.match(prompt, /Ask at most one question per turn\./);
  }
});

test("system prompt blocks ticket handling", () => {
  const prompt = buildSystemPrompt("fan");
  assert.match(
    prompt,
    /Tickets live elsewhere — Saga doesn't handle those\./,
  );
});

test("host prompt includes nextStep handoff rule", () => {
  const prompt = buildSystemPrompt("host");
  assert.match(
    prompt,
    /emit nextStep with route \/projects\/new\./,
  );
  assert.match(
    prompt,
    /Once you have the minimum info to move them forward, emit a nextStep block with a label of five words or fewer\./,
  );
});
