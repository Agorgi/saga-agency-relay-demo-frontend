import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getLlmConfigPresence } from "@/lib/env";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import { loadConversationContext } from "@/lib/conversation/conversationContext";
import { evaluateContactReplyPolicy } from "@/lib/conversation/contactReplyPolicy";
import { evaluateCapabilityFaqPolicy } from "@/lib/conversation/capabilityResponses";
import { evaluateGigSeekerOnboardingPolicy } from "@/lib/conversation/gigSeekerOnboardingPolicy";
import { evaluateInterestCheckPolicy } from "@/lib/conversation/interestCheckPolicy";
import { evaluateOrganizerIntakePolicy } from "@/lib/conversation/organizerIntakePolicy";
import { logStructuredEvent, redactForLog } from "@/lib/safeLogging";

export const messageProcessingModes = [
  "sync",
  "async_shadow",
  "async_active",
] as const;

export type MessageProcessingMode = (typeof messageProcessingModes)[number];

export const inboundProcessingJobStatuses = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED_DUPLICATE",
  "BLOCKED",
] as const;

export type InboundProcessingJobStatus =
  (typeof inboundProcessingJobStatuses)[number];

export const pipelineAuditEvents = {
  created: "pipeline.inbound_job_created",
  deduped: "pipeline.inbound_job_deduped",
  started: "pipeline.inbound_job_started",
  succeeded: "pipeline.inbound_job_succeeded",
  failed: "pipeline.inbound_job_failed",
  retried: "pipeline.inbound_job_retried",
  skippedDuplicate: "pipeline.inbound_job_skipped_duplicate",
  locked: "pipeline.inbound_job_locked",
} as const;

export const pipelineFailureCategories = [
  "signature_failed",
  "duplicate_message_sid",
  "allowlist_blocked",
  "opted_out",
  "llm_provider_failed",
  "llm_validation_failed",
  "db_error",
  "missing_context",
  "safety_blocked",
  "send_blocked",
  "unknown",
] as const;

export type PipelineFailureCategory =
  (typeof pipelineFailureCategories)[number];

const terminalStatuses = new Set<InboundProcessingJobStatus>([
  "SUCCEEDED",
  "SKIPPED_DUPLICATE",
  "BLOCKED",
]);

function cleanMode(value?: string | null): MessageProcessingMode {
  const normalized = (value || "").trim().toLowerCase();
  return messageProcessingModes.includes(normalized as MessageProcessingMode)
    ? (normalized as MessageProcessingMode)
    : "sync";
}

export function getMessageProcessingMode() {
  return cleanMode(process.env.MESSAGE_PROCESSING_MODE);
}

export function getMessageProcessingModeHealth() {
  const configured = process.env.MESSAGE_PROCESSING_MODE || null;
  const mode = getMessageProcessingMode();
  return {
    messageProcessingMode: mode,
    messageProcessingModeConfigured: configured,
    asyncProcessingAvailable: true,
    asyncActiveEnabled: mode === "async_active",
    warnings:
      configured && cleanMode(configured) !== configured.trim().toLowerCase()
        ? ["invalid_message_processing_mode"]
        : [],
  };
}

export function hashNormalizedSender(normalizedSender?: string | null) {
  if (!normalizedSender) return null;
  return createHash("sha256").update(normalizedSender).digest("hex");
}

function redactedErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return String(redactForLog(error.message)).slice(0, 240);
  }
  return String(redactForLog(String(error || "unknown"))).slice(0, 240);
}

function jsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function jobAuditMetadata(input: {
  jobId?: string | null;
  inboundMessageId?: string | null;
  inboundTwilioMessageSid?: string | null;
  status?: string | null;
  attempts?: number | null;
  errorCategory?: string | null;
  processingMode?: string | null;
}) {
  return {
    jobId: input.jobId || null,
    inboundMessageId: input.inboundMessageId || null,
    inboundTwilioMessageSid: input.inboundTwilioMessageSid || null,
    status: input.status || null,
    attempts: input.attempts ?? null,
    errorCategory: input.errorCategory || null,
    processingMode: input.processingMode || null,
  };
}

