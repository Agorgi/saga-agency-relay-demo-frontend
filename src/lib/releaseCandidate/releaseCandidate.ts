import { redactSensitiveJson } from "@/lib/dataOps/dataClassification";
import { getLlmConfigPresence } from "@/lib/env";
import { getMessagingPipelineHealthSnapshot } from "@/lib/messagingPipeline";
import { getPilotPublicLaunchStatus } from "@/lib/pilotControls";
import { getPilotDataOpsHealthSnapshot } from "@/lib/dataOps/pilotExport";
import { getLaunchDrillHealthSnapshot } from "@/lib/launchDrill/launchReadinessDrill";
import { evaluateCappedPublicBetaReadiness } from "@/lib/publicBeta/publicBetaAdmission";
import { getCappedPublicBetaConfig } from "@/lib/publicBeta/publicBetaConfig";
import { getBetaCohortSimulationHealthSnapshot } from "@/lib/cohortSimulation/runCohortSimulation";
import { getSmsSafetyHealth } from "@/lib/smsSafety";

export const releaseCandidateVersion = "release-candidate-v0.1";
export const releaseCandidateTag = "release-candidate-v0.1";
export const releaseCandidateTagMessage =
  "Saga SMS Producer standalone release candidate v0.1";

export type ReleaseCandidateStatus =
  | "READY_FOR_A2P_HOLD"
  | "READY_FOR_POST_A2P_REVIEW"
  | "BLOCKED_UNSAFE_CONFIG";

export type ReleaseCandidateSummary = {
  generatedAt: string;
  releaseCandidateVersion: string;
  releaseCandidateTag: string;
  releaseCandidateTagMessage: string;
  releaseCandidateStatus: ReleaseCandidateStatus;
  postA2PNextAction: string;
  currentRecommendedAction: string;
  blockers: string[];
  warnings: string[];
  verifiedCapabilities: string[];
  explicitlyDisabled: string[];
  currentExpectedBlockers: string[];
  outOfScope: string[];
  sms: {
    providerMode: string;
    sendsDisabled: boolean;
    allowlistRequired: boolean;
    allowedNumbersCount: number;
    smsComplianceApproved: boolean;
    publicBetaEnabled: boolean;
    publicLaunchEnabled: boolean;
  };
  llm: {
    providerEffective: string;
    modeEffective: string;
    model: string;
    shadowMode: boolean;
    activeLiveAllowed: boolean;
  };
  pipeline: {
    messageProcessingMode: string;
    asyncActiveEnabled: boolean;
    queueDepth: number | null;
    failedJobCount: number | null;
  };
  dataOps: {
    pilotDataOpsAvailable: boolean;
    retentionPolicyAvailable: boolean;
    backupRunbookAvailable: boolean;
    dataOpsWarningsCount: number;
  };
  launchDrill: {
    currentRecommendedLaunchStage: string;
    launchRiskLevel: string;
    launchBlockerCount: number;
    designPartnerLaunchReady: boolean;
    publicBetaCandidateReady: boolean;
  };
  publicBeta: {
    publicBetaEnabled: boolean;
    publicBetaLandingEnabled: boolean;
    publicBetaWaitlistEnabled: boolean;
    publicBetaPublicNumberVisible: boolean;
    publicBetaReady: boolean;
    publicBetaBlockerCount: number;
  };
  betaCohortSimulation: {
    betaCohortSimulationAvailable: boolean;
    simulationRiskLevel: string;
    simulationBlockerCount: number;
    designPartnerSimulationReady: boolean;
    privateBetaSimulationReady: boolean;
    publicBetaSimulationReady: boolean;
  };
  noSmsSent: true;
  noTwilioSendCall: true;
  noProductionSagaAppData: true;
};

