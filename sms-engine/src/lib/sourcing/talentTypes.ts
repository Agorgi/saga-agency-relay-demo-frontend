import { z } from "zod";

export const sourcingAuditEvents = {
  internalSearchRunCreated: "sourcing.internal_search_run_created",
  internalSearchCompleted: "sourcing.internal_search_completed",
  strategyGenerated: "sourcing.strategy_generated",
  publicResearchPlanGenerated: "sourcing.public_research_plan_generated",
  publicWebResearchSkipped: "sourcing.public_web_research_skipped",
  publicWebResearchStarted: "sourcing.public_web_research_started",
  publicWebResearchCompleted: "sourcing.public_web_research_completed",
  candidateCardCreated: "sourcing.candidate_card_created",
  candidateScored: "sourcing.candidate_scored",
  candidateApproved: "sourcing.candidate_approved",
  candidateRejected: "sourcing.candidate_rejected",
  candidateMarkedNeedsMoreInfo: "sourcing.candidate_marked_needs_more_info",
  candidateMarkedDoNotContact: "sourcing.candidate_marked_do_not_contact",
} as const;

export const publicWebResearchAuditEvents = {
  planGenerated: "public_web_research.plan_generated",
  runStarted: "public_web_research.run_started",
  runCompleted: "public_web_research.run_completed",
  runFailed: "public_web_research.run_failed",
  resultCreated: "public_web_research.result_created",
  resultRejected: "public_web_research.result_rejected",
  resultDiscarded: "public_web_research.result_discarded",
  resultSentToQualityReview: "public_web_research.result_sent_to_quality_review",
  disabledModeBlocked: "public_web_research.disabled_mode_blocked",
  safetyBlocked: "public_web_research.safety_blocked",
  liveDryRunRequested: "public_web_research.live_dry_run_requested",
  liveDryRunBlocked: "public_web_research.live_dry_run_blocked",
  liveDryRunStarted: "public_web_research.live_dry_run_started",
  liveDryRunCompleted: "public_web_research.live_dry_run_completed",
  liveDryRunFailed: "public_web_research.live_dry_run_failed",
  liveDryRunResultCreated: "public_web_research.live_dry_run_result_created",
  liveDryRunResultDiscarded:
    "public_web_research.live_dry_run_result_discarded",
  liveDryRunSentToQualityReview:
    "public_web_research.live_dry_run_sent_to_quality_review",
  jobCreated: "public_web_research.job_created",
  jobStarted: "public_web_research.job_started",
  jobSucceeded: "public_web_research.job_succeeded",
  jobFailed: "public_web_research.job_failed",
  jobCancelled: "public_web_research.job_cancelled",
  runQueued: "public_web_research.run_queued",
  runFailedTimeout: "public_web_research.run_failed_timeout",
} as const;

export const publicWebReviewAuditEvents = {
  resultReviewed: "public_web_review.result_reviewed",
  resultSentToQualityReview: "public_web_review.result_sent_to_quality_review",
  resultDiscarded: "public_web_review.result_discarded",
  resultArchived: "public_web_review.result_archived",
  resultMarkedDuplicate: "public_web_review.result_marked_duplicate",
  resultMarkedDoNotContact: "public_web_review.result_marked_do_not_contact",
  resultLinkedToInternalProfile:
    "public_web_review.result_linked_to_internal_profile",
  cleanupRunStarted: "public_web_review.cleanup_run_started",
  cleanupRunCompleted: "public_web_review.cleanup_run_completed",
  promotionBlocked: "public_web_review.promotion_blocked",
  promotionAllowed: "public_web_review.promotion_allowed",
} as const;

export const contactabilityAuditEvents = {
  evidenceCreated: "contactability.evidence_created",
  evidenceReviewed: "contactability.evidence_reviewed",
  methodVerified: "contactability.method_verified",
  methodRejected: "contactability.method_rejected",
  markedNeedsMoreResearch: "contactability.marked_needs_more_research",
  markedDoNotContact: "contactability.marked_do_not_contact",
  promotionBlocked: "contactability.promotion_blocked",
  promotionAllowed: "contactability.promotion_allowed",
} as const;

