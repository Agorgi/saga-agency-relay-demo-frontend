import assert from "node:assert/strict";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import { buildSourcingPlan } from "@/sms-engine/producer/sourcingPlan";
import { recommendInternalCandidates } from "@/sms-engine/producer/candidateRecommendations";
import { generateShortlistDraft } from "@/sms-engine/producer/shortlistDraft";
import type { CandidatePoolItem } from "@/sms-engine/producer/producerAgentTypes";

const forbiddenPattern =
  /\b(confirmed|booked|guaranteed?|revenue|ticket sales|attendance|venue access|celebrity|influencer|paid work|will join)\b/i;

const candidatePool: CandidatePoolItem[] = [
  {
    personId: "person_photo_la",
    creatorProfileId: "profile_photo_la",
    displayName: "Rae Star",
    city: "Los Angeles",
    roles: ["photographer", "content creator"],
    skills: ["photography", "events", "camera", "content"],
    fandoms: ["anime", "cosplay"],
    communities: ["anime"],
    portfolioUrls: ["https://example.test/rae"],
    socialUrls: ["https://instagram.test/rae"],
    reviewStatus: "APPROVED",
    consentStatus: "IMPLIED",
    proximityTier: "FRIEND",
  },
  {
    personId: "person_dj_la",
    creatorProfileId: "profile_dj_la",
    displayName: "DJ Kiko",
    city: "Los Angeles",
    roles: ["dj"],
    skills: ["music", "audio", "nightlife"],
    fandoms: ["anime", "gaming"],
    communities: ["cosplay"],
    socialUrls: ["https://instagram.test/kiko"],
    reviewStatus: "APPROVED",
    consentStatus: "IMPLIED",
    proximityTier: "COMMUNITY",
  },
  {
    personId: "person_vendor_nyc",
    creatorProfileId: "profile_vendor_nyc",
    displayName: "Mina Park",
    city: "New York",
    roles: ["vendor coordinator", "host"],
    skills: ["vendor", "market", "hosting", "partners"],
    fandoms: ["anime", "K-pop"],
    communities: ["anime"],
    socialUrls: ["https://instagram.test/mina"],
    reviewStatus: "PENDING_REVIEW",
    consentStatus: "IMPLIED",
    proximityTier: "MUTUAL",
  },
  {
    personId: "person_opted_out",
    creatorProfileId: "profile_opted_out",
    displayName: "Opted Out Person",
    city: "Los Angeles",
    roles: ["photographer"],
    skills: ["photography"],
    fandoms: ["anime"],
    reviewStatus: "APPROVED",
    optedOut: true,
    consentStatus: "OPTED_OUT",
    proximityTier: "FRIEND",
    privateNotes: "Private notes should never appear.",
  },
];

const scenarios = [
  {
    name: "Anime picnic in LA",
    text: "I want to throw an anime picnic in LA for around 80 people. Casual community vibe with creators and photos.",
    expectedRoles: ["photographer", "host"],
  },
  {
    name: "Cosplay cafe night in NYC",
    text: "I want to host a cosplay cafe night in NYC with vendors and a cozy fandom vibe.",
    expectedRoles: ["vendor coordinator", "host"],
  },
  {
    name: "Gaming pop-up in Atlanta",
    text: "We want to produce a gaming pop-up in Atlanta, weekend afternoon, local community.",
    expectedRoles: ["venue"],
  },
  {
    name: "Creator photoshoot in LA",
    text: "I want to make a creator photoshoot day in LA with styled sets and cosplay creators.",
    expectedRoles: ["photographer"],
  },
  {
    name: "Brand/community launch party",
    text: "I want to throw a small brand launch party in LA, polished but community-led with music.",
    expectedRoles: ["dj", "sponsor/brand partner"],
  },
  {
    name: "Vague project with missing city",
    text: "I have a vague idea for a community art thing.",
    expectedMissing: ["city/location"],
  },
  {
    name: "Small low-scope meetup",
    text: "I want to host a tiny anime meetup in LA for 25 people, casual hangout vibe.",
    maxRequiredRoles: 3,
  },
  {
    name: "Larger production requiring more roles",
    text: "I want to produce an anime rave in LA for 250 people with DJs, vendors, content, and volunteers.",
    expectedRoles: ["volunteer coordinator", "dj", "vendor coordinator"],
  },
];

function runScenario(scenario: (typeof scenarios)[number]) {
  const understanding = buildProjectUnderstanding({ text: scenario.text });
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  const recommendations = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
  );
  const shortlist = generateShortlistDraft(understanding, roleMap, recommendations);
  const roleTypes = [...roleMap.requiredRoles, ...roleMap.optionalRoles].map(
    (role) => role.roleType,
  );

  assert.equal(understanding.sourceKind, "organizer_project", scenario.name);
  assert.ok(understanding.title, scenario.name);
  assert.ok(roleMap.humanReviewRequired, scenario.name);
  assert.ok(sourcingPlan.openWebResearchLater, scenario.name);
  assert.ok(sourcingPlan.searchOrder[0].includes("friends"), scenario.name);
  assert.equal(shortlist.adminReviewRequired, true, scenario.name);
  assert.equal(shortlist.forbiddenClaimsCheck.passed, true, scenario.name);
  assert.ok(!forbiddenPattern.test(shortlist.organizerFacingSummary), scenario.name);
  assert.ok(!JSON.stringify(shortlist).includes("Private notes"), scenario.name);
  assert.ok(
    recommendations.every(
      (recommendation) => recommendation.displayName !== "Opted Out Person",
    ),
    scenario.name,
  );

  for (const expectedRole of scenario.expectedRoles || []) {
    assert.ok(
      roleTypes.includes(expectedRole),
      `${scenario.name} missing role ${expectedRole}`,
    );
  }

  for (const missing of scenario.expectedMissing || []) {
    assert.ok(
      understanding.missingInfo.includes(missing),
      `${scenario.name} missing info ${missing}`,
    );
  }

  if (scenario.maxRequiredRoles) {
    assert.ok(
      roleMap.requiredRoles.length <= scenario.maxRequiredRoles,
      `${scenario.name} overstaffed`,
    );
  }
}

function testGigSeekerDoesNotBecomeRoleMap() {
  const understanding = buildProjectUnderstanding({
    text: "I'm a photographer in LA looking for paid anime gigs.",
  });
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  const recommendations = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
  );

  assert.equal(understanding.sourceKind, "gig_seeker");
  assert.equal(roleMap.requiredRoles.length, 0);
  assert.equal(recommendations.length, 0);
}

function testInterestCheckDoesNotCreateRecommendations() {
  const understanding = buildProjectUnderstanding({
    text: "I wish someone would host a Love and Deepspace picnic in LA.",
  });
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  const recommendations = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
  );

  assert.equal(understanding.sourceKind, "interest_check");
  assert.equal(roleMap.requiredRoles.length, 0);
  assert.equal(recommendations.length, 0);
  assert.ok(sourcingPlan.humanReviewRequired);
}

for (const scenario of scenarios) {
  runScenario(scenario);
}
testGigSeekerDoesNotBecomeRoleMap();
testInterestCheckDoesNotCreateRecommendations();

console.log("Producer Agent v0.1 checks passed without SMS or external web calls.");
