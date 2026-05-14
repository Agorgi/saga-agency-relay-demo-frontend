import { existsSync } from "node:fs";
import { join } from "node:path";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { redactSensitiveJson } from "@/lib/dataOps/dataClassification";
import { getLlmConfigPresence, getTwilioConfigPresence } from "@/lib/env";
import {
  getLiveReplyExecutionReadinessSnapshot,
  safeLiveReplyHealthSummary,
} from "@/lib/conversation/liveReplyExecutor";
import { getConversationAutonomyHealthSnapshot } from "@/lib/conversation/conversationAutonomy";
import {
  evaluateLaunchReadinessDrill,
  getLaunchDrillDocumentStatus,
  getLaunchDrillHealthSnapshot,
  type LaunchDrillStageId,
  type LaunchReadinessDrillResult,
} from "@/lib/launchDrill/launchReadinessDrill";
import {
  formatObservabilityDailyReport,
  getObservabilitySummary,
  type ObservabilitySummary,
} from "@/lib/observability/observabilitySummary";
import { getPublicBetaAccessConfig } from "@/lib/access/accessControl";
import { evaluateCappedPublicBetaReadiness } from "@/lib/publicBeta/publicBetaAdmission";
import {
  getCappedPublicBetaConfig,
} from "@/lib/publicBeta/publicBetaConfig";
import { getPublicBetaWaitlistHealthSnapshot } from "@/lib/publicBeta/publicBetaWaitlist";
import {
  getBetaCohortSimulationHealthSnapshot,
} from "@/lib/cohortSimulation/runCohortSimulation";
import type {
  BetaCohortSimulationHealthSnapshot,
} from "@/lib/cohortSimulation/cohortTypes";
import { getReleaseCandidateSummary } from "@/lib/releaseCandidate/releaseCandidate";
import { getTalentDiscoveryHealthSnapshot } from "@/lib/sourcing/talentDiscoveryHealth";
import { getTalentResearchQualityHealthSnapshot } from "@/lib/sourcing/talentResearchQuality";
import { getDesignPartnerPilotReadinessSnapshot } from "@/lib/pilotReadiness";
import {
  evaluatePostA2POneNumberSelfTestReadiness,
  getOutboundSelfTestReadinessSnapshot,
  safeOutboundSelfTestHealthSummary,
} from "@/lib/producer/outboundSelfTestReadiness";
import { getMessageProcessingModeHealth } from "@/lib/messagingPipeline";
import { getSmsSafetyHealth } from "@/lib/smsSafety";

export const commandCenterAuditEvents = {
  viewed: "command_center.viewed",
  readinessEvaluated: "command_center.readiness_evaluated",
  launchStageRecommended: "command_center.launch_stage_recommended",
  dryRunActionInvoked: "command_center.dry_run_action_invoked",
  blockerDetected: "command_center.blocker_detected",
} as const;

export const commandCenterStageIds = [
  "PRE_A2P_HOLD",
  "A2P_APPROVED_REVIEW",
  "ONE_NUMBER_SELF_TEST",
  "INTERNAL_TEAM_TEST",
  "DESIGN_PARTNER_10",
  "PRIVATE_BETA_25",
  "CAPPED_PUBLIC_BETA",
  "PUBLIC_LAUNCH_CANDIDATE",
  "PUBLIC_LIVE",
] as const;

export type CommandCenterStageId = (typeof commandCenterStageIds)[number];
export type CommandCenterRiskLevel = "green" | "yellow" | "red";
export type GoNoGoStatus = "BLOCKED" | "NOT_READY" | "READY_FOR_REVIEW" | "READY";

type RunbookStatus = {
  key: string;
  label: string;
  path: string;
  href: string;
  exists: boolean;
};

type SafeActionCard = {
  title: string;
  description: string;
  href: string;
  actionKind: "link" | "dry_run";
  dangerous: false;
};

type GoNoGoItem = {
  id:
    | "one_number_self_test"
    | "internal_team_test"
    | "design_partner_10"
    | "private_beta"
    | "capped_public_beta"
    | "public_launch";
  title: string;
  status: GoNoGoStatus;
  blockers: string[];
  warnings: string[];
  requiredEvidence: string[];
  relatedDocs: string[];
  lastEvaluatedAt: string;
};

type KillSwitchStatus = {
  key: string;
  currentValue: string;
  expectedSafeValue: string;
  safe: boolean;
  severity: "safe" | "warn" | "danger";
  recommendedOperatorAction: string;
};

type CommandCenterDbSignals = {
  recentCriticalAuditEvents: number | null;
  lastCommandCenterEvaluationAt: string | null;
  lastObservabilityDailyReportAt: string | null;
};

