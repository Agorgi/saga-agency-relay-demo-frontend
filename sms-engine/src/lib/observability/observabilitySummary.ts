import type { MessageDirection, PrismaClient } from "@prisma/client";
import { getPublicBetaAccessHealthSnapshot } from "@/lib/access/accessControl";
import { getDb } from "@/lib/db";
import { getDeploymentInfo, getTwilioConfigPresence } from "@/lib/env";
import { safeLlmHealth } from "@/lib/llm/llmProvider";
import { getLaunchDrillHealthSnapshot } from "@/lib/launchDrill/launchReadinessDrill";
import { getMessagingPipelineHealthSnapshot } from "@/lib/messagingPipeline";
import { getDesignPartnerPilotReadinessSnapshot } from "@/lib/pilotReadiness";
import { getPilotDataOpsHealthSnapshot } from "@/lib/dataOps/pilotExport";
import { evaluateCappedPublicBetaReadiness } from "@/lib/publicBeta/publicBetaAdmission";
import { getCappedPublicBetaConfig } from "@/lib/publicBeta/publicBetaConfig";
import { getPublicBetaWaitlistHealthSnapshot } from "@/lib/publicBeta/publicBetaWaitlist";
import {
  getBetaCohortSimulationHealthSnapshot,
} from "@/lib/cohortSimulation/runCohortSimulation";
import { getTalentDiscoveryHealthSnapshot } from "@/lib/sourcing/talentDiscoveryHealth";
import { getTalentResearchQualityHealthSnapshot } from "@/lib/sourcing/talentResearchQuality";
import { getCandidateGraphHealthSnapshot } from "@/lib/graph/candidateGraphHealth";
import { getMatchingEvaluationHealthSnapshot } from "@/lib/matchingEval/matchingEvaluationHealth";
import type {
  BetaCohortSimulationHealthSnapshot,
} from "@/lib/cohortSimulation/cohortTypes";
import { getSmsSafetyHealth } from "@/lib/smsSafety";
import { redactForLog } from "@/lib/safeLogging";
import {
  evaluateObservabilityRisk,
  type ObservabilityRiskResult,
} from "@/lib/observability/observabilityInvariants";

type CountMap = Record<string, number>;

