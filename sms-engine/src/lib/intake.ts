import type { ConversationProvider, Prisma, ProjectBrief, User } from "@prisma/client";
import type {
  OrganizerGeneratedReply,
  ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import { createInboundMessage, sendSmsMessage } from "@/lib/messages";
import { extractBriefFields, generateIntakeReply } from "@/lib/producerAgent";
import {
  afterBriefReadyReply,
  activeProjectStatuses,
  finalIntakeReply,
  mergeBriefPatch,
  nextStatusAfterIntake,
  type BriefPatch,
} from "@/lib/workflow";
import {
  assessMessageSafety,
  escalationHoldingReply,
  optInReply,
  optOutReply,
} from "@/lib/safety";
import { isStartMessage, isStopMessage, normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import { enforceOrganizerRateLimit } from "@/lib/rateLimit";
import { logLlmFallbackUsed } from "@/lib/llmAudit";
import { ensureProjectForProjectBrief } from "@/lib/networkBridge";
import {
  assertProjectBriefStatusTransition,
  logWorkflowTransition,
} from "@/lib/workflowStateMachine";
import type {
  LlmExecutionContext,
  LlmExecutionContextDetails,
} from "@/lib/llm/llmProvider";

type InboundOrganizerInput = {
  from: string;
  body: string;
  twilioMessageSid?: string | null;
  metadata?: Record<string, unknown>;
  provider?: ConversationProvider;
  conversationReplyPlan?: ReplyPlan | null;
  conversationGeneratedReply?: OrganizerGeneratedReply | null;
  conversationPolicyMetadata?: {
    intent?: string;
    missingRequiredFields?: string[];
    missingOptionalFields?: string[];
  } | null;
  llmExecutionContext?: LlmExecutionContext;
  llmExecutionContextDetails?: Partial<LlmExecutionContextDetails>;
};

function conversationReplyLlmMetadata(
  reply?: OrganizerGeneratedReply | null,
): Record<string, unknown> {
  if (!reply) return {};
  return {
    conversationReplySourceDetail: reply.metadata.replySourceDetail,
    llmOperation: reply.metadata.llmOperation,
    llmOperationUnavailable: reply.metadata.llmOperationUnavailable,
    llmMode: reply.metadata.llmMode,
    llmExecutionSurface: reply.metadata.llmExecutionSurface,
    llmValidationPassed: reply.metadata.llmValidationPassed,
    llmFallbackUsed: reply.metadata.llmFallbackUsed,
    llmFallbackReason: reply.metadata.llmFallbackReason,
    forbiddenClaimsDetected: reply.metadata.forbiddenClaimsDetected,
  };
}

function cleanExtractedPatch(
  extracted: Awaited<ReturnType<typeof extractBriefFields>>,
): BriefPatch {
  return {
    firstTimeHost: extracted.firstTimeHost ?? undefined,
    city: extracted.city ?? undefined,
    projectType: extracted.projectType ?? undefined,
    title: extracted.title ?? undefined,
    description: extracted.description ?? undefined,
    targetDate: extracted.targetDate ?? undefined,
    budgetRange: extracted.budgetRange ?? undefined,
    expectedAudienceSize: extracted.expectedAudienceSize ?? undefined,
    scope: extracted.scope ?? undefined,
    vibe: extracted.vibe ?? undefined,
    helpNeeded: extracted.helpNeeded ?? undefined,
  };
}

export async function findOrCreateUser(phone: string) {
  return getDb().user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

export async function findOrCreateActiveProject(user: User) {
  const db = getDb();
  const existing = await db.projectBrief.findFirst({
    where: {
      userId: user.id,
      status: { in: activeProjectStatuses },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  const created = await db.projectBrief.create({
    data: {
      userId: user.id,
      status: "NEW_INBOUND",
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "project.created_from_sms",
    entityType: "ProjectBrief",
    entityId: created.id,
    metadata: { phone: user.phone },
  });

  return created;
}

async function markNeedsAdmin({
  projectBrief,
  reason,
  flags,
}: {
  projectBrief: ProjectBrief;
  reason: string;
  flags?: string[];
}) {
  assertProjectBriefStatusTransition(projectBrief.status, "NEEDS_ADMIN");
  await getDb().projectBrief.update({
    where: { id: projectBrief.id },
    data: {
      previousStatus:
        projectBrief.status === "NEEDS_ADMIN"
          ? projectBrief.previousStatus
          : projectBrief.status,
      status: "NEEDS_ADMIN",
      escalationReason: reason,
      escalationFlags: flags || [],
      escalationResolvedAt: null,
      adminNotes: projectBrief.adminNotes
        ? `${projectBrief.adminNotes}\nEscalated: ${reason}`
        : `Escalated: ${reason}`,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "project.escalated",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    metadata: { reason, flags },
  });
}

export async function handleOrganizerInbound(input: InboundOrganizerInput) {
  const phone = normalizePhone(input.from);
  let user = await findOrCreateUser(phone);

  if (isStopMessage(input.body)) {
    const optedOutBeforeInbound = Boolean(user.smsOptedOutAt);
    user = await getDb().user.update({
      where: { id: user.id },
      data: { smsOptedOutAt: new Date() },
    });

    const projectBrief = await findOrCreateActiveProject(user);
    await createInboundMessage({
      body: input.body,
      channel: "SMS",
      userId: user.id,
      projectBriefId: projectBrief.id,
      twilioMessageSid: input.twilioMessageSid,
      metadata: {
        ...input.metadata,
        optOut: true,
        optedOutBeforeInbound,
        replyBlocked: true,
        blockReason: "opted_out",
      },
    });

    await logAudit({
      actorType: "USER",
      action: "sms.opted_out",
      entityType: "User",
      entityId: user.id,
      metadata: { phone },
    });

    return {
      reply: optOutReply(),
      sent: false,
      optedOut: true,
      optedOutBeforeInbound,
      replyBlocked: true,
      blockReason: "opted_out",
    };
  }

  if (isStartMessage(input.body) && user.smsOptedOutAt) {
    user = await getDb().user.update({
      where: { id: user.id },
      data: { smsOptedOutAt: null },
    });
    const projectBrief = await findOrCreateActiveProject(user);
    await createInboundMessage({
      body: input.body,
      channel: "SMS",
      userId: user.id,
      projectBriefId: projectBrief.id,
      twilioMessageSid: input.twilioMessageSid,
      metadata: {
        ...input.metadata,
        optIn: true,
        optedOutBeforeInbound: true,
      },
    });

    await logAudit({
      actorType: "USER",
      action: "sms.opted_in",
      entityType: "User",
      entityId: user.id,
      metadata: { phone },
    });

    const reply = optInReply();
    await sendSmsMessage({
      to: phone,
      body: reply,
      userId: user.id,
      projectBriefId: projectBrief.id,
      provider: input.provider,
      metadata: {
        generatedBy: "system",
        reason: "opt_in",
        inboundTwilioMessageSid: input.twilioMessageSid,
      },
    });
    return {
      reply,
      sent: true,
      optedOut: false,
      optedOutBeforeInbound: true,
      replyBlocked: false,
      blockReason: null,
    };
  }

  const projectBrief = await findOrCreateActiveProject(user);
  await createInboundMessage({
    body: input.body,
    channel: "SMS",
    userId: user.id,
    projectBriefId: projectBrief.id,
    twilioMessageSid: input.twilioMessageSid,
    metadata: {
      ...(input.metadata || {}),
      optedOutBeforeInbound: Boolean(user.smsOptedOutAt),
      replyBlocked: Boolean(user.smsOptedOutAt),
      blockReason: user.smsOptedOutAt ? "opted_out" : undefined,
    } as Prisma.InputJsonValue,
  });

  if (user.smsOptedOutAt) {
    return {
      reply: null,
      sent: false,
      optedOut: true,
      optedOutBeforeInbound: true,
      replyBlocked: true,
      blockReason: "opted_out",
    };
  }

  const rateLimit = await enforceOrganizerRateLimit({ user, projectBrief });
  if (rateLimit.limited) {
    return {
      reply: null,
      sent: false,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: true,
      blockReason: "rate_limit",
    };
  }

  const deterministicSafety = assessMessageSafety(input.body);
  if (deterministicSafety.needsAdmin) {
    await markNeedsAdmin({
      projectBrief,
      reason: "deterministic_safety",
      flags: deterministicSafety.flags,
    });

    const reply = escalationHoldingReply();
    await sendSmsMessage({
      to: phone,
      body: reply,
      userId: user.id,
      projectBriefId: projectBrief.id,
      provider: input.provider,
      metadata: {
        generatedBy: "system",
        reason: "safety_escalation",
        flags: deterministicSafety.flags,
        inboundTwilioMessageSid: input.twilioMessageSid,
      },
    });

    return {
      reply,
      sent: true,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: false,
      blockReason: null,
    };
  }

  const llmExecution = {
    executionContext: input.llmExecutionContext,
    executionContextDetails: input.llmExecutionContextDetails,
  };
  const extracted = await extractBriefFields(
    projectBrief,
    input.body,
    llmExecution,
  );
  await logLlmFallbackUsed({
    operation: "extractBriefFields",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
  });
  if (extracted.needsAdmin || extracted.confidence < 0.35) {
    await markNeedsAdmin({
      projectBrief,
      reason:
        extracted.confidence < 0.35
          ? "llm_low_confidence"
          : "llm_safety_flag",
      flags: extracted.safetyFlags,
    });

    const reply = escalationHoldingReply();
    await sendSmsMessage({
      to: phone,
      body: reply,
      userId: user.id,
      projectBriefId: projectBrief.id,
      provider: input.provider,
      metadata: {
        generatedBy: "system",
        reason: "llm_escalation",
        confidence: extracted.confidence,
        flags: extracted.safetyFlags,
        inboundTwilioMessageSid: input.twilioMessageSid,
      },
    });

    return {
      reply,
      sent: true,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: false,
      blockReason: null,
    };
  }

  const patch = cleanExtractedPatch(extracted);
  const completedFirstTime =
    user.hasCompletedFirstTimeHostQuestion || patch.firstTimeHost !== undefined;

  const projectedUser = {
    ...user,
    hasCompletedFirstTimeHostQuestion: completedFirstTime,
  };
  const projectedBrief = mergeBriefPatch(projectBrief, patch);
  const nextStatus = nextStatusAfterIntake(projectedBrief, projectedUser);
  const wasReady = projectBrief.status === "BRIEF_READY_FOR_REVIEW";
  assertProjectBriefStatusTransition(projectBrief.status, nextStatus);

  user = await getDb().user.update({
    where: { id: user.id },
    data: {
      hasCompletedFirstTimeHostQuestion: completedFirstTime,
    },
  });

  const updatedBrief = await getDb().projectBrief.update({
    where: { id: projectBrief.id },
    data: {
      ...patch,
      status: nextStatus,
    },
  });

  await logWorkflowTransition({
    action: "project_brief.status_transitioned",
    entityType: "ProjectBrief",
    entityId: updatedBrief.id,
    fromStatus: projectBrief.status,
    toStatus: nextStatus,
    metadata: { reason: "intake" },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "project.intake_updated",
    entityType: "ProjectBrief",
    entityId: updatedBrief.id,
    metadata: {
      patch,
      status: nextStatus,
      extractionConfidence: extracted.confidence,
    },
  });

  if (nextStatus === "BRIEF_READY_FOR_REVIEW") {
    await ensureProjectForProjectBrief(updatedBrief.id);
  }

  let reply =
    nextStatus === "BRIEF_READY_FOR_REVIEW" && wasReady
      ? afterBriefReadyReply()
      : finalIntakeReply();

  if (
    nextStatus !== "BRIEF_READY_FOR_REVIEW" &&
    !input.conversationGeneratedReply
  ) {
    const generated = await generateIntakeReply(
      updatedBrief,
      input.body,
      user,
      llmExecution,
    );
    await logLlmFallbackUsed({
      operation: "generateIntakeReply",
      entityType: "ProjectBrief",
      entityId: updatedBrief.id,
      metadata: { status: nextStatus },
    });
    if (generated.needsAdmin || generated.confidence < 0.35) {
      await markNeedsAdmin({
        projectBrief: updatedBrief,
        reason: "reply_low_confidence_or_safety",
        flags: generated.reason ? [generated.reason] : [],
      });
      reply = escalationHoldingReply();
    } else {
      reply = generated.message;
    }
  }

  if (input.conversationGeneratedReply) {
    reply = input.conversationGeneratedReply.replyText;
  }

  await sendSmsMessage({
    to: phone,
    body: reply,
    userId: user.id,
    projectBriefId: updatedBrief.id,
    provider: input.provider,
    metadata: {
      generatedBy: input.conversationGeneratedReply
        ? "conversation_engine"
        : "producerAgent",
      conversationEngineActive: Boolean(input.conversationReplyPlan),
      conversationReplyType: input.conversationGeneratedReply?.replyType,
      conversationReplySource: input.conversationGeneratedReply?.source,
      ...conversationReplyLlmMetadata(input.conversationGeneratedReply),
      projectStatus: nextStatus,
      inboundTwilioMessageSid: input.twilioMessageSid,
    },
  });

  if (input.conversationReplyPlan && input.conversationGeneratedReply) {
    await logAudit({
      actorType: "SYSTEM",
      action: "conversation.reply_plan_applied",
      entityType: "ProjectBrief",
      entityId: updatedBrief.id,
      metadata: {
        flow: input.conversationReplyPlan.flow,
        intent: input.conversationPolicyMetadata?.intent,
        stage: input.conversationReplyPlan.stage,
        nextStage: input.conversationReplyPlan.nextStage,
        replyType: input.conversationGeneratedReply.replyType,
        source: input.conversationGeneratedReply.source,
        ...conversationReplyLlmMetadata(input.conversationGeneratedReply),
        enoughInfoForBrief: input.conversationReplyPlan.enoughInfoForBrief,
        missingRequiredFields:
          input.conversationPolicyMetadata?.missingRequiredFields || [],
        missingOptionalFields:
          input.conversationPolicyMetadata?.missingOptionalFields || [],
        confidence: input.conversationReplyPlan.confidence,
        senderRedacted: redactPhoneForDisplay(phone),
      },
    });
  }

  return {
    reply,
    sent: true,
    optedOut: false,
    optedOutBeforeInbound: false,
    replyBlocked: false,
    blockReason: null,
  };
}