export type UpsertInboundProcessingJobInput = {
  inboundMessageId?: string | null;
  inboundTwilioMessageSid?: string | null;
  projectBriefId?: string | null;
  userId?: string | null;
  contactId?: string | null;
  normalizedSender?: string | null;
  status?: InboundProcessingJobStatus;
  processingMode?: MessageProcessingMode;
  resultSummary?: Record<string, unknown>;
  errorCategory?: PipelineFailureCategory | null;
  errorMessage?: string | null;
};

export async function upsertInboundProcessingJob(
  input: UpsertInboundProcessingJobInput,
) {
  if (!process.env.DATABASE_URL) return null;

  try {
    const processingMode = input.processingMode || getMessageProcessingMode();
    const status = input.status || "PENDING";
    const normalizedSenderHash = hashNormalizedSender(input.normalizedSender);
    const data = {
      inboundMessageId: input.inboundMessageId || undefined,
      inboundTwilioMessageSid: input.inboundTwilioMessageSid || undefined,
      projectBriefId: input.projectBriefId || undefined,
      userId: input.userId || undefined,
      contactId: input.contactId || undefined,
      normalizedSenderHash: normalizedSenderHash || undefined,
      status,
      processingMode,
      lastErrorCategory: input.errorCategory || undefined,
      lastErrorMessageRedacted: input.errorMessage
        ? String(redactForLog(input.errorMessage)).slice(0, 240)
        : undefined,
      resultSummary: input.resultSummary ? jsonValue(input.resultSummary) : undefined,
      completedAt: ["SUCCEEDED", "SKIPPED_DUPLICATE", "BLOCKED"].includes(status)
        ? new Date()
        : undefined,
    };

    if (input.inboundTwilioMessageSid) {
      const existing = await getDb().inboundProcessingJob.findUnique({
        where: { inboundTwilioMessageSid: input.inboundTwilioMessageSid },
      });

      if (existing) {
        const updated = await getDb().inboundProcessingJob.update({
          where: { id: existing.id },
          data: {
            inboundMessageId:
              existing.inboundMessageId || input.inboundMessageId || undefined,
            projectBriefId:
              existing.projectBriefId || input.projectBriefId || undefined,
            userId: existing.userId || input.userId || undefined,
            contactId: existing.contactId || input.contactId || undefined,
            normalizedSenderHash:
              existing.normalizedSenderHash || normalizedSenderHash || undefined,
            resultSummary:
              input.resultSummary && !existing.resultSummary
                ? jsonValue(input.resultSummary)
                : undefined,
          },
        });
        await logAudit({
          actorType: "SYSTEM",
          action: pipelineAuditEvents.deduped,
          entityType: "InboundProcessingJob",
          entityId: updated.id,
          metadata: jobAuditMetadata({
            jobId: updated.id,
            inboundMessageId: updated.inboundMessageId,
            inboundTwilioMessageSid: updated.inboundTwilioMessageSid,
            status: updated.status,
            attempts: updated.attempts,
            processingMode: updated.processingMode,
          }),
        });
        return updated;
      }
    }

    const created = await getDb().inboundProcessingJob.create({ data });
    await logAudit({
      actorType: "SYSTEM",
      action: pipelineAuditEvents.created,
      entityType: "InboundProcessingJob",
      entityId: created.id,
      metadata: jobAuditMetadata({
        jobId: created.id,
        inboundMessageId: created.inboundMessageId,
        inboundTwilioMessageSid: created.inboundTwilioMessageSid,
        status: created.status,
        attempts: created.attempts,
        processingMode: created.processingMode,
        errorCategory: created.lastErrorCategory,
      }),
    });
    return created;
  } catch (error) {
    logStructuredEvent({
      level: "warn",
      action: "pipeline.inbound_job_create_failed",
      entityType: "InboundProcessingJob",
      entityId: input.inboundTwilioMessageSid || "unknown",
      status: "failed",
      result: "failure",
      metadata: {
        errorCategory: "db_error",
        errorMessage: redactedErrorMessage(error),
      },
    });
    return null;
  }
}

