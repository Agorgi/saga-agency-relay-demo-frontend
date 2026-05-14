import type { PublicResearchCandidateCard } from "@/lib/sourcing/talentTypes";
import {
  classifySourceType,
  isPrivateOrLoginGatedSource,
  validateCitationSet,
} from "@/lib/sourcing/sourceNormalization";

export type SourceQualityBand =
  | "HIGH_CONFIDENCE_SOURCE"
  | "MEDIUM_CONFIDENCE_SOURCE"
  | "LOW_CONFIDENCE_SOURCE"
  | "INSUFFICIENT_SOURCE"
  | "BLOCKED_SOURCE";

export type SourceQualityReview = {
  totalScore: number;
  band: SourceQualityBand;
  scoreBreakdown: {
    sourceReliability: number;
    citationCompleteness: number;
    identityClarity: number;
    roleEvidenceStrength: number;
    recencyEvidence: number;
    privacySafety: number;
  };
  blockers: string[];
  warnings: string[];
  recommendedAction:
    | "SEND_TO_QUALITY_REVIEW"
    | "NEEDS_MORE_RESEARCH"
    | "DISCARD"
    | "REJECT";
};

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(value, max));
}

function sourceReliabilityScore(candidate: PublicResearchCandidateCard) {
  const types = candidate.sourceUrls.map((url, index) =>
    classifySourceType(url, candidate.sourceTitles?.[index]),
  );
  if (types.some((type) => type === "PUBLIC_PERSONAL_WEBSITE")) return 18;
  if (
    types.some((type) =>
      [
        "PUBLIC_VENDOR_DIRECTORY",
        "PUBLIC_CONVENTION_DIRECTORY",
        "PUBLIC_EVENT_PAGE",
        "PUBLIC_PRESS_OR_ARTICLE",
      ].includes(type),
    )
  ) {
    return 15;
  }
  if (types.some((type) => type === "PUBLIC_SOCIAL_PROFILE")) {
    return candidate.sourceUrls.length > 1 ? 14 : 10;
  }
  return candidate.sourceUrls.length > 0 ? 8 : 0;
}

export function scorePublicWebSourceQuality(input: {
  candidate: PublicResearchCandidateCard;
  allowedDomains?: string[];
  blockedDomains?: string[];
}): SourceQualityReview {
  const citation = validateCitationSet({
    candidate: input.candidate,
    allowedDomains: input.allowedDomains,
    blockedDomains: input.blockedDomains,
  });
  const blockers = [...citation.blockers];
  const warnings = [...citation.warnings];
  const privateSource =
    input.candidate.privateSourceDetected ||
    input.candidate.sourceUrls.some((url) => isPrivateOrLoginGatedSource(url));
  if (privateSource && !blockers.includes("private_or_login_gated_source")) {
    blockers.push("private_or_login_gated_source");
  }

  const citationCompleteness = clamp(
    citation.normalizedSourceUrls.length * 8 +
      (input.candidate.sourceTitles?.length || 0) * 2,
    20,
  );
  const identityClarity = clamp(
    (input.candidate.displayName ? 8 : 0) +
      (input.candidate.publicProfileUrls.length > 0 ? 6 : 0) +
      (citation.normalizedSourceUrls.length > 1 ? 6 : 2),
    20,
  );
  const roleEvidenceStrength = clamp(
    input.candidate.roleFitEvidence.length * 7 +
      input.candidate.portfolioEvidence.length * 5,
    20,
  );
  const recencyEvidence = clamp(
    (input.candidate.recentActivityEvidence || []).length * 5,
    10,
  );
  const privacySafety = privateSource || input.candidate.sensitiveDataDetected ? 0 : 10;
  const scoreBreakdown = {
    sourceReliability: sourceReliabilityScore(input.candidate),
    citationCompleteness,
    identityClarity,
    roleEvidenceStrength,
    recencyEvidence,
    privacySafety,
  };
  const totalScore = Object.values(scoreBreakdown).reduce(
    (sum, value) => sum + value,
    0,
  );
  const band: SourceQualityBand =
    blockers.length > 0
      ? "BLOCKED_SOURCE"
      : totalScore >= 80
        ? "HIGH_CONFIDENCE_SOURCE"
        : totalScore >= 60
          ? "MEDIUM_CONFIDENCE_SOURCE"
          : totalScore >= 35
            ? "LOW_CONFIDENCE_SOURCE"
            : "INSUFFICIENT_SOURCE";

  if (band === "LOW_CONFIDENCE_SOURCE" || band === "INSUFFICIENT_SOURCE") {
    warnings.push("source_quality_needs_more_research");
  }

  const recommendedAction =
    band === "BLOCKED_SOURCE"
      ? "REJECT"
      : band === "HIGH_CONFIDENCE_SOURCE" || band === "MEDIUM_CONFIDENCE_SOURCE"
        ? "SEND_TO_QUALITY_REVIEW"
        : "NEEDS_MORE_RESEARCH";

  return {
    totalScore,
    band,
    scoreBreakdown,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    recommendedAction,
  };
}
