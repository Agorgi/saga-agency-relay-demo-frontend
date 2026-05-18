import assert from "node:assert/strict";
import test from "node:test";
import {
  checkProducerDraftSafety,
  composeCandidateOutreachBody,
  generateCandidateOutreachDraft,
  type CandidateOutreachDraftInput,
} from "@/sms-engine/producer/outboundDrafts";

function approvedInput(
  overrides: Partial<CandidateOutreachDraftInput> = {},
): CandidateOutreachDraftInput {
  return {
    candidateRecommendationId: "rec_1",
    status: "APPROVED_FOR_SHORTLIST",
    optedOut: false,
    role: "photographer",
    city: "Los Angeles",
    displayName: "Maya R. (composite)",
    projectTitle: "Formal ball inspired by Love and Deepspace",
    projectType: "ball",
    matchingReasons: ["Role match: photographer"],
    ...overrides,
  };
}

test("composeCandidateOutreachBody uses the project title verbatim when available", () => {
  const body = composeCandidateOutreachBody(approvedInput());
  assert.match(body, /Formal ball inspired by Love and Deepspace in Los Angeles/);
  // Don't fall back to "a creative project" when we have a real title.
  assert.doesNotMatch(body, /a creative project/);
});

test("composeCandidateOutreachBody falls back to projectType when title is missing", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ projectTitle: null, projectType: "anime picnic" }),
  );
  assert.match(body, /Saga is helping an organizer plan anime picnic in Los Angeles\./);
});

test("composeCandidateOutreachBody falls back to a creative-project generic when neither title nor type is set", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ projectTitle: null, projectType: null }),
  );
  assert.match(body, /Saga is helping an organizer plan a creative project in Los Angeles\./);
});

test("composeCandidateOutreachBody anchors on fandom overlap when the title doesn't already name the fandom", () => {
  // Overlap = "Love and Deepspace"; the title is generic ("Formal ball")
  // so the anchor sentence does meaningful work. Body must mention the
  // fandom anchor AND the role reason — both pieces of personalization
  // land in one message.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectTitle: "Formal ball",
      projectFandoms: ["Love and Deepspace", "anime"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: [
        "Fandom/community fit: Love and Deepspace",
        "Role match: photographer",
      ],
    }),
  );
  assert.match(
    body,
    /They're building it around Love and Deepspace and your work felt aligned\./,
  );
  // Role-specific reason still surfaces (NOT skipped just because there's an overlap).
  assert.match(body, /Your photographer portfolio felt like a fit for the photographer slot\./);
});

test("composeCandidateOutreachBody omits the redundant fandom anchor when the project title already names the fandom", () => {
  // The user-supplied title contains the fandom in the opening
  // sentence — repeating it in the next sentence reads robotic. The
  // composer should drop straight to the role-specific reason instead.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectTitle: "Formal ball inspired by Love and Deepspace",
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Role match: photographer"],
    }),
  );
  assert.doesNotMatch(body, /They're building it around Love and Deepspace/);
  // Role-specific reason still lands.
  assert.match(body, /Your photographer portfolio felt like a fit for the photographer slot\./);
});

test("composeCandidateOutreachBody drops the duplicate fandom reason when the same fandom is already in the anchor", () => {
  // The producer often emits BOTH a fandom anchor (cohort) AND a fandom
  // matching-reason for the same fandom. The body must not say
  // "Love and Deepspace" twice in different sentences.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Fandom/community fit: Love and Deepspace"],
    }),
  );
  // Exactly one mention of the fandom string.
  const occurrences = body.match(/Love and Deepspace/g) ?? [];
  assert.equal(
    occurrences.length,
    1,
    `expected one mention of Love and Deepspace, got ${occurrences.length} in: ${body}`,
  );
});

test("composeCandidateOutreachBody picks a skill-fit reason when there's no fandom overlap", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      role: "producer",
      projectFandoms: ["anime"],
      candidateFandoms: ["K-pop"],
      matchingReasons: [
        "Skill fit: production, operations, logistics",
        "Role match: producer",
      ],
    }),
  );
  // Skill comes first in producer's matchingReasons, so it leads.
  assert.match(
    body,
    /Your production and operations experience felt like a fit for the producer slot\./,
  );
  // No fandom anchor (no overlap).
  assert.doesNotMatch(body, /They're building it around/);
});

