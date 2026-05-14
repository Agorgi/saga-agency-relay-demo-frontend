import type {
  Prisma,
  TalentCandidateSource,
  TalentResearchReviewStatus,
} from "@prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const talentResearchQualityAuditEvents = {
  reviewCreated: "talent_quality.review_created",
  reviewUpdated: "talent_quality.review_updated",
  candidateScored: "talent_quality.candidate_scored",
  candidateApproved: "talent_quality.candidate_approved",
  candidateRejected: "talent_quality.candidate_rejected",
  candidateNeedsMoreResearch: "talent_quality.candidate_needs_more_research",
  candidateMarkedDoNotContact: "talent_quality.candidate_marked_do_not_contact",
  organizerSummaryUpdated: "talent_quality.organizer_summary_updated",
  llmReviewUsed: "talent_quality.llm_review_used",
  llmReviewFallbackUsed: "talent_quality.llm_review_fallback_used",
} as const;

export const talentResearchSourceTypes = [
  "INTERNAL_CREATOR_PROFILE",
  "INTERNAL_CONTACT",
  "INTERNAL_RELATIONSHIP_EDGE",
  "USER_PROVIDED_PORTFOLIO",
  "PUBLIC_PERSONAL_WEBSITE",
  "PUBLIC_SOCIAL_PROFILE",
  "PUBLIC_EVENT_PAGE",
  "PUBLIC_VENDOR_DIRECTORY",
  "PUBLIC_CONVENTION_DIRECTORY",
  "PUBLIC_PRESS_OR_ARTICLE",
  "PUBLIC_MARKETPLACE_PROFILE",
  "ADMIN_ADDED",
  "UNKNOWN",
] as const;

export type TalentResearchSourceType =
  (typeof talentResearchSourceTypes)[number];

export const talentResearchReliabilityLevels = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
] as const;

export type TalentResearchReliability =
  (typeof talentResearchReliabilityLevels)[number];

export const talentResearchReviewBands = [
  "STRONG_FIT",
  "LIKELY_FIT",
  "NEEDS_MORE_RESEARCH",
  "WEAK_FIT",
  "REJECT_RECOMMENDATION",
] as const;

export type TalentResearchReviewBand =
  (typeof talentResearchReviewBands)[number];

export const talentResearchQualityLlmReviewSchema = z.object({
  evidenceSummary: z.string().trim().min(1),
  unsupportedClaims: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  sourceReliabilityAssessment: z.enum(talentResearchReliabilityLevels),
  roleFitAssessment: z.string().trim().min(1),
  fandomFitAssessment: z.string().trim().min(1),
  locationFitAssessment: z.string().trim().min(1),
  organizerSafeSummary: z.string().trim().min(1),
  riskFlags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  recommendedReviewStatus: z.enum([
    "UNREVIEWED",
    "APPROVED_FOR_SHORTLIST",
    "NEEDS_MORE_RESEARCH",
    "REJECTED",
    "DO_NOT_CONTACT",
    "NEEDS_ADMIN",
  ]),
});

export type TalentResearchQualityLlmReview = z.infer<
  typeof talentResearchQualityLlmReviewSchema
>;

export type TalentResearchQualityCandidate = {
  id?: string | null;
  searchRunId?: string | null;
  projectBriefId?: string | null;
  projectId?: string | null;
  candidateRecommendationId?: string | null;
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  source?: TalentCandidateSource | string | null;
  sourceType?: TalentResearchSourceType | string | null;
  displayName?: string | null;
  role?: string | null;
  city?: string | null;
  fandoms?: unknown;
  skills?: unknown;
  portfolioUrls?: unknown;
  publicSourceUrls?: unknown;
  evidence?: unknown;
  score?: number | null;
  scoreBreakdown?: unknown;
  status?: string | null;
  risks?: unknown;
  missingInfo?: unknown;
  adminNotes?: string | null;
  privateNotes?: string | null;
  reviewStatus?: string | null;
  relationshipTier?: string | null;
  relationshipStrength?: number | null;
  availabilityNotes?: string | null;
  rateNotes?: string | null;
  responsivenessScore?: number | null;
  optedOut?: boolean | null;
  doNotContact?: boolean | null;
  consentStatus?: string | null;
};

export type TalentResearchQualityContext = {
  expectedRole?: string | null;
  projectCity?: string | null;
  projectFandoms?: string[];
  adminReviewed?: boolean;
  existingReviewStatus?: string | null;
};

export type TalentResearchScoreBreakdown = {
  evidenceQuality: number;
  identityConfidence: number;
  roleFitEvidence: number;
  fandomCommunityFitEvidence: number;
  locationProximityEvidence: number;
  sourceReliability: number;
  actionability: number;
};

export type TalentResearchEvidenceChecklist = {
  hasDisplayName: boolean;
  hasRoleEvidence: boolean;
  hasPortfolioOrPublicProfile: boolean;
  hasLocationEvidence: boolean;
  hasFandomCommunityEvidence: boolean;
  hasSourceUrls: boolean;
  hasRecentActivityEvidence: boolean;
  hasInternalRelationshipEvidence: boolean;
  hasReviewStatus: boolean;
  hasAvailabilityEvidence: boolean;
  hasDoNotContactFlag: boolean;
  hasOptOutFlag: boolean;
  hasPrivateNotesLeakRisk: boolean;
  hasRawContactInfoLeakRisk: boolean;
  hasUnsupportedClaims: boolean;
};

