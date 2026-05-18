import assert from "node:assert/strict";
import test from "node:test";
import { computeLlmFallbackRate } from "@/sms-engine/observability/observabilitySummary";

test("computeLlmFallbackRate: LLM gated off — every reply is a fallback, rate is 100%", () => {
  // Closes Cowork P2-OI-17: prior formula was
  // `fallbackUsed / callStarted`, which divided by zero in this
  // case and reported 0% even though every reply was a fallback.
  const rate = computeLlmFallbackRate({
    callStarted: 0,
    callFailed: 0,
    fallbackUsed: 27,
  });
  assert.equal(rate, 1.0);
});

test("computeLlmFallbackRate: empty window — all zeros — returns 0 (no divide-by-zero)", () => {
  const rate = computeLlmFallbackRate({
    callStarted: 0,
    callFailed: 0,
    fallbackUsed: 0,
  });
  assert.equal(rate, 0);
});

test("computeLlmFallbackRate: LLM live + every call succeeded — rate is 0%", () => {
  const rate = computeLlmFallbackRate({
    callStarted: 100,
    callFailed: 0,
    fallbackUsed: 0,
  });
  assert.equal(rate, 0);
});

test("computeLlmFallbackRate: LLM live + 5 calls failed-and-fell-back of 100 — rate is 5%", () => {
  // Every `llm.call_failed` is paired with an `llm.fallback_used`,
  // so denominator subtracts callFailed to avoid double-counting.
  const rate = computeLlmFallbackRate({
    callStarted: 100,
    callFailed: 5,
    fallbackUsed: 5,
  });
  assert.equal(rate, 0.05);
});

test("computeLlmFallbackRate: mixed mode — some calls + some gated-off fallbacks", () => {
  // 10 OpenAI calls (2 failed → 2 fallbacks). Plus 10 more
  // fallbacks that fired with no call (gated-off path).
  // Total attempts = 10 + max(0, 12 − 2) = 10 + 10 = 20.
  // Rate = 12 / 20 = 0.60.
  const rate = computeLlmFallbackRate({
    callStarted: 10,
    callFailed: 2,
    fallbackUsed: 12,
  });
  assert.equal(rate, 0.6);
});

test("computeLlmFallbackRate: rounds to two decimal places", () => {
  // 1 of 3 calls fell back; raw value is 0.3333..., rounded to 0.33.
  const rate = computeLlmFallbackRate({
    callStarted: 3,
    callFailed: 1,
    fallbackUsed: 1,
  });
  assert.equal(rate, 0.33);
});

test("computeLlmFallbackRate: never produces NaN / Infinity / negative", () => {
  // Defensive: malformed inputs shouldn't crash the operator
  // dashboard. callFailed > fallbackUsed is impossible in audit
  // logs but the math should still resolve sanely.
  const oddRate = computeLlmFallbackRate({
    callStarted: 10,
    callFailed: 5,
    fallbackUsed: 1,
  });
  // Denominator = 10 + max(0, 1 − 5) = 10 + 0 = 10. Rate = 1/10 = 0.10.
  assert.equal(oddRate, 0.1);
  assert.equal(Number.isFinite(oddRate), true);
});