export type CommandCenterSummary = {
  generatedAt: string;
  currentStage: CommandCenterStageId;
  configuredPilotStage: string;
  stageMismatch: boolean;
  overallStatus: CommandCenterRiskLevel;
  nextRecommendedAction: string;
  blockers: string[];
  warnings: string[];
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
    publicBetaEnabled: boolean;
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
    recentFailureCount: number;
    recentFallbackCount: number;
    warnings: string[];
  };
  pipeline: {
    messageProcessingMode: string;
    asyncProcessingAvailable: boolean;
    asyncActiveEnabled: boolean;
    pendingJobs: number | null;
    failedJobs: number | null;
    warnings: string[];
  };
  observability: {
    riskLevel: CommandCenterRiskLevel;
    blockerCount: number;
    warningCount: number;
    recommendedActions: string[];
  };
  access: {
    smsAccessMode: string;
    accessModeEffective: string;
    publicAccessEnabled: boolean;
    publicBetaEnabled: boolean;
    publicLaunchEnabled: boolean;
    maxActiveParticipants: number;
    currentActiveParticipants: number | null;
    waitlistedParticipantCount: number | null;
    inviteCodeCount: number | null;
    recentBlockedInboundCount: number | null;
  };
  pilot: {
    pilotStage: string;
    pilotReplyMode: string;
    activeParticipants: number;
    waitlistedParticipants: number | null;
    pausedParticipants: number;
    optedOutParticipants: number;
    participantCap: number;
    recentFeedbackCount: number;
    transcriptDryRuns: {
      available: boolean;
      docExists: boolean;
      lastRunAt: string | null;
      latestAverageScore: number | null;
      readyForDesignPartners: boolean;
    };
  };
  designPartnerPilot: {
    designPartnerPilotScriptAvailable: boolean;
    designPartnerFeedbackQuestionsAvailable: boolean;
    designPartnerOperatorChecklistAvailable: boolean;
    designPartnerPilotReady: boolean;
    designPartnerPilotBlockers: string[];
    nextOperatorAction: string;
  };
  dataOps: {
    pilotDataOpsAvailable: boolean;
    exportCountRecent: number | null;
    redactionCountRecent: number | null;
    participantsPausedCount: number | null;
    participantsOptedOutCount: number | null;
    dataOpsWarnings: string[];
    retentionPolicyExists: boolean;
    backupRunbookExists: boolean;
    incidentRunbookExists: boolean;
  };
  producer: {
    recentProjectUnderstandingCount: number;
    recentRoleMapCount: number;
    recentCandidateRecommendationCount: number;
    recentShortlistDraftCount: number;
    recentDraftReadinessCount: number;
    sendReadinessAvailable: boolean;
    outboundSelfTestReady: boolean;
    outboundSelfTestStatus: string;
    liveReplyExecutionAvailable: boolean;
    autonomousRepliesEnabled: boolean;
    autonomousReplyBlockerCount: number;
  };
  conversationAutonomy: {
    perPhoneAutonomyAvailable: boolean;
    autonomousParticipantsCount: number;
    manualReviewParticipantsCount: number;
    pausedParticipantsCount: number;
    autonomyHandoffCount: number;
    candidateOutreachHandoffCount: number;
  };
  postA2PSelfTest: {
    postA2PSelfTestPlanAvailable: boolean;
    postA2PSelfTestChecklistAvailable: boolean;
    oneNumberSelfTestReady: boolean;
    oneNumberSelfTestBlockers: string[];
    nextPostA2PAction: string;
  };
  launchDrill: {
    currentRecommendedStage: string;
    riskLevel: CommandCenterRiskLevel;
    blockerCount: number;
    warningCount: number;
    lastRunAt: string | null;
    designPartnerLaunchReady: boolean;
    publicBetaCandidateReady: boolean;
  };
  publicBeta: {
    publicBetaEnabled: boolean;
    publicBetaLandingEnabled: boolean;
    publicBetaWaitlistEnabled: boolean;
    publicBetaPublicNumberVisible: boolean;
    publicLaunchEnabled: boolean;
    publicBetaReady: boolean;
    publicBetaBlockerCount: number;
    publicBetaBlockers: string[];
    publicLaunchReady: false;
    accessMode: string;
    maxActiveParticipants: number;
    newUserDailyCap: number;
    waitlistCount: number | null;
    admittedCount: number | null;
    pausedCount: number | null;
    rejectedCount: number | null;
    dailyNewUserCount: number | null;
    supportContactConfigured: boolean;
    privacyUrlConfigured: boolean;
    termsUrlConfigured: boolean;
    publicLaunchFoundationsDocExists: boolean;
    abuseRateLimitDocExists: boolean;
    productionAppIntegrationStatus: "NOT_CONNECTED";
  };
  betaCohortSimulation: BetaCohortSimulationHealthSnapshot;
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
  releaseCandidate: {
    releaseCandidateVersion: string;
    releaseCandidateTag: string;
    releaseCandidateStatus: string;
    releaseCandidateBlockers: string[];
    releaseCandidateBlockerCount: number;
    postA2PNextAction: string;
    currentRecommendedAction: string;
  };
  goNoGo: GoNoGoItem[];
  killSwitches: KillSwitchStatus[];
  incidentReadiness: {
    incidentRunbookExists: boolean;
    rollbackRunbookExists: boolean;
    dataIncidentRunbookExists: boolean;
    lastLaunchDrillRunAt: string | null;
    lastObservabilityDailyReportAt: string | null;
    currentRiskLevel: CommandCenterRiskLevel;
    recentCriticalAuditEvents: number | null;
    recentUnexpectedOutboundCount: number;
    recentFailedJobs: number | null;
    recentLlmFailures: number;
    recentBlockedSends: number;
    recentOptOuts: number;
  };
  runbooks: RunbookStatus[];
  safeActions: SafeActionCard[];
  dryRunOnly: true;
  noSmsSent: true;
  noTwilioSendCall: true;
  noProductionSagaAppData: true;
};

function docPath(relativePath: string) {
  return join(process.cwd(), relativePath);
}

function docExists(relativePath: string) {
  return existsSync(docPath(relativePath));
}

function docHref(relativePath: string) {
  return `/admin/data-ops?doc=${encodeURIComponent(relativePath)}`;
}

function runbook(key: string, label: string, path: string): RunbookStatus {
  return {
    key,
    label,
    path,
    href: docHref(path),
    exists: docExists(path),
  };
}

function toCommandStage(stage: string): CommandCenterStageId {
  if (stage === "PUBLIC_BETA_CANDIDATE") return "PUBLIC_LAUNCH_CANDIDATE";
  if (commandCenterStageIds.includes(stage as CommandCenterStageId)) {
    return stage as CommandCenterStageId;
  }
  return "PRE_A2P_HOLD";
}

function statusFromLaunchStage(
  drill: LaunchReadinessDrillResult,
  id: LaunchDrillStageId,
): GoNoGoStatus {
  const stage = drill.stages.find((item) => item.id === id);
  if (!stage) return "NOT_READY";
  if (stage.status === "BLOCKED" || stage.status === "FAILED") return "BLOCKED";
  if (stage.status === "READY") return "READY_FOR_REVIEW";
  if (stage.status === "PASSED") return "READY";
  return "NOT_READY";
}

function stageBlockers(drill: LaunchReadinessDrillResult, id: LaunchDrillStageId) {
  return drill.stages.find((item) => item.id === id)?.blockers || [];
}

function stageWarnings(drill: LaunchReadinessDrillResult, id: LaunchDrillStageId) {
  return drill.stages.find((item) => item.id === id)?.warnings || [];
}