export type ObservabilitySummary = {
  generatedAt: string;
  environment: ReturnType<typeof getDeploymentInfo>;
  app: {
    ok: boolean;
    database: string;
    appBaseUrlConfigured: boolean;
    adminConfigured: boolean;
    internalApiConfigured: boolean;
  };
  sms: {
    providerMode: string;
    sendsDisabled: boolean;
    allowlistRequired: boolean;
    allowedNumbersCount: number;
    twilioStagingMode: boolean;
    webhookValidationEnabled: boolean;
    smsComplianceApproved: boolean;
    publicLaunchEnabled: boolean;
    dailySendCount: number;
    autonomousReplyDailyCount: number;
    recentInboundCount: number;
    recentOutboundCount: number;
    recentBlockedSendCount: number;
    unexpectedOutboundDetected: boolean;
  };
  llm: {
    providerEffective: string;
    modeEffective: string;
    model: string;
    shadowMode: boolean;
    activeMockAvailable: boolean;
    activeLiveAllowed: boolean;
    recentCallCount: number;
    recentSuccessCount: number;
    recentFailureCount: number;
    recentFallbackCount: number;
    fallbackRate: number;
    topFailureCategories: CountMap;
  };
  conversation: {
    recentIntentClassifications: number;
    recentReplyPlans: number;
    needsAdminCount: number;
    flowCounts: CountMap;
  };
  producer: {
    recentProjectUnderstandingCount: number;
    recentRoleMapCount: number;
    recentCandidateRecommendationCount: number;
    recentShortlistDraftCount: number;
    recentDraftReadinessCount: number;
  };
  pipeline: {
    messageProcessingMode: string;
    pendingJobs: number | null;
    processingJobs: number | null;
    succeededJobs: number | null;
    failedJobs: number | null;
    retryableJobs: number | null;
    oldestPendingJobAgeSeconds: number | null;
  };
  pilot: {
    pilotStage: string;
    pilotReplyMode: string;
    accessMode: string;
    accessModeEffective: string;
    publicBetaEnabled: boolean;
    activeParticipants: number;
    pausedParticipants: number;
    optedOutParticipants: number;
    waitlistedParticipants: number | null;
    recentFeedbackCount: number;
    capUsage: {
      active: number | null;
      max: number;
    };
    recentBlockedInboundCount: number | null;
    inviteCodeCount: number | null;
    designPartnerReadiness: {
      sendReadinessAvailable: boolean;
      outboundSelfTestReadinessAvailable: boolean;
      publicLaunchEnabled: boolean;
      autoRepliesEnabled: boolean;
      complianceApproved: boolean;
      allowedNumbersCount: number;
    };
  };
  dataOps: {
    pilotDataOpsAvailable: boolean;
    exportCountRecent: number | null;
    redactionCountRecent: number | null;
    participantsPausedCount: number | null;
    participantsOptedOutCount: number | null;
    dataOpsWarnings: string[];
    backupChecklistStatus: string;
    retentionPolicyExists: boolean;
    incidentRunbookExists: boolean;
  };
  launchDrill: {
    launchDrillAvailable: boolean;
    currentRecommendedLaunchStage: string;
    launchRiskLevel: string;
    launchBlockerCount: number;
    lastLaunchDrillRunAt: string | null;
    designPartnerLaunchReady: boolean;
    publicBetaCandidateReady: boolean;
  };
  publicBeta: {
    publicBetaWaitlistCount: number | null;
    publicBetaAdmittedCount: number | null;
    publicBetaPausedCount: number | null;
    publicBetaRejectedCount: number | null;
    publicBetaCapUsage: {
      admitted: number | null;
      max: number;
    };
    publicBetaDailyNewUserCount: number | null;
    publicBetaReadiness: boolean;
    publicBetaBlockerCount: number;
    publicBetaPublicNumberVisible: boolean;
  };
  betaCohortSimulation: Pick<
    BetaCohortSimulationHealthSnapshot,
    | "betaCohortSimulationAvailable"
    | "simulationRiskLevel"
    | "simulationBlockerCount"
    | "designPartnerSimulationReady"
    | "privateBetaSimulationReady"
    | "publicBetaSimulationReady"
    | "overCapacitySimulationReady"
    | "latestRunAt"
  >;
  talentDiscovery: {
    talentDiscoveryAvailable: boolean;
    recentInternalSearchCount: number | null;
    recentSourcingPlanCount: number | null;
    recentPublicResearchPlanCount: number | null;
    publicWebResearchShadowAvailable: boolean;
    publicWebResearchLiveDryRunAvailable: boolean;
    publicWebResearchAsyncAvailable: boolean;
    publicWebResearchReviewAvailable: boolean;
    publicWebResearchEnabled: boolean;
    publicWebResearchMode: string;
    publicWebResearchProvider: string;
    publicWebResearchRequireCitations: boolean;
    publicWebResearchLiveDryRunAllowed: boolean;
    publicWebResearchMaxResults: number;
    publicWebResearchReady: boolean;
    publicWebResearchBlockerCount: number;
    recentPublicWebResearchRunCount: number | null;
    recentPublicWebLiveDryRunCount: number | null;
    publicWebResearchLastRunAt: string | null;
    publicWebResearchLastRunStatus: string | null;
    publicWebResearchLastCitationCount: number | null;
    publicWebResearchLastResultCount: number | null;
    publicWebResearchPendingJobCount: number | null;
    publicWebResearchFailedJobCount: number | null;
    publicWebResultsPendingReviewCount: number | null;
    publicWebResearchPendingReviewCount: number | null;
    publicWebPendingReviewCount: number | null;
    publicWebNeedsMoreResearchCount: number | null;
    publicWebNeedsMoreContactResearchCount: number | null;
    publicWebDiscardedCount: number | null;
    publicWebDuplicateCount: number | null;
    publicWebDoNotContactCount: number | null;
    publicWebSourceQualityRiskLevel: string;
    publicWebReviewRiskLevel: string;
    publicWebResultsRejectedCount: number | null;
    publicWebResearchRiskLevel: string;
    contactabilityEvidenceAvailable: boolean;
    contactabilityPendingReviewCount: number | null;
    contactabilityHighRiskCount: number | null;
    candidateReviewQueueCount: number | null;
  };
  talentResearchQuality: {
    talentResearchQualityAvailable: boolean;
    pendingTalentQualityReviewCount: number | null;
    approvedTalentQualityReviewCount: number | null;
    needsMoreResearchCount: number | null;
    rejectedTalentCandidateCount: number | null;
    doNotContactCandidateCount: number | null;
    publicWebCandidatesPendingReviewCount: number | null;
    talentQualityRiskLevel: string;
  };
  candidateGraph: {
    candidateGraphAvailable: boolean;
    relationshipAwareMatchingAvailable: boolean;
    candidateSearchProfileCount: number | null;
    graphEdgeCount: number | null;
    unverifiedResearchCandidateCount: number | null;
    doNotContactCandidateCount: number | null;
    publicWebOnlyCandidateCount: number | null;
    recentMatchRunCount: number | null;
    pendingMatchReviewCount: number | null;
    internalCandidateCoverage: number | null;
    publicWebCandidateCoverage: number | null;
    averageCandidateScore: number | null;
    highRiskMatchCount: number | null;
    doNotContactExcludedCount: number | null;
  };
  matchingEvaluation: {
    matchingEvaluationAvailable: boolean;
    lastMatchingEvaluationScore: number | null;
    lastMatchingEvaluationPassed: boolean | null;
    matchingEvaluationFailureCount: number | null;
    matchingEvaluationSafetyViolationCount: number | null;
    matchingEvaluationTuningRecommendationCount: number | null;
  };
  risk: ObservabilityRiskResult;
};

type DbSummary = {
  database: string;
  recentInboundCount: number;
  recentOutboundCount: number;
  recentBlockedSendCount: number;
  autonomousReplyDailyCount: number;
  llmCounts: {
    callStarted: number;
    callSucceeded: number;
    callFailed: number;
    fallbackUsed: number;
    failureCategories: CountMap;
  };
  conversation: ObservabilitySummary["conversation"];
  producer: ObservabilitySummary["producer"];
  pipeline: ObservabilitySummary["pipeline"];
  pilotCounts: Pick<
    ObservabilitySummary["pilot"],
    | "activeParticipants"
    | "pausedParticipants"
    | "optedOutParticipants"
    | "recentFeedbackCount"
  >;
};

const RECENT_WINDOW_HOURS = 24;

function sinceDate(hours = RECENT_WINDOW_HOURS) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function checkDatabase(): Promise<string> {
  if (!process.env.DATABASE_URL) return "not_configured";
  try {
    await getDb().$queryRaw`SELECT 1`;
    return "connected";
  } catch {
    return "error";
  }
}

function increment(map: CountMap, key: string | null | undefined) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function topCounts(map: CountMap, limit = 5) {
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit),
  );
}

async function countMessages(
  db: PrismaClient,
  direction: MessageDirection,
  since: Date,
) {
  return db.message.count({
    where: {
      direction,
      createdAt: { gte: since },
    },
  });
}

