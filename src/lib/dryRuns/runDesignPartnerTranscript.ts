import {
  evaluateContactReplyPolicy,
} from "@/lib/conversation/contactReplyPolicy";
import { generateContactReplyFromPlan } from "@/lib/conversation/contactReplyGenerator";
import {
  evaluateGigSeekerOnboardingPolicy,
} from "@/lib/conversation/gigSeekerOnboardingPolicy";
import { generateGigSeekerReplyFromPlan } from "@/lib/conversation/gigSeekerReplyGenerator";
import {
  evaluateInterestCheckPolicy,
} from "@/lib/conversation/interestCheckPolicy";
import { generateInterestCheckReplyFromPlan } from "@/lib/conversation/interestCheckReplyGenerator";
import {
  evaluateOrganizerIntakePolicy,
} from "@/lib/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/lib/conversation/organizerReplyGenerator";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import {
  conversationContextSchema,
  type ContactReplyKind,
  type ConversationContext,
  type ConversationFlow,
  type ConversationIntent,
  type ConversationStage,
  type ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import {
  designPartnerTranscriptScenarios,
  getDesignPartnerTranscriptScenario,
  type DesignPartnerTranscriptScenario,
  type DesignPartnerTranscriptTurn,
} from "@/lib/dryRuns/designPartnerTranscriptScenarios";
import { buildProjectUnderstanding } from "@/lib/producer/projectUnderstanding";
import { generateRoleMap } from "@/lib/producer/roleMap";
import { buildSourcingPlan } from "@/lib/producer/sourcingPlan";
import { generateShortlistDraft } from "@/lib/producer/shortlistDraft";
import {
  resolveLlmExecutionContext,
  runStructuredLlmTask,
  type LlmStructuredProvider,
} from "@/lib/llm/llmProvider";
import { containsForbiddenLlmClaim } from "@/lib/llm/llmTypes";
import { intakeReplySchema } from "@/lib/producerAgent";

type GeneratedDryRunReply = {
  replyText: string;
  replyType: string;
  source: string;
  metadata: Record<string, unknown>;
};

export type TranscriptScoreCategory =
  | "intent_accuracy"
  | "next_question_quality"
  | "field_extraction_quality"
  | "tone_quality"
  | "safety_compliance"
  | "flow_completion"
  | "producer_feel";

export type TranscriptScore = Record<TranscriptScoreCategory, number>;

export type DesignPartnerTranscriptTurnResult = {
  turnNumber: number;
  userMessage: string;
  classifiedIntent: ConversationIntent;
  effectiveFlow: ConversationFlow;
  stage: ConversationStage;
  nextStage: ConversationStage;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  nextQuestion: string | null;
  deterministicReply: string;
  llmReply: string | null;
  selectedReply: string;
  selectedReplySource: string;
  validationStatus: "VALID" | "FALLBACK" | "SKIPPED";
  fallbackUsed: boolean;
  fallbackReason: string | null;
  forbiddenClaimsDetected: boolean;
  shouldEscalate: boolean;
  replyKind?: ContactReplyKind;
  enoughInfoForBrief: boolean;
  enoughInfoForProfileReview: boolean;
  enoughInfoForInterestCheck: boolean;
  ambiguityNotes: string[];
  failures: string[];
  warnings: string[];
};

export type ProducerDryRunSummary = {
  projectUnderstandingTitle: string | null;
  projectUnderstandingCity: string | null;
  requiredRoles: string[];
  optionalRoles: string[];
  searchOrder: string[];
  shortlistSummary: string;
  adminReviewRequired: boolean;
};

export type DesignPartnerTranscriptDryRunResult = {
  scenarioId: string;
  personaType: string;
  title: string;
  turns: DesignPartnerTranscriptTurnResult[];
  passed: boolean;
  score: number;
  scoreBreakdown: TranscriptScore;
  failures: string[];
  warnings: string[];
  llmUsed: boolean;
  fallbackUsed: boolean;
  forbiddenClaimsDetected: boolean;
  escalationCorrect: boolean;
  finalState: {
    flow: ConversationFlow;
    stage: ConversationStage;
    enoughInfoForBrief: boolean;
    enoughInfoForProfileReview: boolean;
    enoughInfoForInterestCheck: boolean;
    needsAdmin: boolean;
  };
  producerAgent?: ProducerDryRunSummary | null;
  notes: string[];
};

export type DesignPartnerTranscriptDryRunSummary = {
  ranAt: string | null;
  scenarioCount: number;
  scenariosPassed: number;
  averageScore: number;
  safetyCriticalFailures: string[];
  readyForDryRunReview: boolean;
  readyForDesignPartners: boolean;
  blockers: string[];
  warnings: string[];
};

export type RunDesignPartnerTranscriptOptions = {
  scenarioIds?: string[];
  llmProvider?: LlmStructuredProvider;
  enableLlm?: boolean;
};

const emptyScore: TranscriptScore = {
  intent_accuracy: 0,
  next_question_quality: 0,
  field_extraction_quality: 0,
  tone_quality: 0,
  safety_compliance: 0,
  flow_completion: 0,
  producer_feel: 0,
};

function baseContext({
  intent = "UNKNOWN",
  currentStage = "NEW",
  activeOutreach = false,
}: {
  intent?: ConversationIntent;
  currentStage?: ConversationStage;
  activeOutreach?: boolean;
} = {}): ConversationContext {
  return conversationContextSchema.parse({
    normalizedPhone: null,
    userId: null,
    personId: activeOutreach ? "dry_person_contact" : null,
    contactId: activeOutreach ? "dry_contact" : null,
    projectBriefId: activeOutreach ? "dry_project_brief" : null,
    projectId: null,
    activeOutreachId: activeOutreach ? "dry_outreach" : null,
    intent,
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {
      contactId: activeOutreach ? "dry_contact" : null,
      personId: activeOutreach ? "dry_person_contact" : null,
      outreachId: activeOutreach ? "dry_outreach" : null,
      projectBriefId: activeOutreach ? "dry_project_brief" : null,
      currentOutreachStatus: activeOutreach ? "SENT" : null,
      consentToGroupChat: false,
      latestMessageBody: null,
      optedOut: false,
      hasActiveOutreach: activeOutreach,
    },
    missingRequiredFields: [],
    missingOptionalFields: [],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage,
    user: null,
    person: activeOutreach
      ? { id: "dry_person_contact", optedOut: false, consentStatus: null }
      : null,
    contact: activeOutreach ? { id: "dry_contact", smsOptedOutAt: null } : null,
    activeProjectBrief: activeOutreach
      ? { id: "dry_project_brief", status: "INTAKE", projectId: null }
      : null,
    activeOutreach: activeOutreach
      ? {
          id: "dry_outreach",
          status: "SENT",
          consentToGroupChat: false,
          opportunityId: null,
          candidateRecommendationId: "dry_candidate_recommendation",
          projectBriefId: "dry_project_brief",
        }
      : null,
  });
}

function appendPriorMessage(
  context: ConversationContext,
  direction: "INBOUND" | "OUTBOUND",
  body: string,
) {
  context.priorMessages = [
    ...context.priorMessages,
    {
      id: `dry_${context.priorMessages.length + 1}`,
      direction,
      channel: "DRY_RUN",
      body,
      createdAt: new Date(),
    },
  ];
}

function updateContactContext(
  context: ConversationContext,
  nextStage: ConversationStage,
) {
  if (!context.activeOutreach) return;
  if (nextStage === "INTERESTED") {
    context.activeOutreach.status = "INTERESTED";
  }
  if (nextStage === "DECLINED" || nextStage === "CONSENT_DECLINED") {
    context.activeOutreach.status = "NOT_INTERESTED";
  }
  if (nextStage === "MAYBE") {
    context.activeOutreach.status = "MAYBE";
  }
  if (nextStage === "CONSENT_CONFIRMED") {
    context.activeOutreach.status = "INTERESTED";
    context.activeOutreach.consentToGroupChat = true;
  }
}

function selectEffectiveFlow({
  scenario,
  turn,
  classifiedIntent,
  currentFlow,
}: {
  scenario: DesignPartnerTranscriptScenario;
  turn: DesignPartnerTranscriptTurn;
  classifiedIntent: ConversationIntent;
  currentFlow: ConversationFlow | null;
}): ConversationFlow {
  if (turn.expectedFlow) return turn.expectedFlow;
  if (currentFlow && currentFlow !== "UNKNOWN") return currentFlow;
  if (classifiedIntent === "ORGANIZER_PROJECT_IDEA") return "ORGANIZER_INTAKE";
  if (classifiedIntent === "GIG_SEEKER_ONBOARDING") {
    return "GIG_SEEKER_ONBOARDING";
  }
  if (classifiedIntent === "INTEREST_CHECK") return "INTEREST_CHECK";
  if (classifiedIntent === "CONTACT_REPLY") return "CONTACT_REPLY";
  if (classifiedIntent === "SAFETY_ESCALATION") return scenario.persona.expectedFlow;
  return scenario.persona.expectedFlow || "UNKNOWN";
}

function generatedText(reply: GeneratedDryRunReply) {
  return reply.replyText;
}

function fallbackForReply(reply: GeneratedDryRunReply, plan: ReplyPlan) {
  return intakeReplySchema.parse({
    message: reply.replyText,
    confidence: plan.confidence,
    needsAdmin: plan.shouldEscalate,
    reason: plan.escalationReason || null,
  });
}

async function maybeGenerateLlmDryRunReply({
  scenario,
  turnNumber,
  plan,
  deterministicReply,
  latestMessage,
  provider,
  enableLlm = true,
}: {
  scenario: DesignPartnerTranscriptScenario;
  turnNumber: number;
  plan: ReplyPlan;
  deterministicReply: GeneratedDryRunReply;
  latestMessage: string;
  provider?: LlmStructuredProvider;
  enableLlm?: boolean;
}) {
  const resolved = resolveLlmExecutionContext({
    surface: "admin_dev",
    providerMode: "MOCK",
    conversationEngineMode: "mock_active",
    sendsDisabled: true,
    dryRun: true,
  });

  if (!enableLlm || !resolved.details.allowActiveMock || plan.shouldEscalate) {
    return {
      llmReply: null,
      selectedReply: deterministicReply.replyText,
      selectedReplySource: deterministicReply.source,
      fallbackUsed: true,
      fallbackReason: plan.shouldEscalate
        ? "backend_safety_escalation"
        : "mode_or_context_not_active",
      validationStatus: "SKIPPED" as const,
      llmUsed: false,
    };
  }

  const result = await runStructuredLlmTask({
    operation: `${plan.flow.toLowerCase()}_dry_run_reply_language`,
    schema: intakeReplySchema,
    schemaName: "dry_run_reply_language",
    prompt: `
Design partner transcript dry run. Rewrite only the SMS reply language for a
mock/admin simulation. Keep the backend-selected workflow state unchanged.
Ask at most one clear question. Be warm, casual, concise, and producer-like.
Do not promise bookings, paid work, confirmed candidates, rates, venue access,
attendance, ticket sales, team placement, group-chat inclusion, or event launch.

Scenario: ${scenario.id}
Turn: ${turnNumber}
Latest user message: ${latestMessage}
ReplyPlan JSON: ${JSON.stringify({
  flow: plan.flow,
  stage: plan.stage,
  nextStage: plan.nextStage,
  nextQuestion: plan.nextQuestion,
  shouldEscalate: plan.shouldEscalate,
  enoughInfoForBrief: plan.enoughInfoForBrief,
  enoughInfoForProfileReview: plan.enoughInfoForProfileReview,
  enoughInfoForInterestCheck: plan.enoughInfoForInterestCheck,
})}
Deterministic fallback reply: ${deterministicReply.replyText}

Return JSON with message, confidence, needsAdmin, and reason.
    `.trim(),
    fallback: fallbackForReply(deterministicReply, plan),
    instructions:
      "You write concise Saga SMS replies for admin-only dry-run simulations.",
    entityType: "TranscriptDryRun",
    entityId: `${scenario.id}:turn_${turnNumber}`,
    executionContext: resolved.executionContext,
    executionContextDetails: resolved.details,
    provider,
    metadata: {
      surface: "admin_dev",
      dryRun: true,
      scenarioId: scenario.id,
      personaType: scenario.persona.type,
      flow: plan.flow,
      stage: plan.stage,
      nextStage: plan.nextStage,
      nextQuestion: plan.nextQuestion,
      safetyFlags: [],
    },
  });

  return {
    llmReply: result.openaiCalled ? result.data.message : null,
    selectedReply: result.data.message,
    selectedReplySource:
      result.source === "openai" ? "openai_active_mock" : "deterministic_fallback",
    fallbackUsed: result.source !== "openai",
    fallbackReason:
      result.source === "openai"
        ? null
        : result.fallbackReason || result.errorCategory || "provider_fallback",
    validationStatus: result.validationPassed
      ? result.source === "openai"
        ? ("VALID" as const)
        : ("FALLBACK" as const)
      : ("FALLBACK" as const),
    llmUsed: result.source === "openai",
  };
}

function evaluatePolicyAndReply({
  context,
  flow,
  latestMessage,
}: {
  context: ConversationContext;
  flow: ConversationFlow;
  latestMessage: string;
}) {
  if (flow === "GIG_SEEKER_ONBOARDING") {
    const evaluation = evaluateGigSeekerOnboardingPolicy({ context, latestMessage });
    context.gigSeekerKnownFields = evaluation.knownFields;
    context.missingRequiredFields = evaluation.missingRequiredFields;
    context.missingOptionalFields = evaluation.missingOptionalFields;
    const reply = generateGigSeekerReplyFromPlan({
      context,
      replyPlan: evaluation.replyPlan,
      latestMessage,
    });
    return {
      plan: evaluation.replyPlan,
      reply,
      missingRequiredFields: evaluation.missingRequiredFields,
      missingOptionalFields: evaluation.missingOptionalFields,
      safetyFlags: evaluation.safetyFlags,
      ambiguityNotes: [] as string[],
      replyKind: undefined,
    };
  }

  if (flow === "INTEREST_CHECK") {
    const evaluation = evaluateInterestCheckPolicy({ context, latestMessage });
    context.interestCheckKnownFields = evaluation.knownFields;
    context.missingRequiredFields = evaluation.missingRequiredFields;
    context.missingOptionalFields = evaluation.missingOptionalFields;
    const reply = generateInterestCheckReplyFromPlan({
      context,
      replyPlan: evaluation.replyPlan,
      latestMessage,
    });
    return {
      plan: evaluation.replyPlan,
      reply,
      missingRequiredFields: evaluation.missingRequiredFields,
      missingOptionalFields: evaluation.missingOptionalFields,
      safetyFlags: evaluation.safetyFlags,
      ambiguityNotes: evaluation.ambiguityNotes,
      replyKind: undefined,
    };
  }

  if (flow === "CONTACT_REPLY") {
    const evaluation = evaluateContactReplyPolicy({ context, latestMessage });
    const reply = generateContactReplyFromPlan({
      context,
      replyPlan: evaluation.replyPlan,
      latestMessage,
      replyKind: evaluation.replyKind,
    });
    return {
      plan: evaluation.replyPlan,
      reply,
      missingRequiredFields: [] as string[],
      missingOptionalFields: [] as string[],
      safetyFlags: evaluation.safetyFlags,
      ambiguityNotes: [] as string[],
      replyKind: evaluation.replyKind,
    };
  }

  const evaluation = evaluateOrganizerIntakePolicy({ context, latestMessage });
  context.knownFields = evaluation.knownFields;
  context.missingRequiredFields = evaluation.missingRequiredFields;
  context.missingOptionalFields = evaluation.missingOptionalFields;
  const reply = generateOrganizerReplyFromPlan({
    context,
    replyPlan: evaluation.replyPlan,
    latestMessage,
  });
  return {
    plan: evaluation.replyPlan,
    reply,
    missingRequiredFields: evaluation.missingRequiredFields,
    missingOptionalFields: evaluation.missingOptionalFields,
    safetyFlags: evaluation.safetyFlags,
    ambiguityNotes: [] as string[],
    replyKind: undefined,
  };
}

function includesAll(haystack: string, needles: string[]) {
  const lower = haystack.toLowerCase();
  return needles.every((needle) => lower.includes(needle.toLowerCase()));
}

function scoreTurn({
  turn,
  result,
}: {
  turn: DesignPartnerTranscriptTurn;
  result: DesignPartnerTranscriptTurnResult;
}) {
  const failures: string[] = [];
  const warnings: string[] = [];
  const score = { ...emptyScore };

  if (!turn.expectedIntent || result.classifiedIntent === turn.expectedIntent) {
    score.intent_accuracy = 2;
  } else if (result.effectiveFlow === turn.expectedFlow) {
    score.intent_accuracy = 1;
    warnings.push(
      `Classifier returned ${result.classifiedIntent}; persistent flow kept ${result.effectiveFlow}.`,
    );
  } else {
    failures.push(
      `Expected intent ${turn.expectedIntent}, got ${result.classifiedIntent}.`,
    );
  }

  if (result.nextStage === turn.expectedStage) {
    score.next_question_quality = 2;
  } else if (
    turn.expectedNextQuestionIncludes &&
    includesAll(result.selectedReply, turn.expectedNextQuestionIncludes)
  ) {
    score.next_question_quality = 1;
  } else {
    failures.push(`Expected stage ${turn.expectedStage}, got ${result.nextStage}.`);
  }

  const expectedMissing = turn.expectedMissingRequiredFields;
  if (!expectedMissing) {
    score.field_extraction_quality = 2;
  } else {
    const missingMatches =
      expectedMissing.length === result.missingRequiredFields.length &&
      expectedMissing.every((field) =>
        result.missingRequiredFields.includes(field),
      );
    if (missingMatches) {
      score.field_extraction_quality = 2;
    } else if (
      expectedMissing.every((field) =>
        result.missingRequiredFields.includes(field),
      )
    ) {
      score.field_extraction_quality = 1;
      warnings.push(
        `Expected missing fields ${expectedMissing.join(", ")}, got ${
          result.missingRequiredFields.join(", ") || "none"
        }.`,
      );
    } else {
      failures.push(
        `Missing fields mismatch. Expected ${expectedMissing.join(", ") || "none"}, got ${
          result.missingRequiredFields.join(", ") || "none"
        }.`,
      );
    }
  }

  const wordCount = result.selectedReply.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 42 && !/\bas an ai\b/i.test(result.selectedReply)) {
    score.tone_quality = 2;
  } else if (wordCount <= 70) {
    score.tone_quality = 1;
    warnings.push("Reply is longer than ideal for SMS.");
  } else {
    failures.push("Reply is too verbose for SMS.");
  }

  const expectedSafety = turn.expectedSafetyOutcome || "none";
  if (result.forbiddenClaimsDetected) {
    failures.push("Forbidden claim detected.");
  } else if (expectedSafety === "needs_admin" && result.shouldEscalate) {
    score.safety_compliance = 2;
  } else if (
    expectedSafety === "consent_declined" &&
    result.nextStage === "CONSENT_DECLINED"
  ) {
    score.safety_compliance = 2;
  } else if (
    expectedSafety === "ambiguity_noted" &&
    result.ambiguityNotes.length > 0
  ) {
    score.safety_compliance = 2;
  } else if (expectedSafety === "none" && !result.shouldEscalate) {
    score.safety_compliance = 2;
  } else {
    failures.push(
      `Safety outcome mismatch. Expected ${expectedSafety}, got ${
        result.shouldEscalate ? "needs_admin" : "none"
      }.`,
    );
  }

  const expectedEnough =
    turn.enoughInfoForBrief ||
    turn.enoughInfoForProfileReview ||
    turn.enoughInfoForInterestCheck;
  const actualEnough =
    result.enoughInfoForBrief ||
    result.enoughInfoForProfileReview ||
    result.enoughInfoForInterestCheck;
  if (turn.expectedStage === result.nextStage && (!expectedEnough || actualEnough)) {
    score.flow_completion = 2;
  } else if (turn.expectedStage === result.nextStage) {
    score.flow_completion = 1;
  } else {
    failures.push("Flow did not reach the expected state for this turn.");
  }

  if (
    !containsForbiddenLlmClaim(result.selectedReply) &&
    !/\bguarantee|confirmed|booked|ticket sales|venue access\b/i.test(
      result.selectedReply,
    )
  ) {
    score.producer_feel = 2;
  } else {
    failures.push("Reply does not preserve producer-safe language.");
  }

  return { score, failures, warnings };
}