export type TalentResearchQualityResult = {
  totalScore: number;
  scoreBreakdown: TalentResearchScoreBreakdown;
  reviewBand: TalentResearchReviewBand;
  recommendedReviewStatus: TalentResearchReviewStatus | string;
  evidenceChecklist: TalentResearchEvidenceChecklist;
  strengths: string[];
  weaknesses: string[];
  missingEvidence: string[];
  riskFlags: string[];
  organizerSafeSummary: string;
  adminOnlyNotes: string[];
  sourceReliability: TalentResearchReliability;
  sourceType: TalentResearchSourceType;
  identityConfidence: number;
  actionability: number;
  shouldPromoteToShortlist: boolean;
  shouldBlockOutreach: boolean;
  explanationForAudit: string[];
};

const rawEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const rawPhonePattern =
  /(?:\+\d{8,15})|\b(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;
const privateNotesPattern =
  /\b(private note|internal note|admin note|do not share|secret|internal-only)\b/i;
const availabilityClaimPattern =
  /\b(available|open to work|open for work|willing|interested|confirmed availability|will join|has agreed)\b/i;
const rateClaimPattern =
  /\b(rate|rates|payment|paid work|guaranteed|booked|confirmed booking|confirmed rate|\$\d+)/i;
const privateSourcePattern =
  /\b(login|logged-in|private group|dm|direct message|screenshot|nonpublic)\b/i;

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function canonical(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function includesText(left?: string | null, right?: string | null) {
  const a = canonical(left);
  const b = canonical(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textArrayFromEvidence(evidence: Record<string, unknown>, key: string) {
  return safeStringArray(evidence[key]);
}

function allCandidateText(candidate: TalentResearchQualityCandidate) {
  return [
    candidate.displayName,
    candidate.role,
    candidate.city,
    candidate.adminNotes,
    candidate.privateNotes,
    candidate.availabilityNotes,
    candidate.rateNotes,
    JSON.stringify(candidate.evidence || {}),
    ...safeStringArray(candidate.fandoms),
    ...safeStringArray(candidate.skills),
    ...safeStringArray(candidate.portfolioUrls),
    ...safeStringArray(candidate.publicSourceUrls),
    ...safeStringArray(candidate.risks),
    ...safeStringArray(candidate.missingInfo),
  ]
    .filter(Boolean)
    .join(" ");
}

function organizerVisibleCandidateText(candidate: TalentResearchQualityCandidate) {
  return [
    candidate.displayName,
    candidate.role,
    candidate.city,
    candidate.availabilityNotes,
    candidate.rateNotes,
    JSON.stringify(candidate.evidence || {}),
    ...safeStringArray(candidate.fandoms),
    ...safeStringArray(candidate.skills),
    ...safeStringArray(candidate.portfolioUrls),
    ...safeStringArray(candidate.publicSourceUrls),
    ...safeStringArray(candidate.risks),
    ...safeStringArray(candidate.missingInfo),
  ]
    .filter(Boolean)
    .join(" ");
}

function containsRawContactInfo(text: string) {
  return rawEmailPattern.test(text) || rawPhonePattern.test(text);
}

function reliabilityScore(level: TalentResearchReliability) {
  return {
    HIGH: 10,
    MEDIUM: 7,
    LOW: 3,
    UNKNOWN: 1,
  }[level];
}

function reviewBandFromScore(score: number): TalentResearchReviewBand {
  if (score >= 85) return "STRONG_FIT";
  if (score >= 70) return "LIKELY_FIT";
  if (score >= 50) return "NEEDS_MORE_RESEARCH";
  if (score >= 30) return "WEAK_FIT";
  return "REJECT_RECOMMENDATION";
}

function hasRecentEvidence(evidence: Record<string, unknown>) {
  return (
    textArrayFromEvidence(evidence, "recentActivityEvidence").length > 0 ||
    Boolean(evidence.recentActivityEvidence) ||
    Boolean(evidence.lastActiveAt)
  );
}

function sourceTypeFromCandidate(
  candidate: TalentResearchQualityCandidate,
): TalentResearchSourceType {
  if (
    candidate.sourceType &&
    talentResearchSourceTypes.includes(candidate.sourceType as TalentResearchSourceType)
  ) {
    return candidate.sourceType as TalentResearchSourceType;
  }
  if (candidate.source === "PUBLIC_WEB_RESEARCH") {
    const urls = safeStringArray(candidate.publicSourceUrls);
    if (urls.some((url) => /linkedin|marketplace|etsy|ko-fi|fiverr/i.test(url))) {
      return "PUBLIC_MARKETPLACE_PROFILE";
    }
    if (urls.some((url) => /instagram|tiktok|youtube|twitter|x\.com/i.test(url))) {
      return "PUBLIC_SOCIAL_PROFILE";
    }
    if (urls.some((url) => /event|vendor|convention|artist-alley/i.test(url))) {
      return "PUBLIC_EVENT_PAGE";
    }
    return "PUBLIC_PERSONAL_WEBSITE";
  }
  if (candidate.source === "ADMIN_ADDED") return "ADMIN_ADDED";
  if (candidate.creatorProfileId) return "INTERNAL_CREATOR_PROFILE";
  if (candidate.contactId) return "INTERNAL_CONTACT";
  if (candidate.relationshipTier && candidate.relationshipTier !== "UNKNOWN") {
    return "INTERNAL_RELATIONSHIP_EDGE";
  }
  return "UNKNOWN";
}

export function classifyTalentResearchSource(input: {
  candidate: TalentResearchQualityCandidate;
}): {
  sourceType: TalentResearchSourceType;
  sourceReliability: TalentResearchReliability;
} {
  const candidate = input.candidate;
  const sourceType = sourceTypeFromCandidate(candidate);
  const publicSourceUrls = safeStringArray(candidate.publicSourceUrls);
  const portfolioUrls = safeStringArray(candidate.portfolioUrls);
  const evidence = jsonObject(candidate.evidence);

  if (
    sourceType === "INTERNAL_CREATOR_PROFILE" &&
    candidate.reviewStatus === "APPROVED"
  ) {
    return { sourceType, sourceReliability: "HIGH" };
  }
  if (
    sourceType.startsWith("INTERNAL_") &&
    (candidate.reviewStatus === "APPROVED" || candidate.relationshipTier)
  ) {
    return { sourceType, sourceReliability: "HIGH" };
  }
  if (sourceType === "USER_PROVIDED_PORTFOLIO" && portfolioUrls.length > 0) {
    return { sourceType, sourceReliability: "MEDIUM" };
  }
  if (
    sourceType === "PUBLIC_PERSONAL_WEBSITE" &&
    publicSourceUrls.length > 0 &&
    (portfolioUrls.length > 0 || textArrayFromEvidence(evidence, "roleEvidence").length)
  ) {
    return { sourceType, sourceReliability: "HIGH" };
  }
  if (
    [
      "PUBLIC_SOCIAL_PROFILE",
      "PUBLIC_EVENT_PAGE",
      "PUBLIC_VENDOR_DIRECTORY",
      "PUBLIC_CONVENTION_DIRECTORY",
      "PUBLIC_PRESS_OR_ARTICLE",
      "PUBLIC_MARKETPLACE_PROFILE",
    ].includes(sourceType)
  ) {
    return {
      sourceType,
      sourceReliability: publicSourceUrls.length > 1 ? "MEDIUM" : "LOW",
    };
  }
  if (sourceType === "ADMIN_ADDED") {
    return {
      sourceType,
      sourceReliability: publicSourceUrls.length || portfolioUrls.length ? "MEDIUM" : "LOW",
    };
  }
  return { sourceType, sourceReliability: "UNKNOWN" };
}

function buildEvidenceChecklist(input: {
  candidate: TalentResearchQualityCandidate;
  context: TalentResearchQualityContext;
}) {
  const { candidate, context } = input;
  const evidence = jsonObject(candidate.evidence);
  const roleEvidence = [
    candidate.role,
    ...safeStringArray(candidate.skills),
    ...textArrayFromEvidence(evidence, "roleEvidence"),
    ...textArrayFromEvidence(evidence, "matchingReasons"),
  ];
  const fandomEvidence = [
    ...safeStringArray(candidate.fandoms),
    ...textArrayFromEvidence(evidence, "fandomEvidence"),
    ...textArrayFromEvidence(evidence, "communities"),
  ];
  const locationEvidence = [
    candidate.city,
    ...textArrayFromEvidence(evidence, "locationEvidence"),
  ];
  const publicSourceUrls = safeStringArray(candidate.publicSourceUrls);
  const portfolioUrls = safeStringArray(candidate.portfolioUrls);
  const text = allCandidateText(candidate);
  const visibleText = organizerVisibleCandidateText(candidate);
  const hasAvailabilityEvidence =
    Boolean(candidate.availabilityNotes) ||
    textArrayFromEvidence(evidence, "availabilityEvidence").length > 0;
  const hasUnsupportedAvailabilityClaim =
    availabilityClaimPattern.test(visibleText) && !hasAvailabilityEvidence;
  const hasUnsupportedRateClaim =
    rateClaimPattern.test(visibleText) &&
    !candidate.rateNotes &&
    textArrayFromEvidence(evidence, "rateEvidence").length === 0;

  return {
    checklist: {
      hasDisplayName: Boolean(candidate.displayName?.trim()),
      hasRoleEvidence:
        roleEvidence.some(Boolean) &&
        (!context.expectedRole ||
          roleEvidence.some((item) => includesText(item, context.expectedRole))),
      hasPortfolioOrPublicProfile:
        portfolioUrls.length > 0 || publicSourceUrls.length > 0,
      hasLocationEvidence:
        locationEvidence.some(Boolean) &&
        (!context.projectCity ||
          locationEvidence.some((item) => includesText(item, context.projectCity))),
      hasFandomCommunityEvidence:
        fandomEvidence.length > 0 &&
        (!context.projectFandoms?.length ||
          fandomEvidence.some((item) =>
            context.projectFandoms?.some((fandom) => includesText(item, fandom)),
          )),
      hasSourceUrls: publicSourceUrls.length > 0 || candidate.source === "INTERNAL_DB",
      hasRecentActivityEvidence: hasRecentEvidence(evidence),
      hasInternalRelationshipEvidence: Boolean(
        candidate.relationshipTier && candidate.relationshipTier !== "UNKNOWN",
      ),
      hasReviewStatus: Boolean(candidate.reviewStatus),
      hasAvailabilityEvidence,
      hasDoNotContactFlag:
        Boolean(candidate.doNotContact) || candidate.status === "DO_NOT_CONTACT",
      hasOptOutFlag:
        Boolean(candidate.optedOut) || candidate.consentStatus === "OPTED_OUT",
      hasPrivateNotesLeakRisk:
        Boolean(candidate.privateNotes) || privateNotesPattern.test(text),
      hasRawContactInfoLeakRisk: containsRawContactInfo(visibleText),
      hasUnsupportedClaims:
        hasUnsupportedAvailabilityClaim || hasUnsupportedRateClaim,
    } satisfies TalentResearchEvidenceChecklist,
    evidence,
    roleEvidence,
    fandomEvidence,
    locationEvidence,
    publicSourceUrls,
    portfolioUrls,
    unsupportedClaims: unique([
      hasUnsupportedAvailabilityClaim ? "availability_or_willingness_unverified" : null,
      hasUnsupportedRateClaim ? "rate_or_payment_claim_unverified" : null,
    ]),
  };
}

function organizerSafeSummary(input: {
  candidate: TalentResearchQualityCandidate;
  checklist: TalentResearchEvidenceChecklist;
  strengths: string[];
  missingEvidence: string[];
}) {
  const name = candidateSafeName(input.candidate.displayName);
  const role = input.candidate.role?.trim() || "this role";
  const evidenceLine = input.strengths.slice(0, 2).join("; ");
  const base = evidenceLine
    ? `${name} may be worth reviewing for ${role} based on ${evidenceLine}.`
    : `${name} may be worth reviewing for ${role}, but Saga needs more evidence before sharing a confident fit summary.`;
  const caveat =
    input.missingEvidence.length > 0
      ? ` Still needs review on ${input.missingEvidence.slice(0, 2).join(" and ")}.`
      : " Availability, interest, and rates are unverified.";
  return sanitizeOrganizerFacingText(`${base}${caveat}`);
}

function candidateSafeName(name?: string | null) {
  const fallback = "This candidate";
  if (!name?.trim() || containsRawContactInfo(name)) return fallback;
  return name.trim();
}

export function sanitizeOrganizerFacingText(text: string) {
  return text
    .replace(rawEmailPattern, "[redacted email]")
    .replace(rawPhonePattern, "[redacted phone]")
    .replace(privateNotesPattern, "internal-only note")
    .trim();
}

export function evaluateTalentResearchQuality(
  candidate: TalentResearchQualityCandidate,
  context: TalentResearchQualityContext = {},
): TalentResearchQualityResult {
  const source = candidate.source || "INTERNAL_DB";
  const isPublicWeb = source === "PUBLIC_WEB_RESEARCH";
  const {
    checklist,
    evidence,
    roleEvidence,
    fandomEvidence,
    publicSourceUrls,
    portfolioUrls,
    unsupportedClaims,
  } = buildEvidenceChecklist({ candidate, context });
  const { sourceReliability, sourceType } = classifyTalentResearchSource({
    candidate,
  });

  const evidenceQuality = clamp(
    (portfolioUrls.length ? 5 : 0) +
      (publicSourceUrls.length ? 4 : 0) +
      (roleEvidence.length ? 5 : 0) +
      (fandomEvidence.length ? 3 : 0) +
      (checklist.hasLocationEvidence ? 2 : 0) +
      (checklist.hasRecentActivityEvidence ? 1 : 0) +
      (checklist.hasReviewStatus ? 2 : 0),
    20,
  );
  const identityConfidence = clamp(
    (checklist.hasDisplayName ? 4 : 0) +
      (candidate.personId || candidate.creatorProfileId || candidate.contactId ? 4 : 0) +
      (publicSourceUrls.length || portfolioUrls.length ? 3 : 0) +
      (checklist.hasReviewStatus ? 2 : 0) +
      (checklist.hasInternalRelationshipEvidence ? 2 : 0),
    15,
  );
  const roleFitEvidence = clamp(
    (checklist.hasRoleEvidence ? 12 : 0) +
      Math.min(5, safeStringArray(candidate.skills).length * 2) +
      Math.min(3, textArrayFromEvidence(evidence, "roleEvidence").length * 2),
    20,
  );
  const fandomCommunityFitEvidence = clamp(
    (checklist.hasFandomCommunityEvidence ? 11 : 0) +
      Math.min(4, safeStringArray(candidate.fandoms).length),
    15,
  );
  const locationProximityEvidence = checklist.hasLocationEvidence
    ? 10
    : candidate.city
      ? 5
      : 0;
  const actionability = clamp(
    (checklist.hasDoNotContactFlag || checklist.hasOptOutFlag ? 0 : 4) +
      (checklist.hasPortfolioOrPublicProfile ? 2 : 0) +
      (candidate.reviewStatus === "APPROVED" ? 2 : 0) +
      (!checklist.hasUnsupportedClaims ? 1 : 0) +
      (!checklist.hasRawContactInfoLeakRisk ? 1 : 0),
    10,
  );

  const scoreBreakdown = {
    evidenceQuality,
    identityConfidence,
    roleFitEvidence,
    fandomCommunityFitEvidence,
    locationProximityEvidence,
    sourceReliability: reliabilityScore(sourceReliability),
    actionability,
  };
  const totalScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const reviewBand = reviewBandFromScore(totalScore);
  const riskFlags = unique([
    checklist.hasOptOutFlag ? "opted_out" : null,
    checklist.hasDoNotContactFlag ? "do_not_contact" : null,
    checklist.hasPrivateNotesLeakRisk ? "private_notes_leak_risk" : null,
    checklist.hasRawContactInfoLeakRisk ? "raw_contact_info_leak_risk" : null,
    checklist.hasUnsupportedClaims ? "unsupported_claims" : null,
    isPublicWeb && !checklist.hasSourceUrls ? "missing_public_source_urls" : null,
    !checklist.hasDisplayName ? "ambiguous_identity" : null,
    !checklist.hasRoleEvidence ? "weak_role_evidence" : null,
    !checklist.hasLocationEvidence ? "missing_location_evidence" : null,
    !checklist.hasFandomCommunityEvidence ? "missing_fandom_evidence" : null,
    isPublicWeb ? "public_web_needs_human_review" : null,
    privateSourcePattern.test(allCandidateText(candidate))
      ? "source_disallowed_private"
      : null,
    ...unsupportedClaims,
  ]);
  const strengths = unique([
    checklist.hasRoleEvidence ? "role evidence" : null,
    checklist.hasFandomCommunityEvidence ? "community/fandom evidence" : null,
    checklist.hasLocationEvidence ? "location evidence" : null,
    checklist.hasPortfolioOrPublicProfile ? "portfolio or public profile evidence" : null,
    checklist.hasInternalRelationshipEvidence ? "internal relationship evidence" : null,
    candidate.reviewStatus === "APPROVED" ? "approved internal profile" : null,
  ]);
  const missingEvidence = unique([
    !checklist.hasDisplayName ? "clear identity" : null,
    !checklist.hasRoleEvidence ? "role-fit evidence" : null,
    !checklist.hasPortfolioOrPublicProfile ? "portfolio/public profile" : null,
    !checklist.hasLocationEvidence ? "location evidence" : null,
    !checklist.hasFandomCommunityEvidence ? "fandom/community evidence" : null,
    isPublicWeb && !checklist.hasSourceUrls ? "source URLs" : null,
    !checklist.hasAvailabilityEvidence ? "availability remains unknown" : null,
  ]);
  const weaknesses = unique([
    ...missingEvidence.slice(0, 4),
    sourceReliability === "LOW" || sourceReliability === "UNKNOWN"
      ? "source reliability is weak"
      : null,
    isPublicWeb && !context.adminReviewed ? "public-web candidate needs admin review" : null,
  ]);
  const adminOnlyNotes = unique([
    checklist.hasPrivateNotesLeakRisk
      ? "Private/admin notes must not appear in organizer-facing summaries."
      : null,
    checklist.hasRawContactInfoLeakRisk
      ? "Raw phone/email must be redacted before any organizer-facing use."
      : null,
    isPublicWeb
      ? "Public-web candidates require citations and human review before shortlist or outreach."
      : null,
  ]);
  const recommendedReviewStatus = recommendedStatusForResult({
    isPublicWeb,
    reviewBand,
    checklist,
    riskFlags,
    adminReviewed: Boolean(context.adminReviewed),
  });
  const summary = organizerSafeSummary({
    candidate,
    checklist,
    strengths,
    missingEvidence,
  });
  const shouldPromoteToShortlist =
    recommendedReviewStatus === "APPROVED_FOR_SHORTLIST" &&
    !checklist.hasOptOutFlag &&
    !checklist.hasDoNotContactFlag &&
    !checklist.hasRawContactInfoLeakRisk &&
    !checklist.hasUnsupportedClaims;

  return {
    totalScore,
    scoreBreakdown,
    reviewBand,
    recommendedReviewStatus,
    evidenceChecklist: checklist,
    strengths,
    weaknesses,
    missingEvidence,
    riskFlags,
    organizerSafeSummary: summary,
    adminOnlyNotes,
    sourceReliability,
    sourceType,
    identityConfidence,
    actionability,
    shouldPromoteToShortlist,
    shouldBlockOutreach: !shouldPromoteToShortlist,
    explanationForAudit: [
      `Talent quality score ${totalScore}/100 (${reviewBand}).`,
      `Recommended status: ${recommendedReviewStatus}.`,
      `Source reliability: ${sourceReliability}.`,
    ],
  };
}

function recommendedStatusForResult(input: {
  isPublicWeb: boolean;
  reviewBand: TalentResearchReviewBand;
  checklist: TalentResearchEvidenceChecklist;
  riskFlags: string[];
  adminReviewed: boolean;
}): TalentResearchReviewStatus | string {
  if (input.checklist.hasOptOutFlag || input.checklist.hasDoNotContactFlag) {
    return "DO_NOT_CONTACT";
  }
  if (
    input.riskFlags.includes("source_disallowed_private") ||
    input.checklist.hasRawContactInfoLeakRisk ||
    input.riskFlags.includes("ambiguous_identity")
  ) {
    return "NEEDS_ADMIN";
  }
  if (
    input.isPublicWeb &&
    (!input.checklist.hasSourceUrls || !input.checklist.hasRoleEvidence)
  ) {
    return input.reviewBand === "REJECT_RECOMMENDATION"
      ? "REJECTED"
      : "NEEDS_MORE_RESEARCH";
  }
  if (input.reviewBand === "STRONG_FIT" || input.reviewBand === "LIKELY_FIT") {
    if (input.isPublicWeb && !input.adminReviewed) return "NEEDS_MORE_RESEARCH";
    return "APPROVED_FOR_SHORTLIST";
  }
  if (input.reviewBand === "NEEDS_MORE_RESEARCH") return "NEEDS_MORE_RESEARCH";
  if (input.reviewBand === "WEAK_FIT") {
    return input.checklist.hasRoleEvidence ? "NEEDS_MORE_RESEARCH" : "REJECTED";
  }
  return "REJECTED";
}

export function validateTalentResearchQualityLlmReview(value: unknown) {
  return talentResearchQualityLlmReviewSchema.safeParse(value);
}

export function applyTalentResearchQualityLlmReview(input: {
  deterministic: TalentResearchQualityResult;
  llmReview: unknown;
  llmAllowed: boolean;
}) {
  if (!input.llmAllowed) {
    return {
      usedLlm: false,
      fallbackUsed: false,
      result: input.deterministic,
      validationStatus: "not_requested" as const,
    };
  }
  const parsed = validateTalentResearchQualityLlmReview(input.llmReview);
  if (!parsed.success) {
    return {
      usedLlm: false,
      fallbackUsed: true,
      result: input.deterministic,
      validationStatus: "invalid_llm_review" as const,
    };
  }
  const safeSummary = sanitizeOrganizerFacingText(parsed.data.organizerSafeSummary);
  return {
    usedLlm: true,
    fallbackUsed: false,
    result: {
      ...input.deterministic,
      organizerSafeSummary: safeSummary,
      riskFlags: unique([...input.deterministic.riskFlags, ...parsed.data.riskFlags]),
      missingEvidence: unique([
        ...input.deterministic.missingEvidence,
        ...parsed.data.missingEvidence,
      ]),
      adminOnlyNotes: unique([
        ...input.deterministic.adminOnlyNotes,
        `LLM evidence summary validated: ${parsed.data.evidenceSummary}`,
      ]),
    },
    validationStatus: "valid" as const,
  };
}

function jsonForPrisma(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function sourceModeForCandidate(source?: string | null) {
  if (source === "PUBLIC_WEB_RESEARCH") return "PUBLIC_WEB_RESEARCH";
  if (source === "ADMIN_ADDED") return "ADMIN_ADDED";
  return "INTERNAL_DB";
}

function candidateForEvaluation(candidate: {
  id: string;
  searchRunId: string;
  projectBriefId?: string | null;
  projectId?: string | null;
  candidateRecommendationId?: string | null;
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  source?: string | null;
  displayName: string;
  role: string;
  city?: string | null;
  fandoms?: unknown;
  skills?: unknown;
  portfolioUrls?: unknown;
  publicSourceUrls?: unknown;
  evidence?: unknown;
  score?: number | null;
  scoreBreakdown?: unknown;
  status?: string | null;
  risks?: unknown;
  missingInfo?: unknown;
  adminNotes?: string | null;
  searchRun?: { projectBriefId?: string | null; projectId?: string | null } | null;
  person?: {
    optedOut?: boolean | null;
    consentStatus?: string | null;
    creatorProfile?: {
      reviewStatus?: string | null;
      availabilityNotes?: string | null;
      rateNotes?: string | null;
      internalNotes?: string | null;
    } | null;
  } | null;
  creatorProfile?: {
    reviewStatus?: string | null;
    availabilityNotes?: string | null;
    rateNotes?: string | null;
    internalNotes?: string | null;
  } | null;
}) {
  const profile = candidate.creatorProfile || candidate.person?.creatorProfile || null;
  return {
    id: candidate.id,
    searchRunId: candidate.searchRunId,
    projectBriefId:
      candidate.projectBriefId || candidate.searchRun?.projectBriefId || null,
    projectId: candidate.projectId || candidate.searchRun?.projectId || null,
    candidateRecommendationId: candidate.candidateRecommendationId,
    personId: candidate.personId,
    creatorProfileId: candidate.creatorProfileId,
    contactId: candidate.contactId,
    source: candidate.source,
    displayName: candidate.displayName,
    role: candidate.role,
    city: candidate.city,
    fandoms: candidate.fandoms,
    skills: candidate.skills,
    portfolioUrls: candidate.portfolioUrls,
    publicSourceUrls: candidate.publicSourceUrls,
    evidence: candidate.evidence,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    status: candidate.status,
    risks: candidate.risks,
    missingInfo: candidate.missingInfo,
    adminNotes: candidate.adminNotes,
    reviewStatus: profile?.reviewStatus || null,
    availabilityNotes: profile?.availabilityNotes || null,
    rateNotes: profile?.rateNotes || null,
    privateNotes: profile?.internalNotes || null,
    optedOut: candidate.person?.optedOut || false,
    consentStatus: candidate.person?.consentStatus || null,
  } satisfies TalentResearchQualityCandidate;
}

export async function createTalentResearchReviewForCandidate(input: {
  talentCandidateId: string;
  reviewer?: string | null;
  adminReviewed?: boolean;
}) {
  const db = getDb();
  const candidate = await db.talentCandidate.findUniqueOrThrow({
    where: { id: input.talentCandidateId },
    include: {
      searchRun: true,
      candidateRecommendation: true,
      person: { include: { creatorProfile: true } },
      creatorProfile: true,
    },
  });
  const candidateInput = candidateForEvaluation(candidate);
  const evaluation = evaluateTalentResearchQuality(candidateInput, {
    projectCity: null,
    projectFandoms: [],
    adminReviewed: input.adminReviewed,
  });
  const review = await db.talentResearchReview.create({
    data: {
      talentCandidateId: candidate.id,
      candidateRecommendationId: candidate.candidateRecommendationId,
      searchRunId: candidate.searchRunId,
      projectBriefId: candidate.searchRun.projectBriefId,
      projectId: candidate.searchRun.projectId,
      sourceMode: sourceModeForCandidate(candidate.source),
      reviewStatus: evaluation.recommendedReviewStatus as TalentResearchReviewStatus,
      totalScore: evaluation.totalScore,
      scoreBreakdown: jsonForPrisma(evaluation.scoreBreakdown),
      evidenceChecklist: jsonForPrisma(evaluation.evidenceChecklist),
      sourceReliability: evaluation.sourceReliability,
      identityConfidence: evaluation.identityConfidence,
      riskFlags: jsonForPrisma(evaluation.riskFlags),
      organizerFacingSummary: evaluation.organizerSafeSummary,
      privateReviewNotes: evaluation.adminOnlyNotes.join(" "),
      reviewedAt:
        evaluation.recommendedReviewStatus === "UNREVIEWED" ? null : new Date(),
      reviewedBy: input.reviewer || "system",
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: talentResearchQualityAuditEvents.reviewCreated,
    entityType: "TalentResearchReview",
    entityId: review.id,
    metadata: {
      talentCandidateId: candidate.id,
      candidateRecommendationId: candidate.candidateRecommendationId,
      searchRunId: candidate.searchRunId,
      projectBriefId: candidate.searchRun.projectBriefId,
      projectId: candidate.searchRun.projectId,
      sourceMode: review.sourceMode,
      totalScore: review.totalScore,
      reviewStatus: review.reviewStatus,
      riskFlagCount: evaluation.riskFlags.length,
      missingEvidenceCount: evaluation.missingEvidence.length,
      noSmsSent: true,
      noOutreachSent: true,
    },
  });

  return review;
}

function candidateStatusForReviewStatus(
  status: TalentResearchReviewStatus | string,
) {
  if (status === "APPROVED_FOR_SHORTLIST") return "APPROVED_FOR_SHORTLIST";
  if (status === "NEEDS_MORE_RESEARCH" || status === "NEEDS_ADMIN") {
    return "NEEDS_MORE_INFO";
  }
  if (status === "REJECTED") return "REJECTED";
  if (status === "DO_NOT_CONTACT") return "DO_NOT_CONTACT";
  return "SUGGESTED";
}

function recommendationStatusForReviewStatus(
  status: TalentResearchReviewStatus | string,
) {
  if (status === "APPROVED_FOR_SHORTLIST") return "APPROVED_FOR_SHORTLIST";
  if (status === "NEEDS_MORE_RESEARCH" || status === "NEEDS_ADMIN") {
    return "NEEDS_MORE_INFO";
  }
  if (status === "REJECTED") return "REJECTED";
  if (status === "DO_NOT_CONTACT") return "DO_NOT_CONTACT";
  return null;
}

function auditActionForReviewStatus(status: TalentResearchReviewStatus | string) {
  if (status === "APPROVED_FOR_SHORTLIST") {
    return talentResearchQualityAuditEvents.candidateApproved;
  }
  if (status === "REJECTED") return talentResearchQualityAuditEvents.candidateRejected;
  if (status === "NEEDS_MORE_RESEARCH" || status === "NEEDS_ADMIN") {
    return talentResearchQualityAuditEvents.candidateNeedsMoreResearch;
  }
  if (status === "DO_NOT_CONTACT") {
    return talentResearchQualityAuditEvents.candidateMarkedDoNotContact;
  }
  return talentResearchQualityAuditEvents.reviewUpdated;
}

export async function updateTalentResearchReviewStatus(input: {
  reviewId: string;
  reviewStatus: TalentResearchReviewStatus | string;
  reviewerNotes?: string | null;
  organizerFacingSummary?: string | null;
  reviewedBy?: string | null;
}) {
  const db = getDb();
  const current = await db.talentResearchReview.findUniqueOrThrow({
    where: { id: input.reviewId },
  });
  const organizerFacingSummary = input.organizerFacingSummary
    ? sanitizeOrganizerFacingText(input.organizerFacingSummary)
    : current.organizerFacingSummary;
  const updated = await db.talentResearchReview.update({
    where: { id: input.reviewId },
    data: {
      reviewStatus: input.reviewStatus as TalentResearchReviewStatus,
      reviewerNotes: input.reviewerNotes || undefined,
      organizerFacingSummary,
      reviewedAt: new Date(),
      reviewedBy: input.reviewedBy || "admin",
    },
  });

  if (updated.talentCandidateId) {
    await db.talentCandidate.update({
      where: { id: updated.talentCandidateId },
      data: {
        status: candidateStatusForReviewStatus(updated.reviewStatus),
        adminNotes: input.reviewerNotes || undefined,
      },
    });
  }

  const recommendationStatus = recommendationStatusForReviewStatus(updated.reviewStatus);
  if (updated.candidateRecommendationId && recommendationStatus) {
    await db.candidateRecommendation.update({
      where: { id: updated.candidateRecommendationId },
      data: {
        status: recommendationStatus,
        adminReviewNotes: input.reviewerNotes || undefined,
        organizerFacingSummaryOverride: organizerFacingSummary || undefined,
        reviewedAt: new Date(),
        reviewedBy: input.reviewedBy || "admin",
      },
    });
  }

  await logAudit({
    actorType: "ADMIN",
    action: auditActionForReviewStatus(updated.reviewStatus),
    entityType: "TalentResearchReview",
    entityId: updated.id,
    metadata: {
      talentCandidateId: updated.talentCandidateId,
      candidateRecommendationId: updated.candidateRecommendationId,
      searchRunId: updated.searchRunId,
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      sourceMode: updated.sourceMode,
      totalScore: updated.totalScore,
      reviewStatus: updated.reviewStatus,
      noSmsSent: true,
      noOutreachSent: true,
      noPrivateNotesInOrganizerSummary: true,
    },
  });

  if (organizerFacingSummary !== current.organizerFacingSummary) {
    await logAudit({
      actorType: "ADMIN",
      action: talentResearchQualityAuditEvents.organizerSummaryUpdated,
      entityType: "TalentResearchReview",
      entityId: updated.id,
      metadata: {
        talentCandidateId: updated.talentCandidateId,
        candidateRecommendationId: updated.candidateRecommendationId,
        reviewStatus: updated.reviewStatus,
        noSmsSent: true,
      },
    });
  }

  return updated;
}

export function canQualityReviewPromoteToShortlist(input: {
  reviewStatus?: string | null;
  sourceMode?: string | null;
  riskFlags?: unknown;
}) {
  const riskFlags = safeStringArray(input.riskFlags);
  return (
    input.reviewStatus === "APPROVED_FOR_SHORTLIST" &&
    !riskFlags.includes("opted_out") &&
    !riskFlags.includes("do_not_contact") &&
    !riskFlags.includes("raw_contact_info_leak_risk") &&
    !riskFlags.includes("unsupported_claims")
  );
}

export function qualityReviewBlocksOutreach(input: {
  reviewStatus?: string | null;
  riskFlags?: unknown;
}) {
  return !canQualityReviewPromoteToShortlist(input);
}

export async function getCandidateRecommendationQualityGate(
  candidateRecommendationId: string,
) {
  const review = await getDb().talentResearchReview.findFirst({
    where: { candidateRecommendationId },
    orderBy: { updatedAt: "desc" },
  });
  const talentCandidates = await getDb().talentCandidate.findMany({
    where: { candidateRecommendationId },
    select: { source: true, status: true },
  });
  const hasPublicWebCandidate = talentCandidates.some(
    (candidate) => candidate.source === "PUBLIC_WEB_RESEARCH",
  );
  const blockingStatuses = [
    "REJECTED",
    "DO_NOT_CONTACT",
    "NEEDS_MORE_RESEARCH",
    "NEEDS_ADMIN",
  ];
  const blockers = unique([
    hasPublicWebCandidate && !review
      ? "public_web_candidate_requires_quality_review"
      : null,
    review && blockingStatuses.includes(review.reviewStatus)
      ? `quality_review_${review.reviewStatus.toLowerCase()}`
      : null,
    review && !canQualityReviewPromoteToShortlist(review)
      ? "quality_review_not_approved_for_shortlist"
      : null,
  ]);
  return {
    review,
    hasPublicWebCandidate,
    allowed:
      blockers.length === 0 &&
      (!hasPublicWebCandidate || review?.reviewStatus === "APPROVED_FOR_SHORTLIST"),
    blockers,
  };
}

export async function getTalentResearchQualityHealthSnapshot() {
  if (!process.env.DATABASE_URL) {
    return {
      talentResearchQualityAvailable: true,
      pendingTalentQualityReviewCount: null,
      approvedTalentQualityReviewCount: null,
      needsMoreResearchCount: null,
      rejectedTalentCandidateCount: null,
      doNotContactCandidateCount: null,
      publicWebCandidatesPendingReviewCount: null,
      talentQualityRiskLevel: "green" as const,
    };
  }

  try {
    const [
      pendingTalentQualityReviewCount,
      approvedTalentQualityReviewCount,
      needsMoreResearchCount,
      rejectedTalentCandidateCount,
      doNotContactCandidateCount,
      publicWebCandidatesPendingReviewCount,
    ] = await Promise.all([
      getDb().talentResearchReview.count({
        where: { reviewStatus: "UNREVIEWED" },
      }),
      getDb().talentResearchReview.count({
        where: { reviewStatus: "APPROVED_FOR_SHORTLIST" },
      }),
      getDb().talentResearchReview.count({
        where: { reviewStatus: "NEEDS_MORE_RESEARCH" },
      }),
      getDb().talentResearchReview.count({ where: { reviewStatus: "REJECTED" } }),
      getDb().talentResearchReview.count({
        where: { reviewStatus: "DO_NOT_CONTACT" },
      }),
      getDb().talentCandidate.count({
        where: {
          source: "PUBLIC_WEB_RESEARCH",
          status: { in: ["SUGGESTED", "NEEDS_MORE_INFO"] },
        },
      }),
    ]);
    const riskLevel =
      publicWebCandidatesPendingReviewCount > 0 || needsMoreResearchCount > 0
        ? "yellow"
        : "green";
    return {
      talentResearchQualityAvailable: true,
      pendingTalentQualityReviewCount,
      approvedTalentQualityReviewCount,
      needsMoreResearchCount,
      rejectedTalentCandidateCount,
      doNotContactCandidateCount,
      publicWebCandidatesPendingReviewCount,
      talentQualityRiskLevel: riskLevel as "green" | "yellow",
    };
  } catch {
    return {
      talentResearchQualityAvailable: true,
      pendingTalentQualityReviewCount: null,
      approvedTalentQualityReviewCount: null,
      needsMoreResearchCount: null,
      rejectedTalentCandidateCount: null,
      doNotContactCandidateCount: null,
      publicWebCandidatesPendingReviewCount: null,
      talentQualityRiskLevel: "yellow" as const,
    };
  }
}
