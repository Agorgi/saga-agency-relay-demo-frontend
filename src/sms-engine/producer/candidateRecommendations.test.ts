import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import { buildSourcingPlan } from "@/sms-engine/producer/sourcingPlan";
import { recommendInternalCandidates } from "@/sms-engine/producer/candidateRecommendations";
import type { CandidatePoolItem } from "@/sms-engine/producer/producerAgentTypes";

// Hand-built scenario: a host project that names "Love and Deepspace"
// in the brief, with the project owner ALSO carrying "Genshin Impact"
// on their identity-graph Person.fandoms (added via PRs #63–#67).
// PR #68 unions both into ProjectUnderstanding.fandoms; PR #69 splits
// the matchingReasons output so the human-readable rationale
// differentiates brief-driven matches from owner-identity-graph matches.

function buildPool(fandoms: string[]): CandidatePoolItem {
  return {
    personId: "person-1",
    contactId: null,
    creatorProfileId: "cp-1",
    displayName: "Maya Producer",
    city: "Los Angeles",
    roles: ["producer", "production lead"],
    skills: ["production", "operations"],
    fandoms,
    communities: [],
    portfolioUrls: ["https://example.com/maya"],
    socialUrls: [],
    reviewStatus: "APPROVED",
    optedOut: false,
    consentStatus: "IMPLIED",
    proximityTier: "UNKNOWN",
    relationshipStrength: 1,
    privateNotes: null,
  };
}

function buildContext(opts: { extraOwnerFandom?: string }) {
  // The brief itself ONLY mentions Love and Deepspace.
  const baseUnderstanding = buildProjectUnderstanding({
    project: {
      title: "Love and Deepspace formal ball",
      description: "150-person LA event",
      city: "Los Angeles",
      targetDate: "2026-07-10",
      budgetRange: "$15k",
      audience: null,
      fandoms: ["Love and Deepspace"],
    },
  });
  // Force organizer_project so recommendInternalCandidates runs.
  const seeded = {
    ...baseUnderstanding,
    sourceKind: "organizer_project" as const,
  };
  // Simulate PR #68 enrichment: merge an owner-only fandom on top of the
  // brief's fandoms.
  const understanding = opts.extraOwnerFandom
    ? {
        ...seeded,
        fandoms: [...seeded.fandoms, opts.extraOwnerFandom],
      }
    : seeded;
  const ownerOnlyFandoms = opts.extraOwnerFandom ? [opts.extraOwnerFandom] : [];
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  return { understanding, roleMap, sourcingPlan, ownerOnlyFandoms };
}

test("recommendInternalCandidates emits 'Shared fandom with you' for owner-only fandom matches (PR #69)", () => {
  // The candidate shares the owner-only fandom (Genshin Impact) but
  // NOT the brief fandom (Love and Deepspace). The matching reason
  // should be the new "Shared fandom with you" line, not the
  // brief-driven "Fandom/community fit" line.
  const { understanding, roleMap, sourcingPlan, ownerOnlyFandoms } =
    buildContext({ extraOwnerFandom: "Genshin Impact" });
  const profile = buildPool(["Genshin Impact"]);

  const recs = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
    { ownerOnlyFandoms },
  );

  assert.ok(recs.length > 0, "expected at least one recommendation");
  const rec = recs[0]!;
  const reasonsStr = rec.matchingReasons.join(" | ");
  assert.match(
    reasonsStr,
    /Shared fandom with you:\s*Genshin Impact/,
    `expected "Shared fandom with you: Genshin Impact" in reasons, got: ${reasonsStr}`,
  );
  assert.doesNotMatch(
    reasonsStr,
    /Fandom\/community fit:\s*Genshin Impact/,
    "owner-only fandom must NOT be labeled as brief-driven",
  );
});

