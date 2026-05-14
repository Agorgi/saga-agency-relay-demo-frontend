import { z } from "zod";

export const llmProviderSchema = z.enum(["fallback", "openai"]);
export const llmModeSchema = z.enum([
  "fallback",
  "shadow",
  "active_mock",
  "active_live",
]);

export type LlmProviderName = z.infer<typeof llmProviderSchema>;
export type LlmMode = z.infer<typeof llmModeSchema>;

const optionalText = z.string().trim().min(1).nullable().optional();
const confidence = z.number().min(0).max(1).default(0.6);
const stringList = z.array(z.string().trim().min(1)).default([]);

export const briefFieldExtractionSchema = z.object({
  firstTimeHost: z.boolean().nullable().optional(),
  city: optionalText,
  projectConcept: optionalText,
  projectType: optionalText,
  title: optionalText,
  description: optionalText,
  scope: optionalText,
  vibe: optionalText,
  timing: optionalText,
  targetDate: optionalText,
  budget: optionalText,
  budgetRange: optionalText,
  audience: optionalText,
  expectedAudienceSize: optionalText,
  rolesHelpNeeded: optionalText,
  helpNeeded: optionalText,
  confidence,
  missingFields: stringList,
  safetyFlags: stringList,
  needsAdmin: z.boolean().default(false),
});

export const organizerReplyLanguageSchema = z.object({
  replyText: z.string().trim().min(1),
  replyType: z.string().trim().min(1),
  stage: z.string().trim().min(1),
  forbiddenClaimsDetected: z.boolean().default(false),
  shouldEscalate: z.boolean().default(false),
  confidence,
});

export const gigSeekerProfileExtractionSchema = z.object({
  city: optionalText,
  desiredRoles: stringList,
  skills: stringList,
  fandoms: stringList,
  socialLinks: stringList,
  portfolioLinks: stringList,
  availability: optionalText,
  compensationPreference: z
    .enum(["paid_only", "paid_or_collab", "volunteer_collab", "unknown"])
    .default("unknown"),
  confidence,
  missingFields: stringList,
  safetyFlags: stringList,
});

export const interestCheckExtractionSchema = z.object({
  idea: optionalText,
  city: optionalText,
  fandoms: stringList,
  audience: optionalText,
  format: optionalText,
  timing: optionalText,
  interestSignal: optionalText,
  ambiguityWithOrganizer: z.boolean().default(false),
  confidence,
  missingFields: stringList,
  safetyFlags: stringList,
});

export const producerRoleMapRefinementSchema = z.object({
  requiredRoles: stringList,
  optionalRoles: stringList,
  whyEachRoleMatters: z.record(z.string(), z.string()).default({}),
  missingInfo: stringList,
  confidence,
});

export const candidateFitExplanationSchema = z.object({
  roleFitSummary: z.string().trim().min(1),
  fandomFitSummary: z.string().trim().min(1),
  locationFitSummary: z.string().trim().min(1),
  risks: stringList,
  organizerFacingSummary: z.string().trim().min(1),
  confidence,
  privateNotesExcluded: z.boolean().default(true),
});

export const shortlistOutreachDraftLanguageSchema = z.object({
  body: z.string().trim().min(1),
  forbiddenClaimsDetected: z.boolean().default(false),
  privateInfoDetected: z.boolean().default(false),
  adminReviewRequired: z.boolean().default(true),
  confidence,
});

export type BriefFieldExtraction = z.infer<typeof briefFieldExtractionSchema>;
export type OrganizerReplyLanguage = z.infer<typeof organizerReplyLanguageSchema>;
export type GigSeekerProfileExtraction = z.infer<
  typeof gigSeekerProfileExtractionSchema
>;
export type InterestCheckExtraction = z.infer<
  typeof interestCheckExtractionSchema
>;
export type ProducerRoleMapRefinement = z.infer<
  typeof producerRoleMapRefinementSchema
>;
export type CandidateFitExplanation = z.infer<
  typeof candidateFitExplanationSchema
>;
export type ShortlistOutreachDraftLanguage = z.infer<
  typeof shortlistOutreachDraftLanguageSchema
>;

export const forbiddenLlmClaimPattern =
  /\b(guarantee|guaranteed|confirmed|booked|available|selected|paid work|payment guaranteed|rate confirmed|ticket sales|revenue|venue access|celebrity|influencer participation|added to (?:the )?team|group chat confirmed)\b/i;

export function containsForbiddenLlmClaim(value: unknown): boolean {
  if (typeof value === "string") return forbiddenLlmClaimPattern.test(value);
  if (!value || typeof value !== "object") return false;
  return JSON.stringify(value).split("\\n").some((item) =>
    forbiddenLlmClaimPattern.test(item),
  );
}

export function compactLlmText(value: string, maxLength = 500) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength - 3)}...`
    : compact;
}
