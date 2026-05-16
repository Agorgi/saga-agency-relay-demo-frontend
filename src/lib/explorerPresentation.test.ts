import assert from "node:assert/strict";
import test from "node:test";
import { TALENT_PROFILES, getRecommendationsForRole } from "@/data/sagaAgencyData";
import {
  getExplorerCandidateStatus,
  getExplorerCandidateSummary,
  getExplorerCardImage,
} from "@/lib/explorerPresentation";
import { buildHostBriefProject } from "@/lib/hostBriefHandoff";

const animePicnicProject = buildHostBriefProject({
  eventType: "Pop-up / activation",
  city: "Silver Lake",
  scale: "100 people",
  vibe: "anime, picnic, playful, neon",
  projectType: "Pop-up / activation",
  suggestedRoles: ["Producer", "Photographer", "Host", "Vendor", "Cosplayer"],
  date: "next month",
  projectIdea:
    "throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe",
});

test("explorer cards use distinct candidate data instead of identical placeholders", () => {
  const recommendations = getRecommendationsForRole(
    animePicnicProject,
    "Photographer",
    2,
  );

  assert.equal(recommendations.length >= 2, true);

  const [first, second] = recommendations;
  assert.notEqual(first.name, second.name);
  assert.notEqual(getExplorerCardImage(first), "");
  assert.notEqual(getExplorerCardImage(second), "");
  assert.notEqual(
    getExplorerCandidateSummary(first, animePicnicProject),
    getExplorerCandidateSummary(second, animePicnicProject),
  );
});

test("explorer candidate statuses stay honest about demo review state", () => {
  const base = getRecommendationsForRole(animePicnicProject, "Photographer", 1)[0];
  assert.ok(base);

  const suggested = getExplorerCandidateStatus({
    ...base,
    candidateStatus: "suggested",
  });
  const shortlisted = getExplorerCandidateStatus({
    ...base,
    candidateStatus: "shortlisted",
  });
  const booked = getExplorerCandidateStatus({
    ...base,
    candidateStatus: "booked",
  });

  for (const label of [suggested, shortlisted, booked]) {
    assert.doesNotMatch(label, /\bconfirmed\b/i);
    assert.doesNotMatch(label, /\bcontacted\b/i);
    assert.doesNotMatch(label, /\bbooked\b/i);
  }
});

test("explorer summary falls back to an honest demo explanation when no project context exists", () => {
  const candidate = TALENT_PROFILES.find((profile) =>
    profile.roles.includes("Photographer"),
  );
  assert.ok(candidate);
  if (!candidate) {
    return;
  }

  const summary = getExplorerCandidateSummary(
    {
      ...candidate,
      primaryRole: "Photographer",
      portfolioFitScore: 80,
      styleFitScore: 78,
      categoryExperienceScore: 74,
      locationFitScore: 86,
      budgetFitScore: 72,
      availabilityLikelihood: 70,
      distributionScore: candidate.distributionScore || 68,
      priorProjectRelevance: 62,
      whySagaMatched: [],
      candidateStatus: "suggested",
    },
    null,
  );

  assert.match(summary, /demo candidate/i);
});
