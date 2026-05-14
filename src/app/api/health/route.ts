import { getDb } from "@/sms-engine/db";
import {
  getDeploymentInfo,
  getTwilioConfigPresence,
} from "@/sms-engine/env";
import { getConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { getPublicBetaAccessHealthSnapshot } from "@/sms-engine/access/accessControl";
import {
  getLiveReplyExecutionReadinessSnapshot,
  safeLiveReplyHealthSummary,
} from "@/sms-engine/conversation/liveReplyExecutor";
import { getConversationAutonomyHealthSnapshot } from "@/sms-engine/conversation/conversationAutonomy";
import { safeLlmHealth } from "@/sms-engine/llm/llmProvider";
import { logServerError } from "@/sms-engine/safeLogging";
import { getDesignPartnerPilotReadinessSnapshot } from "@/sms-engine/pilotReadiness";
import {
  getOutboundSelfTestReadinessSnapshot,
  safeOutboundSelfTestHealthSummary,
} from "@/sms-engine/producer/outboundSelfTestReadiness";
import { getLlmQualityReviewHealthSnapshot } from "@/sms-engine/llm/qualityReview";
import { getMessagingPipelineHealthSnapshot } from "@/sms-engine/messagingPipeline";
import { getObservabilityHealthSnapshot } from "@/sms-engine/observability/observabilitySummary";
import { getPilotDataOpsHealthSnapshot } from "@/sms-engine/dataOps/pilotExport";
import { getLaunchDrillHealthSnapshot } from "@/sms-engine/launchDrill/launchReadinessDrill";
import { getCommandCenterHealthSnapshot } from "@/sms-engine/commandCenter/commandCenterSummary";
import { getBetaCohortSimulationHealthSnapshot } from "@/sms-engine/cohortSimulation/runCohortSimulation";
import { evaluateCappedPublicBetaReadiness } from "@/sms-engine/publicBeta/publicBetaAdmission";
import { getCappedPublicBetaHealthSnapshot } from "@/sms-engine/publicBeta/publicBetaConfig";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";
import { getTalentDiscoveryHealthSnapshot } from "@/sms-engine/sourcing/talentDiscoveryHealth";
import { getTalentResearchQualityHealthSnapshot } from "@/sms-engine/sourcing/talentResearchQuality";
import { getCandidateGraphHealthSnapshot } from "@/sms-engine/graph/candidateGraphHealth";
import { getMatchingEvaluationHealthSnapshot } from "@/sms-engine/matchingEval/matchingEvaluationHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return "not_configured";
  }

  try {
    await getDb().$queryRaw`SELECT 1`;
    return "connected";
  } catch (error) {
    logServerError("Health check database failure", error);
    return "error";
  }
}