test("recommendInternalCandidates emits 'Fandom/community fit' for brief-driven matches (PR #69)", () => {
  // The candidate shares the brief fandom (Love and Deepspace). The
  // matching reason should be the existing brief-driven line, NOT the
  // new owner-only line.
  const { understanding, roleMap, sourcingPlan, ownerOnlyFandoms } =
    buildContext({ extraOwnerFandom: "Genshin Impact" });
  const profile = buildPool(["Love and Deepspace"]);

  const recs = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
    { ownerOnlyFandoms },
  );

  assert.ok(recs.length > 0);
  const rec = recs[0]!;
  const reasonsStr = rec.matchingReasons.join(" | ");
  assert.match(
    reasonsStr,
    /Fandom\/community fit:\s*Love and Deepspace/,
    `expected "Fandom/community fit: Love and Deepspace" in reasons, got: ${reasonsStr}`,
  );
  assert.doesNotMatch(
    reasonsStr,
    /Shared fandom with you:\s*Love and Deepspace/,
    "brief fandom must NOT be labeled as owner-only",
  );
});

test("recommendInternalCandidates emits BOTH reasons when candidate shares brief + owner fandoms (PR #69)", () => {
  const { understanding, roleMap, sourcingPlan, ownerOnlyFandoms } =
    buildContext({ extraOwnerFandom: "Genshin Impact" });
  const profile = buildPool(["Love and Deepspace", "Genshin Impact"]);

  const recs = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
    { ownerOnlyFandoms },
  );

  assert.ok(recs.length > 0);
  const rec = recs[0]!;
  const reasonsStr = rec.matchingReasons.join(" | ");
  assert.match(reasonsStr, /Fandom\/community fit:\s*Love and Deepspace/);
  assert.match(reasonsStr, /Shared fandom with you:\s*Genshin Impact/);
});

test("recommendInternalCandidates is backward-compatible without ownerOnlyFandoms option (PR #69)", () => {
  // Callers that don't pass the options arg should get the old
  // behavior — single "Fandom/community fit" line, no "Shared fandom"
  // line ever emitted.
  const { understanding, roleMap, sourcingPlan } = buildContext({});
  const profile = buildPool(["Love and Deepspace"]);

  const recs = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
  );

  assert.ok(recs.length > 0);
  const rec = recs[0]!;
  const reasonsStr = rec.matchingReasons.join(" | ");
  assert.match(reasonsStr, /Fandom\/community fit:\s*Love and Deepspace/);
  assert.doesNotMatch(reasonsStr, /Shared fandom with you/);
});

test("recommendInternalCandidates score is unchanged whether ownerOnlyFandoms is passed or not (PR #69)", () => {
  // The PR #69 split is rationale-only — it must not change the
  // numeric score. Same input, with vs without the option, must
  // produce the same scoreBreakdown.fandomFit + same total score.
  const { understanding, roleMap, sourcingPlan, ownerOnlyFandoms } =
    buildContext({ extraOwnerFandom: "Genshin Impact" });

  // The candidate matches the owner-only fandom (Genshin Impact). The
  // PR #68 enrichment has already merged it into understanding.fandoms,
  // so both the with-option and without-option paths see the same
  // merged fandom list — the only difference is whether the rationale
  // labels it as "Shared fandom with you" or "Fandom/community fit".
  const profile = buildPool(["Genshin Impact"]);

  const withSplit = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
    { ownerOnlyFandoms },
  );
  const withoutSplit = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    [profile],
  );

  assert.equal(withSplit.length, withoutSplit.length);
  assert.equal(
    withSplit[0]!.scoreBreakdown.fandomFit,
    withoutSplit[0]!.scoreBreakdown.fandomFit,
    "fandomFit must be identical with or without the split option",
  );
  assert.equal(
    withSplit[0]!.score,
    withoutSplit[0]!.score,
    "total score must be identical with or without the split option",
  );

  // But the matchingReasons text DIFFERS — that's the whole point.
  const withSplitReasons = withSplit[0]!.matchingReasons.join(" | ");
  const withoutSplitReasons = withoutSplit[0]!.matchingReasons.join(" | ");
  assert.match(withSplitReasons, /Shared fandom with you/);
  assert.doesNotMatch(withoutSplitReasons, /Shared fandom with you/);
});