export const talentSourceModeSchema = z.enum([
  "INTERNAL_ONLY",
  "INTERNAL_PLUS_RESEARCH_PLAN",
  "WEB_RESEARCH_SHADOW",
  "WEB_RESEARCH_ACTIVE_ADMIN",
]);

export const talentCandidateStatusSchema = z.enum([
  "SUGGESTED",
  "APPROVED_FOR_SHORTLIST",
  "REJECTED",
  "NEEDS_MORE_INFO",
  "DO_NOT_CONTACT",
]);

export const candidateCardSchema = z.object({
  displayName: z.string().trim().min(1),
  likelyRole: z.string().trim().min(1),
  city: z.string().nullable(),
  publicProfileUrls: z.array(z.string().url()).default([]),
  portfolioEvidence: z.array(z.string()).default([]),
  fandomFitEvidence: z.array(z.string()).default([]),
  roleFitEvidence: z.array(z.string()).default([]),
  locationEvidence: z.array(z.string()).default([]),
  whyTheyMayFit: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  sourceUrls: z.array(z.string().url()).min(1),
  sourceSummary: z.string().trim().min(1),
  requiresHumanReview: z.literal(true),
});

export const publicResearchCandidateCardSchema = z.object({
  displayName: z.string().trim().min(1),
  likelyRole: z.string().trim().min(1),
  city: z.string().trim().nullable(),
  region: z.string().trim().nullable().optional(),
  publicProfileUrls: z.array(z.string().url()).default([]),
  sourceUrls: z.array(z.string().url()).min(1),
  sourceTitles: z.array(z.string()).default([]),
  roleFitEvidence: z.array(z.string()).default([]),
  fandomFitEvidence: z.array(z.string()).default([]),
  locationEvidence: z.array(z.string()).default([]),
  portfolioEvidence: z.array(z.string()).default([]),
  recentActivityEvidence: z.array(z.string()).default([]),
  whyTheyMayFit: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  requiresHumanReview: z.literal(true),
  availabilityKnown: z.literal(false).or(z.boolean()).default(false),
  willingnessKnown: z.literal(false).or(z.boolean()).default(false),
  ratesKnown: z.literal(false).or(z.boolean()).default(false),
  sensitiveDataDetected: z.boolean().default(false),
  privateSourceDetected: z.boolean().default(false),
});

export type TalentSourceMode = z.infer<typeof talentSourceModeSchema>;
export type TalentCandidateStatus = z.infer<typeof talentCandidateStatusSchema>;
export type CandidateCard = z.infer<typeof candidateCardSchema>;
export type PublicResearchCandidateCard = z.infer<
  typeof publicResearchCandidateCardSchema
>;

export type TalentCandidateInput = {
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  candidateRecommendationId?: string | null;
  source?: "INTERNAL_DB" | "PUBLIC_WEB_RESEARCH" | "ADMIN_ADDED";
  displayName: string;
  role: string;
  city?: string | null;
  fandoms?: string[];
  skills?: string[];
  portfolioUrls?: string[];
  publicSourceUrls?: string[];
  evidence?: Record<string, unknown>;
  relationshipTier?: string | null;
  relationshipStrength?: number | null;
  reviewStatus?: string | null;
  availabilityNotes?: string | null;
  responsivenessScore?: number | null;
  optedOut?: boolean;
  doNotContact?: boolean;
  consentStatus?: string | null;
  privateNotes?: string | null;
};

export type TalentScoreBreakdown = {
  roleFit: number;
  fandomFit: number;
  locationFit: number;
  evidenceQuality: number;
  proximityInternalRelationship: number;
  availabilityReviewStatus: number;
};

export type ScoredTalentCandidate = TalentCandidateInput & {
  score: number;
  scoreBreakdown: TalentScoreBreakdown;
  matchingReasons: string[];
  risks: string[];
  missingInfo: string[];
  status: TalentCandidateStatus;
  confidence: number;
};

export function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
