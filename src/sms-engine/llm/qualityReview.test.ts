import assert from "node:assert/strict";
import test from "node:test";
import { safeLlmReviewText } from "@/sms-engine/llm/qualityReview";

test("safeLlmReviewText handles nested data.reply values", () => {
  assert.equal(
    safeLlmReviewText({
      data: {
        reply: "Here is the selected Sagasan reply.",
      },
    }),
    "Here is the selected Sagasan reply.",
  );
});

test("safeLlmReviewText handles top-level reply and message values", () => {
  assert.equal(
    safeLlmReviewText({
      reply: "Top-level reply works.",
    }),
    "Top-level reply works.",
  );

  assert.equal(
    safeLlmReviewText({
      message: "Top-level message works.",
    }),
    "Top-level message works.",
  );
});

test("safeLlmReviewText redacts pii and secrets", () => {
  const text = safeLlmReviewText({
    reply: "Email me at hi@example.com or call +1 555 123 4567.",
  });

  assert.match(text || "", /\[redacted-email\]/);
  assert.match(text || "", /\[redacted-phone\]/);
});

test("safeLlmReviewText does not throw on unknown objects", () => {
  assert.equal(
    safeLlmReviewText({
      foo: "bar",
      count: 2,
    }),
    "Structured output fields: foo, count",
  );
});
