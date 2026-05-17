import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBrowseAllTalentState,
  buildCrewRecommendationState,
  buildProjectBriefForUI,
  PROJECT_BRIEF_EMPTY_STATE,
} from "@/lib/buildMyCrewContracts";
import { buildHostBriefProject } from "@/lib/hostBriefHandoff";
import { TALENT_PROFILES } from "@/data/sagaAgencyData";
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

test("browse-all surface populates a non-empty grid on cold-load", () => {
  const state = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  // The PR e9e7bc6 regression collapsed this surface to 0. Browse-all
  // restores it: pre-cap the dataset has 24 creators, capped to 18.
  const total = state.candidateGroups.reduce(
    (count, group) => count + group.candidates.length,
    0,
  );
  assert.equal(total > 0, true, "browse-all should surface at least one card");
  assert.equal(total <= 18, true, "browse-all should cap total at 18 cards");
  assert.equal(state.brief, null);
  assert.equal(state.candidateGroups.length > 0, true);
});

test("browse-all surface groups by primary role and caps per role", () => {
  const state = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  for (const group of state.candidateGroups) {
    assert.equal(group.candidates.length <= 6, true, `role group ${group.role.role} exceeds per-role cap`);
    for (const candidate of group.candidates) {
      assert.equal(candidate.role, group.role.role);
    }
  }
});

test("browse-all candidates stay honest about review and contact state", () => {
  const state = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });

  for (const group of state.candidateGroups) {
    for (const candidate of group.candidates) {
      assert.equal(candidate.contacted, false);
      assert.equal(candidate.confirmed, false);
      assert.equal(candidate.contactabilityStatus, "Human review required");
      assert.equal(candidate.sourceMode, "demo_seed");
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
  assert.match(
    state.noOneContactedDisclaimer,
    /not contacted|not vetted|browse-all|demo/i,
  );
});

test("browse-all search query narrows the surfaced grid", () => {
  const unfiltered = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "",
    filters: DEFAULT_FILTERS,
  });
  const filtered = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "photographer",
    filters: DEFAULT_FILTERS,
  });

  const unfilteredTotal = unfiltered.candidateGroups.reduce(
    (n, g) => n + g.candidates.length,
    0,
  );
  const filteredTotal = filtered.candidateGroups.reduce(
    (n, g) => n + g.candidates.length,
    0,
  );

  assert.equal(filteredTotal <= unfilteredTotal, true);
});

test("browse-all role filter scopes the grid to the chosen role", () => {
  // Use a role that actually exists in the dataset; pick whatever the
  // first profile lists so the test stays stable across data edits.
  const targetRole = TALENT_PROFILES[0]?.roles[0];
  assert.ok(targetRole);

  const state = buildBrowseAllTalentState({
    talent: TALENT_PROFILES,
    searchQuery: "",
    filters: { ...DEFAULT_FILTERS, role: targetRole as string },
  });

  for (const group of state.candidateGroups) {
    for (const candidate of group.candidates) {
      // Every surfaced profile must list the requested role in its
      // `roles[]` (the filter matches on the full list, but the card's
      // displayed `role` is the profile's first role; either way the
      // profile carries the requested role).
      const profile = TALENT_PROFILES.find((p) => p.id === candidate.id);
      assert.ok(profile);
      assert.equal(
        profile?.roles.some((r) => r.toLowerCase() === (targetRole as string).toLowerCase()),
        true,
        `${candidate.name} surfaced under role filter "${targetRole}" but doesn't list it`,
      );
    }
  }
});
