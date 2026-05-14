import { z } from "zod";

const dateLikeSchema = z.union([z.string(), z.date()]);

export const conversationIntentValues = [
  "ORGANIZER_PROJECT_IDEA",
  "GIG_SEEKER_ONBOARDING",
  "CONTACT_REPLY",
  "INTEREST_CHECK",
  "CAPABILITY_FAQ",
  "STOP_OR_OPT_OUT",
  "START_OR_OPT_IN",
  "HELP",
  "SAFETY_ESCALATION",
  "UNKNOWN",
] as const;

export const intentSuggestedFlowValues = [
  "organizer_intake",
  "creator_onboarding",
  "contact_reply",
  "interest_check",
  "capability_faq",
  "opt_out",
  "opt_in",
  "help",
  "admin_review",
  "unknown",
] as const;

export const conversationFlowValues = [
  "ORGANIZER_INTAKE",
  "GIG_SEEKER_ONBOARDING",
  "CONTACT_REPLY",
  "INTEREST_CHECK",
  "CAPABILITY_FAQ",
  "ADMIN_REVIEW",
  "UNKNOWN",
] as const;

export const organizerIntakeStageValues = [
  "NEW",
  "ASK_FIRST_TIME_HOST",
  "ASK_LOCATION",
  "ASK_PROJECT_CONCEPT",
  "ASK_SCOPE_VIBE",
  "ASK_TIMING",
  "ASK_BUDGET",
  "ASK_AUDIENCE",
  "BRIEF_READY",
  "NEEDS_ADMIN",
] as const;

export const gigSeekerOnboardingStageValues = [
  "NEW",
  "ASK_LOCATION",
  "ASK_GIG_TYPES",
  "ASK_SKILLS",
  "ASK_FANDOMS",
  "ASK_LINKS",
  "ASK_AVAILABILITY",
  "PROFILE_READY_FOR_REVIEW",
  "NEEDS_ADMIN",
] as const;

export const interestCheckStageValues = [
  "NEW",
  "ASK_LOCATION",
  "ASK_IDEA_SCOPE",
  "ASK_FANDOM_OR_AUDIENCE",
  "ASK_TIMING",
  "ASK_INTEREST_SIGNAL",
  "INTEREST_CHECK_READY",
  "NEEDS_ADMIN",
] as const;

export const contactReplyStageValues = [
  "NO_ACTIVE_OUTREACH",
  "OUTREACH_SENT",
  "CLASSIFY_REPLY",
  "INTERESTED",
  "DECLINED",
  "MAYBE",
  "QUESTION_OR_CLARIFICATION",
  "CONSENT_REQUESTED",
  "CONSENT_CONFIRMED",
  "CONSENT_DECLINED",
  "NEEDS_ADMIN",
  "OPTED_OUT",
  "HELP_REQUESTED",
] as const;

export const contactReplyKindValues = [
  "YES_INTERESTED",
  "NO_DECLINED",
  "MAYBE_INTERESTED",
  "QUESTION",
  "RATE_OR_PAYMENT_QUESTION",
  "AVAILABILITY_QUESTION",
  "CONSENT_YES",
  "CONSENT_NO",
  "HELP",
  "STOP",
  "START",
  "UNKNOWN",
] as const;

export const conversationIntentSchema = z.enum(conversationIntentValues);
export const intentSuggestedFlowSchema = z.enum(intentSuggestedFlowValues);
export const conversationFlowSchema = z.enum(conversationFlowValues);
export const organizerIntakeStageSchema = z.enum(organizerIntakeStageValues);
export const gigSeekerOnboardingStageSchema = z.enum(
  gigSeekerOnboardingStageValues,
);
export const interestCheckStageSchema = z.enum(interestCheckStageValues);
export const contactReplyStageSchema = z.enum(contactReplyStageValues);
export const contactReplyKindSchema = z.enum(contactReplyKindValues);
export const conversationStageSchema = z.union([
  organizerIntakeStageSchema,
  gigSeekerOnboardingStageSchema,
  interestCheckStageSchema,
  contactReplyStageSchema,
]);

