import type { ProjectUnderstanding, ProducerRole } from "@/sms-engine/producer/producerAgentTypes";
import type { CandidatePoolProfile } from "@/sms-engine/graph/candidateRetrieval";
import { computeFandomCommunityFit } from "@/sms-engine/graph/fandomCommunityFit";
import { computeRoleFitFromTags } from "@/sms-engine/graph/tagTaxonomy";
import { computeRelationshipScore, type ProximityContext } from "@/sms-engine/graph/relationshipProximity";
import { explainRelationshipPath } from "@/sms-engine/graph/relationshipPathExplain";
import { computeRoleAwareLocationFit } from "@/sms-engine/graph/roleLocationRequirements";
import { getRelationshipAwareMatchingWeights } from "@/sms-engine/graph/matchingWeights";

export const RELATIONSHIP_AWARE_SCORING_VERSION =
  getRelationshipAwareMatchingWeights().scoringVersion;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gi;
const EMAIL_TEST_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_TEST_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/i;

export type RelationshipAwareScoreBreakdown = {
  roleFit: number;
  fandomCommunityFit: number;
  locationFit: number;
  relationshipProximity: number;
  evidenceQuality: number;
  contactabilityReadiness: number;
  reviewTrust: number;
  riskPenalty: number;
};

export function redactOrganizerText(value: string) {
  return value.replace(EMAIL_PATTERN, "[redacted-email]").replace(PHONE_PATTERN, "[redacted-phone]");
}

function reviewTrust(profile: CandidatePoolProfile) {
  if (profile.reviewStatus === "APPROVED_FOR_SHORTLIST") return 10;
  if (profile.reviewStatus === "APPROVED_FOR_INTERNAL_REVIEW") return 9;
  if (profile.sourceMode === "INTERNAL_DB" && profile.reviewStatus === "DISCOVERED") return 7;
  if (profile.sourceMode === "PUBLIC_WEB_RESEARCH" && profile.reviewStatus === "NEEDS_QUALITY_REVIEW") {
    return 4;
  }
  if (profile.sourceMode === "PUBLIC_WEB_RESEARCH") return 3;
  return 5;
}

function sourceRisk(profile: CandidatePoolProfile) {
  const weights = getRelationshipAwareMatchingWeights();
  const risks: string[] = [];
  let penalty = 0;
  if (profile.evidenceQualityScore < 35) {
    risks.push("weak_evidence");
    penalty += profile.evidenceQualityScore < 15
      ? weights.roleSpecificOverrides.veryWeakEvidencePenalty
      : weights.roleSpecificOverrides.weakEvidencePenalty;
  }
  if (
    profile.sourceMode === "PUBLIC_WEB_RESEARCH" &&
    profile.reviewStatus !== "APPROVED_FOR_INTERNAL_REVIEW" &&
    profile.reviewStatus !== "APPROVED_FOR_SHORTLIST"
  ) {
    risks.push("unverified_public_web_candidate");
    penalty += weights.roleSpecificOverrides.publicWebUnreviewedPenalty;
  }
  if (profile.contactabilityScore <= 0) {
    risks.push("missing_contactability");
    penalty += weights.roleSpecificOverrides.noContactabilityPenalty;
  }
  if (profile.reviewStatus === "NEEDS_IDENTITY_REVIEW") {
    risks.push("ambiguous_identity");
    penalty += weights.roleSpecificOverrides.ambiguousIdentityPenalty;
  }
  return { risks, penalty };
}

function contactabilitySummary(profile: CandidatePoolProfile) {
  const risk = profile.doNotContact || profile.optedOut
    ? "BLOCKED"
    : profile.contactabilityRisk ||
      (profile.contactabilityScore >= 80
        ? "LOW"
        : profile.contactabilityScore >= 55
          ? "MEDIUM"
          : profile.contactabilityScore > 0
            ? "HIGH"
            : "UNKNOWN");
  return {
    contactabilityScore: profile.contactabilityScore,
    contactabilityRisk: risk,
    recommendedContactPathForAdminReview:
      profile.recommendedContactPathForAdminReview ||
      (profile.contactabilityScore > 0 ? "review_existing_contactability_evidence" : null),
    note: "Contactability is evidence, not permission to contact.",
  };
}

