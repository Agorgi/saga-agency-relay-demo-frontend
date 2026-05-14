import { logAudit } from "@/lib/audit";
import {
  evaluateAndApplyInboundAccess,
  safeAccessDecisionForAudit,
} from "@/lib/access/accessControl";
import { handleContactInbound } from "@/lib/contactReplies";
import { getDb } from "@/lib/db";
import {
  findOrCreateActiveProject,
  findOrCreateUser,
  handleOrganizerInbound,
} from "@/lib/intake";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { loadConversationContext } from "@/lib/conversation/conversationContext";
import { getConversationEngineRuntime } from "@/lib/conversation/conversationEngineMode";
import { evaluateCapabilityFaqPolicy } from "@/lib/conversation/capabilityResponses";
import { evaluateContactReplyPolicy } from "@/lib/conversation/contactReplyPolicy";
import { evaluateGigSeekerOnboardingPolicy } from "@/lib/conversation/gigSeekerOnboardingPolicy";
import { evaluateInterestCheckPolicy } from "@/lib/conversation/interestCheckPolicy";
import { evaluateOrganizerIntakePolicy } from "@/lib/conversation/organizerIntakePolicy";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import type {
  ConversationIntentResult,
  ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import {
  createInboundMessage,
  messageExistsForTwilioSid,
  shouldSkipDuplicateTwilioMessageSid,
} from "@/lib/messages";
import { normalizePhone } from "@/lib/phone";
import {
  logServerError,
  logStructuredEvent,
  requestCorrelationId,
} from "@/lib/safeLogging";
import {
  completeInboundProcessingJob,
  findInboundMessageForPipeline,
  getMessageProcessingMode,
  recordInboundProcessingDuplicate,
  upsertInboundProcessingJob,
} from "@/lib/messagingPipeline";
import {
  getSmsSafetyConfig,
} from "@/lib/smsSafety";
import { resolveLlmExecutionContext } from "@/lib/llm/llmProvider";
import {
  forbiddenTwilioResponse,
  formDataToRecord,
  validateTwilioWebhookRequest,
} from "@/lib/twilioWebhook";

export const runtime = "nodejs";

const inboundRoute = "/api/twilio/inbound";

function twimlResponse(status = 200) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response />', {
    status,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

function inboundSafetyMetadata(allowlistResult: "allowed" | "blocked") {
  const safetyConfig = getSmsSafetyConfig({ providerMode: "TWILIO" });
  return {
    providerMode: safetyConfig.providerMode,
    twilioStagingMode: safetyConfig.twilioStagingMode,
    sendsDisabled: safetyConfig.sendsDisabled,
    allowlistRequired: safetyConfig.allowlistRequired,
    allowlistResult,
    allowedNumbersCount: safetyConfig.allowedNumbersCount,
  };
}

function compactMetadata(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

async function recordPipelineJobForPersistedInbound({
  twilioMessageSid,
  from,
  status,
  handler,
  resultSummary,
}: {
  twilioMessageSid?: string | null;
  from: string;
  status?: "PENDING" | "SUCCEEDED" | "BLOCKED";
  handler?: string;
  resultSummary?: Record<string, unknown>;
}) {
  if (!twilioMessageSid) return null;
  const processingMode = getMessageProcessingMode();
  const inboundMessage = await findInboundMessageForPipeline(twilioMessageSid);
  if (!inboundMessage) return null;

  const job = await upsertInboundProcessingJob({
    inboundMessageId: inboundMessage.id,
    inboundTwilioMessageSid: twilioMessageSid,
    projectBriefId: inboundMessage.projectBriefId,
    userId: inboundMessage.userId,
    contactId: inboundMessage.contactId,
    normalizedSender: normalizePhone(from),
    processingMode,
    status:
      status ||
      (processingMode === "sync"
        ? "SUCCEEDED"
        : processingMode === "async_shadow"
          ? "PENDING"
          : "PENDING"),
    resultSummary: {
      handler: handler || "unknown",
      processingMode,
      routeProcessedSynchronously: processingMode !== "async_active",
      asyncShadowNoDuplicateSideEffects: processingMode === "async_shadow",
      noSmsSentByPipeline: true,
      ...(resultSummary || {}),
    },
  });

  if (job && processingMode === "sync" && job.status !== "SUCCEEDED") {
    await completeInboundProcessingJob(job.id, {
      handler: handler || "unknown",
      processingMode,
      routeProcessedSynchronously: true,
      noSmsSentByPipeline: true,
      ...(resultSummary || {}),
    });
  }

  return job;
}

async function recordConversationIntentShadow({
  request,
  from,
  body,
  twilioMessageSid,
}: {
  request: Request;
  from: string;
  body: string;
  twilioMessageSid?: string | null;
}): Promise<{
  classification?: ConversationIntentResult;
  replyPlan?: ReplyPlan | null;
}> {
  try {
    const context = await loadConversationContext(from);
    const classification = classifyConversationIntent({ body, context });
    const engineRuntime = getConversationEngineRuntime({
      providerMode: "TWILIO",
      source: "twilio_webhook",
    });
    const entityId =
      context.activeProjectBrief?.id ||
      context.activeOutreach?.id ||
      context.user?.id ||
      context.person?.id ||
      context.contact?.id ||
      "shadow";
    const metadata = {
      intent: classification.intent,
      confidence: classification.confidence,
      reasons: classification.reasons,
      matchedSignals: classification.matchedSignals,
      shouldEscalate: classification.shouldEscalate,
      suggestedFlow: classification.suggestedFlow,
      providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
      senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
      twilioMessageSid,
      hasUser: Boolean(context.user),
      hasPerson: Boolean(context.person),
      hasContact: Boolean(context.contact),
      hasCreatorProfile: Boolean(context.creatorProfile),
      hasActiveProjectBrief: Boolean(context.activeProjectBrief),
      hasActiveOutreach: Boolean(context.activeOutreach),
      optedOut: Boolean(context.optedOut),
      hasCompletedFirstTimeHostQuestion: Boolean(
        context.hasCompletedFirstTimeHostQuestion,
      ),
      shadowMode: true,
    };

    logStructuredEvent({
      action: "conversation.intent_classified",
      entityType: "Conversation",
      entityId,
      status: "shadow",
      result: "success",
      requestId: requestCorrelationId(request),
      metadata,
    });

    await logAudit({
      actorType: "SYSTEM",
      action: "conversation.intent_classified",
      entityType: "Conversation",
      entityId,
      metadata,
    });

    let replyPlan: ReplyPlan | null = null;
    const shouldPlanContactReply =
      classification.intent === "CONTACT_REPLY" ||
      Boolean(context.activeOutreach) ||
      Boolean(context.contact);
    const shouldPlanCapabilityFaq =
      classification.intent === "CAPABILITY_FAQ" ||
      classification.intent === "HELP";
    const shouldPlanOrganizerIntake =
      classification.intent === "ORGANIZER_PROJECT_IDEA" ||
      (Boolean(context.activeProjectBrief) &&
        !context.activeOutreach &&
        !context.contact &&
        ![
          "STOP_OR_OPT_OUT",
          "START_OR_OPT_IN",
          "HELP",
          "CAPABILITY_FAQ",
          "SAFETY_ESCALATION",
          "GIG_SEEKER_ONBOARDING",
          "INTEREST_CHECK",
        ].includes(classification.intent));

    if (shouldPlanCapabilityFaq) {
      const policyContext = {
        ...context,
        intent: classification.intent,
        safetyFlags: classification.shouldEscalate
          ? classification.matchedSignals
          : [],
        allowlistResult: "allowed" as const,
      };
      const policy = evaluateCapabilityFaqPolicy({
        context: policyContext,
        latestMessage: body,
      });
      replyPlan = policy.replyPlan;
      const replyPlanMetadata = {
        flow: replyPlan.flow,
        stage: replyPlan.stage,
        nextStage: replyPlan.nextStage,
        responseKind: policy.response.responseKind,
        suggestedFlow: policy.response.suggestedFlow,
        replyType: policy.response.replyType,
        shouldEscalate: replyPlan.shouldEscalate,
        escalationReason: replyPlan.escalationReason,
        confidence: replyPlan.confidence,
        explanationForAudit: replyPlan.explanationForAudit,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
        twilioMessageSid,
        conversationEngineMode: engineRuntime.mode,
        conversationEngineEffectiveActive: false,
        shadowMode: true,
      };

      logStructuredEvent({
        action: "conversation.capability_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        status: "shadow",
        result: "success",
        requestId: requestCorrelationId(request),
        metadata: replyPlanMetadata,
      });

      await logAudit({
        actorType: "SYSTEM",
        action: "conversation.capability_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        metadata: replyPlanMetadata,
      });
    } else if (shouldPlanContactReply) {
      const policyContext = {
        ...context,
        intent: "CONTACT_REPLY" as const,
        safetyFlags: classification.shouldEscalate
          ? classification.matchedSignals
          : [],
        allowlistResult: "allowed" as const,
      };
      const policy = evaluateContactReplyPolicy({
        context: policyContext,
        latestMessage: body,
      });
      replyPlan = policy.replyPlan;
      const replyPlanMetadata = {
        flow: replyPlan.flow,
        stage: replyPlan.stage,
        nextStage: replyPlan.nextStage,
        replyKind: policy.replyKind,
        currentOutreachStatus: policy.currentOutreachStatus,
        consentToGroupChat: policy.consentToGroupChat,
        hasActiveOutreach: policy.hasActiveOutreach,
        nextQuestion: replyPlan.nextQuestion,
        shouldEscalate: replyPlan.shouldEscalate,
        escalationReason: replyPlan.escalationReason,
        confidence: replyPlan.confidence,
        explanationForAudit: replyPlan.explanationForAudit,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
        twilioMessageSid,
        conversationEngineMode: engineRuntime.mode,
        conversationEngineEffectiveActive: false,
        shadowMode: true,
      };

      logStructuredEvent({
        action: "conversation.contact_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        status: "shadow",
        result: "success",
        requestId: requestCorrelationId(request),
        metadata: replyPlanMetadata,
      });

      await logAudit({
        actorType: "SYSTEM",
        action: "conversation.contact_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        metadata: replyPlanMetadata,
      });

      if (engineRuntime.activeBlockedForProvider) {
        await logAudit({
          actorType: "SYSTEM",
          action: "conversation.engine_active_blocked_for_provider",
          entityType: "Conversation",
          entityId,
          metadata: {
            providerMode: engineRuntime.providerMode,
            conversationEngineMode: engineRuntime.mode,
            reason: engineRuntime.blockedReason,
            twilioMessageSid,
            senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
            flow: "CONTACT_REPLY",
          },
        });
      }
    } else if (shouldPlanOrganizerIntake) {
      const policyContext = {
        ...context,
        intent: classification.intent,
        safetyFlags: classification.shouldEscalate
          ? classification.matchedSignals
          : [],
        allowlistResult: "allowed" as const,
      };
      const policy = evaluateOrganizerIntakePolicy({
        context: policyContext,
        latestMessage: body,
      });
      replyPlan = policy.replyPlan;
      const replyPlanMetadata = {
        flow: replyPlan.flow,
        stage: replyPlan.stage,
        nextStage: replyPlan.nextStage,
        enoughInfoForBrief: replyPlan.enoughInfoForBrief,
        missingRequiredFields: policy.missingRequiredFields,
        missingOptionalFields: policy.missingOptionalFields,
        nextQuestion: replyPlan.nextQuestion,
        shouldEscalate: replyPlan.shouldEscalate,
        escalationReason: replyPlan.escalationReason,
        confidence: replyPlan.confidence,
        explanationForAudit: replyPlan.explanationForAudit,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
        twilioMessageSid,
        conversationEngineMode: engineRuntime.mode,
        conversationEngineEffectiveActive: false,
        activeBlockedForProvider: engineRuntime.activeBlockedForProvider,
        shadowMode: true,
      };

      logStructuredEvent({
        action: "conversation.reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        status: "shadow",
        result: "success",
        requestId: requestCorrelationId(request),
        metadata: replyPlanMetadata,
      });

      await logAudit({
        actorType: "SYSTEM",
        action: "conversation.reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        metadata: replyPlanMetadata,
      });

      if (engineRuntime.activeBlockedForProvider) {
        await logAudit({
          actorType: "SYSTEM",
          action: "conversation.engine_active_blocked_for_provider",
          entityType: "Conversation",
          entityId,
          metadata: {
            providerMode: engineRuntime.providerMode,
            conversationEngineMode: engineRuntime.mode,
            reason: engineRuntime.blockedReason,
            twilioMessageSid,
            senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
          },
        });
      }
    } else if (classification.intent === "GIG_SEEKER_ONBOARDING") {
      const policyContext = {
        ...context,
        intent: classification.intent,
        safetyFlags: classification.shouldEscalate
          ? classification.matchedSignals
          : [],
        allowlistResult: "allowed" as const,
      };
      const policy = evaluateGigSeekerOnboardingPolicy({
        context: policyContext,
        latestMessage: body,
      });
      replyPlan = policy.replyPlan;
      const replyPlanMetadata = {
        flow: replyPlan.flow,
        stage: replyPlan.stage,
        nextStage: replyPlan.nextStage,
        enoughInfoForProfileReview: replyPlan.enoughInfoForProfileReview,
        missingRequiredFields: policy.missingRequiredFields,
        missingOptionalFields: policy.missingOptionalFields,
        nextQuestion: replyPlan.nextQuestion,
        shouldEscalate: replyPlan.shouldEscalate,
        escalationReason: replyPlan.escalationReason,
        confidence: replyPlan.confidence,
        explanationForAudit: replyPlan.explanationForAudit,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
        twilioMessageSid,
        conversationEngineMode: engineRuntime.mode,
        conversationEngineEffectiveActive: false,
        shadowMode: true,
      };

      logStructuredEvent({
        action: "conversation.gig_seeker_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        status: "shadow",
        result: "success",
        requestId: requestCorrelationId(request),
        metadata: replyPlanMetadata,
      });

      await logAudit({
        actorType: "SYSTEM",
        action: "conversation.gig_seeker_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        metadata: replyPlanMetadata,
      });

      if (engineRuntime.activeBlockedForProvider) {
        await logAudit({
          actorType: "SYSTEM",
          action: "conversation.engine_active_blocked_for_provider",
          entityType: "Conversation",
          entityId,
          metadata: {
            providerMode: engineRuntime.providerMode,
            conversationEngineMode: engineRuntime.mode,
            reason: engineRuntime.blockedReason,
            twilioMessageSid,
            senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
            flow: "GIG_SEEKER_ONBOARDING",
          },
        });
      }
    } else if (classification.intent === "INTEREST_CHECK") {
      const policyContext = {
        ...context,
        intent: classification.intent,
        safetyFlags: classification.shouldEscalate
          ? classification.matchedSignals
          : [],
        allowlistResult: "allowed" as const,
      };
      const policy = evaluateInterestCheckPolicy({
        context: policyContext,
        latestMessage: body,
      });
      replyPlan = policy.replyPlan;
      const replyPlanMetadata = {
        flow: replyPlan.flow,
        stage: replyPlan.stage,
        nextStage: replyPlan.nextStage,
        enoughInfoForInterestCheck: replyPlan.enoughInfoForInterestCheck,
        missingRequiredFields: policy.missingRequiredFields,
        missingOptionalFields: policy.missingOptionalFields,
        nextQuestion: replyPlan.nextQuestion,
        shouldEscalate: replyPlan.shouldEscalate,
        escalationReason: replyPlan.escalationReason,
        confidence: replyPlan.confidence,
        explanationForAudit: replyPlan.explanationForAudit,
        ambiguityNotes: policy.ambiguityNotes,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
        twilioMessageSid,
        conversationEngineMode: engineRuntime.mode,
        conversationEngineEffectiveActive: false,
        shadowMode: true,
      };

      logStructuredEvent({
        action: "conversation.interest_check_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        status: "shadow",
        result: "success",
        requestId: requestCorrelationId(request),
        metadata: replyPlanMetadata,
      });

      await logAudit({
        actorType: "SYSTEM",
        action: "conversation.interest_check_reply_plan_shadowed",
        entityType: "Conversation",
        entityId,
        metadata: replyPlanMetadata,
      });

      if (engineRuntime.activeBlockedForProvider) {
        await logAudit({
          actorType: "SYSTEM",
          action: "conversation.engine_active_blocked_for_provider",
          entityType: "Conversation",
          entityId,
          metadata: {
            providerMode: engineRuntime.providerMode,
            conversationEngineMode: engineRuntime.mode,
            reason: engineRuntime.blockedReason,
            twilioMessageSid,
            senderRedacted: redactPhoneForDisplay(context.normalizedPhone),
            flow: "INTEREST_CHECK",
          },
        });
      }
    }

    return { classification, replyPlan };
  } catch (error) {
    const metadata = {
      providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
      senderRedacted: redactPhoneForDisplay(from),
      twilioMessageSid,
      shadowMode: true,
      error: error instanceof Error ? error.message : "Unknown intent error",
    };

    await logAudit({
      actorType: "SYSTEM",
      action: "conversation.intent_classification_failed",
      entityType: "Conversation",
      entityId: "shadow",
      metadata,
    });

    logServerError("Conversation intent shadow classification failed", error, {
      entityType: "Conversation",
      entityId: "shadow",
      requestId: requestCorrelationId(request),
      metadata: {
        twilioMessageSid,
      },
    });
    return {};
  }
}

async function recordInboundObservation({
  action,
  request,
  from,
  twilioMessageSid,
  status = "ok",
  result = "success",
  metadata = {},
}: {
  action: string;
  request?: Request;
  from?: string | null;
  twilioMessageSid?: string | null;
  status?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}) {
  const eventMetadata = compactMetadata({
    route: inboundRoute,
    from,
    twilioMessageSid,
    providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
    ...metadata,
  });

  logStructuredEvent({
    level: result === "failure" ? "warn" : "info",
    action,
    entityType: "Webhook",
    entityId: inboundRoute,
    status,
    result,
    requestId: requestCorrelationId(request),
    metadata: eventMetadata,
  });

  await logAudit({
    actorType: "SYSTEM",
    action,
    entityType: "Webhook",
    entityId: inboundRoute,
    metadata: eventMetadata,
  });
}

async function markBlockedInboundNeedsAdmin({
  from,
  body,
  twilioMessageSid,
  payload,
  accessDecision,
}: {
  from: string;
  body: string;
  twilioMessageSid?: string | null;
  payload: Record<string, string>;
  accessDecision?: Record<string, unknown>;
}) {
  const phone = normalizePhone(from);
  const user = await findOrCreateUser(phone);
  const projectBrief = await findOrCreateActiveProject(user);
  const safety = inboundSafetyMetadata("blocked");

  const message = await createInboundMessage({
    body,
    channel: "SMS",
    userId: user.id,
    projectBriefId: projectBrief.id,
    twilioMessageSid,
    metadata: {
      ...payload,
      allowlistBlocked: true,
      inboundSafety: safety,
      reason: "inbound_sender_not_allowlisted",
      blockReason: "non_allowlisted",
      accessDecision,
      replyBlocked: true,
    },
  });

  await upsertInboundProcessingJob({
    inboundMessageId: message.id,
    inboundTwilioMessageSid: twilioMessageSid,
    projectBriefId: projectBrief.id,
    userId: user.id,
    normalizedSender: phone,
    processingMode: getMessageProcessingMode(),
    status: "BLOCKED",
    errorCategory: "allowlist_blocked",
    resultSummary: {
      allowlistBlocked: true,
      accessDecision,
      noSmsSentByPipeline: true,
      noDuplicateSideEffects: true,
    },
  });

  await getDb().projectBrief.update({
    where: { id: projectBrief.id },
    data: {
      previousStatus:
        projectBrief.status === "NEEDS_ADMIN"
          ? projectBrief.previousStatus
          : projectBrief.status,
      status: "NEEDS_ADMIN",
      escalationReason: "inbound_sender_not_allowlisted",
      escalationFlags: ["sms_allowlist"],
      escalationResolvedAt: null,
      adminNotes: projectBrief.adminNotes
        ? `${projectBrief.adminNotes}\nEscalated: inbound sender not allowlisted.`
        : "Escalated: inbound sender not allowlisted.",
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "sms.inbound_blocked_allowlist",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    metadata: {
      reason: "inbound_sender_not_allowlisted",
      blockReason: "non_allowlisted",
      allowedNumbersCount: safety.allowedNumbersCount,
      twilioMessageSid,
      accessDecision,
    },
  });

  logStructuredEvent({
    level: "warn",
    action: "sms.inbound_blocked_allowlist",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    status: "blocked",
    result: "success",
    metadata: {
      route: inboundRoute,
      from,
      twilioMessageSid,
      reason: "inbound_sender_not_allowlisted",
      blockReason: "non_allowlisted",
      allowedNumbersCount: safety.allowedNumbersCount,
      accessDecision,
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = formDataToRecord(formData);
  const from = payload.From;
  const body = payload.Body || "";
  const twilioMessageSid =
    payload.MessageSid || payload.SmsMessageSid || payload.SmsSid || null;

  await recordInboundObservation({
    action: "sms.inbound_webhook_received",
    request,
    from,
    twilioMessageSid,
    metadata: {
      hasFrom: Boolean(from),
      hasText: Boolean(body),
      hasSignature: Boolean(request.headers.get("x-twilio-signature")),
    },
  });

  if (!from || !body) {
    await recordInboundObservation({
      action: "sms.inbound_rejected_missing_fields",
      request,
      from,
      twilioMessageSid,
      status: "rejected",
      result: "failure",
      metadata: {
        hasFrom: Boolean(from),
        hasText: Boolean(body),
      },
    });
    return twimlResponse(400);
  }

  try {
    const valid = await validateTwilioWebhookRequest({
      request,
      payload,
      route: inboundRoute,
    });
    if (!valid) {
      await recordInboundObservation({
        action: "sms.inbound_signature_failed",
        request,
        from,
        twilioMessageSid,
        status: "forbidden",
        result: "failure",
        metadata: {
          hasSignature: Boolean(request.headers.get("x-twilio-signature")),
        },
      });
      return forbiddenTwilioResponse();
    }

    await recordInboundObservation({
      action: "sms.inbound_signature_passed",
      request,
      from,
      twilioMessageSid,
      metadata: {
        validationRequired: process.env.TWILIO_VALIDATE_WEBHOOKS !== "false",
      },
    });

    if (
      shouldSkipDuplicateTwilioMessageSid({
        twilioMessageSid,
        exists: twilioMessageSid
          ? await messageExistsForTwilioSid(twilioMessageSid)
          : false,
      })
    ) {
      await recordInboundProcessingDuplicate({
        inboundTwilioMessageSid: twilioMessageSid,
        normalizedSender: normalizePhone(from),
        processingMode: getMessageProcessingMode(),
      });
      await recordInboundObservation({
        action: "sms.inbound_duplicate_skipped",
        request,
        from,
        twilioMessageSid,
        status: "duplicate",
        metadata: {},
      });
      return twimlResponse();
    }

    const accessResult = await evaluateAndApplyInboundAccess({
      from,
      body,
      twilioMessageSid,
    });
    const safeAccessDecision = safeAccessDecisionForAudit(accessResult.decision);
    const blockedByAllowlist = !accessResult.decision.allowed;
    await recordInboundObservation({
      action: "sms.inbound_allowlist_checked",
      request,
      from,
      twilioMessageSid,
      status: blockedByAllowlist ? "blocked" : "allowed",
      metadata: {
        ...inboundSafetyMetadata(blockedByAllowlist ? "blocked" : "allowed"),
        accessStatus: accessResult.decision.accessStatus,
        accessMode: safeAccessDecision.accessMode,
        cohort: accessResult.decision.cohort,
        publicBetaAccessEvaluated: true,
      },
    });

    if (blockedByAllowlist) {
      await markBlockedInboundNeedsAdmin({
        from,
        body,
        twilioMessageSid,
        payload,
        accessDecision: safeAccessDecision,
      });
      return twimlResponse();
    }

    if (getMessageProcessingMode() === "async_active") {
      const phone = normalizePhone(from);
      const user = await findOrCreateUser(phone);
      const projectBrief = await findOrCreateActiveProject(user);
      const message = await createInboundMessage({
        body,
        channel: "SMS",
        userId: user.id,
        projectBriefId: projectBrief.id,
        twilioMessageSid,
        metadata: {
          ...payload,
          inboundSafety: inboundSafetyMetadata("allowed"),
          accessDecision: safeAccessDecision,
          messageProcessingMode: "async_active",
          queuedOnly: true,
        },
      });
      await upsertInboundProcessingJob({
        inboundMessageId: message.id,
        inboundTwilioMessageSid: twilioMessageSid,
        projectBriefId: projectBrief.id,
        userId: user.id,
        normalizedSender: phone,
        processingMode: "async_active",
        status: "PENDING",
        resultSummary: {
          queuedOnly: true,
          routeReturnedQuickly: true,
          noSmsSentByPipeline: true,
        },
      });
      await recordInboundObservation({
        action: "sms.inbound_enqueued_async_active",
        request,
        from,
        twilioMessageSid,
        metadata: {
          messageProcessingMode: "async_active",
          queuedOnly: true,
        },
      });
      return twimlResponse();
    }

    await recordConversationIntentShadow({
      request,
      from,
      body,
      twilioMessageSid,
    });

    const contactResult = await handleContactInbound({
      from,
      body,
      twilioMessageSid,
      metadata: {
        ...payload,
        inboundSafety: inboundSafetyMetadata("allowed"),
        accessDecision: safeAccessDecision,
      },
    });

    if (!contactResult.handled) {
      const llmExecution = resolveLlmExecutionContext({
        surface: "twilio_inbound",
        providerMode: "TWILIO",
        conversationEngineMode: "shadow",
        sendsDisabled: getSmsSafetyConfig({ providerMode: "TWILIO" })
          .sendsDisabled,
        dryRun: false,
      });
      const organizerResult = await handleOrganizerInbound({
        from,
        body,
        twilioMessageSid,
        conversationReplyPlan: null,
        llmExecutionContext: llmExecution.executionContext,
        llmExecutionContextDetails: llmExecution.details,
        metadata: {
          ...payload,
          inboundSafety: inboundSafetyMetadata("allowed"),
          accessDecision: safeAccessDecision,
        },
      });
      await recordInboundObservation({
        action: "sms.inbound_processed",
        request,
        from,
        twilioMessageSid,
        metadata: {
          handler: "organizer",
          optedOut: Boolean(organizerResult.optedOut),
          optedOutBeforeInbound: Boolean(organizerResult.optedOutBeforeInbound),
          replyAttempted: Boolean(organizerResult.sent),
          replyBlocked: Boolean(organizerResult.replyBlocked),
          blockReason: organizerResult.blockReason || null,
        },
      });
      await recordPipelineJobForPersistedInbound({
        twilioMessageSid,
        from,
        handler: "organizer",
        resultSummary: {
          optedOut: Boolean(organizerResult.optedOut),
          replyAttempted: Boolean(organizerResult.sent),
          replyBlocked: Boolean(organizerResult.replyBlocked),
          blockReason: organizerResult.blockReason || null,
        },
      });
    } else {
      await recordInboundObservation({
        action: "sms.inbound_processed",
        request,
        from,
        twilioMessageSid,
        metadata: {
          handler: "contact",
          optedOut: Boolean(contactResult.optedOut),
          optedOutBeforeInbound: Boolean(contactResult.optedOutBeforeInbound),
          replyAttempted: Boolean(contactResult.sent),
          replyBlocked: Boolean(contactResult.replyBlocked),
          blockReason: contactResult.blockReason || null,
        },
      });
      await recordPipelineJobForPersistedInbound({
        twilioMessageSid,
        from,
        handler: "contact",
        resultSummary: {
          optedOut: Boolean(contactResult.optedOut),
          replyAttempted: Boolean(contactResult.sent),
          replyBlocked: Boolean(contactResult.replyBlocked),
          blockReason: contactResult.blockReason || null,
        },
      });
    }

    return twimlResponse();
  } catch (error) {
    await recordInboundObservation({
      action: "sms.inbound_failed",
      request,
      from,
      twilioMessageSid,
      status: "error",
      result: "failure",
      metadata: {
        errorCategory: error instanceof Error ? error.name : "UnknownError",
      },
    });
    logServerError("Twilio inbound webhook failed", error, {
      entityType: "Webhook",
      entityId: inboundRoute,
      requestId: requestCorrelationId(request),
      metadata: {
        twilioMessageSid,
      },
    });
    return twimlResponse(500);
  }
}
