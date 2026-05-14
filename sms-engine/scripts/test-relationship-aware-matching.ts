import assert from "node:assert/strict";
import type { ProjectUnderstanding, RoleMap } from "@/sms-engine/producer/producerAgentTypes";
import type { CandidatePoolProfile } from "@/sms-engine/graph/candidateRetrieval";
import { retrieveCandidatePoolForProject } from "@/sms-engine/graph/candidateRetrieval";
import { computeFandomCommunityFit } from "@/sms-engine/graph/fandomCommunityFit";
import { computeRoleAwareLocationFit } from "@/sms-engine/graph/roleLocationRequirements";
import { explainRelationshipPath } from "@/sms-engine/graph/relationshipPathExplain";
import {
  canPromoteMatchResultToReview,
  scoreCandidateForRole,
} from "@/sms-engine/graph/relationshipAwareScoring";
import { rankCandidatesForProject } from "@/sms-engine/graph/projectCandidateMatcher";
import type { RelationshipGraphEdge } from "@/sms-engine/graph/relationshipProximity";

const projectUnderstanding: ProjectUnderstanding = {
  title: "Anime picnic in Silver Lake",
  projectType: "community picnic",
  city: "Los Angeles",
  fandoms: ["anime", "cosplay"],
  communities: ["artist alley"],
  format: "picnic",
  scope: "small",
  vibe: "warm and playful",
  targetDate: null,
  timing: null,
  budgetRange: null,
  expectedAudienceSize: "50",
  audience: "anime fans",
  helpNeeded: "photographer, illustrator, venue owner",
  riskFlags: [],
  missingInfo: [],
  sourceKind: "organizer_project",
  confidence: 0.9,
  explanationForAudit: ["Synthetic relationship-aware matching fixture."],
};

const photographerRole = {
  roleType: "photographer",
  title: "Cosplay event photographer",
  priority: "required" as const,
  description: "Capture the anime picnic.",
  requiredSkills: ["cosplay photographer", "photography"],
  preferredFandoms: ["anime", "cosplay"],
  localRequired: false,
  whyThisRoleMatters: "The event needs public-safe visual documentation.",
  roleFitCriteria: ["cosplay portfolio", "anime event experience", "LA proximity"],
  missingInfoForRole: [],
  confidence: 0.9,
};

const roleMap: RoleMap = {
  requiredRoles: [photographerRole],
  optionalRoles: [
    {
      roleType: "illustrator",
      title: "Remote fan artist",
      priority: "optional",
      description: "Create a small event graphic.",
      requiredSkills: ["illustrator"],
      preferredFandoms: ["anime"],
      localRequired: false,
      whyThisRoleMatters: "The project could use a lightweight visual identity.",
      roleFitCriteria: ["portfolio", "anime fandom"],
      missingInfoForRole: [],
      confidence: 0.75,
    },
  ],
  rolePriority: ["photographer", "illustrator"],
  roleDescriptions: {
    photographer: "Capture the anime picnic.",
    illustrator: "Create a small event graphic.",
  },
  roleFitCriteria: {
    photographer: ["cosplay portfolio", "anime event experience", "LA proximity"],
    illustrator: ["portfolio", "anime fandom"],
  },
  localRequired: { photographer: false, illustrator: false },
  whyThisRoleMatters: {
    photographer: "The event needs public-safe visual documentation.",
    illustrator: "The project could use a lightweight visual identity.",
  },
  missingInfoForRole: { photographer: [], illustrator: [] },
  confidence: 0.86,
  humanReviewRequired: true,
  explanationForAudit: ["Synthetic role map for matching tests."],
};