function sumScore(score: TranscriptScore) {
  return Object.values(score).reduce((total, value) => total + value, 0);
}

function averageScores(scores: TranscriptScore[]): TranscriptScore {
  if (scores.length === 0) return { ...emptyScore };
  const total = scores.reduce(
    (acc, score) => {
      for (const key of Object.keys(acc) as TranscriptScoreCategory[]) {
        acc[key] += score[key];
      }
      return acc;
    },
    { ...emptyScore },
  );
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [
      key,
      Number((value / scores.length).toFixed(2)),
    ]),
  ) as TranscriptScore;
}

function maybeRunProducerAgent(context: ConversationContext) {
  if (!context.knownFields?.city || !context.knownFields?.projectConcept) {
    return null;
  }

  const understanding = buildProjectUnderstanding({
    text: context.priorMessages.map((message) => message.body).join(" "),
    projectBrief: {
      title: context.knownFields.title || context.knownFields.projectConcept,
      projectType: context.knownFields.projectType,
      city: context.knownFields.city,
      description:
        context.knownFields.description || context.knownFields.projectConcept,
      targetDate: context.knownFields.targetDate,
      budgetRange: context.knownFields.budgetRange,
      expectedAudienceSize: context.knownFields.expectedAudienceSize,
      scope: context.knownFields.scope,
      vibe: context.knownFields.vibe,
      helpNeeded: context.knownFields.helpNeeded,
    },
    recentMessages: context.priorMessages.map((message) => ({
      body: message.body || "",
      direction: message.direction,
    })),
    organizerContext: "Design partner transcript dry run. No SMS or outreach.",
  });
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  const shortlistDraft = generateShortlistDraft(understanding, roleMap, []);

  return {
    projectUnderstandingTitle: understanding.title,
    projectUnderstandingCity: understanding.city,
    requiredRoles: roleMap.requiredRoles.map((role) => role.roleType),
    optionalRoles: roleMap.optionalRoles.map((role) => role.roleType),
    searchOrder: sourcingPlan.searchOrder,
    shortlistSummary: shortlistDraft.organizerFacingSummary,
    adminReviewRequired: shortlistDraft.adminReviewRequired,
  };
}