export async function recordInboundProcessingDuplicate(
  input: Pick<
    UpsertInboundProcessingJobInput,
    "inboundTwilioMessageSid" | "normalizedSender" | "processingMode"
  >,
) {
  if (!process.env.DATABASE_URL || !input.inboundTwilioMessageSid) return null;
  const message = await getDb().message.findUnique({
    where: { twilioMessageSid: input.inboundTwilioMessageSid },
    select: {
      id: true,
      projectBriefId: true,
      userId: true,
      contactId: true,
    },
  });
  const job = await upsertInboundProcessingJob({
    inboundMessageId: message?.id || null,
    inboundTwilioMessageSid: input.inboundTwilioMessageSid,
    projectBriefId: message?.projectBriefId || null,
    userId: message?.userId || null,
    contactId: message?.contactId || null,
    normalizedSender: input.normalizedSender,
    processingMode: input.processingMode || getMessageProcessingMode(),
    status: "SKIPPED_DUPLICATE",
    errorCategory: "duplicate_message_sid",
    resultSummary: {
      duplicateTwilioWebhook: true,
      noDuplicateSideEffects: true,
    },
  });

  if (job) {
    await logAudit({
      actorType: "SYSTEM",
      action: pipelineAuditEvents.skippedDuplicate,
      entityType: "InboundProcessingJob",
      entityId: job.id,
      metadata: jobAuditMetadata({
        jobId: job.id,
        inboundMessageId: job.inboundMessageId,
        inboundTwilioMessageSid: job.inboundTwilioMessageSid,
        status: "SKIPPED_DUPLICATE",
        attempts: job.attempts,
        processingMode: job.processingMode,
        errorCategory: "duplicate_message_sid",
      }),
    });
  }
  return job;
}

export async function findInboundMessageForPipeline(
  twilioMessageSid?: string | null,
) {
  if (!process.env.DATABASE_URL || !twilioMessageSid) return null;
  return getDb().message.findUnique({
    where: { twilioMessageSid },
    select: {
      id: true,
      userId: true,
      contactId: true,
      projectBriefId: true,
      body: true,
      twilioMessageSid: true,
      user: { select: { phone: true, smsOptedOutAt: true } },
      contact: { select: { phone: true, smsOptedOutAt: true } },
    },
  });
}