export type ReleaseCandidateReportGitInfo = {
  commit?: string | null;
  branch?: string | null;
  tag?: string | null;
};

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function deriveRcStatus(input: {
  providerMode: string;
  smsSendsDisabled: boolean;
  smsComplianceApproved: boolean;
  publicLaunchEnabled: boolean;
  activeLiveAllowed: boolean;
  asyncActiveEnabled: boolean;
  allowlistRequired: boolean;
}) {
  const twilioRequiresAllowlist = input.providerMode === "TWILIO";
  if (
    input.publicLaunchEnabled ||
    input.activeLiveAllowed ||
    input.asyncActiveEnabled ||
    (twilioRequiresAllowlist && !input.allowlistRequired) ||
    (!input.smsSendsDisabled && !input.smsComplianceApproved)
  ) {
    return "BLOCKED_UNSAFE_CONFIG" as const;
  }

  return input.smsComplianceApproved
    ? ("READY_FOR_POST_A2P_REVIEW" as const)
    : ("READY_FOR_A2P_HOLD" as const);
}

export async function getReleaseCandidateSummary(): Promise<ReleaseCandidateSummary> {
  const generatedAt = new Date().toISOString();
  const sms = getSmsSafetyHealth();
  const publicLaunch = getPilotPublicLaunchStatus();
  const llm = getLlmConfigPresence();
  const [pipeline, dataOps, launchDrill, betaCohortSimulation] =
    await Promise.all([
      getMessagingPipelineHealthSnapshot(),
      getPilotDataOpsHealthSnapshot(),
      getLaunchDrillHealthSnapshot(),
      getBetaCohortSimulationHealthSnapshot({ runFreshWhenNoDb: false }),
    ]);
  const publicBetaConfig = getCappedPublicBetaConfig();
  const publicBetaReadiness = await evaluateCappedPublicBetaReadiness({
    observabilityRiskLevel:
      launchDrill.launchRiskLevel === "red" ? "red" : "yellow",
    launchRiskLevel: launchDrill.launchRiskLevel,
  });

  const unsafeBlockers = unique([
    publicLaunch.publicLaunchEnabled
      ? "PUBLIC_LAUNCH_ENABLED is true; disable public launch before RC freeze."
      : "",
    llm.activeLiveAllowed
      ? "LLM active_live is allowed; active_live must remain disabled."
      : "",
    pipeline.asyncActiveEnabled
      ? "MESSAGE_PROCESSING_MODE async_active is enabled; restore sync or async_shadow."
      : "",
    sms.providerMode === "TWILIO" && !sms.allowlistRequired
      ? "SMS_REQUIRE_ALLOWLIST is false; restore allowlist requirement."
      : "",
    !sms.sendsDisabled && !publicLaunch.complianceApproved
      ? "SMS sends are enabled before compliance approval."
      : "",
  ]);
  const currentExpectedBlockers = unique([
    !publicLaunch.complianceApproved
      ? "A2P / SMS compliance is not approved yet."
      : "",
    sms.sendsDisabled
      ? "SMS_SENDS_DISABLED=true blocks live outbound SMS."
      : "",
    !publicBetaConfig.publicBetaEnabled
      ? "PUBLIC_BETA_ENABLED=false keeps public beta closed."
      : "",
    !publicLaunch.publicLaunchEnabled
      ? "PUBLIC_LAUNCH_ENABLED=false keeps public launch closed."
      : "",
    "No one-number outbound self-test has been executed yet.",
    "No internal-team pilot has been executed yet.",
    "No 10-person design-partner pilot has been executed yet.",
  ]);
  const warnings = unique([
    ...llm.warnings.map((warning) => `LLM config warning: ${warning}`),
    ...pipeline.warnings.map((warning) => `Pipeline warning: ${warning}`),
    ...dataOps.dataOpsWarnings.map((warning) => `Data ops warning: ${warning}`),
    ...publicBetaReadiness.warnings.map(
      (warning) => `Public beta warning: ${warning}`,
    ),
    ...betaCohortSimulation.warnings.map(
      (warning) => `Beta cohort simulation warning: ${warning}`,
    ),
  ]);
  const releaseCandidateStatus = deriveRcStatus({
    providerMode: sms.providerMode,
    smsSendsDisabled: sms.sendsDisabled,
    smsComplianceApproved: publicLaunch.complianceApproved,
    publicLaunchEnabled: publicLaunch.publicLaunchEnabled,
    activeLiveAllowed: llm.activeLiveAllowed,
    asyncActiveEnabled: pipeline.asyncActiveEnabled,
    allowlistRequired: sms.allowlistRequired,
  });

  const summary: ReleaseCandidateSummary = {
    generatedAt,
    releaseCandidateVersion,
    releaseCandidateTag,
    releaseCandidateTagMessage,
    releaseCandidateStatus,
    postA2PNextAction:
      "After A2P approval, set SMS_COMPLIANCE_APPROVED=true while keeping SMS_SENDS_DISABLED=true, then run the launch drill and outbound self-test readiness checks before opening a one-number self-test window.",
    currentRecommendedAction:
      releaseCandidateStatus === "BLOCKED_UNSAFE_CONFIG"
        ? "Restore fail-closed guardrails before treating this commit as a release candidate."
        : "Hold at the A2P gate. Keep live SMS, public beta, public launch, active_live, and async_active disabled.",
    blockers: unsafeBlockers,
    warnings,
    verifiedCapabilities: [
      "Twilio inbound staging",
      "SMS safety controls",
      "allowlist controls",
      "conversation engine",
      "producer agent v0.1-v0.4",
      "LLM shadow and active_mock",
      "message pipeline reliability",
      "production observability",
      "public beta access control",
      "pilot data operations",
      "launch readiness drill",
      "operator command center",
      "capped public beta infrastructure",
      "beta cohort simulation",
      "outbound self-test readiness",
    ],
    explicitlyDisabled: [
      "live outbound SMS",
      "LLM active_live",
      "async_active message processing",
      "public beta",
      "public launch",
      "design partner invites",
      "main Saga app integration",
      "candidate outreach sends",
      "group chat automation",
      "ticketing / RSVP / QR / payments",
    ],
    currentExpectedBlockers,
    outOfScope: [
      "production Saga app connection",
      "production Saga database",
      "event publishing",
      "ticketing",
      "RSVP",
      "QR codes",
      "payments",
      "public internet sourcing",
      "autonomous candidate outreach",
      "autonomous group chat creation",
    ],
    sms: {
      providerMode: sms.providerMode,
      sendsDisabled: sms.sendsDisabled,
      allowlistRequired: sms.allowlistRequired,
      allowedNumbersCount: sms.allowedNumbersCount,
      smsComplianceApproved: publicLaunch.complianceApproved,
      publicBetaEnabled: publicLaunch.publicBetaEnabled,
      publicLaunchEnabled: publicLaunch.publicLaunchEnabled,
    },
    llm: {
      providerEffective: llm.providerEffective,
      modeEffective: llm.modeEffective,
      model: llm.model,
      shadowMode: llm.shadowMode,
      activeLiveAllowed: llm.activeLiveAllowed,
    },
    pipeline: {
      messageProcessingMode: pipeline.messageProcessingMode,
      asyncActiveEnabled: pipeline.asyncActiveEnabled,
      queueDepth: pipeline.queueDepth,
      failedJobCount: pipeline.failedJobCount,
    },
    dataOps: {
      pilotDataOpsAvailable: dataOps.pilotDataOpsAvailable,
      retentionPolicyAvailable: dataOps.retentionPolicyAvailable,
      backupRunbookAvailable: dataOps.backupRunbookAvailable,
      dataOpsWarningsCount: dataOps.dataOpsWarningsCount,
    },
    launchDrill: {
      currentRecommendedLaunchStage:
        launchDrill.currentRecommendedLaunchStage,
      launchRiskLevel: launchDrill.launchRiskLevel,
      launchBlockerCount: launchDrill.launchBlockerCount,
      designPartnerLaunchReady: launchDrill.designPartnerLaunchReady,
      publicBetaCandidateReady: launchDrill.publicBetaCandidateReady,
    },
    publicBeta: {
      publicBetaEnabled: publicBetaConfig.publicBetaEnabled,
      publicBetaLandingEnabled: publicBetaConfig.publicBetaLandingEnabled,
      publicBetaWaitlistEnabled: publicBetaConfig.publicBetaWaitlistEnabled,
      publicBetaPublicNumberVisible:
        publicBetaConfig.publicBetaPublicNumberVisible,
      publicBetaReady: publicBetaReadiness.publicBetaReady,
      publicBetaBlockerCount: publicBetaReadiness.blockers.length,
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
    },
    noSmsSent: true,
    noTwilioSendCall: true,
    noProductionSagaAppData: true,
  };

  return redactSensitiveJson(summary) as ReleaseCandidateSummary;
}

