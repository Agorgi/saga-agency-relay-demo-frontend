import {
  organizerGeneratedReplySchema,
  type ConversationContext,
  type OrganizerGeneratedReply,
  type ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import {
  resolveLlmExecutionContext,
  runStructuredLlmTask,
  type LlmStructuredProvider,
} from "@/lib/llm/llmProvider";
import { intakeReplySchema } from "@/lib/producerAgent";

type AdminDevLlmMetadata = {
  replySourceDetail: string;
  llmOperation: string | null;
  llmOperationUnavailable: boolean;
  llmMode: string;
  llmExecutionSurface: "admin_dev";
  llmValidationPassed: boolean | null;
  llmFallbackUsed: boolean;
  llmFallbackReason: string | null;
  forbiddenClaimsDetected: boolean;
};

export function resolveAdminDevLlmExecution({
  conversationEngineMode = "mock_active",
}: {
  conversationEngineMode?: string | null;
} = {}) {
  return resolveLlmExecutionContext({
    surface: "admin_dev",
    providerMode: "MOCK",
    conversationEngineMode,
    sendsDisabled: true,
    dryRun: true,
  });
}

export function adminDevDeterministicLlmUnavailableMetadata({
  conversationEngineMode = "mock_active",
  reason = "llm_operation_unavailable",
}: {
  conversationEngineMode?: string | null;
  reason?: string;
} = {}): AdminDevLlmMetadata {
  const resolved = resolveAdminDevLlmExecution({ conversationEngineMode });
  return {
    replySourceDetail: "deterministic_fallback",
    llmOperation: null,
    llmOperationUnavailable: true,
    llmMode: resolved.details.llmMode,
    llmExecutionSurface: "admin_dev",
    llmValidationPassed: null,
    llmFallbackUsed: true,
    llmFallbackReason: reason,
    forbiddenClaimsDetected: false,
  };
}

function organizerFallbackFor(reply: OrganizerGeneratedReply) {
  return intakeReplySchema.parse({
    message: reply.replyText,
    confidence: reply.metadata.confidence,
    needsAdmin: reply.metadata.shouldEscalate,
    reason: null,
  });
}

export async function generateAdminDevOrganizerReplyWithLlm({
  context,
  replyPlan,
  latestMessage,
  fallbackReply,
  conversationEngineMode = "mock_active",
  provider,
}: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
  fallbackReply: OrganizerGeneratedReply;
  conversationEngineMode?: string | null;
  provider?: LlmStructuredProvider;
}): Promise<OrganizerGeneratedReply> {
  if (replyPlan.shouldEscalate) {
    return organizerGeneratedReplySchema.parse({
      ...fallbackReply,
      source: "deterministic_fallback",
      metadata: {
        ...fallbackReply.metadata,
        ...adminDevDeterministicLlmUnavailableMetadata({
          conversationEngineMode,
          reason: "backend_safety_escalation",
        }),
      },
    });
  }

  const resolved = resolveAdminDevLlmExecution({ conversationEngineMode });
  const result = await runStructuredLlmTask({
    operation: "organizer_reply_language",
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    prompt: `
Admin/dev mock organizer reply language only. The backend state machine has
already selected the stage and next question; rewrite only the reply language.
Do not change workflow state. Ask at most one clear question. Do not promise
bookings, payment, revenue, attendance, venue access, confirmed team members,
celebrity/influencer participation, or group-chat inclusion.

Latest organizer message:
${latestMessage}

ReplyPlan JSON:
${JSON.stringify({
  flow: replyPlan.flow,
  stage: replyPlan.stage,
  nextStage: replyPlan.nextStage,
  nextQuestion: replyPlan.nextQuestion,
  enoughInfoForBrief: replyPlan.enoughInfoForBrief,
  shouldEscalate: replyPlan.shouldEscalate,
  explanationForAudit: replyPlan.explanationForAudit,
})}

Known context JSON:
${JSON.stringify({
  knownFields: context.knownFields,
  missingRequiredFields: context.missingRequiredFields,
  missingOptionalFields: context.missingOptionalFields,
})}

Return JSON with message, confidence, needsAdmin, and reason.
    `.trim(),
    fallback: organizerFallbackFor(fallbackReply),
    instructions:
      "You write concise, warm, producer-like Saga SMS replies for admin/dev mock simulations only.",
    entityType: "DemoLab",
    entityId: "admin_dev_organizer",
    executionContext: resolved.executionContext,
    executionContextDetails: resolved.details,
    provider,
    metadata: {
      surface: "admin_dev",
      flow: replyPlan.flow,
      stage: replyPlan.stage,
      nextStage: replyPlan.nextStage,
    },
  });

  const source =
    result.source === "openai" ? "openai_active_mock" : "deterministic_fallback";
  const fallbackReason =
    result.source === "openai"
      ? null
      : result.fallbackReason ||
        result.errorCategory ||
        (result.shadowOutput
          ? "shadow_mode_not_user_facing"
          : result.openaiCalled
            ? "provider_output_rejected"
            : "mode_or_context_not_active");

  return organizerGeneratedReplySchema.parse({
    replyText: result.data.message,
    replyType: fallbackReply.replyType,
    source,
    metadata: {
      ...fallbackReply.metadata,
      replySourceDetail: source,
      llmOperation: "organizer_reply_language",
      llmOperationUnavailable: false,
      llmMode: result.mode,
      llmExecutionSurface: "admin_dev",
      llmValidationPassed: result.validationPassed,
      llmFallbackUsed: result.source !== "openai",
      llmFallbackReason: fallbackReason,
      forbiddenClaimsDetected: false,
    },
  });
}
