import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCrewRecommendationState,
  buildProjectBriefForUI,
  PROJECT_BRIEF_EMPTY_STATE,
} from "@/lib/buildMyCrewContracts";
import { buildHostBriefProject } from "@/lib/hostBriefHandoff";
import type { TalentFilters } from "@/types/sagaAgency";

const DEFAULT_FILTERS: TalentFilters = {
  role: "All roles",
  city: "All cities",
  projectType: "All",
  tag: "All tags",
  budget: "All budgets",
  availability: "all",
};

const animePicnicPrefill: Record<string, string | string[]> = {
  eventType: "Pop-up / activation",
  city: "Silver Lake",
  scale: "100 people",
  expectedAttendance: "100 people",
  vibe: "playful, neon, anime-inspired",
  themeVibe: "playful, neon, anime-inspired",
  projectType: "Pop-up / activation",
  suggestedRoles: ["Producer", "Photographer", "Host", "Vendor", "Cosplayer"],
  desiredTalentRoles: ["Producer", "Photographer", "Host"],
  date: "next month",
  projectIdea: "throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe",
  helpNeeded: "find a producer, photographer, and host",
  readinessStage: "talent_search_ready",
};

test("anime picnic brief drives the public Build My Crew contract instead of the beauty-brand fixture", () => {
  const project = buildHostBriefProject(animePicnicPrefill);
  const brief = buildProjectBriefForUI(project, animePicnicPrefill);
  const state = buildCrewRecommendationState({
    project,
    prefill: animePicnicPrefill,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  assert.ok(brief);
  assert.equal(brief?.city, "Silver Lake");
  assert.equal(brief?.dateWindow, "Next month");
  assert.match(brief?.projectIdea || "", /anime picnic/i);
  assert.doesNotMatch(brief?.projectIdea || "", /beauty brand/i);
  assert.equal(state.brief?.city, "Silver Lake");
  assert.notEqual(state.brief?.city, "Miami");
  assert.equal(state.candidateGroups.length > 0, true);
});

test("crew recommendation groups are role-first and candidates stay distinct", () => {
  const project = buildHostBriefProject(animePicnicPrefill);
  const state = buildCrewRecommendationState({
    project,
    prefill: animePicnicPrefill,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  assert.equal(state.suggestedRoles[0]?.role, "Producer");
  assert.equal(state.candidateGroups.length > 0, true);

  const photographerGroup = state.candidateGroups.find((group) => group.role.role === "Photographer");
  assert.ok(photographerGroup);
  assert.equal((photographerGroup?.candidates.length || 0) > 1, true);

  const [first, second] = photographerGroup?.candidates || [];
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first?.name, second?.name);
  assert.notEqual(first?.whyThisPersonMayFit, second?.whyThisPersonMayFit);
  assert.notEqual(first?.imageSrc, "");
  assert.notEqual(second?.imageSrc, "");
});

test("public candidate cards stay honest about review and contact state", () => {
  const project = buildHostBriefProject(animePicnicPrefill);
  const state = buildCrewRecommendationState({
    project,
    prefill: animePicnicPrefill,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  const firstCandidate = state.candidateGroups[0]?.candidates[0];
  assert.ok(firstCandidate);
  assert.equal(firstCandidate?.contacted, false);
  assert.equal(firstCandidate?.confirmed, false);
  assert.equal(firstCandidate?.contactabilityStatus, "Human review required");
  for (const group of state.candidateGroups) {
    for (const candidate of group.candidates) {
      const cardCopy = [
        candidate.reviewStatus,
        candidate.contactabilityStatus,
        candidate.whyThisPersonMayFit,
        candidate.evidence,
      ].join(" ");
      assert.doesNotMatch(cardCopy, /\bconfirmed\b/i);
      assert.doesNotMatch(cardCopy, /\bcontacted\b/i);
      assert.doesNotMatch(cardCopy, /\bbooked\b/i);
    }
  }
});

test("build my crew state is empty when no brief or project exists", () => {
  const state = buildCrewRecommendationState({
    project: null,
    prefill: null,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  assert.equal(state.brief, null);
  assert.deepEqual(state.suggestedRoles, []);
  assert.deepEqual(state.candidateGroups, []);
});

test("project brief empty state stays usable when no prefill exists", () => {
  assert.match(PROJECT_BRIEF_EMPTY_STATE.title, /Start with Sagasan/i);
  assert.match(PROJECT_BRIEF_EMPTY_STATE.subhead, /chat first/i);
  assert.match(PROJECT_BRIEF_EMPTY_STATE.helper, /reviewable draft/i);
  assert.equal(PROJECT_BRIEF_EMPTY_STATE.ctaLabel, "Talk to Sagasan");
});