async function collectDbSummary(database: string): Promise<DbSummary> {
  const emptyPipeline = {
    messageProcessingMode: "sync",
    pendingJobs: null,
    processingJobs: null,
    succeededJobs: null,
    failedJobs: null,
    retryableJobs: null,
    oldestPendingJobAgeSeconds: null,
  };
  const empty: DbSummary = {
    database,
    recentInboundCount: 0,
    recentOutboundCount: 0,
    recentBlockedSendCount: 0,
    autonomousReplyDailyCount: 0,
    llmCounts: {
      callStarted: 0,
      callSucceeded: 0,
      callFailed: 0,
      fallbackUsed: 0,
      failureCategories: {},
    },
    conversation: {
      recentIntentClassifications: 0,
      recentReplyPlans: 0,
      needsAdminCount: 0,
      flowCounts: {},
    },
    producer: {
      recentProjectUnderstandingCount: 0,
      recentRoleMapCount: 0,
      recentCandidateRecommendationCount: 0,
      recentShortlistDraftCount: 0,
      recentDraftReadinessCount: 0,
    },
    pipeline: emptyPipeline,
    pilotCounts: {
      activeParticipants: 0,
      pausedParticipants: 0,
      optedOutParticipants: 0,
      recentFeedbackCount: 0,
    },
  };

  if (!process.env.DATABASE_URL || database !== "connected") return empty;

  const since = sinceDate();
  const db = getDb();

  try {
    const [
      recentInboundCount,
      recentOutboundCount,
      recentBlockedSendCount,
      autonomousReplyDailyCount,
      llmAuditLogs,
      conversationAuditLogs,
      needsAdminCount,
      producerAuditLogs,
      pendingJobs,
      processingJobs,
      succeededJobs,
      failedJobs,
      retryableJobs,
      oldestPendingJob,
      activeParticipants,
      pausedParticipants,
      optedOutParticipants,
      recentFeedbackCount,
    ] = await Promise.all([
      countMessages(db, "INBOUND", since),
      countMessages(db, "OUTBOUND", since),
      db.auditLog.count({
        where: { action: "message.send_blocked", createdAt: { gte: since } },
      }),
      db.auditLog.count({
        where: { action: "live_reply.sent", createdAt: { gte: since } },
      }),
      db.auditLog.findMany({
        where: { action: { startsWith: "llm." }, createdAt: { gte: since } },
        select: { action: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.auditLog.findMany({
        where: {
          action: { startsWith: "conversation." },
          createdAt: { gte: since },
        },
        select: { action: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.projectBrief.count({ where: { status: "NEEDS_ADMIN" } }),
      db.auditLog.findMany({
        where: { action: { startsWith: "producer." }, createdAt: { gte: since } },
        select: { action: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.inboundProcessingJob.count({ where: { status: "PENDING" } }),
      db.inboundProcessingJob.count({ where: { status: "PROCESSING" } }),
      db.inboundProcessingJob.count({ where: { status: "SUCCEEDED" } }),
      db.inboundProcessingJob.count({ where: { status: "FAILED" } }),
      db.inboundProcessingJob.count({
        where: { status: "FAILED", attempts: { lt: 3 } },
      }),
      db.inboundProcessingJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      db.pilotParticipant.count({ where: { status: "ACTIVE" } }),
      db.pilotParticipant.count({ where: { status: "PAUSED" } }),
      db.pilotParticipant.count({ where: { status: "OPTED_OUT" } }),
      db.pilotFeedback.count({ where: { createdAt: { gte: since } } }),
    ]);

    const flowCounts: CountMap = {};
    for (const item of conversationAuditLogs) {
      const metadata = metadataObject(item.metadata);
      const flow = typeof metadata.flow === "string" ? metadata.flow : null;
      increment(flowCounts, flow);
    }

    const failureCategories: CountMap = {};
    for (const item of llmAuditLogs) {
      if (item.action !== "llm.call_failed") continue;
      const metadata = metadataObject(item.metadata);
      const category =
        typeof metadata.errorCategory === "string"
          ? metadata.errorCategory
          : "unknown";
      increment(failureCategories, category);
    }

    const oldestPendingJobAgeSeconds = oldestPendingJob
      ? Math.max(
          0,
          Math.floor((Date.now() - oldestPendingJob.createdAt.getTime()) / 1000),
        )
      : null;

    return {
      database,
      recentInboundCount,
      recentOutboundCount,
      recentBlockedSendCount,
      autonomousReplyDailyCount,
      llmCounts: {
        callStarted: llmAuditLogs.filter((item) => item.action === "llm.call_started")
          .length,
        callSucceeded: llmAuditLogs.filter(
          (item) => item.action === "llm.call_succeeded",
        ).length,
        callFailed: llmAuditLogs.filter((item) => item.action === "llm.call_failed")
          .length,
        fallbackUsed: llmAuditLogs.filter(
          (item) => item.action === "llm.fallback_used",
        ).length,
        failureCategories: topCounts(failureCategories),
      },
      conversation: {
        recentIntentClassifications: conversationAuditLogs.filter(
          (item) => item.action === "conversation.intent_classified",
        ).length,
        recentReplyPlans: conversationAuditLogs.filter((item) =>
          item.action.includes("reply_plan"),
        ).length,
        needsAdminCount,
        flowCounts: topCounts(flowCounts),
      },
      producer: {
        recentProjectUnderstandingCount: producerAuditLogs.filter(
          (item) => item.action === "producer.project_understanding_generated",
        ).length,
        recentRoleMapCount: producerAuditLogs.filter(
          (item) => item.action === "producer.role_map_generated",
        ).length,
        recentCandidateRecommendationCount: producerAuditLogs.filter(
          (item) => item.action === "producer.internal_candidates_recommended",
        ).length,
        recentShortlistDraftCount: producerAuditLogs.filter((item) =>
          [
            "producer.shortlist_draft_generated",
            "producer.shortlist_packet_generated",
            "producer.organizer_shortlist_draft_generated",
          ].includes(item.action),
        ).length,
        recentDraftReadinessCount: producerAuditLogs.filter(
          (item) => item.action === "producer.draft_send_readiness_evaluated",
        ).length,
      },
      pipeline: {
        messageProcessingMode: process.env.MESSAGE_PROCESSING_MODE || "sync",
        pendingJobs,
        processingJobs,
        succeededJobs,
        failedJobs,
        retryableJobs,
        oldestPendingJobAgeSeconds,
      },
      pilotCounts: {
        activeParticipants,
        pausedParticipants,
        optedOutParticipants,
        recentFeedbackCount,
      },
    };
  } catch {
    return {
      ...empty,
      database: "error",
    };
  }
}

export function safeObservabilitySummaryForAdmin<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactForLog(value) as T;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value as T;
  if (Array.isArray(value)) {
    return value.map((item) => safeObservabilitySummaryForAdmin(item)) as T;
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        safeObservabilitySummaryForAdmin(item),
      ]),
    ) as T;
  }
  return "[redacted]" as T;
}

export async function getObservabilitySummary(): Promise<ObservabilitySummary> {
  const generatedAt = new Date().toISOString();
  const database = await checkDatabase();
  const [dbSummary, pipelineHealth] = await Promise.all([
    collectDbSummary(database),
    getMessagingPipelineHealthSnapshot(),
  ]);
  const sms = getSmsSafetyHealth();
  const twilio = getTwilioConfigPresence();
  const llm = safeLlmHealth();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const access = await getPublicBetaAccessHealthSnapshot();
  const dataOps = await getPilotDataOpsHealthSnapshot();
  const launchDrill = await getLaunchDrillHealthSnapshot();
  const publicBetaConfig = getCappedPublicBetaConfig();
  const [
    publicBetaWaitlist,
    publicBetaReadiness,
    betaCohortSimulation,
    talentDiscovery,
    talentResearchQuality,
    candidateGraph,
    matchingEvaluation,
  ] =
    await Promise.all([
      getPublicBetaWaitlistHealthSnapshot(),
      evaluateCappedPublicBetaReadiness({
        launchRiskLevel: launchDrill.launchRiskLevel as "green" | "yellow" | "red",
      }),
      getBetaCohortSimulationHealthSnapshot(),
      getTalentDiscoveryHealthSnapshot(),
      getTalentResearchQualityHealthSnapshot(),
      getCandidateGraphHealthSnapshot(),
      Promise.resolve(getMatchingEvaluationHealthSnapshot()),
    ]);
  const deployment = getDeploymentInfo();

  const pipeline = {
    ...dbSummary.pipeline,
    messageProcessingMode: pipelineHealth.messageProcessingMode,
    pendingJobs:
      dbSummary.pipeline.pendingJobs ?? pipelineHealth.queueDepth ?? null,
    failedJobs:
      dbSummary.pipeline.failedJobs ?? pipelineHealth.failedJobCount ?? null,
  };
  const fallbackRate =
    dbSummary.llmCounts.callStarted > 0
      ? Number(
          (dbSummary.llmCounts.fallbackUsed / dbSummary.llmCounts.callStarted).toFixed(
            2,
          ),
        )
      : 0;
  const recentOutboundCount = dbSummary.recentOutboundCount;
  const summaryWithoutRisk = {
    generatedAt,
    environment: deployment,
    app: {
      ok:
        database === "connected" &&
        Boolean(process.env.ADMIN_PASSWORD) &&
        Boolean(process.env.APP_BASE_URL),
      database,
      appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
      adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
      internalApiConfigured: Boolean(process.env.INTERNAL_API_KEY),
    },
    sms: {
      providerMode: sms.providerMode,
      sendsDisabled: sms.sendsDisabled,
      allowlistRequired: sms.allowlistRequired,
      allowedNumbersCount: sms.allowedNumbersCount,
      twilioStagingMode: sms.twilioStagingMode,
      webhookValidationEnabled: twilio.webhookValidationEnabled,
      smsComplianceApproved: pilot.complianceApproved,
      publicLaunchEnabled: pilot.publicLaunchEnabled,
      dailySendCount: recentOutboundCount,
      autonomousReplyDailyCount: dbSummary.autonomousReplyDailyCount,
      recentInboundCount: dbSummary.recentInboundCount,
      recentOutboundCount,
      recentBlockedSendCount: dbSummary.recentBlockedSendCount,
      unexpectedOutboundDetected: sms.sendsDisabled && recentOutboundCount > 0,
    },
    llm: {
      providerEffective: llm.providerEffective,
      modeEffective: llm.modeEffective,
      model: llm.model,
      shadowMode: llm.shadowMode,
      activeMockAvailable: llm.activeMockAvailable,
      activeLiveAllowed: llm.activeLiveAllowed,
      recentCallCount: dbSummary.llmCounts.callStarted,
      recentSuccessCount: dbSummary.llmCounts.callSucceeded,
      recentFailureCount: dbSummary.llmCounts.callFailed,
      recentFallbackCount: dbSummary.llmCounts.fallbackUsed,
      fallbackRate,
      topFailureCategories: dbSummary.llmCounts.failureCategories,
    },
    conversation: {
      ...dbSummary.conversation,
      flowCounts: dbSummary.conversation.flowCounts,
    },
    producer: dbSummary.producer,
    pipeline,
    pilot: {
      pilotStage: pilot.pilotStage,
      pilotReplyMode: pilot.pilotReplyMode,
      accessMode: access.smsAccessMode,
      accessModeEffective: access.accessModeEffective,
      publicBetaEnabled: access.publicBetaEnabled,
      ...dbSummary.pilotCounts,
      waitlistedParticipants: access.waitlistedParticipantCount,
      capUsage: {
        active: access.currentActiveParticipants,
        max: access.maxActiveParticipants,
      },
      recentBlockedInboundCount: access.recentBlockedInboundCount,
      inviteCodeCount: access.inviteCodeCount,
      designPartnerReadiness: {
        sendReadinessAvailable: pilot.sendReadinessAvailable,
        outboundSelfTestReadinessAvailable: pilot.outboundSelfTestReadinessAvailable,
        publicLaunchEnabled: pilot.publicLaunchEnabled,
        autoRepliesEnabled: pilot.autoRepliesEnabled,
        complianceApproved: pilot.complianceApproved,
        allowedNumbersCount: pilot.allowedNumbersCount,
      },
    },
    dataOps: {
      pilotDataOpsAvailable: dataOps.pilotDataOpsAvailable,
      exportCountRecent: dataOps.exportCountRecent,
      redactionCountRecent: dataOps.redactionCountRecent,
      participantsPausedCount: dataOps.participantsPausedCount,
      participantsOptedOutCount: dataOps.participantsOptedOutCount,
      dataOpsWarnings: dataOps.dataOpsWarnings,
      backupChecklistStatus: dataOps.backupChecklistStatus,
      retentionPolicyExists: dataOps.retentionPolicyAvailable,
      incidentRunbookExists: dataOps.incidentRunbookAvailable,
    },
    launchDrill,
    publicBeta: {
      publicBetaWaitlistCount: publicBetaWaitlist.publicBetaWaitlistCount,
      publicBetaAdmittedCount: publicBetaWaitlist.publicBetaAdmittedCount,
      publicBetaPausedCount: publicBetaWaitlist.publicBetaPausedCount,
      publicBetaRejectedCount: publicBetaWaitlist.publicBetaRejectedCount,
      publicBetaCapUsage: {
        admitted: publicBetaWaitlist.publicBetaAdmittedCount,
        max: publicBetaConfig.publicBetaMaxActiveParticipants,
      },
      publicBetaDailyNewUserCount:
        publicBetaWaitlist.publicBetaDailyNewUserCount,
      publicBetaReadiness: publicBetaReadiness.publicBetaReady,
      publicBetaBlockerCount: publicBetaReadiness.blockers.length,
      publicBetaPublicNumberVisible:
        publicBetaConfig.publicBetaPublicNumberVisible,
    },
    betaCohortSimulation: {
      betaCohortSimulationAvailable:
        betaCohortSimulation.betaCohortSimulationAvailable,
      simulationRiskLevel: betaCohortSimulation.simulationRiskLevel,
      simulationBlockerCount: betaCohortSimulation.simulationBlockerCount,
      designPartnerSimulationReady:
        betaCohortSimulation.designPartnerSimulationReady,
      privateBetaSimulationReady:
        betaCohortSimulation.privateBetaSimulationReady,
      publicBetaSimulationReady: betaCohortSimulation.publicBetaSimulationReady,
      overCapacitySimulationReady:
        betaCohortSimulation.overCapacitySimulationReady,
      latestRunAt: betaCohortSimulation.latestRunAt,
    },
    talentDiscovery,
    talentResearchQuality,
    candidateGraph,
    matchingEvaluation,
  };

  const safeSerialized = JSON.stringify(
    safeObservabilitySummaryForAdmin(summaryWithoutRisk),
  );
  const risk = evaluateObservabilityRisk({
    database,
    serializedOutput: safeSerialized,
    sms: summaryWithoutRisk.sms,
    llm: summaryWithoutRisk.llm,
    pipeline: { failedJobs: summaryWithoutRisk.pipeline.failedJobs },
    pilot: summaryWithoutRisk.pilot,
  });

  return safeObservabilitySummaryForAdmin({
    ...summaryWithoutRisk,
    app: {
      ...summaryWithoutRisk.app,
      ok: summaryWithoutRisk.app.ok,
    },
    risk,
  });
}

export async function getObservabilityHealthSnapshot() {
  const sms = getSmsSafetyHealth();
  const twilio = getTwilioConfigPresence();
  const llm = safeLlmHealth();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const pipeline = await getMessagingPipelineHealthSnapshot();
  const dataOps = await getPilotDataOpsHealthSnapshot();
  const launchDrill = await getLaunchDrillHealthSnapshot();
  const talentDiscovery = await getTalentDiscoveryHealthSnapshot();
  const talentResearchQuality = await getTalentResearchQualityHealthSnapshot();
  const candidateGraph = await getCandidateGraphHealthSnapshot();
  const matchingEvaluation = getMatchingEvaluationHealthSnapshot();
  let recentBlockedSendCount = 0;
  let recentOutboundCount = 0;
  let database = "not_configured";

  if (process.env.DATABASE_URL) {
    database = await checkDatabase();
    if (database === "connected") {
      const since = sinceDate();
      try {
        [recentBlockedSendCount, recentOutboundCount] = await Promise.all([
          getDb().auditLog.count({
            where: { action: "message.send_blocked", createdAt: { gte: since } },
          }),
          getDb().message.count({
            where: { direction: "OUTBOUND", createdAt: { gte: since } },
          }),
        ]);
      } catch {
        database = "error";
      }
    }
  }

  const risk = evaluateObservabilityRisk({
    database,
    serializedOutput: JSON.stringify({
      providerMode: sms.providerMode,
      allowedNumbersCount: sms.allowedNumbersCount,
      llmModel: llm.model,
    }),
    sms: {
      providerMode: sms.providerMode,
      sendsDisabled: sms.sendsDisabled,
      smsComplianceApproved: pilot.complianceApproved,
      publicLaunchEnabled: pilot.publicLaunchEnabled,
      recentOutboundCount,
      webhookValidationEnabled: twilio.webhookValidationEnabled,
    },
    llm: {
      activeLiveAllowed: llm.activeLiveAllowed,
    },
    pipeline: { failedJobs: pipeline.failedJobCount },
    pilot: {
      pilotStage: pilot.pilotStage,
      activeParticipants: 0,
    },
  });

  return {
    observabilityAvailable: true,
    riskLevel: risk.level,
    observabilityWarningsCount: risk.warnings.length + risk.blockers.length,
    failedJobCount: pipeline.failedJobCount,
    recentBlockedSendCount,
    pilotDataOpsAvailable: dataOps.pilotDataOpsAvailable,
    dataOpsWarningsCount: dataOps.dataOpsWarningsCount,
    retentionPolicyAvailable: dataOps.retentionPolicyAvailable,
    backupRunbookAvailable: dataOps.backupRunbookAvailable,
    launchDrillAvailable: launchDrill.launchDrillAvailable,
    launchRiskLevel: launchDrill.launchRiskLevel,
    launchBlockerCount: launchDrill.launchBlockerCount,
    currentRecommendedLaunchStage:
      launchDrill.currentRecommendedLaunchStage,
    talentDiscoveryAvailable: talentDiscovery.talentDiscoveryAvailable,
    publicWebResearchShadowAvailable:
      talentDiscovery.publicWebResearchShadowAvailable,
    publicWebResearchLiveDryRunAvailable:
      talentDiscovery.publicWebResearchLiveDryRunAvailable,
    publicWebResearchAsyncAvailable:
      talentDiscovery.publicWebResearchAsyncAvailable,
    publicWebResearchReviewAvailable:
      talentDiscovery.publicWebResearchReviewAvailable,
    publicWebResearchEnabled: talentDiscovery.publicWebResearchEnabled,
    publicWebResearchMode: talentDiscovery.publicWebResearchMode,
    publicWebResearchLiveDryRunAllowed:
      talentDiscovery.publicWebResearchLiveDryRunAllowed,
    publicWebResearchRiskLevel:
      talentDiscovery.publicWebResearchRiskLevel,
    recentPublicWebLiveDryRunCount:
      talentDiscovery.recentPublicWebLiveDryRunCount,
    publicWebResearchLastRunAt:
      talentDiscovery.publicWebResearchLastRunAt,
    publicWebResearchLastRunStatus:
      talentDiscovery.publicWebResearchLastRunStatus,
    publicWebResearchLastCitationCount:
      talentDiscovery.publicWebResearchLastCitationCount,
    publicWebResearchLastResultCount:
      talentDiscovery.publicWebResearchLastResultCount,
    publicWebResearchPendingJobCount:
      talentDiscovery.publicWebResearchPendingJobCount,
    publicWebResearchFailedJobCount:
      talentDiscovery.publicWebResearchFailedJobCount,
    publicWebResultsPendingReviewCount:
      talentDiscovery.publicWebResultsPendingReviewCount,
    publicWebPendingReviewCount: talentDiscovery.publicWebPendingReviewCount,
    publicWebNeedsMoreResearchCount:
      talentDiscovery.publicWebNeedsMoreResearchCount,
    publicWebNeedsMoreContactResearchCount:
      talentDiscovery.publicWebNeedsMoreContactResearchCount,
    publicWebDiscardedCount: talentDiscovery.publicWebDiscardedCount,
    publicWebDuplicateCount: talentDiscovery.publicWebDuplicateCount,
    publicWebDoNotContactCount: talentDiscovery.publicWebDoNotContactCount,
    contactabilityEvidenceAvailable:
      talentDiscovery.contactabilityEvidenceAvailable,
    contactabilityPendingReviewCount:
      talentDiscovery.contactabilityPendingReviewCount,
    contactabilityHighRiskCount:
      talentDiscovery.contactabilityHighRiskCount,
    publicWebSourceQualityRiskLevel:
      talentDiscovery.publicWebSourceQualityRiskLevel,
    publicWebReviewRiskLevel: talentDiscovery.publicWebReviewRiskLevel,
    talentCandidateReviewQueueCount:
      talentDiscovery.candidateReviewQueueCount,
    talentResearchQualityAvailable:
      talentResearchQuality.talentResearchQualityAvailable,
    pendingTalentQualityReviewCount:
      talentResearchQuality.pendingTalentQualityReviewCount,
    candidateGraphAvailable: candidateGraph.candidateGraphAvailable,
    relationshipAwareMatchingAvailable:
      candidateGraph.relationshipAwareMatchingAvailable,
    candidateSearchProfileCount: candidateGraph.candidateSearchProfileCount,
    graphEdgeCount: candidateGraph.graphEdgeCount,
    unverifiedResearchCandidateCount:
      candidateGraph.unverifiedResearchCandidateCount,
    doNotContactCandidateCount: candidateGraph.doNotContactCandidateCount,
    publicWebOnlyCandidateCount: candidateGraph.publicWebOnlyCandidateCount,
    recentMatchRunCount: candidateGraph.recentMatchRunCount,
    pendingMatchReviewCount: candidateGraph.pendingMatchReviewCount,
    internalCandidateCoverage: candidateGraph.internalCandidateCoverage,
    publicWebCandidateCoverage: candidateGraph.publicWebCandidateCoverage,
    averageCandidateScore: candidateGraph.averageCandidateScore,
    highRiskMatchCount: candidateGraph.highRiskMatchCount,
    doNotContactExcludedCount: candidateGraph.doNotContactExcludedCount,
    matchingEvaluationAvailable:
      matchingEvaluation.matchingEvaluationAvailable,
    lastMatchingEvaluationScore:
      matchingEvaluation.lastMatchingEvaluationScore,
    lastMatchingEvaluationPassed:
      matchingEvaluation.lastMatchingEvaluationPassed,
    matchingEvaluationFailureCount:
      matchingEvaluation.matchingEvaluationFailureCount,
    matchingEvaluationSafetyViolationCount:
      matchingEvaluation.matchingEvaluationSafetyViolationCount,
    matchingEvaluationTuningRecommendationCount:
      matchingEvaluation.matchingEvaluationTuningRecommendationCount,
  };
}

export function formatObservabilityDailyReport(summary: ObservabilitySummary) {
  const lines = [
    "# Saga SMS Producer Daily Observability Report",
    "",
    `Generated: ${summary.generatedAt}`,
    `Environment: ${summary.environment.platform}/${summary.environment.environment}`,
    `Risk level: ${summary.risk.level.toUpperCase()}`,
    "",
    "## System",
    `- Database: ${summary.app.database}`,
    `- App base URL configured: ${summary.app.appBaseUrlConfigured}`,
    `- Admin configured: ${summary.app.adminConfigured}`,
    "",
    "## SMS Safety",
    `- Provider: ${summary.sms.providerMode}`,
    `- Sends disabled: ${summary.sms.sendsDisabled}`,
    `- Allowlist required: ${summary.sms.allowlistRequired}`,
    `- Allowed numbers count: ${summary.sms.allowedNumbersCount}`,
    `- Recent inbound: ${summary.sms.recentInboundCount}`,
    `- Recent outbound records: ${summary.sms.recentOutboundCount}`,
    `- Recent blocked sends: ${summary.sms.recentBlockedSendCount}`,
    `- Unexpected outbound detected: ${summary.sms.unexpectedOutboundDetected}`,
    "",
    "## LLM",
    `- Provider/mode: ${summary.llm.providerEffective}/${summary.llm.modeEffective}`,
    `- Model: ${summary.llm.model}`,
    `- Calls/success/failure/fallback: ${summary.llm.recentCallCount}/${summary.llm.recentSuccessCount}/${summary.llm.recentFailureCount}/${summary.llm.recentFallbackCount}`,
    `- Fallback rate: ${summary.llm.fallbackRate}`,
    "",
    "## Pipeline",
    `- Mode: ${summary.pipeline.messageProcessingMode}`,
    `- Pending jobs: ${summary.pipeline.pendingJobs ?? "n/a"}`,
    `- Failed jobs: ${summary.pipeline.failedJobs ?? "n/a"}`,
    "",
    "## Talent Discovery",
    `- Available: ${summary.talentDiscovery.talentDiscoveryAvailable}`,
    `- Recent internal searches: ${summary.talentDiscovery.recentInternalSearchCount ?? "n/a"}`,
    `- Recent sourcing plans: ${summary.talentDiscovery.recentSourcingPlanCount ?? "n/a"}`,
    `- Recent public research plans: ${summary.talentDiscovery.recentPublicResearchPlanCount ?? "n/a"}`,
    `- Public web research: ${summary.talentDiscovery.publicWebResearchEnabled}/${summary.talentDiscovery.publicWebResearchMode}`,
    `- Public web shadow available: ${summary.talentDiscovery.publicWebResearchShadowAvailable}`,
    `- Public web live dry run available: ${summary.talentDiscovery.publicWebResearchLiveDryRunAvailable}`,
    `- Public web async jobs available: ${summary.talentDiscovery.publicWebResearchAsyncAvailable}`,
    `- Public web review available: ${summary.talentDiscovery.publicWebResearchReviewAvailable}`,
    `- Public web live dry run allowed: ${summary.talentDiscovery.publicWebResearchLiveDryRunAllowed}`,
    `- Recent live dry runs: ${summary.talentDiscovery.recentPublicWebLiveDryRunCount ?? "n/a"}`,
    `- Pending public web jobs: ${summary.talentDiscovery.publicWebResearchPendingJobCount ?? "n/a"}`,
    `- Failed public web jobs: ${summary.talentDiscovery.publicWebResearchFailedJobCount ?? "n/a"}`,
    `- Last public web citations: ${summary.talentDiscovery.publicWebResearchLastCitationCount ?? "n/a"}`,
    `- Public web pending review: ${summary.talentDiscovery.publicWebResultsPendingReviewCount ?? "n/a"}`,
    `- Public web needs contact research: ${summary.talentDiscovery.publicWebNeedsMoreContactResearchCount ?? "n/a"}`,
    `- Public web duplicates: ${summary.talentDiscovery.publicWebDuplicateCount ?? "n/a"}`,
    `- Public web do-not-contact: ${summary.talentDiscovery.publicWebDoNotContactCount ?? "n/a"}`,
    `- Contactability pending review: ${summary.talentDiscovery.contactabilityPendingReviewCount ?? "n/a"}`,
    `- Contactability high risk: ${summary.talentDiscovery.contactabilityHighRiskCount ?? "n/a"}`,
    `- Public web review risk: ${summary.talentDiscovery.publicWebReviewRiskLevel}`,
    `- Public web risk: ${summary.talentDiscovery.publicWebResearchRiskLevel}`,
    `- Candidate review queue: ${summary.talentDiscovery.candidateReviewQueueCount ?? "n/a"}`,
    `- Quality review available: ${summary.talentResearchQuality.talentResearchQualityAvailable}`,
    `- Pending quality reviews: ${summary.talentResearchQuality.pendingTalentQualityReviewCount ?? "n/a"}`,
    `- Public web pending quality review: ${summary.talentResearchQuality.publicWebCandidatesPendingReviewCount ?? "n/a"}`,
    `- Quality risk: ${summary.talentResearchQuality.talentQualityRiskLevel}`,
    "",
    "## Candidate Graph",
    `- Available: ${summary.candidateGraph.candidateGraphAvailable}`,
    `- Relationship-aware matching: ${summary.candidateGraph.relationshipAwareMatchingAvailable}`,
    `- Search profiles: ${summary.candidateGraph.candidateSearchProfileCount ?? "n/a"}`,
    `- Graph edges: ${summary.candidateGraph.graphEdgeCount ?? "n/a"}`,
    `- Unverified research candidates: ${summary.candidateGraph.unverifiedResearchCandidateCount ?? "n/a"}`,
    `- Do-not-contact candidates: ${summary.candidateGraph.doNotContactCandidateCount ?? "n/a"}`,
    `- Public-web-only candidates: ${summary.candidateGraph.publicWebOnlyCandidateCount ?? "n/a"}`,
    `- Recent match runs: ${summary.candidateGraph.recentMatchRunCount ?? "n/a"}`,
    `- Pending match reviews: ${summary.candidateGraph.pendingMatchReviewCount ?? "n/a"}`,
    `- Internal candidate coverage: ${summary.candidateGraph.internalCandidateCoverage ?? "n/a"}`,
    `- Public-web candidate coverage: ${summary.candidateGraph.publicWebCandidateCoverage ?? "n/a"}`,
    `- Average candidate score: ${summary.candidateGraph.averageCandidateScore ?? "n/a"}`,
    `- High-risk matches: ${summary.candidateGraph.highRiskMatchCount ?? "n/a"}`,
    `- Do-not-contact/opt-out excluded: ${summary.candidateGraph.doNotContactExcludedCount ?? "n/a"}`,
    "",
    "## Matching Evaluation",
    `- Available: ${summary.matchingEvaluation.matchingEvaluationAvailable}`,
    `- Last score: ${summary.matchingEvaluation.lastMatchingEvaluationScore ?? "n/a"}`,
    `- Last passed: ${summary.matchingEvaluation.lastMatchingEvaluationPassed ?? "n/a"}`,
    `- Failure count: ${summary.matchingEvaluation.matchingEvaluationFailureCount ?? "n/a"}`,
    `- Safety violations: ${summary.matchingEvaluation.matchingEvaluationSafetyViolationCount ?? "n/a"}`,
    `- Tuning recommendations: ${summary.matchingEvaluation.matchingEvaluationTuningRecommendationCount ?? "n/a"}`,
    "",
    "## Pilot",
    `- Stage: ${summary.pilot.pilotStage}`,
    `- Reply mode: ${summary.pilot.pilotReplyMode}`,
    `- Access mode: ${summary.pilot.accessModeEffective}`,
    `- Public beta enabled: ${summary.pilot.publicBetaEnabled}`,
    `- Active participants: ${summary.pilot.activeParticipants}`,
    `- Waitlisted participants: ${summary.pilot.waitlistedParticipants ?? "n/a"}`,
    `- Invite codes: ${summary.pilot.inviteCodeCount ?? "n/a"}`,
    `- Recent feedback: ${summary.pilot.recentFeedbackCount}`,
    "",
    "## Data Operations",
    `- Available: ${summary.dataOps.pilotDataOpsAvailable}`,
    `- Recent exports: ${summary.dataOps.exportCountRecent ?? "n/a"}`,
    `- Recent redactions: ${summary.dataOps.redactionCountRecent ?? "n/a"}`,
    `- Paused participants: ${summary.dataOps.participantsPausedCount ?? "n/a"}`,
    `- Opted-out participants: ${summary.dataOps.participantsOptedOutCount ?? "n/a"}`,
    `- Backup checklist: ${summary.dataOps.backupChecklistStatus}`,
    `- Data ops warnings: ${summary.dataOps.dataOpsWarnings.length ? summary.dataOps.dataOpsWarnings.join(", ") : "none"}`,
    "",
    "## Launch Drill",
    `- Available: ${summary.launchDrill.launchDrillAvailable}`,
    `- Recommended stage: ${summary.launchDrill.currentRecommendedLaunchStage}`,
    `- Risk: ${summary.launchDrill.launchRiskLevel}`,
    `- Blockers: ${summary.launchDrill.launchBlockerCount}`,
    `- Last run: ${summary.launchDrill.lastLaunchDrillRunAt ?? "n/a"}`,
    "",
    "## Public Beta",
    `- Waitlist entries: ${summary.publicBeta.publicBetaWaitlistCount ?? "n/a"}`,
    `- Admitted: ${summary.publicBeta.publicBetaAdmittedCount ?? "n/a"}`,
    `- Cap usage: ${summary.publicBeta.publicBetaCapUsage.admitted ?? "n/a"}/${summary.publicBeta.publicBetaCapUsage.max}`,
    `- Daily new users: ${summary.publicBeta.publicBetaDailyNewUserCount ?? "n/a"}`,
    `- Ready: ${summary.publicBeta.publicBetaReadiness}`,
    `- Blockers: ${summary.publicBeta.publicBetaBlockerCount}`,
    `- Public number visible: ${summary.publicBeta.publicBetaPublicNumberVisible}`,
    "",
    "## Beta Cohort Simulation",
    `- Available: ${summary.betaCohortSimulation.betaCohortSimulationAvailable}`,
    `- Risk: ${summary.betaCohortSimulation.simulationRiskLevel}`,
    `- Blockers: ${summary.betaCohortSimulation.simulationBlockerCount}`,
    `- Design partner simulation ready: ${summary.betaCohortSimulation.designPartnerSimulationReady}`,
    `- Private beta simulation ready: ${summary.betaCohortSimulation.privateBetaSimulationReady}`,
    `- Public beta simulation ready: ${summary.betaCohortSimulation.publicBetaSimulationReady}`,
    `- Latest run: ${summary.betaCohortSimulation.latestRunAt ?? "n/a"}`,
    "",
    "## Risk",
    `- Blockers: ${summary.risk.blockers.length ? summary.risk.blockers.join(", ") : "none"}`,
    `- Warnings: ${summary.risk.warnings.length ? summary.risk.warnings.join(", ") : "none"}`,
    "",
    "## Recommended Actions",
    ...(summary.risk.recommendedActions.length
      ? summary.risk.recommendedActions.map((action) => `- ${action}`)
      : ["- No immediate observability action required."]),
  ];

  return lines.join("\n");
}