function intentToPolicy(input: {
  intent: string;
  context: Awaited<ReturnType<typeof loadConversationContext>>;
  body: string;
}) {
  if (input.context.activeOutreach || input.intent === "CONTACT_REPLY") {
    const policy = evaluateContactReplyPolicy({
      context: input.context,
      latestMessage: input.body,
    });
    return {
      flow: "CONTACT_REPLY",
      stage: policy.replyPlan.stage,
      nextStage: policy.replyPlan.nextStage,
      shouldEscalate: policy.replyPlan.shouldEscalate,
      confidence: policy.replyPlan.confidence,
      replyKind: policy.replyKind,
    };
  }

  if (input.intent === "CAPABILITY_FAQ" || input.intent === "HELP") {
    const policy = evaluateCapabilityFaqPolicy({
      context: input.context,
      latestMessage: input.body,
    });
    return {
      flow: policy.replyPlan.flow,
      stage: policy.replyPlan.stage,
      nextStage: policy.replyPlan.nextStage,
      shouldEscalate: policy.replyPlan.shouldEscalate,
      confidence: policy.replyPlan.confidence,
      responseKind: policy.response.responseKind,
      suggestedFlow: policy.response.suggestedFlow,
    };
  }

  if (input.intent === "GIG_SEEKER_ONBOARDING") {
    const policy = evaluateGigSeekerOnboardingPolicy({
      context: input.context,
      latestMessage: input.body,
    });
    return {
      flow: "GIG_SEEKER_ONBOARDING",
      stage: policy.replyPlan.stage,
      nextStage: policy.replyPlan.nextStage,
      shouldEscalate: policy.replyPlan.shouldEscalate,
      confidence: policy.replyPlan.confidence,
      missingRequiredFields: policy.missingRequiredFields,
      missingOptionalFields: policy.missingOptionalFields,
    };
  }

  if (input.intent === "INTEREST_CHECK") {
    const policy = evaluateInterestCheckPolicy({
      context: input.context,
      latestMessage: input.body,
    });
    return {
      flow: "INTEREST_CHECK",
      stage: policy.replyPlan.stage,
      nextStage: policy.replyPlan.nextStage,
      shouldEscalate: policy.replyPlan.shouldEscalate,
      confidence: policy.replyPlan.confidence,
      missingRequiredFields: policy.missingRequiredFields,
      missingOptionalFields: policy.missingOptionalFields,
      ambiguityNotes: policy.ambiguityNotes,
    };
  }

  const policy = evaluateOrganizerIntakePolicy({
    context: input.context,
    latestMessage: input.body,
  });
  return {
    flow: policy.replyPlan.flow,
    stage: policy.replyPlan.stage,
    nextStage: policy.replyPlan.nextStage,
    shouldEscalate: policy.replyPlan.shouldEscalate,
    confidence: policy.replyPlan.confidence,
    missingRequiredFields: policy.missingRequiredFields,
    missingOptionalFields: policy.missingOptionalFields,
  };
}

export async function completeInboundProcessingJob(
  jobId: string,
  resultSummary: Record<string, unknown>,
) {
  if (!process.env.DATABASE_URL) return null;
  const job = await getDb().inboundProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      resultSummary: jsonValue(resultSummary),
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastErrorCategory: null,
      lastErrorMessageRedacted: null,
    },
  });
  await logAudit({
    actorType: "SYSTEM",
    action: pipelineAuditEvents.succeeded,
    entityType: "InboundProcessingJob",
    entityId: job.id,
    metadata: jobAuditMetadata({
      jobId: job.id,
      inboundMessageId: job.inboundMessageId,
      inboundTwilioMessageSid: job.inboundTwilioMessageSid,
      status: job.status,
      attempts: job.attempts,
      processingMode: job.processingMode,
    }),
  });
  return job;
}

export async function failInboundProcessingJob(input: {
  jobId: string;
  errorCategory: PipelineFailureCategory;
  error: unknown;
}) {
  if (!process.env.DATABASE_URL) return null;
  const existing = await getDb().inboundProcessingJob.findUnique({
    where: { id: input.jobId },
  });
  const exceeded = existing
    ? existing.attempts >= Math.max(existing.maxAttempts, 1)
    : false;
  const job = await getDb().inboundProcessingJob.update({
    where: { id: input.jobId },
    data: {
      status: exceeded ? "BLOCKED" : "FAILED",
      lockedAt: null,
      lockedBy: null,
      lastErrorCategory: input.errorCategory,
      lastErrorMessageRedacted: redactedErrorMessage(input.error),
      completedAt: exceeded ? new Date() : null,
    },
  });
  await logAudit({
    actorType: "SYSTEM",
    action: pipelineAuditEvents.failed,
    entityType: "InboundProcessingJob",
    entityId: job.id,
    metadata: jobAuditMetadata({
      jobId: job.id,
      inboundMessageId: job.inboundMessageId,
      inboundTwilioMessageSid: job.inboundTwilioMessageSid,
      status: job.status,
      attempts: job.attempts,
      processingMode: job.processingMode,
      errorCategory: input.errorCategory,
    }),
  });
  return job;
}