function goNoGoItems(input: {
  drill: LaunchReadinessDrillResult;
  outboundSelfTest: Awaited<ReturnType<typeof getOutboundSelfTestReadinessSnapshot>>;
  access: ObservabilitySummary["pilot"];
  publicBetaEnabled: boolean;
  publicBetaReadinessBlockers: string[];
  publicLaunchEnabled: boolean;
  generatedAt: string;
}): GoNoGoItem[] {
  const publicBetaBlockers = [
    ...stageBlockers(input.drill, "PUBLIC_BETA_CANDIDATE"),
    ...input.publicBetaReadinessBlockers,
    ...(!input.publicBetaEnabled ? ["PUBLIC_BETA_ENABLED is false."] : []),
  ];
  const publicLaunchBlockers = [
    ...publicBetaBlockers,
    ...(!input.publicLaunchEnabled ? ["PUBLIC_LAUNCH_ENABLED is false."] : []),
    "Public launch is future-only and requires explicit final approval.",
  ];

  return [
    {
      id: "one_number_self_test",
      title: "One-number outbound self-test",
      status: input.outboundSelfTest.ready ? "READY_FOR_REVIEW" : "BLOCKED",
      blockers: input.outboundSelfTest.blockers,
      warnings: input.outboundSelfTest.warnings,
      requiredEvidence: [
        "A2P/compliance approval",
        "Exactly one allowlisted founder/operator number",
        "Approved draft with READY_IN_DRY_RUN readiness",
        "Rollback runbook reviewed",
      ],
      relatedDocs: [
        "docs/outbound-sms-self-test-runbook.md",
        "docs/outbound-self-test-checklist.md",
        "docs/post-a2p-one-number-self-test-v0.9.md",
        "docs/post-a2p-self-test-checklist.md",
      ],
      lastEvaluatedAt: input.generatedAt,
    },
    {
      id: "internal_team_test",
      title: "Internal team test",
      status: statusFromLaunchStage(input.drill, "INTERNAL_TEAM_TEST"),
      blockers: stageBlockers(input.drill, "INTERNAL_TEAM_TEST"),
      warnings: stageWarnings(input.drill, "INTERNAL_TEAM_TEST"),
      requiredEvidence: [
        "One-number self-test passed",
        "Internal participants active",
        "Observability not red",
      ],
      relatedDocs: ["docs/launch-readiness-drill.md"],
      lastEvaluatedAt: input.generatedAt,
    },
    {
      id: "design_partner_10",
      title: "10 design partner pilot",
      status: statusFromLaunchStage(input.drill, "DESIGN_PARTNER_10"),
      blockers: stageBlockers(input.drill, "DESIGN_PARTNER_10"),
      warnings: stageWarnings(input.drill, "DESIGN_PARTNER_10"),
      requiredEvidence: [
        "Internal team test passed",
        "At most 10 design partners",
        "Feedback capture ready",
        "Data ops ready",
        "Transcript dry runs reviewed",
      ],
      relatedDocs: [
        "docs/design-partner-launch-checklist.md",
        "docs/design-partner-pilot-runbook.md",
        "docs/design-partner-pilot-script-v0.8.md",
        "docs/design-partner-feedback-questions.md",
        "docs/design-partner-operator-checklist.md",
      ],
      lastEvaluatedAt: input.generatedAt,
    },
    {
      id: "private_beta",
      title: "Private beta",
      status: statusFromLaunchStage(input.drill, "PRIVATE_BETA_25"),
      blockers: stageBlockers(input.drill, "PRIVATE_BETA_25"),
      warnings: stageWarnings(input.drill, "PRIVATE_BETA_25"),
      requiredEvidence: [
        "Design partner stage passed",
        "Participant caps reviewed",
        "Incident owner identified",
      ],
      relatedDocs: ["docs/public-beta-access-control.md"],
      lastEvaluatedAt: input.generatedAt,
    },
    {
      id: "capped_public_beta",
      title: "Capped public beta",
      status: publicBetaBlockers.length ? "BLOCKED" : "READY_FOR_REVIEW",
      blockers: publicBetaBlockers,
      warnings: stageWarnings(input.drill, "PUBLIC_BETA_CANDIDATE"),
      requiredEvidence: [
        "Private beta passed",
        "PUBLIC_BETA_ENABLED intentionally reviewed",
        "Caps, support, privacy, terms, and abuse controls ready",
      ],
      relatedDocs: [
        "docs/public-beta-launch-checklist.md",
        "docs/public-launch-foundations.md",
      ],
      lastEvaluatedAt: input.generatedAt,
    },
    {
      id: "public_launch",
      title: "Public launch",
      status: "BLOCKED",
      blockers: publicLaunchBlockers,
      warnings: ["Public launch remains disabled in this phase."],
      requiredEvidence: [
        "Capped public beta passed",
        "PUBLIC_LAUNCH_ENABLED explicitly approved",
        "All public-live gates reviewed by engineers",
      ],
      relatedDocs: ["docs/public-launch-foundations.md"],
      lastEvaluatedAt: input.generatedAt,
    },
  ];
}

function killSwitches(input: {
  sms: ObservabilitySummary["sms"];
  llmMode: string;
  messageProcessing: ReturnType<typeof getMessageProcessingModeHealth>;
  pilotStage: string;
  pilotReplyMode: string;
  publicBetaEnabled: boolean;
}): KillSwitchStatus[] {
  const rows: KillSwitchStatus[] = [
    {
      key: "SMS_SENDS_DISABLED",
      currentValue: String(input.sms.sendsDisabled),
      expectedSafeValue: "true",
      safe: input.sms.sendsDisabled,
      severity: input.sms.sendsDisabled ? "safe" : "danger",
      recommendedOperatorAction: input.sms.sendsDisabled
        ? "No action."
        : "Follow rollback runbook and set SMS_SENDS_DISABLED=true.",
    },
    {
      key: "PUBLIC_LAUNCH_ENABLED",
      currentValue: String(input.sms.publicLaunchEnabled),
      expectedSafeValue: "false",
      safe: !input.sms.publicLaunchEnabled,
      severity: input.sms.publicLaunchEnabled ? "danger" : "safe",
      recommendedOperatorAction: input.sms.publicLaunchEnabled
        ? "Disable public launch and review incident runbook."
        : "No action.",
    },
    {
      key: "PUBLIC_BETA_ENABLED",
      currentValue: String(input.publicBetaEnabled),
      expectedSafeValue: "false before explicit public-beta approval",
      safe: !input.publicBetaEnabled,
      severity: input.publicBetaEnabled ? "warn" : "safe",
      recommendedOperatorAction: input.publicBetaEnabled
        ? "Confirm public beta was explicitly approved or disable it."
        : "No action.",
    },
    {
      key: "SMS_REQUIRE_ALLOWLIST",
      currentValue: String(input.sms.allowlistRequired),
      expectedSafeValue: "true",
      safe: input.sms.allowlistRequired,
      severity: input.sms.allowlistRequired ? "safe" : "danger",
      recommendedOperatorAction: input.sms.allowlistRequired
        ? "No action."
        : "Restore SMS_REQUIRE_ALLOWLIST=true before pilot traffic.",
    },
    {
      key: "TWILIO_VALIDATE_WEBHOOKS",
      currentValue: String(input.sms.webhookValidationEnabled),
      expectedSafeValue: "true",
      safe: input.sms.webhookValidationEnabled,
      severity: input.sms.webhookValidationEnabled ? "safe" : "danger",
      recommendedOperatorAction: input.sms.webhookValidationEnabled
        ? "No action."
        : "Restore Twilio webhook validation before accepting Twilio traffic.",
    },
    {
      key: "LLM_MODE",
      currentValue: input.llmMode,
      expectedSafeValue: "fallback, shadow, or active_mock",
      safe: input.llmMode !== "active_live",
      severity: input.llmMode === "active_live" ? "danger" : "safe",
      recommendedOperatorAction:
        input.llmMode === "active_live"
          ? "Set LLM_MODE to fallback, shadow, or active_mock."
          : "No action.",
    },
    {
      key: "MESSAGE_PROCESSING_MODE",
      currentValue: input.messageProcessing.messageProcessingMode,
      expectedSafeValue: "sync unless async_shadow is being tested",
      safe: input.messageProcessing.messageProcessingMode !== "async_active",
      severity:
        input.messageProcessing.messageProcessingMode === "async_active"
          ? "danger"
          : input.messageProcessing.messageProcessingMode === "async_shadow"
            ? "warn"
            : "safe",
      recommendedOperatorAction:
        input.messageProcessing.messageProcessingMode === "async_active"
          ? "Set MESSAGE_PROCESSING_MODE=sync before launch rehearsal."
          : "No action.",
    },
    {
      key: "PILOT_STAGE",
      currentValue: input.pilotStage,
      expectedSafeValue: "internal_test until A2P/self-test evidence is complete",
      safe: !["public_live", "capped_public_beta"].includes(input.pilotStage),
      severity: ["public_live", "capped_public_beta"].includes(input.pilotStage)
        ? "danger"
        : input.pilotStage === "public_candidate"
          ? "warn"
          : "safe",
      recommendedOperatorAction:
        input.pilotStage === "public_live"
          ? "Return to internal_test/design_partner until public-live approval."
          : "No action.",
    },
    {
      key: "PILOT_REPLY_MODE",
      currentValue: input.pilotReplyMode,
      expectedSafeValue: "draft_only or manual_approval until live gates pass",
      safe: input.pilotReplyMode !== "auto_allowlisted",
      severity: input.pilotReplyMode === "auto_allowlisted" ? "warn" : "safe",
      recommendedOperatorAction:
        input.pilotReplyMode === "auto_allowlisted"
          ? "Confirm all live reply gates before using auto_allowlisted."
          : "No action.",
    },
  ];

  return rows;
}