export const allowlistResultSchema = z.enum([
  "allowed",
  "blocked",
  "not_applicable",
  "unknown",
]);

export const conversationIntentResultSchema = z.object({
  intent: conversationIntentSchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  matchedSignals: z.array(z.string()),
  shouldEscalate: z.boolean(),
  suggestedFlow: intentSuggestedFlowSchema,
});

export const organizerKnownFieldsSchema = z.object({
  firstTimeHost: z.boolean().nullable().optional(),
  city: z.string().nullable().optional(),
  projectConcept: z.string().nullable().optional(),
  projectType: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  vibe: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  budgetRange: z.string().nullable().optional(),
  expectedAudienceSize: z.string().nullable().optional(),
  helpNeeded: z.string().nullable().optional(),
});

export const compensationPreferenceSchema = z.enum([
  "paid_only",
  "paid_or_collab",
  "volunteer_collab",
  "unknown",
]);

export const gigSeekerKnownFieldsSchema = z.object({
  city: z.string().nullable().optional(),
  desiredRoles: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  fandoms: z.array(z.string()).optional(),
  communities: z.array(z.string()).optional(),
  portfolioUrls: z.array(z.string()).optional(),
  socialUrls: z.array(z.string()).optional(),
  availabilityNotes: z.string().nullable().optional(),
  rateNotes: z.string().nullable().optional(),
  compensationPreference: compensationPreferenceSchema.optional(),
  preferredOpportunityTypes: z.array(z.string()).optional(),
  selfDescription: z.string().nullable().optional(),
  safetyFlags: z.array(z.string()).optional(),
});

export const interestCheckKnownFieldsSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  fandoms: z.array(z.string()).optional(),
  communities: z.array(z.string()).optional(),
  targetAudience: z.string().nullable().optional(),
  proposedTiming: z.string().nullable().optional(),
  likelyFormat: z.string().nullable().optional(),
  interestSignal: z.string().nullable().optional(),
  expectedAudienceSize: z.string().nullable().optional(),
  willingnessToHelpOrganize: z.string().nullable().optional(),
  safetyFlags: z.array(z.string()).optional(),
  ambiguityNotes: z.array(z.string()).optional(),
});

export const contactReplyKnownFieldsSchema = z.object({
  contactId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  outreachId: z.string().nullable().optional(),
  projectBriefId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  candidateRecommendationId: z.string().nullable().optional(),
  currentOutreachStatus: z.string().nullable().optional(),
  consentToGroupChat: z.boolean().optional(),
  activeGroupChatId: z.string().nullable().optional(),
  latestMessageBody: z.string().nullable().optional(),
  replyKind: contactReplyKindSchema.optional(),
  safetyFlags: z.array(z.string()).optional(),
  optedOut: z.boolean().optional(),
  hasActiveOutreach: z.boolean().optional(),
});

export const priorMessageSchema = z.object({
  id: z.string(),
  direction: z.string(),
  channel: z.string(),
  body: z.string().optional(),
  createdAt: dateLikeSchema,
});

