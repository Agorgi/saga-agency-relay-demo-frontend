import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyIdentitySignals,
  extractIdentitySignals,
  mergeIdentitySignals,
} from "@/lib/identitySignals";

test("extractIdentitySignals returns empty signals for empty input", () => {
  assert.deepEqual(extractIdentitySignals(""), emptyIdentitySignals());
  assert.deepEqual(extractIdentitySignals(null), emptyIdentitySignals());
  assert.deepEqual(extractIdentitySignals(undefined), emptyIdentitySignals());
  assert.deepEqual(extractIdentitySignals("   "), emptyIdentitySignals());
});

test("extractIdentitySignals recognises 'love and deepspace' as a fandom (the user-screenshotted case)", () => {
  // The user explicitly cited this fandom when lifting the
  // identity-graph workstream. It must round-trip cleanly with
  // canonical capitalization regardless of how the user typed it.
  const cases = [
    "I want to throw a Love and Deepspace formal ball.",
    "It's a love and deepspace inspired event.",
    "LOVE AND DEEPSPACE",
  ];
  for (const text of cases) {
    const signals = extractIdentitySignals(text);
    assert.ok(
      signals.fandoms.includes("Love and Deepspace"),
      `expected Love and Deepspace fandom for: ${JSON.stringify(text)}; got ${JSON.stringify(signals)}`,
    );
  }
});

test("extractIdentitySignals recognises fandoms across the user spectrum", () => {
  // A representative span of fandoms the design-partner cohort
  // mentions. The list isn't exhaustive — pattern coverage will
  // expand as we observe more user input.
  const examples: Array<[string, string]> = [
    ["I'm an anime fan", "anime"],
    ["Big K-pop nights", "K-pop"],
    ["kpop with no hyphen", "K-pop"],
    ["JJK cosplayer", "JJK"],
    ["I love One Piece", "One Piece"],
    ["A Genshin Impact fan event", "Genshin Impact"],
    ["Honkai Star Rail listener", "Honkai Star Rail"],
    ["A drag-night gathering", "drag culture"],
  ];
  for (const [text, expectedFandom] of examples) {
    const signals = extractIdentitySignals(text);
    assert.ok(
      signals.fandoms.includes(expectedFandom),
      `${JSON.stringify(text)} should surface fandom "${expectedFandom}"; got ${JSON.stringify(signals.fandoms)}`,
    );
  }
});

test("extractIdentitySignals separates fandoms from broader interests", () => {
  // "anime" is a fandom — overlap is meaningful collaboration
  // signal. "nightlife" is an interest — useful but weaker. The
  // separator must hold so the PR #68 matching helper doesn't
  // cross-pollinate them.
  const signals = extractIdentitySignals(
    "I run anime nightlife events with rooftop pop-ups",
  );
  assert.ok(signals.fandoms.includes("anime"));
  assert.equal(
    signals.fandoms.some((f) => /nightlife|rooftop|pop[- ]?ups?/i.test(f)),
    false,
    "interest tags must not leak into fandoms",
  );
  for (const interest of ["nightlife", "rooftop venues", "pop-ups"]) {
    assert.ok(
      signals.interests.includes(interest),
      `expected interest "${interest}", got ${JSON.stringify(signals.interests)}`,
    );
  }
});

test("extractIdentitySignals deduplicates within a single message", () => {
  const signals = extractIdentitySignals(
    "anime fan running anime nights, anime cosplay, anime watch parties",
  );
  const animeCount = signals.fandoms.filter((f) => f === "anime").length;
  assert.equal(animeCount, 1);
});

test("mergeIdentitySignals unions case-insensitively, keeping first-seen capitalization", () => {
  const a = { fandoms: ["K-pop", "anime"], interests: ["nightlife"] };
  const b = { fandoms: ["kpop", "Cosplay"], interests: ["NIGHTLIFE", "raves"] };
  const merged = mergeIdentitySignals(a, b);
  // K-pop wins over kpop (first-seen)
  assert.ok(merged.fandoms.includes("K-pop"));
  assert.equal(merged.fandoms.filter((f) => f.toLowerCase() === "k-pop").length, 1);
  // cosplay added from B
  assert.ok(merged.fandoms.includes("Cosplay"));
  // anime preserved from A
  assert.ok(merged.fandoms.includes("anime"));
  // nightlife appears once (case-insensitive dedup)
  assert.equal(
    merged.interests.filter((i) => i.toLowerCase() === "nightlife").length,
    1,
  );
  // raves added from B
  assert.ok(merged.interests.includes("raves"));
});

test("mergeIdentitySignals returns a stable shape when both inputs are empty", () => {
  const merged = mergeIdentitySignals(emptyIdentitySignals(), emptyIdentitySignals());
  assert.deepEqual(merged, emptyIdentitySignals());
});