function candidate(overrides: Partial<CandidatePoolProfile>): CandidatePoolProfile {
  return {
    id: overrides.id || "candidate",
    personId: overrides.personId ?? overrides.id ?? null,
    creatorProfileId: overrides.creatorProfileId ?? null,
    contactId: overrides.contactId ?? null,
    talentCandidateId: overrides.talentCandidateId ?? null,
    candidateRecommendationId: overrides.candidateRecommendationId ?? null,
    publicWebResearchResultId: overrides.publicWebResearchResultId ?? null,
    displayName: overrides.displayName || "Review Candidate",
    roleTags: overrides.roleTags || ["cosplay photographer"],
    skillTags: overrides.skillTags || ["photography"],
    fandomTags: overrides.fandomTags || ["anime", "cosplay"],
    communityTags: overrides.communityTags || [],
    city: overrides.city ?? "Los Angeles",
    metro: overrides.metro ?? "Los Angeles",
    locationConfidence: overrides.locationConfidence ?? 0.9,
    reviewStatus: overrides.reviewStatus || "APPROVED_FOR_INTERNAL_REVIEW",
    sourceMode: overrides.sourceMode || "INTERNAL_DB",
    evidenceQualityScore: overrides.evidenceQualityScore ?? 85,
    contactabilityScore: overrides.contactabilityScore ?? 75,
    contactabilityRisk: overrides.contactabilityRisk,
    recommendedContactPathForAdminReview:
      overrides.recommendedContactPathForAdminReview ?? "internal_contact",
    doNotContact: overrides.doNotContact ?? false,
    optedOut: overrides.optedOut ?? false,
  };
}

const requesterId = "person-requester";
const graphEdges: RelationshipGraphEdge[] = [
  {
    fromEntityType: "PERSON",
    fromEntityId: requesterId,
    toEntityType: "PERSON",
    toEntityId: "person-direct",
    edgeType: "WORKED_TOGETHER",
    strength: 0.9,
    confidence: 0.95,
    sourceType: "INTERNAL_DB",
    isInferred: false,
  },
  {
    fromEntityType: "PERSON",
    fromEntityId: requesterId,
    toEntityType: "PERSON",
    toEntityId: "person-mutual",
    edgeType: "FRIEND",
    strength: 0.8,
    confidence: 0.9,
    sourceType: "INTERNAL_DB",
    isInferred: false,
  },
  {
    fromEntityType: "PERSON",
    fromEntityId: "person-mutual",
    toEntityType: "PERSON",
    toEntityId: "person-mutual-candidate",
    edgeType: "REFERRED_BY",
    strength: 0.7,
    confidence: 0.85,
    sourceType: "INTERNAL_DB",
    isInferred: false,
  },
];

const profiles: CandidatePoolProfile[] = [
  candidate({
    id: "internal-approved",
    personId: "person-internal-approved",
    displayName: "Internal Approved Photographer",
    reviewStatus: "APPROVED_FOR_SHORTLIST",
    evidenceQualityScore: 96,
    contactabilityScore: 92,
  }),
  candidate({
    id: "direct",
    personId: "person-direct",
    displayName: "Direct Relationship Photographer",
    evidenceQualityScore: 82,
    contactabilityScore: 85,
  }),
  candidate({
    id: "mutual",
    personId: "person-mutual-candidate",
    displayName: "Mutual Path Photographer",
    evidenceQualityScore: 80,
    contactabilityScore: 80,
  }),
  candidate({
    id: "same-fandom",
    personId: "person-same-fandom",
    displayName: "Same Fandom Photographer",
    city: "Atlanta",
    metro: "Atlanta",
    evidenceQualityScore: 78,
  }),
  candidate({
    id: "public-reviewed",
    personId: null,
    publicWebResearchResultId: "public-result-reviewed",
    displayName: "Reviewed Public Portfolio",
    sourceMode: "PUBLIC_WEB_RESEARCH",
    reviewStatus: "APPROVED_FOR_INTERNAL_REVIEW",
    evidenceQualityScore: 100,
    contactabilityScore: 78,
  }),
  candidate({
    id: "public-unreviewed",
    personId: null,
    publicWebResearchResultId: "public-result-unreviewed",
    displayName: "Unreviewed Public Portfolio",
    sourceMode: "PUBLIC_WEB_RESEARCH",
    reviewStatus: "NEEDS_QUALITY_REVIEW",
    evidenceQualityScore: 100,
    contactabilityScore: 78,
  }),
  candidate({
    id: "opted-out",
    personId: "person-opted-out",
    displayName: "Opted Out Candidate",
    optedOut: true,
  }),
  candidate({
    id: "do-not-contact",
    personId: "person-do-not-contact",
    displayName: "Do Not Contact Candidate",
    doNotContact: true,
  }),
  candidate({
    id: "missing-contact",
    personId: "person-missing-contact",
    displayName: "Missing Contactability Candidate",
    contactabilityScore: 0,
    recommendedContactPathForAdminReview: null,
  }),
  candidate({
    id: "public-phone",
    personId: null,
    publicWebResearchResultId: "public-phone-result",
    displayName: "Public Phone Candidate",
    sourceMode: "PUBLIC_WEB_RESEARCH",
    reviewStatus: "APPROVED_FOR_INTERNAL_REVIEW",
    contactabilityRisk: "HIGH",
    recommendedContactPathForAdminReview: "public_business_phone_requires_review",
  }),
];