export const conversationContextSchema = z.object({
  normalizedPhone: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  projectBriefId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  activeOutreachId: z.string().nullable().optional(),
  intent: conversationIntentSchema,
  priorMessages: z.array(priorMessageSchema),
  knownFields: organizerKnownFieldsSchema,
  gigSeekerKnownFields: gigSeekerKnownFieldsSchema.optional(),
  interestCheckKnownFields: interestCheckKnownFieldsSchema.optional(),
  contactReplyKnownFields: contactReplyKnownFieldsSchema.optional(),
  missingRequiredFields: z.array(z.string()),
  missingOptionalFields: z.array(z.string()),
  hasCompletedFirstTimeHostQuestion: z.boolean(),
  optedOut: z.boolean(),
  safetyFlags: z.array(z.string()),
  providerMode: z.string(),
  sendsDisabled: z.boolean(),
  allowlistResult: allowlistResultSchema,
  currentStage: conversationStageSchema,
  user: z
    .object({
      id: z.string(),
      smsOptedOutAt: dateLikeSchema.nullable().optional(),
      hasCompletedFirstTimeHostQuestion: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  person: z
    .object({
      id: z.string(),
      optedOut: z.boolean().optional(),
      consentStatus: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  contact: z
    .object({
      id: z.string(),
      smsOptedOutAt: dateLikeSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  creatorProfile: z
    .object({
      id: z.string(),
      reviewStatus: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      roles: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
      fandoms: z.array(z.string()).optional(),
      communities: z.array(z.string()).optional(),
      portfolioUrls: z.array(z.string()).optional(),
      socialUrls: z.array(z.string()).optional(),
      availabilityNotes: z.string().nullable().optional(),
      rateNotes: z.string().nullable().optional(),
      preferredOpportunityTypes: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  activeProjectBrief: z
    .object({
      id: z.string(),
      status: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
      firstTimeHost: z.boolean().nullable().optional(),
      city: z.string().nullable().optional(),
      projectType: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      targetDate: z.string().nullable().optional(),
      budgetRange: z.string().nullable().optional(),
      expectedAudienceSize: z.string().nullable().optional(),
      scope: z.string().nullable().optional(),
      vibe: z.string().nullable().optional(),
      helpNeeded: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  activeOutreach: z
    .object({
      id: z.string(),
      status: z.string().nullable().optional(),
      consentToGroupChat: z.boolean().optional(),
      opportunityId: z.string().nullable().optional(),
      candidateRecommendationId: z.string().nullable().optional(),
      projectBriefId: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const replyPlanSchema = z.object({
  flow: conversationFlowSchema,
  stage: conversationStageSchema,
  nextStage: conversationStageSchema,
  enoughInfoForBrief: z.boolean(),
  enoughInfoForProfileReview: z.boolean().optional(),
  enoughInfoForInterestCheck: z.boolean().optional(),
  shouldEscalate: z.boolean(),
  escalationReason: z.string().optional(),
  nextQuestion: z.string().optional(),
  ambiguityNotes: z.array(z.string()).optional(),
  replyTone: z.string(),
  allowedActions: z.array(z.string()),
  blockedActions: z.array(z.string()),
  explanationForAudit: z.string(),
  confidence: z.number().min(0).max(1),
});

export const organizerReplyTypeValues = [
  "ask_next_question",
  "brief_ready",
  "needs_admin",
  "fallback",
] as const;

export const gigSeekerReplyTypeValues = [
  "ask_next_question",
  "profile_ready_for_review",
  "needs_admin",
  "fallback",
] as const;

export const interestCheckReplyTypeValues = [
  "ask_next_question",
  "interest_check_ready",
  "needs_admin",
  "fallback",
] as const;

export const contactReplyTypeValues = [
  "ask_consent",
  "acknowledge_decline",
  "maybe_followup",
  "needs_admin",
  "help",
  "fallback",
] as const;

export const generatedReplySourceValues = [
  "conversation_engine",
  "openai_active_mock",
  "deterministic_fallback",
] as const;

export const generatedReplySourceSchema = z.enum(generatedReplySourceValues);

const llmDebugMetadataSchema = z.object({
  replySourceDetail: z.string().optional(),
  llmOperation: z.string().nullable().optional(),
  llmOperationUnavailable: z.boolean().optional(),
  llmMode: z.string().nullable().optional(),
  llmExecutionSurface: z.string().nullable().optional(),
  llmValidationPassed: z.boolean().nullable().optional(),
  llmFallbackUsed: z.boolean().optional(),
  llmFallbackReason: z.string().nullable().optional(),
  forbiddenClaimsDetected: z.boolean().optional(),
});

export const organizerGeneratedReplySchema = z.object({
  replyText: z.string().trim().min(1),
  replyType: z.enum(organizerReplyTypeValues),
  source: generatedReplySourceSchema,
  metadata: z
    .object({
      stage: organizerIntakeStageSchema,
      nextStage: organizerIntakeStageSchema,
      enoughInfoForBrief: z.boolean(),
      shouldEscalate: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
    .merge(llmDebugMetadataSchema),
});

export const gigSeekerGeneratedReplySchema = z.object({
  replyText: z.string().trim().min(1),
  replyType: z.enum(gigSeekerReplyTypeValues),
  source: generatedReplySourceSchema,
  metadata: z
    .object({
      stage: gigSeekerOnboardingStageSchema,
      nextStage: gigSeekerOnboardingStageSchema,
      enoughInfoForProfileReview: z.boolean(),
      shouldEscalate: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
    .merge(llmDebugMetadataSchema),
});

export const interestCheckGeneratedReplySchema = z.object({
  replyText: z.string().trim().min(1),
  replyType: z.enum(interestCheckReplyTypeValues),
  source: generatedReplySourceSchema,
  metadata: z
    .object({
      stage: interestCheckStageSchema,
      nextStage: interestCheckStageSchema,
      enoughInfoForInterestCheck: z.boolean(),
      shouldEscalate: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
    .merge(llmDebugMetadataSchema),
});

export const contactReplyGeneratedReplySchema = z.object({
  replyText: z.string().trim().min(1),
  replyType: z.enum(contactReplyTypeValues),
  source: generatedReplySourceSchema,
  metadata: z
    .object({
      stage: contactReplyStageSchema,
      nextStage: contactReplyStageSchema,
      replyKind: contactReplyKindSchema,
      hasActiveOutreach: z.boolean(),
      consentToGroupChat: z.boolean(),
      shouldEscalate: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
    .merge(llmDebugMetadataSchema),
});

export type ConversationIntent = z.infer<typeof conversationIntentSchema>;
export type IntentSuggestedFlow = z.infer<typeof intentSuggestedFlowSchema>;
export type ConversationFlow = z.infer<typeof conversationFlowSchema>;
export type OrganizerIntakeStage = z.infer<typeof organizerIntakeStageSchema>;
export type GigSeekerOnboardingStage = z.infer<
  typeof gigSeekerOnboardingStageSchema
>;
export type InterestCheckStage = z.infer<typeof interestCheckStageSchema>;
export type ContactReplyStage = z.infer<typeof contactReplyStageSchema>;
export type ContactReplyKind = z.infer<typeof contactReplyKindSchema>;
export type ConversationStage = z.infer<typeof conversationStageSchema>;
export type ConversationIntentResult = z.infer<
  typeof conversationIntentResultSchema
>;
export type OrganizerKnownFields = z.infer<typeof organizerKnownFieldsSchema>;
export type GigSeekerKnownFields = z.infer<typeof gigSeekerKnownFieldsSchema>;
export type InterestCheckKnownFields = z.infer<
  typeof interestCheckKnownFieldsSchema
>;
export type ContactReplyKnownFields = z.infer<
  typeof contactReplyKnownFieldsSchema
>;
export type CompensationPreference = z.infer<typeof compensationPreferenceSchema>;
export type ConversationContext = z.infer<typeof conversationContextSchema>;
export type ReplyPlan = z.infer<typeof replyPlanSchema>;
export type OrganizerGeneratedReply = z.infer<
  typeof organizerGeneratedReplySchema
>;
export type GigSeekerGeneratedReply = z.infer<
  typeof gigSeekerGeneratedReplySchema
>;
export type InterestCheckGeneratedReply = z.infer<
  typeof interestCheckGeneratedReplySchema
>;
export type ContactReplyGeneratedReply = z.infer<
  typeof contactReplyGeneratedReplySchema
>;