export async function GET() {
  const database = await checkDatabase();
  const twilio = getTwilioConfigPresence();
  const sms = getSmsSafetyHealth();
  const conversationEngine = getConversationEngineRuntime({
    providerMode: sms.providerMode,
  });
  const llm = safeLlmHealth();
  const llmQualityReview = await getLlmQualityReviewHealthSnapshot();
  const deployment = getDeploymentInfo();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const outboundSelfTestReadiness =
    await getOutboundSelfTestReadinessSnapshot();
  const outboundSelfTest = safeOutboundSelfTestHealthSummary(
    outboundSelfTestReadiness,
  );
  const liveReplyReadiness = await getLiveReplyExecutionReadinessSnapshot();
  const liveReplyExecution = safeLiveReplyHealthSummary(liveReplyReadiness);
  const conversationAutonomy = await getConversationAutonomyHealthSnapshot();
  const messagingPipeline = await getMessagingPipelineHealthSnapshot();
  const observability = await getObservabilityHealthSnapshot();
  const publicBetaAccess = await getPublicBetaAccessHealthSnapshot();
  const pilotDataOps = await getPilotDataOpsHealthSnapshot();
  const launchDrill = await getLaunchDrillHealthSnapshot();
  const commandCenter = await getCommandCenterHealthSnapshot();
  const betaCohortSimulation = await getBetaCohortSimulationHealthSnapshot({
    runFreshWhenNoDb: false,
  });
  const cappedPublicBetaReadiness = await evaluateCappedPublicBetaReadiness({
    launchRiskLevel: launchDrill.launchRiskLevel,
    observabilityRiskLevel: observability.riskLevel,
  });
  const cappedPublicBeta = await getCappedPublicBetaHealthSnapshot({
    publicBetaReady: cappedPublicBetaReadiness.publicBetaReady,
    publicBetaBlockerCount: cappedPublicBetaReadiness.blockers.length,
  });
  const talentDiscovery = await getTalentDiscoveryHealthSnapshot();
  const talentResearchQuality =
    await getTalentResearchQualityHealthSnapshot();
  const candidateGraph = await getCandidateGraphHealthSnapshot();
  const matchingEvaluation = getMatchingEvaluationHealthSnapshot();
  const smsHealth = {
    ...sms,
    smsComplianceApproved: pilot.complianceApproved,
    publicLaunchEnabled: pilot.publicLaunchEnabled,
    pilotStage: pilot.pilotStage,
    pilotReplyMode: pilot.pilotReplyMode,
    autoRepliesEnabled: pilot.autoRepliesEnabled,
    sendReadinessAvailable: true,
    ...outboundSelfTest,
    ...liveReplyExecution,
  };
  const app = {
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
    internalApiConfigured: Boolean(process.env.INTERNAL_API_KEY),
    demoModeAvailable: true,
    conversationEngineMode: conversationEngine.mode,
    conversationEngineActive: conversationEngine.effectiveActive,
    conversationEngineEffectiveActive: conversationEngine.effectiveActive,
    conversationEngineActiveAllowed: conversationEngine.activeAllowed,
    sendReadinessAvailable: true,
    outboundSelfTestReadinessAvailable:
      outboundSelfTest.outboundSelfTestReadinessAvailable,
    liveReplyExecutionAvailable:
      liveReplyExecution.liveReplyExecutionAvailable,
    perPhoneAutonomyAvailable:
      conversationAutonomy.perPhoneAutonomyAvailable,
    messageProcessingMode: messagingPipeline.messageProcessingMode,
    asyncProcessingAvailable: messagingPipeline.asyncProcessingAvailable,
    observabilityAvailable: observability.observabilityAvailable,
    publicBetaAccessAvailable: publicBetaAccess.publicBetaAccessAvailable,
    pilotDataOpsAvailable: pilotDataOps.pilotDataOpsAvailable,
    launchDrillAvailable: launchDrill.launchDrillAvailable,
    commandCenterAvailable: commandCenter.commandCenterAvailable,
    betaCohortSimulationAvailable:
      betaCohortSimulation.betaCohortSimulationAvailable,
    cappedPublicBetaInfrastructureAvailable:
      cappedPublicBeta.cappedPublicBetaInfrastructureAvailable,
    talentDiscoveryAvailable: talentDiscovery.talentDiscoveryAvailable,
    publicWebResearchShadowAvailable:
      talentDiscovery.publicWebResearchShadowAvailable,
    publicWebResearchLiveDryRunAvailable:
      talentDiscovery.publicWebResearchLiveDryRunAvailable,
    publicWebResearchAsyncAvailable:
      talentDiscovery.publicWebResearchAsyncAvailable,
    publicWebResearchReviewAvailable:
      talentDiscovery.publicWebResearchReviewAvailable,
    talentResearchQualityAvailable:
      talentResearchQuality.talentResearchQualityAvailable,
    candidateGraphAvailable: candidateGraph.candidateGraphAvailable,
    relationshipAwareMatchingAvailable:
      candidateGraph.relationshipAwareMatchingAvailable,
    matchingEvaluationAvailable:
      matchingEvaluation.matchingEvaluationAvailable,
  };

  return Response.json(
    {
      ok:
        database === "connected" &&
        app.adminConfigured &&
        app.appBaseUrlConfigured,
      database,
      twilio,
      sms: smsHealth,
      pilot,
      outboundSelfTest,
      liveReplyExecution,
      conversationAutonomy: {
        perPhoneAutonomyAvailable:
          conversationAutonomy.perPhoneAutonomyAvailable,
        autonomousParticipantCount:
          conversationAutonomy.autonomousParticipantCount,
        manualReviewParticipantCount:
          conversationAutonomy.manualReviewParticipantCount,
        pausedParticipantCount:
          conversationAutonomy.pausedParticipantCount,
        autonomyHandoffCount: conversationAutonomy.autonomyHandoffCount,
      },
      messagingPipeline,
      observability,
      publicBetaAccess,
      pilotDataOps: {
        pilotDataOpsAvailable: pilotDataOps.pilotDataOpsAvailable,
        dataOpsWarningsCount: pilotDataOps.dataOpsWarningsCount,
        retentionPolicyAvailable: pilotDataOps.retentionPolicyAvailable,
        backupRunbookAvailable: pilotDataOps.backupRunbookAvailable,
      },
      launchDrill: {
        launchDrillAvailable: launchDrill.launchDrillAvailable,
        launchRiskLevel: launchDrill.launchRiskLevel,
        launchBlockerCount: launchDrill.launchBlockerCount,
        currentRecommendedLaunchStage:
          launchDrill.currentRecommendedLaunchStage,
      },
      commandCenter,
      betaCohortSimulation: {
        betaCohortSimulationAvailable:
          betaCohortSimulation.betaCohortSimulationAvailable,
        simulationRiskLevel: betaCohortSimulation.simulationRiskLevel,
        simulationBlockerCount: betaCohortSimulation.simulationBlockerCount,
        designPartnerSimulationReady:
          betaCohortSimulation.designPartnerSimulationReady,
        publicBetaSimulationReady:
          betaCohortSimulation.publicBetaSimulationReady,
        latestRunAt: betaCohortSimulation.latestRunAt,
      },
      cappedPublicBeta,
      talentDiscovery,
      publicWebResearch: {
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
        publicWebResearchProvider: talentDiscovery.publicWebResearchProvider,
        publicWebResearchRequireCitations:
          talentDiscovery.publicWebResearchRequireCitations,
        publicWebResearchLiveDryRunAllowed:
          talentDiscovery.publicWebResearchLiveDryRunAllowed,
        publicWebResearchMaxResults:
          talentDiscovery.publicWebResearchMaxResults,
        publicWebResearchReady: talentDiscovery.publicWebResearchReady,
        publicWebResearchBlockerCount:
          talentDiscovery.publicWebResearchBlockerCount,
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
        publicWebPendingReviewCount:
          talentDiscovery.publicWebPendingReviewCount,
        publicWebNeedsMoreContactResearchCount:
          talentDiscovery.publicWebNeedsMoreContactResearchCount,
        publicWebReviewRiskLevel:
          talentDiscovery.publicWebReviewRiskLevel,
        contactabilityEvidenceAvailable:
          talentDiscovery.contactabilityEvidenceAvailable,
        contactabilityPendingReviewCount:
          talentDiscovery.contactabilityPendingReviewCount,
      },
      talentResearchQuality: {
        talentResearchQualityAvailable:
          talentResearchQuality.talentResearchQualityAvailable,
        pendingTalentQualityReviewCount:
          talentResearchQuality.pendingTalentQualityReviewCount,
      },
      candidateGraph,
      matchingEvaluation,
      llm: {
        ...llm,
        ...llmQualityReview,
      },
      app,
      deployment,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