function score(profile: CandidatePoolProfile) {
  return scoreCandidateForRole({
    project: projectUnderstanding,
    role: photographerRole,
    candidate: profile,
    requesterId,
    graphContext: {
      edges: graphEdges,
      requesterFandomTags: ["anime", "cosplay"],
      requesterCity: "Los Angeles",
      requesterMetro: "Los Angeles",
    },
  });
}

async function main() {
  const internalApproved = profiles[0];
  const direct = profiles[1];
  const mutual = profiles[2];
  const sameFandom = profiles[3];
  const publicReviewed = profiles[4];
  const publicUnreviewed = profiles[5];
  const missingContact = profiles[8];
  const publicPhone = profiles[9];

  const internalScore = score(internalApproved);
  assert.equal(internalScore.blocked, false);
  assert.ok(internalScore.totalScore >= 70, "internal exact fit should rank high");

  const directScore = score(direct);
  assert.equal(directScore.proximityTier, "P1_DIRECT");
  assert.ok(directScore.totalScore > score(sameFandom).totalScore, "direct relationship should boost score");

  const mutualScore = score(mutual);
  assert.equal(mutualScore.proximityTier, "P2_MUTUAL");
  assert.ok(mutualScore.totalScore > score(sameFandom).totalScore, "mutual path should boost score");

  const fandomPath = explainRelationshipPath({
    requesterId,
    candidateId: "person-same-fandom",
    context: {
      requesterFandomTags: ["anime"],
      candidateFandomTags: ["anime"],
      candidateSourceMode: "INTERNAL_DB",
    },
  });
  assert.equal(fandomPath.proximityTier, "P4_SAME_COMMUNITY_OR_FANDOM");
  assert.equal(fandomPath.shouldCallThisMutual, false);
  assert.match(fandomPath.pathSummary, /no known direct relationship/i);

  const locationFit = computeRoleAwareLocationFit({
    role: "photographer",
    candidateLocation: "Los Angeles",
    projectLocation: "Silver Lake",
  });
  const nonLocalPhotographer = computeRoleAwareLocationFit({
    role: "photographer",
    candidateLocation: "New York City",
    projectLocation: "Los Angeles",
  });
  assert.ok(locationFit.score > nonLocalPhotographer.score, "photographer should strongly prefer local candidates");

  const remoteIllustrator = computeRoleAwareLocationFit({
    role: "illustrator",
    candidateLocation: "New York City",
    projectLocation: "Los Angeles",
  });
  assert.ok(remoteIllustrator.score > 0, "remote-friendly role should not over-penalize non-local candidate");

  const venueFit = computeRoleAwareLocationFit({
    role: "venue owner",
    candidateLocation: "New York City",
    projectLocation: "Los Angeles",
  });
  assert.equal(venueFit.score, 0, "venue owner should be local-required");

  const publicPath = explainRelationshipPath({
    requesterId,
    candidateId: "public-reviewed",
    context: {
      candidateSourceMode: "PUBLIC_WEB_RESEARCH",
      candidateMatchedInternal: false,
    },
  });
  assert.equal(publicPath.proximityTier, "P6_PUBLIC_WEB_ONLY");
  assert.match(publicPath.pathSummary, /no known internal relationship/i);

  assert.equal(score(publicReviewed).blocked, false);
  assert.ok(score(publicReviewed).totalScore > 0, "reviewed public-web candidate can rank when evidence is strong");
  assert.ok(
    score(publicUnreviewed).totalScore < internalScore.totalScore,
    "unreviewed public-web candidate should not outrank strong internal approved candidate",
  );

  const retrieval = await retrieveCandidatePoolForProject(projectUnderstanding, roleMap, {
    profiles,
    poolCap: 6,
    perRolePoolCap: 6,
    minInternalCoverage: 1,
  });
  assert.ok(retrieval.candidates.length <= 6, "candidate pool cap should be respected");
  assert.ok(!retrieval.candidates.some((item) => item.optedOut), "opted-out candidates should be excluded");
  assert.ok(!retrieval.candidates.some((item) => item.doNotContact), "DO_NOT_CONTACT candidates should be excluded");
  assert.deepEqual(
    retrieval.filtersApplied.retrievalOrder.slice(0, 4),
    ["role_tags", "skill_tags", "fandom_community_tags", "city_metro"],
    "retrieval should use index-friendly filtering before scoring",
  );

  const ranked = await rankCandidatesForProject("synthetic", {
    projectUnderstanding,
    roleMap,
    profiles,
    requesterId,
    graphContext: {
      edges: graphEdges,
      requesterFandomTags: ["anime", "cosplay"],
      requesterCity: "Los Angeles",
      requesterMetro: "Los Angeles",
    },
    persist: false,
    poolCap: 8,
    minInternalCoverage: 1,
  });
  assert.equal(ranked.status, "COMPLETED");
  assert.equal(ranked.noSmsSent, true);
  assert.equal(ranked.noOutreachSent, true);
  assert.equal(ranked.noGroupChatCreated, true);
  assert.equal(ranked.noLiveWebCall, true);
  assert.equal(ranked.noProductionSagaData, true);
  assert.ok(ranked.results.length <= 8, "ranked result cap should be respected");
  assert.ok(
    ranked.results[0].candidate.sourceMode !== "PUBLIC_WEB_RESEARCH" ||
      ranked.results[0].candidate.reviewStatus === "APPROVED_FOR_INTERNAL_REVIEW",
    "unreviewed public-web candidates should not sit above strong reviewed candidates",
  );

  const noContactScore = score(missingContact);
  assert.ok(
    noContactScore.riskFlags.includes("missing_contactability"),
    "missing contactability should lower operational score",
  );
  assert.equal(score(publicPhone).contactabilitySummary.contactabilityRisk, "HIGH");

  const fanFit = computeFandomCommunityFit({
    projectTags: ["JJK", "cosplay"],
    candidateTags: ["Jujutsu Kaisen", "cosplay photographer"],
  });
  assert.ok(fanFit.score > 0, "fandom aliases should contribute to affinity");

  const summary = ranked.results[0]?.organizerSafeSummary || "";
  assert.doesNotMatch(summary, /@|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  assert.doesNotMatch(summary, /\bavailable\b|\bconfirmed\b|\bbooked\b/i);

  const blockedPromotion = canPromoteMatchResultToReview({
    reviewStatus: "SUGGESTED",
    sourceMode: "INTERNAL_DB",
    organizerSafeSummary: "Reach at person@example.com",
    adminAction: true,
  });
  assert.equal(blockedPromotion.allowed, false);
  assert.ok(blockedPromotion.blockers.includes("organizer_summary_contains_contact_info"));

  const allowedPromotion = canPromoteMatchResultToReview({
    reviewStatus: "SUGGESTED",
    sourceMode: "INTERNAL_DB",
    organizerSafeSummary: "Reviewable internal candidate for photographer.",
    adminAction: true,
  });
  assert.equal(allowedPromotion.allowed, true);
  assert.equal(allowedPromotion.noSmsSent, true);
  assert.equal(allowedPromotion.noOutreachSent, true);
  assert.equal(allowedPromotion.noGroupChatCreated, true);

  const doNotContactPromotion = canPromoteMatchResultToReview({
    reviewStatus: "DO_NOT_CONTACT",
    sourceMode: "INTERNAL_DB",
    organizerSafeSummary: "Reviewable candidate.",
    adminAction: true,
    doNotContact: true,
  });
  assert.equal(doNotContactPromotion.allowed, false);
  assert.ok(doNotContactPromotion.blockers.includes("do_not_contact"));

  console.log("relationship-aware matching tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