export async function retryInboundProcessingJob(jobId: string) {
  const job = await getDb().inboundProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      lockedAt: null,
      lockedBy: null,
      runAfter: null,
      lastErrorCategory: null,
      lastErrorMessageRedacted: null,
      completedAt: null,
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: pipelineAuditEvents.retried,
    entityType: "InboundProcessingJob",
    entityId: job.id,
    metadata: jobAuditMetadata({
      jobId: job.id,
      inboundMessageId: job.inboundMessageId,
      inboundTwilioMessageSid: job.inboundTwilioMessageSid,
      status: job.status,
      attempts: job.attempts,
      processingMode: job.processingMode,
    }),
  });
  return job;
}

export async function markInboundProcessingJobSkipped(jobId: string) {
  const job = await getDb().inboundProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "SKIPPED_DUPLICATE",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastErrorCategory: "duplicate_message_sid",
      resultSummary: jsonValue({
        manuallySkipped: true,
        noDuplicateSideEffects: true,
      }),
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: pipelineAuditEvents.skippedDuplicate,
    entityType: "InboundProcessingJob",
    entityId: job.id,
    metadata: jobAuditMetadata({
      jobId: job.id,
      inboundMessageId: job.inboundMessageId,
      inboundTwilioMessageSid: job.inboundTwilioMessageSid,
      status: job.status,
      attempts: job.attempts,
      processingMode: job.processingMode,
      errorCategory: "duplicate_message_sid",
    }),
  });
  return job;
}

export async function processInboundProcessingJob(jobId: string) {
  if (!process.env.DATABASE_URL) {
    return {
      processed: false,
      status: "FAILED" as const,
      errorCategory: "db_error" as const,
      message: "DATABASE_URL is not configured.",
    };
  }

  const existing = await getDb().inboundProcessingJob.findUnique({
    where: { id: jobId },
  });
  if (!existing) {
    return {
      processed: false,
      status: "FAILED" as const,
      errorCategory: "missing_context" as const,
      message: "Job was not found.",
    };
  }
  if (terminalStatuses.has(existing.status as InboundProcessingJobStatus)) {
    return {
      processed: false,
      status: existing.status,
      jobId: existing.id,
      message: "Job is already terminal.",
    };
  }

  const locked = await getDb().inboundProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: `pipeline-${process.pid}`,
    },
  });
  await logAudit({
    actorType: "SYSTEM",
    action: pipelineAuditEvents.locked,
    entityType: "InboundProcessingJob",
    entityId: locked.id,
    metadata: jobAuditMetadata({
      jobId: locked.id,
      inboundMessageId: locked.inboundMessageId,
      inboundTwilioMessageSid: locked.inboundTwilioMessageSid,
      status: locked.status,
      attempts: locked.attempts,
      processingMode: locked.processingMode,
    }),
  });
  await logAudit({
    actorType: "SYSTEM",
    action: pipelineAuditEvents.started,
    entityType: "InboundProcessingJob",
    entityId: locked.id,
    metadata: jobAuditMetadata({
      jobId: locked.id,
      inboundMessageId: locked.inboundMessageId,
      inboundTwilioMessageSid: locked.inboundTwilioMessageSid,
      status: locked.status,
      attempts: locked.attempts,
      processingMode: locked.processingMode,
    }),
  });

  try {
    const inbound = locked.inboundMessageId
      ? await getDb().message.findUnique({
          where: { id: locked.inboundMessageId },
          select: {
            id: true,
            body: true,
            twilioMessageSid: true,
            user: { select: { phone: true, smsOptedOutAt: true } },
            contact: { select: { phone: true, smsOptedOutAt: true } },
          },
        })
      : locked.inboundTwilioMessageSid
        ? await findInboundMessageForPipeline(locked.inboundTwilioMessageSid)
        : null;

    const phone = inbound?.user?.phone || inbound?.contact?.phone || null;
    if (!inbound || !phone) {
      await failInboundProcessingJob({
        jobId,
        errorCategory: "missing_context",
        error: new Error("Inbound message or sender context is missing."),
      });
      return {
        processed: false,
        status: "FAILED" as const,
        errorCategory: "missing_context" as const,
      };
    }

    const context = await loadConversationContext(phone);
    const intent = classifyConversationIntent({
      body: inbound.body,
      context,
    });
    const contextWithIntent = await loadConversationContext(phone, {
      intent: intent.intent,
      safetyFlags: intent.shouldEscalate ? ["intent_router_escalation"] : [],
    });
    const policySummary = intentToPolicy({
      intent: intent.intent,
      context: contextWithIntent,
      body: inbound.body,
    });
    const llm = getLlmConfigPresence();
    const resultSummary = {
      dryRunOnly: true,
      noSmsSent: true,
      noGroupChatCreated: true,
      noCandidateOutreach: true,
      processingMode: locked.processingMode,
      intent: intent.intent,
      suggestedFlow: intent.suggestedFlow,
      confidence: intent.confidence,
      policy: policySummary,
      llm: {
        provider: llm.providerEffective,
        mode: llm.modeEffective,
        shadowMode: llm.shadowMode,
      },
      liveReplyExecution: "not_invoked_by_pipeline_shadow_processor",
    };
    const completed = await completeInboundProcessingJob(jobId, resultSummary);
    return {
      processed: true,
      status: completed?.status || "SUCCEEDED",
      jobId,
      resultSummary,
    };
  } catch (error) {
    await failInboundProcessingJob({
      jobId,
      errorCategory: "unknown",
      error,
    });
    return {
      processed: false,
      status: "FAILED" as const,
      errorCategory: "unknown" as const,
      message: redactedErrorMessage(error),
    };
  }
}