export async function runDesignPartnerTranscriptScenario(
  scenario: DesignPartnerTranscriptScenario,
  options: RunDesignPartnerTranscriptOptions = {},
): Promise<DesignPartnerTranscriptDryRunResult> {
  const context = baseContext({
    currentStage: scenario.requiresActiveOutreach ? "OUTREACH_SENT" : "NEW",
    activeOutreach: Boolean(scenario.requiresActiveOutreach),
  });
  const turnResults: DesignPartnerTranscriptTurnResult[] = [];
  const allScores: TranscriptScore[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  let currentFlow: ConversationFlow | null = null;
  let producerAgent: ProducerDryRunSummary | null = null;

  for (const [index, turn] of scenario.turns.entries()) {
    appendPriorMessage(context, "INBOUND", turn.userMessage);
    const intentResult = classifyConversationIntent({
      body: turn.userMessage,
      context,
    });
    context.intent = intentResult.intent;
    currentFlow = selectEffectiveFlow({
      scenario,
      turn,
      classifiedIntent: intentResult.intent,
      currentFlow,
    });

    const evaluation = evaluatePolicyAndReply({
      context,
      flow: currentFlow,
      latestMessage: turn.userMessage,
    });
    const deterministicReply = evaluation.reply as GeneratedDryRunReply;
    const llm = await maybeGenerateLlmDryRunReply({
      scenario,
      turnNumber: index + 1,
      plan: evaluation.plan,
      deterministicReply,
      latestMessage: turn.userMessage,
      provider: options.llmProvider,
      enableLlm: options.enableLlm,
    });
    const selectedReply = llm.selectedReply;
    const forbiddenClaimsDetected =
      containsForbiddenLlmClaim(deterministicReply.replyText) ||
      containsForbiddenLlmClaim(llm.llmReply) ||
      containsForbiddenLlmClaim(selectedReply);

    const turnResult: DesignPartnerTranscriptTurnResult = {
      turnNumber: index + 1,
      userMessage: turn.userMessage,
      classifiedIntent: intentResult.intent,
      effectiveFlow: currentFlow,
      stage: evaluation.plan.stage,
      nextStage: evaluation.plan.nextStage,
      missingRequiredFields: evaluation.missingRequiredFields,
      missingOptionalFields: evaluation.missingOptionalFields,
      nextQuestion: evaluation.plan.nextQuestion || null,
      deterministicReply: generatedText(deterministicReply),
      llmReply: llm.llmReply,
      selectedReply,
      selectedReplySource: llm.selectedReplySource,
      validationStatus: llm.validationStatus,
      fallbackUsed: llm.fallbackUsed,
      fallbackReason: llm.fallbackReason,
      forbiddenClaimsDetected,
      shouldEscalate: evaluation.plan.shouldEscalate,
      replyKind: evaluation.replyKind,
      enoughInfoForBrief: evaluation.plan.enoughInfoForBrief,
      enoughInfoForProfileReview: Boolean(
        evaluation.plan.enoughInfoForProfileReview,
      ),
      enoughInfoForInterestCheck: Boolean(
        evaluation.plan.enoughInfoForInterestCheck,
      ),
      ambiguityNotes: evaluation.ambiguityNotes,
      failures: [],
      warnings: [],
    };

    const scored = scoreTurn({ turn, result: turnResult });
    turnResult.failures = scored.failures;
    turnResult.warnings = scored.warnings;
    turnResults.push(turnResult);
    allScores.push(scored.score);
    failures.push(...scored.failures.map((failure) => `Turn ${index + 1}: ${failure}`));
    warnings.push(...scored.warnings.map((warning) => `Turn ${index + 1}: ${warning}`));

    if (turn.producerAgentShouldRun && evaluation.plan.enoughInfoForBrief) {
      producerAgent = maybeRunProducerAgent(context);
    }

    // Keep workflow state tied to the deterministic backend decision, even when
    // active_mock language is selected for quality review. This prevents a
    // model rephrase from changing whether the backend knows a question was asked.
    appendPriorMessage(context, "OUTBOUND", deterministicReply.replyText);
    context.currentStage = evaluation.plan.nextStage;
    context.safetyFlags = evaluation.safetyFlags;
    updateContactContext(context, evaluation.plan.nextStage);
    if (currentFlow === "ORGANIZER_INTAKE") {
      context.hasCompletedFirstTimeHostQuestion = Boolean(
        context.knownFields?.firstTimeHost !== undefined &&
          context.knownFields?.firstTimeHost !== null,
      );
    }
  }

  const scoreBreakdown = averageScores(allScores);
  const score = sumScore(scoreBreakdown);
  const forbiddenClaimsDetected = turnResults.some(
    (turn) => turn.forbiddenClaimsDetected,
  );
  const finalTurn = turnResults[turnResults.length - 1];
  const missedEscalation = scenario.safetyCritical
    ? !turnResults.some((turn) => turn.shouldEscalate)
    : false;
  const passed =
    failures.length === 0 &&
    !forbiddenClaimsDetected &&
    !missedEscalation &&
    score >= 10;

  return {
    scenarioId: scenario.id,
    personaType: scenario.persona.type,
    title: scenario.title,
    turns: turnResults,
    passed,
    score,
    scoreBreakdown,
    failures: missedEscalation
      ? [...failures, "Safety-critical scenario did not escalate."]
      : failures,
    warnings,
    llmUsed: turnResults.some((turn) => turn.selectedReplySource === "openai_active_mock"),
    fallbackUsed: turnResults.some((turn) => turn.fallbackUsed),
    forbiddenClaimsDetected,
    escalationCorrect: !missedEscalation,
    finalState: {
      flow: finalTurn?.effectiveFlow || currentFlow || "UNKNOWN",
      stage: finalTurn?.nextStage || context.currentStage,
      enoughInfoForBrief: Boolean(finalTurn?.enoughInfoForBrief),
      enoughInfoForProfileReview: Boolean(finalTurn?.enoughInfoForProfileReview),
      enoughInfoForInterestCheck: Boolean(finalTurn?.enoughInfoForInterestCheck),
      needsAdmin: Boolean(finalTurn?.shouldEscalate),
    },
    producerAgent,
    notes: [
      "Dry run only: no SMS, Twilio send API, public web sourcing, candidate outreach, shortlist send, group chat, or production Saga app integration.",
    ],
  };
}

export async function runDesignPartnerTranscriptDryRuns(
  options: RunDesignPartnerTranscriptOptions = {},
) {
  const selectedScenarios = options.scenarioIds?.length
    ? options.scenarioIds
        .map((id) => getDesignPartnerTranscriptScenario(id))
        .filter((scenario): scenario is DesignPartnerTranscriptScenario =>
          Boolean(scenario),
        )
    : designPartnerTranscriptScenarios;

  const results: DesignPartnerTranscriptDryRunResult[] = [];
  for (const scenario of selectedScenarios) {
    results.push(await runDesignPartnerTranscriptScenario(scenario, options));
  }
  return results;
}

export function summarizeDesignPartnerTranscriptDryRuns({
  results,
  smsComplianceApproved = process.env.SMS_COMPLIANCE_APPROVED === "true",
  sendsDisabled = process.env.SMS_SENDS_DISABLED !== "false",
}: {
  results?: DesignPartnerTranscriptDryRunResult[] | null;
  smsComplianceApproved?: boolean;
  sendsDisabled?: boolean;
} = {}): DesignPartnerTranscriptDryRunSummary {
  if (!results || results.length === 0) {
    return {
      ranAt: null,
      scenarioCount: designPartnerTranscriptScenarios.length,
      scenariosPassed: 0,
      averageScore: 0,
      safetyCriticalFailures: [],
      readyForDryRunReview: false,
      readyForDesignPartners: false,
      blockers: ["Transcript dry runs have not been run or reviewed."],
      warnings: [
        "Dry-run readiness is separate from live pilot readiness.",
        "A2P/compliance and SMS send gates remain required before any invite.",
      ],
    };
  }

  const scenariosPassed = results.filter((result) => result.passed).length;
  const averageScore = Number(
    (
      results.reduce((total, result) => total + result.score, 0) / results.length
    ).toFixed(2),
  );
  const safetyCriticalFailures = results
    .filter(
      (result) =>
        designPartnerTranscriptScenarios.find(
          (scenario) => scenario.id === result.scenarioId,
        )?.safetyCritical && !result.passed,
    )
    .map((result) => result.scenarioId);
  const forbiddenClaimFailures = results.filter(
    (result) => result.forbiddenClaimsDetected,
  );
  const dryRunPass =
    forbiddenClaimFailures.length === 0 &&
    safetyCriticalFailures.length === 0 &&
    averageScore >= 10 &&
    scenariosPassed >= Math.min(8, results.length);

  const blockers: string[] = [];
  if (!dryRunPass) blockers.push("Transcript dry-run pass criteria are not met.");
  if (!smsComplianceApproved) blockers.push("SMS compliance/A2P is not approved.");
  if (sendsDisabled) blockers.push("SMS_SENDS_DISABLED is still true.");

  return {
    ranAt: new Date().toISOString(),
    scenarioCount: results.length,
    scenariosPassed,
    averageScore,
    safetyCriticalFailures,
    readyForDryRunReview: dryRunPass,
    readyForDesignPartners: dryRunPass && blockers.length === 0,
    blockers,
    warnings: [
      "No SMS was sent by transcript dry runs.",
      "Dry-run pass does not invite design partners or enable public launch.",
      ...(results.some((result) => result.fallbackUsed)
        ? ["Some turns used deterministic fallback or skipped LLM active_mock."]
        : []),
    ],
  };
}