export function scoreCandidateForRole(input: {
  project: ProjectUnderstanding;
  role: ProducerRole;
  candidate: CandidatePoolProfile;
  requesterId?: string | null;
  graphContext?: ProximityContext;
}) {
  const weights = getRelationshipAwareMatchingWeights();
  const candidate = input.candidate;
  if (candidate.doNotContact || candidate.optedOut) {
    return {
      blocked: true,
      totalScore: 0,
      scoreBreakdown: {
        roleFit: 0,
        fandomCommunityFit: 0,
        locationFit: 0,
        relationshipProximity: 0,
        evidenceQuality: 0,
        contactabilityReadiness: 0,
        reviewTrust: 0,
        riskPenalty: 0,
      } satisfies RelationshipAwareScoreBreakdown,
      proximityTier: "P7_UNKNOWN",
      relationshipPath: null,
      matchReasons: [],
      riskFlags: [candidate.doNotContact ? "do_not_contact" : "opted_out"],
      missingEvidence: [],
      contactabilitySummary: contactabilitySummary(candidate),
      organizerSafeSummary: "",
    };
  }

  const roleFit = computeRoleFitFromTags({
    candidateRoleTags: [...candidate.roleTags, ...candidate.skillTags],
    targetRoleTags: [input.role.roleType, input.role.title, ...input.role.requiredSkills],
    inferredCandidateTags: candidate.sourceMode === "PUBLIC_WEB_RESEARCH",
  });
  const roleScore = Math.round(roleFit.score * weights.baseWeights.roleFit);
  const fandomFit = computeFandomCommunityFit({
    projectTags: [
      ...input.project.fandoms,
      ...input.project.communities,
      ...input.role.preferredFandoms,
    ],
    candidateTags: [...candidate.fandomTags, ...candidate.communityTags],
    candidateTagsInferred: candidate.sourceMode === "PUBLIC_WEB_RESEARCH",
  });
  const location = computeRoleAwareLocationFit({
    role: input.role.roleType,
    candidateLocation: candidate.city || candidate.metro,
    projectLocation: input.project.city,
    roleMapLocalRequired: input.role.localRequired,
  });
  const context: ProximityContext = {
    ...(input.graphContext || {}),
    candidateFandomTags: candidate.fandomTags,
    candidateCommunityTags: candidate.communityTags,
    candidateCity: candidate.city,
    candidateMetro: candidate.metro,
    candidateSourceMode: candidate.sourceMode,
    candidateMatchedInternal: Boolean(candidate.personId || candidate.creatorProfileId || candidate.contactId),
  };
  const relationshipPath = explainRelationshipPath({
    requesterId: input.requesterId,
    candidateId: candidate.personId || candidate.id,
    context,
  });
  const relationshipScore = Math.round(
    (computeRelationshipScore(relationshipPath.proximityTier) / 100) *
      weights.baseWeights.relationshipProximity,
  );
  const evidenceQuality = Math.round(
    Math.min(weights.baseWeights.evidenceQuality, Math.max(0, candidate.evidenceQualityScore / 10)),
  );
  const contactabilityReadiness = Math.round(
    Math.min(weights.baseWeights.contactabilityReadiness, Math.max(0, candidate.contactabilityScore / 10)),
  );
  const trust = reviewTrust(candidate);
  const risk = sourceRisk(candidate);
  const scoreBreakdown: RelationshipAwareScoreBreakdown = {
    roleFit: roleScore,
    fandomCommunityFit: fandomFit.score,
    locationFit: location.score,
    relationshipProximity: relationshipScore,
    evidenceQuality,
    contactabilityReadiness,
    reviewTrust: trust,
    riskPenalty: -risk.penalty,
  };
  const rawScore =
    roleScore +
    fandomFit.score +
    location.score +
    relationshipScore +
    evidenceQuality +
    contactabilityReadiness +
    trust -
    risk.penalty;
  const totalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const missingEvidence = [
    roleScore === 0 ? "role_fit_evidence" : null,
    fandomFit.score === 0 ? "fandom_or_community_evidence" : null,
    location.bucket === "unknown" ? "location_evidence" : null,
    candidate.contactabilityScore <= 0 ? "contactability_evidence" : null,
    candidate.evidenceQualityScore < 35 ? "stronger_candidate_evidence" : null,
  ].filter((item): item is string => Boolean(item));
  const matchReasons = [
    roleFit.matchedTags.length > 0
      ? `Role fit: ${roleFit.matchedTags.join(", ")}`
      : null,
    fandomFit.score > 0 ? fandomFit.explanation : null,
    location.explanation,
    relationshipPath.pathSummary,
    candidate.sourceMode === "INTERNAL_DB"
      ? "Internal candidate evidence is higher trust than public-web inference."
      : "Public-web candidate remains review-gated and lower confidence.",
    candidate.contactabilityScore > 0
      ? "Contactability evidence exists for admin review."
      : "Contactability evidence is missing or not reviewed.",
  ].filter((item): item is string => Boolean(item));
  const organizerSafeSummary = redactOrganizerText(
    `${candidate.displayName} may fit ${input.role.roleType}. ${matchReasons
      .filter((reason) => !/contactability/i.test(reason))
      .join(" ")}`.replace(/\bavailable\b|\bconfirmed\b|\bbooked\b/gi, "reviewable"),
  );

  return {
    blocked: false,
    totalScore,
    scoreBreakdown,
    proximityTier: relationshipPath.proximityTier,
    relationshipPath,
    matchReasons,
    riskFlags: risk.risks,
    missingEvidence,
    contactabilitySummary: contactabilitySummary(candidate),
    organizerSafeSummary,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
  };
}

export function canPromoteMatchResultToReview(input: {
  reviewStatus: string;
  sourceMode: string;
  riskFlags?: string[];
  organizerSafeSummary?: string | null;
  adminAction?: boolean;
  optedOut?: boolean;
  doNotContact?: boolean;
}) {
  const summary = input.organizerSafeSummary || "";
  const blockers = [
    input.optedOut ? "opted_out" : null,
    input.doNotContact || input.reviewStatus === "DO_NOT_CONTACT" ? "do_not_contact" : null,
    input.reviewStatus === "REJECTED" ? "rejected" : null,
    !input.adminAction ? "admin_action_required" : null,
    EMAIL_TEST_PATTERN.test(summary) || PHONE_TEST_PATTERN.test(summary)
      ? "organizer_summary_contains_contact_info"
      : null,
    /\bavailable\b|\bconfirmed\b|\bbooked\b/i.test(summary)
      ? "unsupported_availability_or_booking_claim"
      : null,
    input.sourceMode === "PUBLIC_WEB_RESEARCH" &&
    !["NEEDS_REVIEW", "SUGGESTED", "APPROVED_FOR_SHORTLIST"].includes(input.reviewStatus)
      ? "public_web_candidate_needs_review"
      : null,
  ].filter((item): item is string => Boolean(item));
  return {
    allowed: blockers.length === 0,
    blockers,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
  };
}