export async function processPendingInboundJobsOnce(limit = 10) {
  if (!process.env.DATABASE_URL) {
    return {
      processed: 0,
      skipped: true,
      reason: "DATABASE_URL is not configured.",
    };
  }
  const now = new Date();
  const jobs = await getDb().inboundProcessingJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 3 },
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
  const results = [];
  for (const job of jobs) {
    results.push(await processInboundProcessingJob(job.id));
  }
  return {
    processed: results.length,
    results,
  };
}

export async function getMessagingPipelineHealthSnapshot() {
  const modeHealth = getMessageProcessingModeHealth();
  if (!process.env.DATABASE_URL) {
    return {
      ...modeHealth,
      queueDepth: null,
      failedJobCount: null,
      databaseAvailable: false,
    };
  }
  try {
    const [queueDepth, failedJobCount] = await Promise.all([
      getDb().inboundProcessingJob.count({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
      }),
      getDb().inboundProcessingJob.count({ where: { status: "FAILED" } }),
    ]);
    return {
      ...modeHealth,
      queueDepth,
      failedJobCount,
      databaseAvailable: true,
    };
  } catch (error) {
    return {
      ...modeHealth,
      queueDepth: null,
      failedJobCount: null,
      databaseAvailable: false,
      warnings: [...modeHealth.warnings, "messaging_pipeline_db_unavailable"],
      errorCategory: "db_error",
      errorMessageRedacted: redactedErrorMessage(error),
    };
  }
}

export async function getMessagingPipelineAdminSnapshot() {
  const health = await getMessagingPipelineHealthSnapshot();
  if (!process.env.DATABASE_URL || !health.databaseAvailable) {
    return {
      ...health,
      counts: {},
      recentJobs: [],
    };
  }
  const [counts, recentJobs] = await Promise.all([
    Promise.all(
      inboundProcessingJobStatuses.map(async (status) => [
        status,
        await getDb().inboundProcessingJob.count({ where: { status } }),
      ]),
    ),
    getDb().inboundProcessingJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        inboundMessageId: true,
        inboundTwilioMessageSid: true,
        projectBriefId: true,
        userId: true,
        contactId: true,
        status: true,
        processingMode: true,
        attempts: true,
        maxAttempts: true,
        lockedAt: true,
        runAfter: true,
        lastErrorCategory: true,
        lastErrorMessageRedacted: true,
        resultSummary: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
  ]);

  return {
    ...health,
    counts: Object.fromEntries(counts),
    recentJobs,
  };
}