test("composeCandidateOutreachBody skips generic-trust reasons that don't say anything specific", () => {
  // The producer emits reasons like "Profile reviewed by Saga" and
  // "Has portfolio or social proof" — those don't belong in candidate-
  // facing copy. The composer should drop past them to a real signal.
  const body = composeCandidateOutreachBody(
    approvedInput({
      matchingReasons: [
        "Profile reviewed by Saga",
        "Has portfolio or social proof",
        "Role match: stylist",
      ],
      role: "stylist",
    }),
  );
  assert.doesNotMatch(body, /Profile reviewed/);
  assert.doesNotMatch(body, /portfolio or social proof/);
  assert.match(body, /Your stylist portfolio felt like a fit for the stylist slot\./);
});

test("composeCandidateOutreachBody skips proximity reasons (organizer's network graph isn't a story for candidate-facing copy)", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      matchingReasons: [
        "Proximity: friend",
        "Role match: host",
      ],
      role: "host",
    }),
  );
  assert.doesNotMatch(body, /Proximity/);
  assert.doesNotMatch(body, /friend/);
  assert.match(body, /Your host portfolio felt like a fit for the host slot\./);
});

test("composeCandidateOutreachBody falls back to a generic role-fit sentence when no reasons survive the filter", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      role: "venue",
      matchingReasons: ["Profile reviewed by Saga", "Has portfolio or social proof"],
    }),
  );
  assert.match(body, /Your work felt like a fit for the venue slot\./);
});

test("composeCandidateOutreachBody handles missing city gracefully", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ city: null }),
  );
  // No " in {city}" tail; sentence should still terminate cleanly.
  assert.match(body, /Saga is helping an organizer plan Formal ball[^.]*\./);
  assert.doesNotMatch(body, /in \./);
  assert.doesNotMatch(body, / in $/);
});

test("composeCandidateOutreachBody handles missing displayName with a soft fallback", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ displayName: null }),
  );
  assert.match(body, /^Hey there —/);
});

test("composeCandidateOutreachBody body still passes the safety check (open + considered)", () => {
  // checkProducerDraftSafety requires "open" or "interested" AND
  // "considered" in CANDIDATE_OUTREACH bodies. The composer's close
  // line is load-bearing — verify every variant we generate satisfies
  // the rule.
  const variants = [
    approvedInput(),
    approvedInput({ projectTitle: null, projectType: null }),
    approvedInput({
      projectFandoms: ["anime"],
      candidateFandoms: ["anime"],
      matchingReasons: ["Fandom/community fit: anime"],
    }),
    approvedInput({
      matchingReasons: ["Skill fit: production, operations"],
    }),
    approvedInput({ matchingReasons: [], city: null }),
  ];
  for (const variant of variants) {
    const body = composeCandidateOutreachBody(variant);
    const safety = checkProducerDraftSafety({ type: "CANDIDATE_OUTREACH", body });
    assert.equal(
      safety.passed,
      true,
      `safety check failed for variant: ${JSON.stringify(variant)}\nBody: ${body}\nErrors: ${safety.errors.join(" / ")}`,
    );
  }
});

test("generateCandidateOutreachDraft returns BLOCKED with placeholder body when status is not APPROVED_FOR_SHORTLIST", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({ status: "SUGGESTED" }),
  );
  assert.equal(draft.status, "BLOCKED");
  assert.match(draft.body, /Blocked draft:/);
  assert.equal(draft.blockReason, "candidate_not_approved_for_shortlist");
});

test("generateCandidateOutreachDraft returns BLOCKED when the candidate is opted out", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({ optedOut: true }),
  );
  assert.equal(draft.status, "BLOCKED");
  assert.equal(draft.blockReason, "candidate_opted_out");
});

test("generateCandidateOutreachDraft on an approved candidate produces NEEDS_REVIEW with the personalized body", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Role match: photographer"],
    }),
  );
  assert.equal(draft.status, "NEEDS_REVIEW");
  assert.match(draft.body, /Love and Deepspace/);
  assert.match(draft.body, /Open to being considered for the team/);
  assert.equal(draft.adminReviewRequired, true);
});
