import { z } from "zod";

export const producerFlowKindSchema = z.enum([
  "organizer_project",
  "gig_seeker",
  "interest_check",
  "unknown",
]);

export const producerScoreBreakdownSchema = z.object({
  roleFit: z.number(),
  fandomFit: z.number(),
  locationFit: z.number(),
  proximity: z.number(),
  reliability: z.number(),
});

export const projectUnderstandingSchema = z.object({
  title: z.string().nullable(),
  projectType: z.string().nullable(),
  city: z.string().nullable(),
  fandoms: z.array(z.string()),
  communities: z.array(z.string()),
  format: z.string().nullable(),
  scope: z.string().nullable(),
  vibe: z.string().nullable(),
  targetDate: z.string().nullable(),
  timing: z.string().nullable(),
  budgetRange: z.string().nullable(),
  expectedAudienceSize: z.string().nullable(),
  audience: z.string().nullable(),
  helpNeeded: z.string().nullable(),
  riskFlags: z.array(z.string()),
  missingInfo: z.array(z.string()),
  sourceKind: producerFlowKindSchema,
  confidence: z.number().min(0).max(1),
  explanationForAudit: z.array(z.string()),
});

export const producerRoleSchema = z.object({
  roleType: z.string(),
  title: z.string(),
  priority: z.enum(["required", "optional"]),
  description: z.string(),
  requiredSkills: z.array(z.string()),
  preferredFandoms: z.array(z.string()),
  localRequired: z.boolean(),
  whyThisRoleMatters: z.string(),
  roleFitCriteria: z.array(z.string()),
  missingInfoForRole: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const roleMapSchema = z.object({
  requiredRoles: z.array(producerRoleSchema),
  optionalRoles: z.array(producerRoleSchema),
  rolePriority: z.array(z.string()),
  roleDescriptions: z.record(z.string(), z.string()),
  roleFitCriteria: z.record(z.string(), z.array(z.string())),
  localRequired: z.record(z.string(), z.boolean()),
  whyThisRoleMatters: z.record(z.string(), z.string()),
  missingInfoForRole: z.record(z.string(), z.array(z.string())),
  confidence: z.number().min(0).max(1),
  humanReviewRequired: z.boolean(),
  explanationForAudit: z.array(z.string()),
});

export const sourcingPlanSchema = z.object({
  searchOrder: z.array(z.string()),
  perRoleSearchCriteria: z.record(
    z.string(),
    z.object({
      roleType: z.string(),
      skills: z.array(z.string()),
      fandoms: z.array(z.string()),
      location: z.string().nullable(),
      localRequired: z.boolean(),
      reviewStatusPreference: z.string(),
    }),
  ),
  proximityPriority: z.array(z.string()),
  fandomFitCriteria: z.array(z.string()),
  locationFitCriteria: z.array(z.string()),
  riskNotes: z.array(z.string()),
  humanReviewRequired: z.boolean(),
  openWebResearchLater: z.boolean(),
  explanationForAudit: z.array(z.string()),
});

export const internalCandidateRecommendationSchema = z.object({
  personId: z.string().nullable(),
  contactId: z.string().nullable(),
  creatorProfileId: z.string().nullable(),
  displayName: z.string(),
  recommendedRole: z.string(),
  score: z.number(),
  scoreBreakdown: producerScoreBreakdownSchema,
  proximityTier: z.enum([
    "FRIEND",
    "MUTUAL",
    "COMMUNITY",
    "LOCAL",
    "EXTENDED",
    "PUBLIC",
    "UNKNOWN",
  ]),
  matchingReasons: z.array(z.string()),
  risks: z.array(z.string()),
  missingInfo: z.array(z.string()),
  adminReviewStatus: z.string(),
  confidence: z.number().min(0).max(1),
});

export const shortlistDraftSchema = z.object({
  organizerFacingSummary: z.string(),
  recommendedTeamByRole: z.array(
    z.object({
      role: z.string(),
      candidates: z.array(z.string()),
      coverageStatus: z.enum(["covered", "missing", "needs_more_research"]),
    }),
  ),
  coverage: z.object({
    rolesCovered: z.array(z.string()),
    rolesMissing: z.array(z.string()),
    needsMoreResearch: z.array(z.string()),
  }),
  candidateSummaries: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      city: z.string().nullable(),
      whyTheyFit: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      gaps: z.array(z.string()),
    }),
  ),
  recommendedNextMessageToOrganizer: z.string(),
  adminReviewRequired: z.boolean(),
  forbiddenClaimsCheck: z.object({
    passed: z.boolean(),
    flaggedTerms: z.array(z.string()),
  }),
});

export type ProducerFlowKind = z.infer<typeof producerFlowKindSchema>;
export type ProducerScoreBreakdown = z.infer<
  typeof producerScoreBreakdownSchema
>;
export type ProjectUnderstanding = z.infer<typeof projectUnderstandingSchema>;
export type ProducerRole = z.infer<typeof producerRoleSchema>;
export type RoleMap = z.infer<typeof roleMapSchema>;
export type SourcingPlan = z.infer<typeof sourcingPlanSchema>;
export type InternalCandidateRecommendation = z.infer<
  typeof internalCandidateRecommendationSchema
>;
export type ShortlistDraft = z.infer<typeof shortlistDraftSchema>;

export type ProducerRecentMessage = {
  body: string;
  direction?: "INBOUND" | "OUTBOUND" | string;
};

export type ProjectUnderstandingInput = {
  projectBrief?: {
    title?: string | null;
    projectType?: string | null;
    city?: string | null;
    description?: string | null;
    targetDate?: string | null;
    budgetRange?: string | null;
    expectedAudienceSize?: string | null;
    scope?: string | null;
    vibe?: string | null;
    helpNeeded?: string | null;
  } | null;
  project?: {
    title?: string | null;
    description?: string | null;
    city?: string | null;
    targetDate?: string | null;
    budgetRange?: string | null;
    audience?: string | null;
    fandoms?: string[];
  } | null;
  recentMessages?: ProducerRecentMessage[];
  organizerContext?: string | null;
  replyPlan?: unknown;
  text?: string | null;
};

export type CandidatePoolItem = {
  personId?: string | null;
  contactId?: string | null;
  creatorProfileId?: string | null;
  displayName?: string | null;
  city?: string | null;
  roles?: string[];
  skills?: string[];
  fandoms?: string[];
  communities?: string[];
  portfolioUrls?: string[];
  socialUrls?: string[];
  reviewStatus?: string | null;
  optedOut?: boolean;
  consentStatus?: string | null;
  proximityTier?: InternalCandidateRecommendation["proximityTier"];
  relationshipStrength?: number;
  privateNotes?: string | null;
};