export function formatReleaseCandidateReport(input: {
  summary: ReleaseCandidateSummary;
  git?: ReleaseCandidateReportGitInfo;
}) {
  const { summary, git } = input;
  const lines = [
    "# Saga SMS Producer Release Candidate v0.1",
    "",
    `Generated: ${summary.generatedAt}`,
    `Version: ${summary.releaseCandidateVersion}`,
    `Tag: ${git?.tag || summary.releaseCandidateTag}`,
    `Commit: ${git?.commit || "unknown"}`,
    `Branch: ${git?.branch || "unknown"}`,
    `Status: ${summary.releaseCandidateStatus}`,
    `Current recommended action: ${summary.currentRecommendedAction}`,
    `Post-A2P next action: ${summary.postA2PNextAction}`,
    "",
    "## SMS Safety",
    `- Provider mode: ${summary.sms.providerMode}`,
    `- Sends disabled: ${summary.sms.sendsDisabled}`,
    `- Allowlist required: ${summary.sms.allowlistRequired}`,
    `- Allowed numbers count: ${summary.sms.allowedNumbersCount}`,
    `- SMS compliance approved: ${summary.sms.smsComplianceApproved}`,
    `- Public beta enabled: ${summary.sms.publicBetaEnabled}`,
    `- Public launch enabled: ${summary.sms.publicLaunchEnabled}`,
    "",
    "## LLM",
    `- Provider effective: ${summary.llm.providerEffective}`,
    `- Mode effective: ${summary.llm.modeEffective}`,
    `- Model: ${summary.llm.model}`,
    `- Shadow mode: ${summary.llm.shadowMode}`,
    `- Active live allowed: ${summary.llm.activeLiveAllowed}`,
    "",
    "## Pipeline and Operations",
    `- Message processing mode: ${summary.pipeline.messageProcessingMode}`,
    `- Async active enabled: ${summary.pipeline.asyncActiveEnabled}`,
    `- Queue depth: ${summary.pipeline.queueDepth ?? "n/a"}`,
    `- Failed jobs: ${summary.pipeline.failedJobCount ?? "n/a"}`,
    `- Data ops available: ${summary.dataOps.pilotDataOpsAvailable}`,
    `- Launch drill stage: ${summary.launchDrill.currentRecommendedLaunchStage}`,
    `- Launch drill risk: ${summary.launchDrill.launchRiskLevel}`,
    "",
    "## Public Beta and Simulation",
    `- Public beta ready: ${summary.publicBeta.publicBetaReady}`,
    `- Public beta blockers: ${summary.publicBeta.publicBetaBlockerCount}`,
    `- Public number visible: ${summary.publicBeta.publicBetaPublicNumberVisible}`,
    `- Beta cohort simulation risk: ${summary.betaCohortSimulation.simulationRiskLevel}`,
    `- Beta cohort simulation blockers: ${summary.betaCohortSimulation.simulationBlockerCount}`,
    "",
    "## Verified Capabilities",
    ...summary.verifiedCapabilities.map((item) => `- ${item}`),
    "",
    "## Explicitly Disabled",
    ...summary.explicitlyDisabled.map((item) => `- ${item}`),
    "",
    "## Current Expected Blockers",
    ...summary.currentExpectedBlockers.map((item) => `- ${item}`),
    "",
    "## Unsafe Config Blockers",
    ...(summary.blockers.length
      ? summary.blockers.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(summary.warnings.length
      ? summary.warnings.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Out of Scope",
    ...summary.outOfScope.map((item) => `- ${item}`),
    "",
    "No SMS was sent. No Twilio send API was called. No public beta, public launch, design partner invite, production Saga app integration, group chat, shortlist send, candidate outreach, ticketing, RSVP, QR, payment, or production data path was triggered.",
  ];

  return String(redactSensitiveJson(lines.join("\n")));
}