async function collectCommandCenterDbSignals(): Promise<CommandCenterDbSignals> {
  if (!process.env.DATABASE_URL) {
    return {
      recentCriticalAuditEvents: null,
      lastCommandCenterEvaluationAt: null,
      lastObservabilityDailyReportAt: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentCriticalAuditEvents, lastCommandCenterEvaluation] =
      await Promise.all([
        getDb().auditLog.count({
          where: {
            action: {
              in: [
                "live_reply.sent",
                "message.send_blocked",
                "pipeline.inbound_job_failed",
                "llm.call_failed",
                "access.unknown_inbound_blocked",
                "data_ops.redaction_failed",
                "launch_drill.blocker_detected",
                commandCenterAuditEvents.blockerDetected,
              ],
            },
            createdAt: { gte: since },
          },
        }),
        getDb().auditLog.findFirst({
          where: { action: commandCenterAuditEvents.readinessEvaluated },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    return {
      recentCriticalAuditEvents,
      lastCommandCenterEvaluationAt:
        lastCommandCenterEvaluation?.createdAt.toISOString() || null,
      lastObservabilityDailyReportAt: null,
    };
  } catch {
    return {
      recentCriticalAuditEvents: null,
      lastCommandCenterEvaluationAt: null,
      lastObservabilityDailyReportAt: null,
    };
  }
}

function buildRunbooks(): RunbookStatus[] {
  return [
    runbook("outbound_self_test", "Outbound self-test runbook", "docs/outbound-sms-self-test-runbook.md"),
    runbook("post_a2p_self_test_plan", "Post-A2P one-number self-test v0.9", "docs/post-a2p-one-number-self-test-v0.9.md"),
    runbook("post_a2p_self_test_checklist", "Post-A2P self-test checklist", "docs/post-a2p-self-test-checklist.md"),
    runbook("design_partner_checklist", "Design partner launch checklist", "docs/design-partner-launch-checklist.md"),
    runbook("design_partner_pilot_script", "Design partner pilot script v0.8", "docs/design-partner-pilot-script-v0.8.md"),
    runbook("design_partner_feedback_questions", "Design partner feedback questions", "docs/design-partner-feedback-questions.md"),
    runbook("design_partner_operator_checklist", "Design partner operator checklist", "docs/design-partner-operator-checklist.md"),
    runbook("rollback", "Pilot rollback runbook", "docs/pilot-rollback-runbook.md"),
    runbook("incident", "Incident response runbook", "docs/incident-response-runbook.md"),
    runbook("data_incident", "Pilot data incident runbook", "docs/pilot-data-incident-runbook.md"),
    runbook("a2p_packet", "A2P compliance packet", "docs/a2p-compliance-packet.md"),
    runbook("transcript_dry_runs", "Transcript dry runs", "docs/design-partner-transcript-dry-runs.md"),
    runbook("beta_cohort_simulation", "Beta cohort simulation", "docs/beta-cohort-simulation.md"),
    runbook("design_partner_simulation_report", "Design partner simulation report template", "docs/design-partner-simulation-report-template.md"),
    runbook("release_candidate", "Release candidate v0.1", "docs/release-candidate-v0.1.md"),
    runbook("rc_readiness_matrix", "RC readiness matrix", "docs/rc-readiness-matrix.md"),
    runbook("post_a2p_playbook", "Post-A2P execution playbook", "docs/post-a2p-execution-playbook.md"),
    runbook("known_open_items", "Known open items", "docs/known-open-items.md"),
    runbook("llm_quality_review", "LLM quality review", "docs/llm-quality-review.md"),
    runbook("public_launch_foundations", "Public launch foundations", "docs/public-launch-foundations.md"),
    runbook("capped_public_beta", "Capped public beta infrastructure", "docs/capped-public-beta-infrastructure.md"),
    runbook("public_beta_landing_copy", "Public beta landing copy", "docs/public-beta-landing-copy.md"),
    runbook("abuse_rate_limit", "Abuse and rate-limit readiness", "docs/abuse-and-rate-limit-readiness.md"),
    runbook("talent_discovery", "Talent discovery engine", "docs/talent-discovery-engine-v0.1.md"),
    runbook("talent_research_quality", "Talent research quality", "docs/talent-research-quality-v0.2.md"),
    runbook("public_web_research_policy", "Public web research policy", "docs/public-web-research-policy.md"),
    runbook("public_web_live_dry_run", "Public web live dry run", "docs/public-web-research-live-dry-run-v0.4.md"),
  ];
}

function buildSafeActions(): SafeActionCard[] {
  return [
    {
      title: "View post-A2P self-test plan",
      description: "Review the one-number live-send test plan without enabling sends.",
      href: docHref("docs/post-a2p-one-number-self-test-v0.9.md"),
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View post-A2P self-test checklist",
      description: "Review the operator checklist for exactly one future test reply.",
      href: docHref("docs/post-a2p-self-test-checklist.md"),
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View design partner pilot script",
      description: "Review the 10-person pilot script, approved copy, and operator workflow.",
      href: docHref("docs/design-partner-pilot-script-v0.8.md"),
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View design partner operator checklist",
      description: "Review pre-A2P, post-A2P, self-test, internal-test, and design-partner gates.",
      href: docHref("docs/design-partner-operator-checklist.md"),
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View outbound self-test runbook",
      description: "Review the one-number self-test gates without sending SMS.",
      href: "/admin/launch-drill",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "Run launch readiness drill",
      description: "Record a simulation-only launch readiness audit trail.",
      href: "/admin/launch-drill",
      actionKind: "dry_run",
      dangerous: false,
    },
    {
      title: "View rollback runbook",
      description: "Open the rollback checklist before any live test.",
      href: "/admin/launch-drill",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View incident runbook",
      description: "Review detection, pause, preservation, and escalation paths.",
      href: "/admin/observability",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View transcript dry-run results",
      description: "Inspect simulated design-partner transcript readiness.",
      href: "/admin/transcript-dry-runs",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "Run beta cohort simulations",
      description: "Model 10, 25, 100, and over-capacity cohorts with fake data only.",
      href: "/admin/beta-simulations",
      actionKind: "dry_run",
      dangerous: false,
    },
    {
      title: "View LLM quality review",
      description: "Compare deterministic and OpenAI outputs before live usage.",
      href: "/admin/llm-review",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View data ops dashboard",
      description: "Check redacted exports, retention, and participant redaction tools.",
      href: "/admin/data-ops",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View public beta dashboard",
      description: "Review waitlist, consent, capacity, and public-beta blockers.",
      href: "/admin/public-beta",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View sourcing workbench",
      description: "Review internal-first talent search and public-research plans without outreach.",
      href: "/admin/sourcing",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View sourcing quality review",
      description: "Review candidate evidence strength and shortlist gates before any outreach workflow.",
      href: "/admin/sourcing-quality",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View public web live dry run",
      description: "Inspect the gated one-query research dry run without outreach or SMS.",
      href: "/admin/sourcing/public-web",
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "View release candidate package",
      description: "Review RC scope, blockers, known open items, and the post-A2P path.",
      href: docHref("docs/release-candidate-v0.1.md"),
      actionKind: "link",
      dangerous: false,
    },
    {
      title: "Run daily observability report",
      description: "Use npm run observability:daily-report in Railway SSH or locally.",
      href: "/admin/observability",
      actionKind: "dry_run",
      dangerous: false,
    },
  ];
}

function deriveOverallStatus(input: {
  observability: ObservabilitySummary;
  drill: LaunchReadinessDrillResult;
  switches: KillSwitchStatus[];
  messageProcessingMode: string;
}): CommandCenterRiskLevel {
  if (
    input.observability.risk.level === "red" ||
    input.drill.launchRiskLevel === "red" ||
    input.switches.some((item) => item.severity === "danger") ||
    input.messageProcessingMode === "async_active"
  ) {
    return "red";
  }
  if (
    input.observability.risk.level === "yellow" ||
    input.drill.launchRiskLevel === "yellow" ||
    input.switches.some((item) => item.severity === "warn") ||
    input.drill.globalBlockers.length > 0
  ) {
    return "yellow";
  }
  return "green";
}

export async function getCommandCenterSummary(): Promise<CommandCenterSummary> {
  const generatedAt = new Date().toISOString();
  const [
    observability,
    drill,
    outboundSelfTest,
    liveReplyReadiness,
    dbSignals,
    betaCohortSimulation,
    releaseCandidate,
    talentDiscovery,
    talentResearchQuality,
    conversationAutonomy,
  ] = await Promise.all([
    getObservabilitySummary(),
    evaluateLaunchReadinessDrill(),
    getOutboundSelfTestReadinessSnapshot(),
    getLiveReplyExecutionReadinessSnapshot(),
    collectCommandCenterDbSignals(),
    getBetaCohortSimulationHealthSnapshot(),
    getReleaseCandidateSummary(),
    getTalentDiscoveryHealthSnapshot(),
    getTalentResearchQualityHealthSnapshot(),
    getConversationAutonomyHealthSnapshot(),
  ]);
  const twilio = getTwilioConfigPresence();
  const llm = getLlmConfigPresence();
  const messageProcessing = getMessageProcessingModeHealth();
  const accessConfig = getPublicBetaAccessConfig();
  const publicBetaConfig = getCappedPublicBetaConfig();
  const [publicBetaWaitlist, publicBetaReadiness] = await Promise.all([
    getPublicBetaWaitlistHealthSnapshot(),
    evaluateCappedPublicBetaReadiness({
      observabilityRiskLevel: observability.risk.level,
      launchRiskLevel: drill.launchRiskLevel,
    }),
  ]);
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const docs = getLaunchDrillDocumentStatus();
  const runbooks = buildRunbooks();
  const switches = killSwitches({
    sms: observability.sms,
    llmMode: llm.modeEffective,
    messageProcessing,
    pilotStage: pilot.pilotStage,
    pilotReplyMode: pilot.pilotReplyMode,
    publicBetaEnabled: accessConfig.publicBetaEnabled,
  });
  const goNoGo = goNoGoItems({
    drill,
    outboundSelfTest,
    access: observability.pilot,
    publicBetaEnabled: accessConfig.publicBetaEnabled,
    publicBetaReadinessBlockers: publicBetaReadiness.blockers,
    publicLaunchEnabled: accessConfig.publicLaunchEnabled,
    generatedAt,
  });
  const designPartnerStage = drill.stages.find(
    (stage) => stage.id === "DESIGN_PARTNER_10",
  );
  const designPartnerPilotReady = designPartnerStage?.status === "READY";
  const designPartnerPilotBlockers = [
    ...(designPartnerStage?.blockers || []),
    ...(!docs.designPartnerPilotScriptExists
      ? ["Design partner pilot script is missing."]
      : []),
    ...(!docs.designPartnerFeedbackQuestionsExists
      ? ["Design partner feedback questions are missing."]
      : []),
    ...(!docs.designPartnerOperatorChecklistExists
      ? ["Design partner operator checklist is missing."]
      : []),
  ];
  const baseOverallStatus = deriveOverallStatus({
    observability,
    drill,
    switches,
    messageProcessingMode: messageProcessing.messageProcessingMode,
  });
  const overallStatus: CommandCenterRiskLevel =
    baseOverallStatus === "red" ||
    betaCohortSimulation.simulationRiskLevel === "red"
      ? "red"
      : baseOverallStatus === "yellow" ||
          betaCohortSimulation.simulationRiskLevel === "yellow"
        ? "yellow"
        : "green";
  const currentStage = toCommandStage(drill.currentRecommendedStage);
  const blockers = [
    ...observability.risk.blockers,
    ...drill.globalBlockers,
    ...betaCohortSimulation.blockers.map(
      (blocker) => `Beta cohort simulation: ${blocker}`,
    ),
    ...switches
      .filter((item) => item.severity === "danger")
      .map((item) => `${item.key}: ${item.recommendedOperatorAction}`),
  ];
  const warnings = [
    ...observability.risk.warnings,
    ...drill.globalWarnings,
    ...betaCohortSimulation.warnings.map(
      (warning) => `Beta cohort simulation: ${warning}`,
    ),
    ...switches
      .filter((item) => item.severity === "warn")
      .map((item) => `${item.key}: ${item.recommendedOperatorAction}`),
    ...(twilio.webhookValidationEnabled
      ? []
      : ["Twilio webhook validation is disabled."]),
    ...(conversationAutonomy.autonomyHandoffCount > 0
      ? ["Per-phone autonomy handoffs need review in Needs Attention."]
      : []),
  ];
  const outboundSelfTestHealth =
    safeOutboundSelfTestHealthSummary(outboundSelfTest);
  const postA2PSelfTest =
    evaluatePostA2POneNumberSelfTestReadiness();
  const liveReplyHealth = safeLiveReplyHealthSummary(liveReplyReadiness);

  const nextRecommendedAction =
    conversationAutonomy.autonomyHandoffCount > 0
      ? "Review autonomy handoffs in Needs Attention before continuing pilot replies."
      : drill.recommendedNextAction;

  const summary: CommandCenterSummary = {
    generatedAt,
    currentStage,
    configuredPilotStage: pilot.pilotStage,
    stageMismatch:
      currentStage.toLowerCase() !== pilot.pilotStage &&
      !(currentStage === "PRE_A2P_HOLD" && pilot.pilotStage === "internal_test"),
    overallStatus,
    nextRecommendedAction,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    app: observability.app,
    sms: {
      providerMode: observability.sms.providerMode,
      sendsDisabled: observability.sms.sendsDisabled,
      allowlistRequired: observability.sms.allowlistRequired,
      allowedNumbersCount: observability.sms.allowedNumbersCount,
      twilioStagingMode: observability.sms.twilioStagingMode,
      webhookValidationEnabled: observability.sms.webhookValidationEnabled,
      smsComplianceApproved: observability.sms.smsComplianceApproved,
      publicLaunchEnabled: observability.sms.publicLaunchEnabled,
      publicBetaEnabled: accessConfig.publicBetaEnabled,
      recentInboundCount: observability.sms.recentInboundCount,
      recentOutboundCount: observability.sms.recentOutboundCount,
      recentBlockedSendCount: observability.sms.recentBlockedSendCount,
      unexpectedOutboundDetected: observability.sms.unexpectedOutboundDetected,
    },
    llm: {
      providerEffective: observability.llm.providerEffective,
      modeEffective: observability.llm.modeEffective,
      model: observability.llm.model,
      shadowMode: observability.llm.shadowMode,
      activeMockAvailable: observability.llm.activeMockAvailable,
      activeLiveAllowed: observability.llm.activeLiveAllowed,
      recentCallCount: observability.llm.recentCallCount,
      recentFailureCount: observability.llm.recentFailureCount,
      recentFallbackCount: observability.llm.recentFallbackCount,
      warnings: llm.warnings,
    },
    pipeline: {
      messageProcessingMode: messageProcessing.messageProcessingMode,
      asyncProcessingAvailable: messageProcessing.asyncProcessingAvailable,
      asyncActiveEnabled: messageProcessing.asyncActiveEnabled,
      pendingJobs: observability.pipeline.pendingJobs,
      failedJobs: observability.pipeline.failedJobs,
      warnings: messageProcessing.warnings,
    },
    observability: {
      riskLevel: observability.risk.level,
      blockerCount: observability.risk.blockers.length,
      warningCount: observability.risk.warnings.length,
      recommendedActions: observability.risk.recommendedActions,
    },
    access: {
      smsAccessMode: accessConfig.smsAccessMode,
      accessModeEffective: accessConfig.accessModeEffective,
      publicAccessEnabled:
        accessConfig.accessModeEffective === "capped_public_beta" &&
        accessConfig.publicBetaEnabled &&
        accessConfig.smsComplianceApproved,
      publicBetaEnabled: accessConfig.publicBetaEnabled,
      publicLaunchEnabled: accessConfig.publicLaunchEnabled,
      maxActiveParticipants: accessConfig.maxActiveParticipants,
      currentActiveParticipants: observability.pilot.capUsage.active,
      waitlistedParticipantCount: observability.pilot.waitlistedParticipants,
      inviteCodeCount: observability.pilot.inviteCodeCount,
      recentBlockedInboundCount: observability.pilot.recentBlockedInboundCount,
    },
    pilot: {
      pilotStage: observability.pilot.pilotStage,
      pilotReplyMode: observability.pilot.pilotReplyMode,
      activeParticipants: observability.pilot.activeParticipants,
      waitlistedParticipants: observability.pilot.waitlistedParticipants,
      pausedParticipants: observability.pilot.pausedParticipants,
      optedOutParticipants: observability.pilot.optedOutParticipants,
      participantCap: accessConfig.maxActiveParticipants,
      recentFeedbackCount: observability.pilot.recentFeedbackCount,
      transcriptDryRuns: {
        available: docs.transcriptDryRunsDocExists,
        docExists: docs.transcriptDryRunsDocExists,
        lastRunAt: null,
        latestAverageScore: null,
        readyForDesignPartners: false,
      },
    },
    designPartnerPilot: {
      designPartnerPilotScriptAvailable: docs.designPartnerPilotScriptExists,
      designPartnerFeedbackQuestionsAvailable:
        docs.designPartnerFeedbackQuestionsExists,
      designPartnerOperatorChecklistAvailable:
        docs.designPartnerOperatorChecklistExists,
      designPartnerPilotReady,
      designPartnerPilotBlockers: [...new Set(designPartnerPilotBlockers)],
      nextOperatorAction: designPartnerPilotReady
        ? "Run a final command-center review before manually inviting any design partner."
        : "Keep the design-partner pilot blocked until A2P, one-number self-test, internal test, docs, observability, access, and data-ops evidence pass.",
    },
    dataOps: {
      pilotDataOpsAvailable: observability.dataOps.pilotDataOpsAvailable,
      exportCountRecent: observability.dataOps.exportCountRecent,
      redactionCountRecent: observability.dataOps.redactionCountRecent,
      participantsPausedCount: observability.dataOps.participantsPausedCount,
      participantsOptedOutCount: observability.dataOps.participantsOptedOutCount,
      dataOpsWarnings: observability.dataOps.dataOpsWarnings,
      retentionPolicyExists: observability.dataOps.retentionPolicyExists,
      backupRunbookExists: docExists("docs/pilot-backup-restore-runbook.md"),
      incidentRunbookExists: observability.dataOps.incidentRunbookExists,
    },
    producer: {
      ...observability.producer,
      sendReadinessAvailable: pilot.sendReadinessAvailable,
      outboundSelfTestReady: outboundSelfTestHealth.outboundSelfTestReady,
      outboundSelfTestStatus:
        outboundSelfTestHealth.outboundSelfTestReadinessStatus,
      liveReplyExecutionAvailable:
        liveReplyHealth.liveReplyExecutionAvailable,
      autonomousRepliesEnabled: liveReplyHealth.autonomousRepliesEnabled,
      autonomousReplyBlockerCount:
        liveReplyHealth.autonomousReplyBlockerCount,
    },
    conversationAutonomy: {
      perPhoneAutonomyAvailable:
        conversationAutonomy.perPhoneAutonomyAvailable,
      autonomousParticipantsCount:
        conversationAutonomy.autonomousParticipantsCount,
      manualReviewParticipantsCount:
        conversationAutonomy.manualReviewParticipantsCount,
      pausedParticipantsCount:
        conversationAutonomy.pausedParticipantsCount,
      autonomyHandoffCount: conversationAutonomy.autonomyHandoffCount,
      candidateOutreachHandoffCount:
        conversationAutonomy.candidateOutreachHandoffCount,
    },
    postA2PSelfTest: {
      postA2PSelfTestPlanAvailable:
        postA2PSelfTest.postA2PSelfTestPlanAvailable,
      postA2PSelfTestChecklistAvailable:
        postA2PSelfTest.postA2PSelfTestChecklistAvailable,
      oneNumberSelfTestReady: postA2PSelfTest.oneNumberSelfTestReady,
      oneNumberSelfTestBlockers:
        postA2PSelfTest.oneNumberSelfTestBlockers,
      nextPostA2PAction: postA2PSelfTest.expectedNextAction,
    },
    launchDrill: {
      currentRecommendedStage: drill.currentRecommendedStage,
      riskLevel: drill.launchRiskLevel,
      blockerCount: drill.globalBlockers.length,
      warningCount: drill.globalWarnings.length,
      lastRunAt: observability.launchDrill.lastLaunchDrillRunAt,
      designPartnerLaunchReady:
        drill.stages.find((stage) => stage.id === "DESIGN_PARTNER_10")
          ?.status === "READY",
      publicBetaCandidateReady:
        drill.stages.find((stage) => stage.id === "PUBLIC_BETA_CANDIDATE")
          ?.status === "READY",
    },
    publicBeta: {
      publicBetaEnabled: publicBetaConfig.publicBetaEnabled,
      publicBetaLandingEnabled: publicBetaConfig.publicBetaLandingEnabled,
      publicBetaWaitlistEnabled: publicBetaConfig.publicBetaWaitlistEnabled,
      publicBetaPublicNumberVisible:
        publicBetaConfig.publicBetaPublicNumberVisible,
      publicLaunchEnabled: publicBetaConfig.publicLaunchEnabled,
      publicBetaReady: publicBetaReadiness.publicBetaReady,
      publicBetaBlockerCount: publicBetaReadiness.blockers.length,
      publicBetaBlockers: publicBetaReadiness.blockers,
      publicLaunchReady: false,
      accessMode: accessConfig.accessModeEffective,
      maxActiveParticipants: publicBetaConfig.publicBetaMaxActiveParticipants,
      newUserDailyCap: publicBetaConfig.publicBetaNewUserDailyCap,
      waitlistCount: publicBetaWaitlist.publicBetaWaitlistCount,
      admittedCount: publicBetaWaitlist.publicBetaAdmittedCount,
      pausedCount: publicBetaWaitlist.publicBetaPausedCount,
      rejectedCount: publicBetaWaitlist.publicBetaRejectedCount,
      dailyNewUserCount: publicBetaWaitlist.publicBetaDailyNewUserCount,
      supportContactConfigured: publicBetaConfig.supportEmailConfigured,
      privacyUrlConfigured: publicBetaConfig.privacyUrlConfigured,
      termsUrlConfigured: publicBetaConfig.termsUrlConfigured,
      publicLaunchFoundationsDocExists: docs.publicLaunchFoundationsExists,
      abuseRateLimitDocExists: docExists("docs/abuse-and-rate-limit-readiness.md"),
      productionAppIntegrationStatus: "NOT_CONNECTED",
    },
    betaCohortSimulation,
    talentDiscovery,
    talentResearchQuality,
    candidateGraph: observability.candidateGraph,
    matchingEvaluation: observability.matchingEvaluation,
    releaseCandidate: {
      releaseCandidateVersion: releaseCandidate.releaseCandidateVersion,
      releaseCandidateTag: releaseCandidate.releaseCandidateTag,
      releaseCandidateStatus: releaseCandidate.releaseCandidateStatus,
      releaseCandidateBlockers: releaseCandidate.blockers,
      releaseCandidateBlockerCount: releaseCandidate.blockers.length,
      postA2PNextAction: releaseCandidate.postA2PNextAction,
      currentRecommendedAction: releaseCandidate.currentRecommendedAction,
    },
    goNoGo,
    killSwitches: switches,
    incidentReadiness: {
      incidentRunbookExists: docs.incidentRunbookExists,
      rollbackRunbookExists: docs.pilotRollbackRunbookExists,
      dataIncidentRunbookExists: docs.dataIncidentRunbookExists,
      lastLaunchDrillRunAt: observability.launchDrill.lastLaunchDrillRunAt,
      lastObservabilityDailyReportAt: dbSignals.lastObservabilityDailyReportAt,
      currentRiskLevel: overallStatus,
      recentCriticalAuditEvents: dbSignals.recentCriticalAuditEvents,
      recentUnexpectedOutboundCount: observability.sms.unexpectedOutboundDetected
        ? observability.sms.recentOutboundCount
        : 0,
      recentFailedJobs: observability.pipeline.failedJobs,
      recentLlmFailures: observability.llm.recentFailureCount,
      recentBlockedSends: observability.sms.recentBlockedSendCount,
      recentOptOuts: observability.pilot.optedOutParticipants,
    },
    runbooks,
    safeActions: buildSafeActions(),
    dryRunOnly: true,
    noSmsSent: true,
    noTwilioSendCall: true,
    noProductionSagaAppData: true,
  };

  return safeCommandCenterSummary(summary);
}

export function safeCommandCenterSummary<T>(value: T): T {
  return redactSensitiveJson(value) as T;
}

export async function getCommandCenterHealthSnapshot() {
  const sms = getSmsSafetyHealth();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const llm = getLlmConfigPresence();
  const messageProcessing = getMessageProcessingModeHealth();
  const [launch, conversationAutonomy] = await Promise.all([
    getLaunchDrillHealthSnapshot(),
    getConversationAutonomyHealthSnapshot(),
  ]);
  const blockers = [
    ...(!pilot.complianceApproved ? ["sms_compliance_not_approved"] : []),
    ...(sms.sendsDisabled ? ["sends_disabled"] : []),
    ...(pilot.publicLaunchEnabled ? ["public_launch_enabled"] : []),
    ...(llm.activeLiveAllowed ? ["active_live_allowed"] : []),
    ...(messageProcessing.messageProcessingMode === "async_active"
      ? ["async_active_enabled"]
      : []),
    ...(!sms.allowlistRequired ? ["allowlist_not_required"] : []),
  ];
  const riskLevel: CommandCenterRiskLevel =
    pilot.publicLaunchEnabled ||
    llm.activeLiveAllowed ||
    messageProcessing.messageProcessingMode === "async_active" ||
    (!sms.sendsDisabled && !pilot.complianceApproved)
      ? "red"
      : blockers.length || launch.launchRiskLevel === "yellow"
        ? "yellow"
        : "green";

  return {
    commandCenterAvailable: true,
    commandCenterRiskLevel: riskLevel,
    commandCenterBlockerCount: blockers.length,
    currentRecommendedLaunchStage: launch.currentRecommendedLaunchStage,
    perPhoneAutonomyAvailable:
      conversationAutonomy.perPhoneAutonomyAvailable,
    autonomousParticipantsCount:
      conversationAutonomy.autonomousParticipantsCount,
    manualReviewParticipantsCount:
      conversationAutonomy.manualReviewParticipantsCount,
    pausedParticipantsCount: conversationAutonomy.pausedParticipantsCount,
    autonomyHandoffCount: conversationAutonomy.autonomyHandoffCount,
    candidateOutreachHandoffCount:
      conversationAutonomy.candidateOutreachHandoffCount,
  };
}

async function auditCommandCenterEvent(input: {
  action: string;
  summary: Pick<
    CommandCenterSummary,
    "currentStage" | "overallStatus" | "blockers" | "warnings"
  >;
  dryRunAction?: string | null;
  notes?: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  await logAudit({
    actorType: "ADMIN",
    action: input.action,
    entityType: "CommandCenter",
    entityId: input.summary.currentStage,
    metadata: {
      currentStage: input.summary.currentStage,
      riskLevel: input.summary.overallStatus,
      blockersCount: input.summary.blockers.length,
      warningsCount: input.summary.warnings.length,
      dryRunAction: input.dryRunAction || null,
      hasNotes: Boolean(input.notes),
      noSmsSent: true,
      noTwilioSendCall: true,
      noSecrets: true,
    },
  });
}

export async function recordCommandCenterViewed() {
  const summary = await getCommandCenterSummary();
  await auditCommandCenterEvent({
    action: commandCenterAuditEvents.viewed,
    summary,
  });
  return summary;
}

export async function evaluateCommandCenterForAdmin(input?: {
  notes?: string | null;
}) {
  const summary = await getCommandCenterSummary();
  await auditCommandCenterEvent({
    action: commandCenterAuditEvents.dryRunActionInvoked,
    summary,
    dryRunAction: "command_center_readiness_evaluation",
    notes: input?.notes,
  });
  await auditCommandCenterEvent({
    action: commandCenterAuditEvents.readinessEvaluated,
    summary,
    notes: input?.notes,
  });
  await auditCommandCenterEvent({
    action: commandCenterAuditEvents.launchStageRecommended,
    summary,
  });
  if (summary.blockers.length > 0) {
    await auditCommandCenterEvent({
      action: commandCenterAuditEvents.blockerDetected,
      summary,
    });
  }
  return summary;
}

export function formatCommandCenterReport(summary: CommandCenterSummary) {
  const lines = [
    "# Saga SMS Producer Operator Command Center",
    "",
    `Generated: ${summary.generatedAt}`,
    `Current stage: ${summary.currentStage}`,
    `Configured pilot stage: ${summary.configuredPilotStage}`,
    `Overall status: ${summary.overallStatus}`,
    `Next recommended action: ${summary.nextRecommendedAction}`,
    "",
    "## Go / No-Go",
    ...summary.goNoGo.map(
      (item) =>
        `- ${item.title}: ${item.status} (${item.blockers.length} blockers, ${item.warnings.length} warnings)`,
    ),
    "",
    "## Blockers",
    ...(summary.blockers.length
      ? summary.blockers.map((blocker) => `- ${blocker}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(summary.warnings.length
      ? summary.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
    "",
    "## SMS Safety",
    `- Provider mode: ${summary.sms.providerMode}`,
    `- Sends disabled: ${summary.sms.sendsDisabled}`,
    `- Allowlist required: ${summary.sms.allowlistRequired}`,
    `- Compliance approved: ${summary.sms.smsComplianceApproved}`,
    `- Public beta enabled: ${summary.sms.publicBetaEnabled}`,
    `- Public launch enabled: ${summary.sms.publicLaunchEnabled}`,
    "",
    "## LLM Status",
    `- Provider: ${summary.llm.providerEffective}`,
    `- Mode: ${summary.llm.modeEffective}`,
    `- Active live allowed: ${summary.llm.activeLiveAllowed}`,
    `- Recent failures: ${summary.llm.recentFailureCount}`,
    "",
    "## Pipeline",
    `- Mode: ${summary.pipeline.messageProcessingMode}`,
    `- Pending jobs: ${summary.pipeline.pendingJobs ?? "n/a"}`,
    `- Failed jobs: ${summary.pipeline.failedJobs ?? "n/a"}`,
    "",
    "## Access and Data Ops",
    `- Access mode: ${summary.access.accessModeEffective}`,
    `- Active participants: ${summary.pilot.activeParticipants}`,
    `- Waitlisted participants: ${summary.pilot.waitlistedParticipants ?? "n/a"}`,
    `- Data ops available: ${summary.dataOps.pilotDataOpsAvailable}`,
    "",
    "## Post-A2P One-Number Self-Test",
    `- Plan available: ${summary.postA2PSelfTest.postA2PSelfTestPlanAvailable}`,
    `- Checklist available: ${summary.postA2PSelfTest.postA2PSelfTestChecklistAvailable}`,
    `- Ready: ${summary.postA2PSelfTest.oneNumberSelfTestReady}`,
    `- Blockers: ${summary.postA2PSelfTest.oneNumberSelfTestBlockers.length}`,
    `- Next action: ${summary.postA2PSelfTest.nextPostA2PAction}`,
    "",
    "## Design Partner Pilot Package",
    `- Script available: ${summary.designPartnerPilot.designPartnerPilotScriptAvailable}`,
    `- Feedback questions available: ${summary.designPartnerPilot.designPartnerFeedbackQuestionsAvailable}`,
    `- Operator checklist available: ${summary.designPartnerPilot.designPartnerOperatorChecklistAvailable}`,
    `- Pilot ready: ${summary.designPartnerPilot.designPartnerPilotReady}`,
    `- Pilot blockers: ${summary.designPartnerPilot.designPartnerPilotBlockers.length}`,
    `- Next operator action: ${summary.designPartnerPilot.nextOperatorAction}`,
    "",
    "## Public Beta",
    `- Public beta ready: ${summary.publicBeta.publicBetaReady}`,
    `- Landing enabled: ${summary.publicBeta.publicBetaLandingEnabled}`,
    `- Waitlist enabled: ${summary.publicBeta.publicBetaWaitlistEnabled}`,
    `- Public number visible: ${summary.publicBeta.publicBetaPublicNumberVisible}`,
    `- Waitlist entries: ${summary.publicBeta.waitlistCount ?? "n/a"}`,
    `- Admitted/cap: ${summary.publicBeta.admittedCount ?? "n/a"}/${summary.publicBeta.maxActiveParticipants}`,
    `- Public beta blockers: ${summary.publicBeta.publicBetaBlockerCount}`,
    "",
    "## Beta Cohort Simulation",
    `- Available: ${summary.betaCohortSimulation.betaCohortSimulationAvailable}`,
    `- Simulation risk: ${summary.betaCohortSimulation.simulationRiskLevel}`,
    `- Simulation blockers: ${summary.betaCohortSimulation.simulationBlockerCount}`,
    `- Design partner simulation ready: ${summary.betaCohortSimulation.designPartnerSimulationReady}`,
    `- Private beta simulation ready: ${summary.betaCohortSimulation.privateBetaSimulationReady}`,
    `- Public beta simulation ready: ${summary.betaCohortSimulation.publicBetaSimulationReady}`,
    `- Latest run: ${summary.betaCohortSimulation.latestRunAt ?? "n/a"}`,
    "",
    "## Talent Discovery",
    `- Available: ${summary.talentDiscovery.talentDiscoveryAvailable}`,
    `- Recent internal searches: ${summary.talentDiscovery.recentInternalSearchCount ?? "n/a"}`,
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
    "## Release Candidate",
    `- Version: ${summary.releaseCandidate.releaseCandidateVersion}`,
    `- Tag: ${summary.releaseCandidate.releaseCandidateTag}`,
    `- Status: ${summary.releaseCandidate.releaseCandidateStatus}`,
    `- Blockers: ${summary.releaseCandidate.releaseCandidateBlockerCount}`,
    `- Post-A2P next action: ${summary.releaseCandidate.postA2PNextAction}`,
    "",
    "No SMS was sent. No Twilio send API was called. No public launch, design partner invite, group chat, shortlist send, candidate outreach, or production Saga app integration was triggered.",
  ];

  return String(redactSensitiveJson(lines.join("\n")));
}

export function formatCommandCenterWithObservabilityReport(input: {
  commandCenter: CommandCenterSummary;
  observability: ObservabilitySummary;
}) {
  return [
    formatCommandCenterReport(input.commandCenter),
    "",
    "---",
    "",
    formatObservabilityDailyReport(input.observability),
  ].join("\n");
}
