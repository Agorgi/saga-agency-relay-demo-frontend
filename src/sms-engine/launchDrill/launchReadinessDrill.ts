import { existsSync } from "node:fs";
import path from "node:path";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { safeLlmHealth } from "@/sms-engine/llm/llmProvider";
import { getMessagingPipelineHealthSnapshot } from "@/sms-engine/messagingPipeline";
import { getDesignPartnerPilotReadinessSnapshot } from "@/sms-engine/pilotReadiness";
import { getPilotDataOpsHealthSnapshot } from "@/sms-engine/dataOps/pilotExport";
import { redactSensitiveJson } from "@/sms-engine/dataOps/dataClassification";
import { getPublicBetaAccessHealthSnapshot } from "@/sms-engine/access/accessControl";
import {
  getBetaCohortSimulationHealthSnapshot,
} from "@/sms-engine/cohortSimulation/runCohortSimulation";
import type {
  BetaCohortSimulationHealthSnapshot,
} from "@/sms-engine/cohortSimulation/cohortTypes";
import {
  getOutboundSelfTestReadinessSnapshot,
  type OutboundSelfTestReadinessResult,
} from "@/sms-engine/producer/outboundSelfTestReadiness";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";
import { getTwilioConfigPresence } from "@/sms-engine/env";

export const launchDrillStageIds = [
  "PRE_A2P_HOLD",
  "A2P_APPROVED_REVIEW",
  "ONE_NUMBER_SELF_TEST",
  "INTERNAL_TEAM_TEST",
  "DESIGN_PARTNER_10",
  "PRIVATE_BETA_25",
  "PUBLIC_BETA_CANDIDATE",
  "ROLLBACK_DRILL",
  "INCIDENT_DRILL",
  "COMPLETE",
] as const;

export type LaunchDrillStageId = (typeof launchDrillStageIds)[number];

export const launchDrillStageStatuses = [
  "NOT_STARTED",
  "READY",
  "BLOCKED",
  "PASSED",
  "FAILED",
  "SKIPPED",
] as const;

export type LaunchDrillStageStatus = (typeof launchDrillStageStatuses)[number];
export type LaunchRiskLevel = "green" | "yellow" | "red";

export type LaunchDrillStageResult = {
  id: LaunchDrillStageId;
  title: string;
  goal: string;
  requiredPreconditions: string[];
  operatorSteps: string[];
  expectedEvidence: string[];
  blockers: string[];
  warnings: string[];
  passCriteria: string[];
  failCriteria: string[];
  rollbackSteps: string[];
  relatedDocs: string[];
  status: LaunchDrillStageStatus;
};

export type LaunchReadinessDrillResult = {
  currentRecommendedStage: LaunchDrillStageId;
  overallReady: boolean;
  launchRiskLevel: LaunchRiskLevel;
  stages: LaunchDrillStageResult[];
  globalBlockers: string[];
  globalWarnings: string[];
  recommendedNextAction: string;
  evidenceSummary: Record<string, unknown>;
  generatedAt: string;
};

export const launchDrillAuditEvents = {
  runStarted: "launch_drill.run_started",
  runCompleted: "launch_drill.run_completed",
  stageEvaluated: "launch_drill.stage_evaluated",
  manualEvidenceRecorded: "launch_drill.manual_evidence_recorded",
  rollbackSimulated: "launch_drill.rollback_simulated",
  incidentSimulated: "launch_drill.incident_simulated",
  blockerDetected: "launch_drill.blocker_detected",
} as const;

type ManualEvidenceMap = Partial<Record<LaunchDrillStageId, LaunchDrillStageStatus>>;

type LaunchDrillEvidence = {
  sms: ReturnType<typeof getSmsSafetyHealth> & {
    smsComplianceApproved: boolean;
    publicLaunchEnabled: boolean;
  };
  twilio: ReturnType<typeof getTwilioConfigPresence>;
  llm: ReturnType<typeof safeLlmHealth>;
  pilot: ReturnType<typeof getDesignPartnerPilotReadinessSnapshot>;
  access: Awaited<ReturnType<typeof getPublicBetaAccessHealthSnapshot>>;
  pipeline: Awaited<ReturnType<typeof getMessagingPipelineHealthSnapshot>>;
  dataOps: Awaited<ReturnType<typeof getPilotDataOpsHealthSnapshot>>;
  betaCohortSimulation: BetaCohortSimulationHealthSnapshot;
  outboundSelfTest: OutboundSelfTestReadinessResult;
  docs: ReturnType<typeof getLaunchDrillDocumentStatus>;
  counts: {
    recentOutboundCount: number | null;
    activeInternalParticipants: number | null;
    activeDesignPartners: number | null;
    activePrivateBetaParticipants: number | null;
    launchDrillRunCount: number | null;
    lastLaunchDrillRunAt: string | null;
  };
  manualEvidence: ManualEvidenceMap;
};

function docExists(relativePath: string) {
  return existsSync(path.join(process.cwd(), relativePath));
}

export function getLaunchDrillDocumentStatus() {
  return {
    a2pCompliancePacketExists: docExists("docs/a2p-compliance-packet.md"),
    outboundSelfTestRunbookExists: docExists(
      "docs/outbound-sms-self-test-runbook.md",
    ),
    outboundSelfTestChecklistExists: docExists(
      "docs/outbound-self-test-checklist.md",
    ),
    postA2POneNumberSelfTestPlanExists: docExists(
      "docs/post-a2p-one-number-self-test-v0.9.md",
    ),
    postA2PSelfTestChecklistExists: docExists(
      "docs/post-a2p-self-test-checklist.md",
    ),
    designPartnerRunbookExists: docExists(
      "docs/design-partner-pilot-runbook.md",
    ),
    designPartnerPilotScriptExists: docExists(
      "docs/design-partner-pilot-script-v0.8.md",
    ),
    designPartnerFeedbackQuestionsExists: docExists(
      "docs/design-partner-feedback-questions.md",
    ),
    designPartnerOperatorChecklistExists: docExists(
      "docs/design-partner-operator-checklist.md",
    ),
    feedbackCaptureReady: true,
    transcriptDryRunsDocExists: docExists(
      "docs/design-partner-transcript-dry-runs.md",
    ),
    publicLaunchFoundationsExists: docExists(
      "docs/public-launch-foundations.md",
    ),
    publicBetaAccessControlExists: docExists(
      "docs/public-beta-access-control.md",
    ),
    productionObservabilityExists: docExists(
      "docs/production-observability.md",
    ),
    pilotRollbackRunbookExists: docExists("docs/pilot-rollback-runbook.md"),
    incidentRunbookExists: docExists("docs/incident-response-runbook.md"),
    dataIncidentRunbookExists: docExists("docs/pilot-data-incident-runbook.md"),
    dataInventoryExists: docExists("docs/pilot-data-inventory.md"),
    launchReadinessDrillDocExists: docExists(
      "docs/launch-readiness-drill.md",
    ),
    designPartnerLaunchChecklistExists: docExists(
      "docs/design-partner-launch-checklist.md",
    ),
    publicBetaLaunchChecklistExists: docExists(
      "docs/public-beta-launch-checklist.md",
    ),
    betaCohortSimulationDocExists: docExists("docs/beta-cohort-simulation.md"),
    designPartnerSimulationReportTemplateExists: docExists(
      "docs/design-partner-simulation-report-template.md",
    ),
  };
}

function baseStage(
  id: LaunchDrillStageId,
  input: Omit<LaunchDrillStageResult, "id" | "blockers" | "warnings" | "status">,
): LaunchDrillStageResult {
  return {
    id,
    ...input,
    blockers: [],
    warnings: [],
    status: "NOT_STARTED",
  };
}

export function getLaunchDrillStageDefinitions(): LaunchDrillStageResult[] {
  return [
    baseStage("PRE_A2P_HOLD", {
      title: "Pre-A2P hold",
      goal: "Keep the app safe and ready while provider compliance is pending.",
      requiredPreconditions: [
        "SMS_COMPLIANCE_APPROVED=false",
        "SMS_SENDS_DISABLED=true",
        "Public launch disabled",
        "A2P compliance packet exists",
      ],
      operatorSteps: [
        "Keep sends disabled.",
        "Keep public beta and public launch disabled.",
        "Maintain runbooks and dry-run evidence.",
      ],
      expectedEvidence: [
        "/api/health safety flags",
        "A2P compliance packet",
        "Zero recent outbound SMS records",
      ],
      passCriteria: [
        "No outbound activity while sends are disabled.",
        "Compliance remains pending and launch remains closed.",
      ],
      failCriteria: [
        "Outbound activity appears while sends are disabled.",
        "Public launch is enabled before approval.",
      ],
      rollbackSteps: [
        "Set SMS_SENDS_DISABLED=true.",
        "Set PILOT_REPLY_MODE=draft_only.",
      ],
      relatedDocs: [
        "docs/a2p-compliance-packet.md",
        "docs/twilio-readiness.md",
      ],
    }),
    baseStage("A2P_APPROVED_REVIEW", {
      title: "A2P approved review",
      goal: "Verify compliance approval and opt-in language before any outbound test.",
      requiredPreconditions: [
        "SMS_COMPLIANCE_APPROVED=true",
        "A2P approval manually documented",
        "STOP/START/HELP copy reviewed",
      ],
      operatorSteps: [
        "Capture provider approval evidence.",
        "Review opt-in and HELP/STOP/START language.",
        "Confirm Twilio staging remains configured safely.",
      ],
      expectedEvidence: [
        "A2P packet",
        "Provider approval screenshot or note",
        "Twilio readiness check",
        "Post-A2P one-number self-test v0.9 playbook",
      ],
      passCriteria: ["Compliance approval is documented and reviewed."],
      failCriteria: ["Compliance is missing or undocumented."],
      rollbackSteps: ["Keep SMS_SENDS_DISABLED=true."],
      relatedDocs: [
        "docs/a2p-compliance-packet.md",
        "docs/twilio-readiness.md",
        "docs/post-a2p-one-number-self-test-v0.9.md",
      ],
    }),
    baseStage("ONE_NUMBER_SELF_TEST", {
      title: "One-number self-test",
      goal: "Prepare the first single-recipient outbound test without sending during the drill.",
      requiredPreconditions: [
        "SMS_COMPLIANCE_APPROVED=true",
        "SMS_SENDS_DISABLED=false only for the future live test",
        "Exactly one allowlisted number",
        "PILOT_STAGE=internal_test",
        "PILOT_REPLY_MODE=manual_approval",
        "Dry-run send readiness is ready",
        "Post-A2P v0.9 checklist is ready",
      ],
      operatorSteps: [
        "Capture health baseline.",
        "Capture Twilio outbound log baseline.",
        "Verify exactly one allowlisted operator recipient.",
        "Confirm rollback plan.",
      ],
      expectedEvidence: [
        "Outbound self-test readiness result",
        "Approved draft readiness result",
        "Post-A2P self-test checklist",
        "Rollback runbook",
      ],
      passCriteria: ["Self-test passed exactly once with no duplicates."],
      failCriteria: ["More than one SMS sends, wrong recipient, or readiness blockers remain."],
      rollbackSteps: [
        "Set SMS_SENDS_DISABLED=true.",
        "Set PILOT_REPLY_MODE=draft_only.",
        "Remove or reduce SMS_ALLOWED_NUMBERS.",
      ],
      relatedDocs: [
        "docs/outbound-sms-self-test-runbook.md",
        "docs/outbound-self-test-checklist.md",
        "docs/post-a2p-one-number-self-test-v0.9.md",
        "docs/post-a2p-self-test-checklist.md",
        "docs/pilot-rollback-runbook.md",
      ],
    }),
    baseStage("INTERNAL_TEAM_TEST", {
      title: "Internal team test",
      goal: "Run a tiny internal allowlisted test after the one-number self-test passes.",
      requiredPreconditions: [
        "One-number self-test marked passed",
        "Internal participants active",
        "Participant cap configured",
        "No critical observability warnings",
      ],
      operatorSteps: [
        "Add internal testers only.",
        "Monitor observability and audit.",
        "Collect feedback and rollback evidence.",
      ],
      expectedEvidence: ["Pilot participants", "Observability dashboard", "Feedback notes"],
      passCriteria: ["Internal test passes without unsafe promises or unexpected sends."],
      failCriteria: ["Duplicate replies, unsafe LLM output, or outbound anomalies."],
      rollbackSteps: ["Pause participants.", "Restore SMS_SENDS_DISABLED=true."],
      relatedDocs: ["docs/incident-response-runbook.md", "docs/production-observability.md"],
    }),
    baseStage("DESIGN_PARTNER_10", {
      title: "10 design partner pilot",
      goal: "Confirm the invite-only design-partner pilot can start safely.",
      requiredPreconditions: [
        "SMS_COMPLIANCE_APPROVED=true",
        "One-number self-test marked passed",
        "Internal team test marked passed",
        "At most 10 design partners active or invited",
        "Pilot script, runbook, feedback questions, and operator checklist ready",
        "SMS safety and access-control gates configured",
        "Data ops ready",
        "Observability not red",
        "No safety-critical transcript dry-run failures",
      ],
      operatorSteps: [
        "Select and allowlist only the approved design partners.",
        "Confirm opt-in copy.",
        "Monitor every session.",
        "Capture feedback after each test.",
      ],
      expectedEvidence: [
        "Design partner pilot script",
        "Design partner runbook",
        "Design partner feedback questions",
        "Design partner operator checklist",
        "Transcript dry-run summary",
        "Pilot feedback",
        "Data ops checklist",
      ],
      passCriteria: ["10-person pilot completes with no safety-critical issues."],
      failCriteria: ["Unsafe promise, non-allowlisted send, or unresolved incident."],
      rollbackSteps: ["Pause pilot.", "Set SMS_SENDS_DISABLED=true.", "Preserve audit logs."],
      relatedDocs: [
        "docs/design-partner-pilot-runbook.md",
        "docs/design-partner-pilot-script-v0.8.md",
        "docs/design-partner-feedback-questions.md",
        "docs/design-partner-operator-checklist.md",
        "docs/design-partner-launch-checklist.md",
        "docs/pilot-data-retention.md",
      ],
    }),
    baseStage("PRIVATE_BETA_25", {
      title: "Private beta 25",
      goal: "Prepare a larger invite-only beta after design partner learning.",
      requiredPreconditions: [
        "Design partner stage marked passed",
        "Access caps configured",
        "Support and incident process ready",
        "Public beta remains disabled unless explicitly approved",
      ],
      operatorSteps: [
        "Review design partner findings.",
        "Set private beta caps.",
        "Confirm incident ownership.",
      ],
      expectedEvidence: ["Access control dashboard", "Incident runbook", "Pilot synthesis"],
      passCriteria: ["Private beta completes without public-launch drift."],
      failCriteria: ["Caps bypassed or public access enabled unintentionally."],
      rollbackSteps: ["Set access mode to allowlist_only.", "Pause participants."],
      relatedDocs: ["docs/public-beta-access-control.md", "docs/incident-response-runbook.md"],
    }),
    baseStage("PUBLIC_BETA_CANDIDATE", {
      title: "Public beta candidate",
      goal: "Rehearse capped public beta readiness while public launch remains disabled.",
      requiredPreconditions: [
        "Private beta stage marked passed",
        "Public launch foundations complete",
        "PUBLIC_BETA_ENABLED intentionally reviewed",
        "PUBLIC_LAUNCH_ENABLED=false until final approval",
        "Observability green",
      ],
      operatorSteps: [
        "Review support, privacy, terms, and abuse controls.",
        "Confirm rate and cost caps.",
        "Confirm production app integration remains out of scope.",
      ],
      expectedEvidence: ["Public beta checklist", "Observability dashboard", "Access controls"],
      passCriteria: ["Capped public beta is ready for explicit approval."],
      failCriteria: ["Public launch enabled or compliance/rate limits incomplete."],
      rollbackSteps: ["Disable public beta.", "Set public closed access mode."],
      relatedDocs: [
        "docs/public-launch-foundations.md",
        "docs/public-beta-launch-checklist.md",
      ],
    }),
    baseStage("ROLLBACK_DRILL", {
      title: "Rollback drill",
      goal: "Simulate the pause path without changing env vars.",
      requiredPreconditions: ["Rollback runbook exists."],
      operatorSteps: [
        "State the env vars that would be set.",
        "State participant pause action.",
        "State audit preservation steps.",
      ],
      expectedEvidence: ["Rollback simulation audit event", "Runbook link"],
      passCriteria: ["Operator can describe rollback without deleting data."],
      failCriteria: ["Rollback would delete data or skip audit preservation."],
      rollbackSteps: ["This stage is the rollback simulation."],
      relatedDocs: ["docs/pilot-rollback-runbook.md"],
    }),
    baseStage("INCIDENT_DRILL", {
      title: "Incident drill",
      goal: "Simulate top messaging, LLM, pipeline, and data incidents.",
      requiredPreconditions: ["Incident runbooks exist."],
      operatorSteps: [
        "Review unexpected outbound SMS response.",
        "Review duplicate reply response.",
        "Review unsafe LLM output response.",
        "Review data exposure response.",
      ],
      expectedEvidence: ["Incident simulation audit event", "Runbook link"],
      passCriteria: ["Operator can identify detection, owner, rollback, and bug-report path."],
      failCriteria: ["No owner, no rollback path, or no preservation plan."],
      rollbackSteps: ["Follow incident-specific pause procedure."],
      relatedDocs: [
        "docs/incident-response-runbook.md",
        "docs/pilot-data-incident-runbook.md",
      ],
    }),
    baseStage("COMPLETE", {
      title: "Launch drill complete",
      goal: "Confirm every prior rehearsal stage has passed or been explicitly skipped.",
      requiredPreconditions: ["All launch drill stages passed or intentionally skipped."],
      operatorSteps: ["Export drill report.", "Review blockers.", "Record final note."],
      expectedEvidence: ["Launch drill report"],
      passCriteria: ["All required launch rehearsal stages passed."],
      failCriteria: ["Any required stage remains blocked or failed."],
      rollbackSteps: ["Return to the first blocked stage."],
      relatedDocs: ["docs/launch-readiness-drill.md"],
    }),
  ];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function withStatus(
  stage: LaunchDrillStageResult,
  status: LaunchDrillStageStatus,
  blockers: string[] = [],
  warnings: string[] = [],
): LaunchDrillStageResult {
  return {
    ...stage,
    status,
    blockers: unique(blockers),
    warnings: unique(warnings),
  };
}

function stageManualStatus(
  evidence: LaunchDrillEvidence,
  stage: LaunchDrillStageId,
) {
  return evidence.manualEvidence[stage];
}

async function getLaunchDrillCounts(): Promise<LaunchDrillEvidence["counts"]> {
  if (!process.env.DATABASE_URL) {
    return {
      recentOutboundCount: null,
      activeInternalParticipants: null,
      activeDesignPartners: null,
      activePrivateBetaParticipants: null,
      launchDrillRunCount: null,
      lastLaunchDrillRunAt: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      recentOutboundCount,
      activeInternalParticipants,
      activeDesignPartners,
      activePrivateBetaParticipants,
      launchDrillRunCount,
      lastLaunchDrillRun,
    ] = await Promise.all([
      getDb().message.count({
        where: { direction: "OUTBOUND", createdAt: { gte: since } },
      }),
      getDb().pilotParticipant.count({
        where: { status: "ACTIVE", cohort: "internal" },
      }),
      getDb().pilotParticipant.count({
        where: { status: { in: ["ACTIVE", "INVITED"] }, cohort: "design_partner" },
      }),
      getDb().pilotParticipant.count({
        where: { status: "ACTIVE", cohort: "private_beta" },
      }),
      getDb().auditLog.count({
        where: { action: launchDrillAuditEvents.runCompleted },
      }),
      getDb().auditLog.findFirst({
        where: { action: launchDrillAuditEvents.runCompleted },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      recentOutboundCount,
      activeInternalParticipants,
      activeDesignPartners,
      activePrivateBetaParticipants,
      launchDrillRunCount,
      lastLaunchDrillRunAt: lastLaunchDrillRun?.createdAt.toISOString() || null,
    };
  } catch {
    return {
      recentOutboundCount: null,
      activeInternalParticipants: null,
      activeDesignPartners: null,
      activePrivateBetaParticipants: null,
      launchDrillRunCount: null,
      lastLaunchDrillRunAt: null,
    };
  }
}

async function getManualEvidenceFromAudit(): Promise<ManualEvidenceMap> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const items = await getDb().auditLog.findMany({
      where: { action: launchDrillAuditEvents.manualEvidenceRecorded },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { metadata: true },
    });
    const evidence: ManualEvidenceMap = {};
    for (const item of items) {
      const metadata =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {};
      const stage = metadata.stage;
      const status = metadata.status;
      if (
        typeof stage === "string" &&
        launchDrillStageIds.includes(stage as LaunchDrillStageId) &&
        typeof status === "string" &&
        launchDrillStageStatuses.includes(status as LaunchDrillStageStatus) &&
        !evidence[stage as LaunchDrillStageId]
      ) {
        evidence[stage as LaunchDrillStageId] = status as LaunchDrillStageStatus;
      }
    }
    return evidence;
  } catch {
    return {};
  }
}

export async function getLaunchDrillEvidence(input?: {
  manualEvidence?: ManualEvidenceMap;
}): Promise<LaunchDrillEvidence> {
  const smsBase = getSmsSafetyHealth();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const [
    access,
    pipeline,
    dataOps,
    betaCohortSimulation,
    outboundSelfTest,
    counts,
    manualEvidence,
  ] =
    await Promise.all([
      getPublicBetaAccessHealthSnapshot(),
      getMessagingPipelineHealthSnapshot(),
      getPilotDataOpsHealthSnapshot(),
      getBetaCohortSimulationHealthSnapshot(),
      getOutboundSelfTestReadinessSnapshot(),
      getLaunchDrillCounts(),
      input?.manualEvidence ? Promise.resolve(input.manualEvidence) : getManualEvidenceFromAudit(),
    ]);

  return {
    sms: {
      ...smsBase,
      smsComplianceApproved: pilot.complianceApproved,
      publicLaunchEnabled: pilot.publicLaunchEnabled,
    },
    twilio: getTwilioConfigPresence(),
    llm: safeLlmHealth(),
    pilot,
    access,
    pipeline,
    dataOps,
    betaCohortSimulation,
    outboundSelfTest,
    docs: getLaunchDrillDocumentStatus(),
    counts,
    manualEvidence,
  };
}

function stageStatusFromManual(
  evidence: LaunchDrillEvidence,
  stageId: LaunchDrillStageId,
  fallback: LaunchDrillStageStatus,
) {
  const manual = stageManualStatus(evidence, stageId);
  return manual || fallback;
}

function evaluateStages(evidence: LaunchDrillEvidence): LaunchDrillStageResult[] {
  const docs = evidence.docs;
  const definitions = getLaunchDrillStageDefinitions();
  const byId = Object.fromEntries(definitions.map((stage) => [stage.id, stage])) as Record<
    LaunchDrillStageId,
    LaunchDrillStageResult
  >;
  const outboundCount = evidence.counts.recentOutboundCount ?? 0;
  const obsRiskRed =
    evidence.sms.sendsDisabled && outboundCount > 0 ||
    evidence.sms.publicLaunchEnabled && evidence.pilot.pilotStage !== "public_live" ||
    evidence.llm.activeLiveAllowed ||
    (evidence.pipeline.failedJobCount ?? 0) >= 10;

  const preA2pBlockers: string[] = [];
  if (evidence.sms.smsComplianceApproved) {
    preA2pBlockers.push("SMS_COMPLIANCE_APPROVED is true; move to A2P review evidence.");
  }
  if (!evidence.sms.sendsDisabled) {
    preA2pBlockers.push("SMS_SENDS_DISABLED must remain true during pre-A2P hold.");
  }
  if (outboundCount > 0) {
    preA2pBlockers.push("Recent outbound messages exist while this drill expects no-send posture.");
  }
  if (!docs.a2pCompliancePacketExists) {
    preA2pBlockers.push("A2P compliance packet is missing.");
  }
  if (evidence.sms.publicLaunchEnabled) {
    preA2pBlockers.push("PUBLIC_LAUNCH_ENABLED must be false.");
  }
  if ((evidence.counts.activeDesignPartners ?? 0) > 0) {
    preA2pBlockers.push("Design partners should not be active before A2P approval.");
  }

  const a2pBlockers: string[] = [];
  if (!evidence.sms.smsComplianceApproved) {
    a2pBlockers.push("SMS_COMPLIANCE_APPROVED is false or missing.");
  }
  if (!docs.a2pCompliancePacketExists) {
    a2pBlockers.push("A2P compliance packet is missing.");
  }

  const selfTestBlockers = [...evidence.outboundSelfTest.blockers];
  if (!docs.outboundSelfTestRunbookExists || !docs.outboundSelfTestChecklistExists) {
    selfTestBlockers.push("Outbound self-test runbook/checklist is missing.");
  }
  if (!docs.postA2POneNumberSelfTestPlanExists) {
    selfTestBlockers.push("Post-A2P one-number self-test v0.9 playbook is missing.");
  }
  if (!docs.postA2PSelfTestChecklistExists) {
    selfTestBlockers.push("Post-A2P self-test checklist is missing.");
  }

  const internalBlockers: string[] = [];
  if (stageManualStatus(evidence, "ONE_NUMBER_SELF_TEST") !== "PASSED") {
    internalBlockers.push("One-number self-test is not marked passed.");
  }
  if ((evidence.counts.activeInternalParticipants ?? 0) < 1) {
    internalBlockers.push("No active internal test participants are recorded.");
  }
  if (!evidence.access.maxActiveParticipants || evidence.access.maxActiveParticipants < 1) {
    internalBlockers.push("Participant cap is not configured.");
  }
  if (obsRiskRed) {
    internalBlockers.push("Observability risk is red.");
  }

  const designPartnerBlockers: string[] = [];
  if (!evidence.sms.smsComplianceApproved) {
    designPartnerBlockers.push("A2P/SMS compliance approval is not recorded.");
  }
  if (stageManualStatus(evidence, "ONE_NUMBER_SELF_TEST") !== "PASSED") {
    designPartnerBlockers.push("One-number self-test is not marked passed.");
  }
  if (stageManualStatus(evidence, "INTERNAL_TEAM_TEST") !== "PASSED") {
    designPartnerBlockers.push("Internal team test is not marked passed.");
  }
  const activeDesignPartners = evidence.counts.activeDesignPartners ?? 0;
  if (activeDesignPartners > 10) {
    designPartnerBlockers.push("More than 10 design partners are active/invited.");
  }
  if (!docs.designPartnerRunbookExists) {
    designPartnerBlockers.push("Design partner runbook is missing.");
  }
  if (!docs.designPartnerPilotScriptExists) {
    designPartnerBlockers.push("Design partner pilot script is missing.");
  }
  if (!docs.designPartnerFeedbackQuestionsExists) {
    designPartnerBlockers.push("Design partner feedback questions are missing.");
  }
  if (!docs.designPartnerOperatorChecklistExists) {
    designPartnerBlockers.push("Design partner operator checklist is missing.");
  }
  if (!docs.feedbackCaptureReady) {
    designPartnerBlockers.push("Feedback capture is not ready.");
  }
  if (!evidence.sms.allowlistRequired) {
    designPartnerBlockers.push("SMS_REQUIRE_ALLOWLIST must be true.");
  }
  if (!evidence.access.maxActiveParticipants || evidence.access.maxActiveParticipants < 10) {
    designPartnerBlockers.push("Participant cap is below the 10-person design partner target.");
  }
  if (!evidence.dataOps.pilotDataOpsAvailable || evidence.dataOps.dataOpsWarningsCount > 0) {
    designPartnerBlockers.push("Pilot data operations are not fully ready.");
  }
  if (obsRiskRed) {
    designPartnerBlockers.push("Observability risk is red.");
  }
  if (!docs.transcriptDryRunsDocExists) {
    designPartnerBlockers.push("Transcript dry-run documentation is missing.");
  }
  if (!docs.betaCohortSimulationDocExists) {
    designPartnerBlockers.push("Beta cohort simulation documentation is missing.");
  }
  if (!evidence.betaCohortSimulation.designPartnerSimulationReady) {
    designPartnerBlockers.push("DESIGN_PARTNER_10 cohort simulation has not passed.");
  }

  const privateBetaBlockers: string[] = [];
  if (stageManualStatus(evidence, "DESIGN_PARTNER_10") !== "PASSED") {
    privateBetaBlockers.push("Design partner stage is not marked passed.");
  }
  if (!evidence.betaCohortSimulation.privateBetaSimulationReady) {
    privateBetaBlockers.push("PRIVATE_BETA_25 cohort simulation has not passed.");
  }
  if (!evidence.access.maxActiveParticipants || evidence.access.maxActiveParticipants < 25) {
    privateBetaBlockers.push("Participant cap is below the private-beta target.");
  }
  if (!docs.incidentRunbookExists) {
    privateBetaBlockers.push("Incident response runbook is missing.");
  }

  const publicBetaBlockers: string[] = [];
  if (stageManualStatus(evidence, "PRIVATE_BETA_25") !== "PASSED") {
    publicBetaBlockers.push("Private beta stage is not marked passed.");
  }
  if (!docs.publicLaunchFoundationsExists || !docs.publicBetaLaunchChecklistExists) {
    publicBetaBlockers.push("Public beta/public launch checklist docs are missing.");
  }
  if (!evidence.access.publicBetaEnabled) {
    publicBetaBlockers.push("PUBLIC_BETA_ENABLED is false.");
  }
  if (!evidence.betaCohortSimulation.publicBetaSimulationReady) {
    publicBetaBlockers.push("CAPPED_PUBLIC_BETA_100 cohort simulation has not passed.");
  }
  if (!evidence.betaCohortSimulation.overCapacitySimulationReady) {
    publicBetaBlockers.push("Over-capacity cohort simulation has not passed.");
  }
  if (evidence.sms.publicLaunchEnabled) {
    publicBetaBlockers.push("PUBLIC_LAUNCH_ENABLED must remain false until final public-live approval.");
  }
  if (obsRiskRed) {
    publicBetaBlockers.push("Observability risk is red.");
  }

  const rollbackBlockers = docs.pilotRollbackRunbookExists
    ? []
    : ["Pilot rollback runbook is missing."];
  const incidentBlockers =
    docs.incidentRunbookExists && docs.dataIncidentRunbookExists
      ? []
      : ["Incident runbooks are missing."];

  const completeBlockers: string[] = [];
  for (const required of [
    "A2P_APPROVED_REVIEW",
    "ONE_NUMBER_SELF_TEST",
    "INTERNAL_TEAM_TEST",
    "DESIGN_PARTNER_10",
    "ROLLBACK_DRILL",
    "INCIDENT_DRILL",
  ] as LaunchDrillStageId[]) {
    const manual = stageManualStatus(evidence, required);
    if (manual !== "PASSED" && manual !== "SKIPPED") {
      completeBlockers.push(`${required} is not passed or explicitly skipped.`);
    }
  }

  return [
    withStatus(
      byId.PRE_A2P_HOLD,
      stageStatusFromManual(
        evidence,
        "PRE_A2P_HOLD",
        preA2pBlockers.length === 0 ? "PASSED" : "BLOCKED",
      ),
      preA2pBlockers,
    ),
    withStatus(
      byId.A2P_APPROVED_REVIEW,
      stageStatusFromManual(
        evidence,
        "A2P_APPROVED_REVIEW",
        a2pBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      a2pBlockers,
    ),
    withStatus(
      byId.ONE_NUMBER_SELF_TEST,
      stageStatusFromManual(
        evidence,
        "ONE_NUMBER_SELF_TEST",
        selfTestBlockers.length === 0 && evidence.outboundSelfTest.ready ? "READY" : "BLOCKED",
      ),
      selfTestBlockers,
      evidence.outboundSelfTest.warnings,
    ),
    withStatus(
      byId.INTERNAL_TEAM_TEST,
      stageStatusFromManual(
        evidence,
        "INTERNAL_TEAM_TEST",
        internalBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      internalBlockers,
    ),
    withStatus(
      byId.DESIGN_PARTNER_10,
      stageStatusFromManual(
        evidence,
        "DESIGN_PARTNER_10",
        designPartnerBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      designPartnerBlockers,
    ),
    withStatus(
      byId.PRIVATE_BETA_25,
      stageStatusFromManual(
        evidence,
        "PRIVATE_BETA_25",
        privateBetaBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      privateBetaBlockers,
    ),
    withStatus(
      byId.PUBLIC_BETA_CANDIDATE,
      stageStatusFromManual(
        evidence,
        "PUBLIC_BETA_CANDIDATE",
        publicBetaBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      publicBetaBlockers,
    ),
    withStatus(
      byId.ROLLBACK_DRILL,
      stageStatusFromManual(
        evidence,
        "ROLLBACK_DRILL",
        rollbackBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      rollbackBlockers,
      ["Simulation only: no env vars are changed."],
    ),
    withStatus(
      byId.INCIDENT_DRILL,
      stageStatusFromManual(
        evidence,
        "INCIDENT_DRILL",
        incidentBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      incidentBlockers,
      ["Simulation only: no incident actions are executed."],
    ),
    withStatus(
      byId.COMPLETE,
      stageStatusFromManual(
        evidence,
        "COMPLETE",
        completeBlockers.length === 0 ? "READY" : "BLOCKED",
      ),
      completeBlockers,
    ),
  ];
}

function deriveRiskLevel(stages: LaunchDrillStageResult[], evidence: LaunchDrillEvidence): LaunchRiskLevel {
  const outboundWhileDisabled =
    evidence.sms.sendsDisabled && (evidence.counts.recentOutboundCount ?? 0) > 0;
  const unsafePublicLaunch =
    evidence.sms.publicLaunchEnabled && evidence.pilot.pilotStage !== "public_live";
  if (
    outboundWhileDisabled ||
    unsafePublicLaunch ||
    evidence.llm.activeLiveAllowed ||
    evidence.pilot.pilotStage === "public_live" ||
    stages.some((stage) => stage.status === "FAILED")
  ) {
    return "red";
  }
  if (stages.some((stage) => stage.status === "BLOCKED")) return "yellow";
  return "green";
}

function recommendedStage(stages: LaunchDrillStageResult[], evidence: LaunchDrillEvidence): LaunchDrillStageId {
  if (!evidence.sms.smsComplianceApproved) return "PRE_A2P_HOLD";
  return (
    stages.find((stage) => stage.status !== "PASSED" && stage.status !== "SKIPPED")
      ?.id || "COMPLETE"
  );
}

function evidenceSummary(evidence: LaunchDrillEvidence) {
  return redactSensitiveJson({
    sms: {
      providerMode: evidence.sms.providerMode,
      sendsDisabled: evidence.sms.sendsDisabled,
      allowlistRequired: evidence.sms.allowlistRequired,
      allowedNumbersCount: evidence.sms.allowedNumbersCount,
      twilioStagingMode: evidence.sms.twilioStagingMode,
      smsComplianceApproved: evidence.sms.smsComplianceApproved,
      publicLaunchEnabled: evidence.sms.publicLaunchEnabled,
    },
    twilio: {
      configured:
        evidence.twilio.accountSidConfigured &&
        evidence.twilio.authTokenConfigured &&
        evidence.twilio.messagingConfigured,
      webhookValidationEnabled: evidence.twilio.webhookValidationEnabled,
    },
    llm: {
      providerEffective: evidence.llm.providerEffective,
      modeEffective: evidence.llm.modeEffective,
      activeLiveAllowed: evidence.llm.activeLiveAllowed,
      model: evidence.llm.model,
    },
    pilot: {
      stage: evidence.pilot.pilotStage,
      replyMode: evidence.pilot.pilotReplyMode,
      autoRepliesEnabled: evidence.pilot.autoRepliesEnabled,
    },
    access: {
      mode: evidence.access.accessModeEffective,
      publicBetaEnabled: evidence.access.publicBetaEnabled,
      maxActiveParticipants: evidence.access.maxActiveParticipants,
      currentActiveParticipants: evidence.access.currentActiveParticipants,
      waitlistedParticipantCount: evidence.access.waitlistedParticipantCount,
    },
    pipeline: {
      messageProcessingMode: evidence.pipeline.messageProcessingMode,
      queueDepth: evidence.pipeline.queueDepth,
      failedJobCount: evidence.pipeline.failedJobCount,
    },
    dataOps: {
      pilotDataOpsAvailable: evidence.dataOps.pilotDataOpsAvailable,
      dataOpsWarningsCount: evidence.dataOps.dataOpsWarningsCount,
      retentionPolicyAvailable: evidence.dataOps.retentionPolicyAvailable,
      backupRunbookAvailable: evidence.dataOps.backupRunbookAvailable,
    },
    betaCohortSimulation: {
      available: evidence.betaCohortSimulation.betaCohortSimulationAvailable,
      riskLevel: evidence.betaCohortSimulation.simulationRiskLevel,
      blockerCount: evidence.betaCohortSimulation.simulationBlockerCount,
      designPartnerSimulationReady:
        evidence.betaCohortSimulation.designPartnerSimulationReady,
      privateBetaSimulationReady:
        evidence.betaCohortSimulation.privateBetaSimulationReady,
      publicBetaSimulationReady:
        evidence.betaCohortSimulation.publicBetaSimulationReady,
      overCapacitySimulationReady:
        evidence.betaCohortSimulation.overCapacitySimulationReady,
      latestRunAt: evidence.betaCohortSimulation.latestRunAt,
    },
    outboundSelfTest: {
      ready: evidence.outboundSelfTest.ready,
      readinessStatus: evidence.outboundSelfTest.readinessStatus,
      blockerCount: evidence.outboundSelfTest.blockers.length,
    },
    counts: evidence.counts,
    docs: evidence.docs,
    dryRunOnly: true,
    noSmsSent: true,
    noTwilioSendCall: true,
    noProductionSagaAppData: true,
  }) as Record<string, unknown>;
}

export async function evaluateLaunchReadinessDrill(input?: {
  manualEvidence?: ManualEvidenceMap;
}): Promise<LaunchReadinessDrillResult> {
  const generatedAt = new Date().toISOString();
  const evidence = await getLaunchDrillEvidence(input);
  const stages = evaluateStages(evidence);
  const currentRecommendedStage = recommendedStage(stages, evidence);
  const launchRiskLevel = deriveRiskLevel(stages, evidence);
  const globalBlockers = unique(
    stages
      .filter((stage) => stage.status === "BLOCKED" || stage.status === "FAILED")
      .flatMap((stage) =>
        stage.blockers.map((blocker) => `${stage.id}: ${blocker}`),
      ),
  );
  const globalWarnings = unique([
    ...stages.flatMap((stage) => stage.warnings.map((warning) => `${stage.id}: ${warning}`)),
    "Launch drill is simulation only; it never sends SMS or invites users.",
    ...(evidence.pipeline.messageProcessingMode === "async_active"
      ? ["MESSAGE_PROCESSING_MODE=async_active is not allowed for this drill."]
      : []),
    ...(evidence.llm.modeEffective === "active_live"
      ? ["LLM_MODE=active_live is not allowed for this drill."]
      : []),
  ]);
  const overallReady =
    stages.find((stage) => stage.id === "COMPLETE")?.status === "READY" &&
    launchRiskLevel === "green";

  const recommendedNextAction =
    currentRecommendedStage === "PRE_A2P_HOLD"
      ? "Stay in PRE_A2P_HOLD: keep sends disabled, keep public launch disabled, and wait for A2P approval."
      : stages.find((stage) => stage.id === currentRecommendedStage)?.blockers[0] ||
        stages.find((stage) => stage.id === currentRecommendedStage)?.operatorSteps[0] ||
        "Review the launch drill checklist.";

  return safeLaunchDrillResult({
    currentRecommendedStage,
    overallReady,
    launchRiskLevel,
    stages,
    globalBlockers,
    globalWarnings,
    recommendedNextAction,
    evidenceSummary: evidenceSummary(evidence),
    generatedAt,
  });
}

export function safeLaunchDrillResult<T>(value: T): T {
  return redactSensitiveJson(value) as T;
}

export async function getLaunchDrillHealthSnapshot() {
  const sms = getSmsSafetyHealth();
  const pilot = getDesignPartnerPilotReadinessSnapshot();
  const docs = getLaunchDrillDocumentStatus();
  const [lastRun, betaCohortSimulation] = await Promise.all([
    getLaunchDrillCounts(),
    getBetaCohortSimulationHealthSnapshot(),
  ]);
  const blockers = [
    ...(!pilot.complianceApproved ? ["sms_compliance_not_approved"] : []),
    ...(sms.sendsDisabled ? ["sends_disabled"] : []),
    ...(pilot.publicLaunchEnabled ? ["public_launch_enabled"] : []),
    ...(!docs.launchReadinessDrillDocExists ? ["launch_drill_docs_missing"] : []),
    ...(betaCohortSimulation.simulationRiskLevel === "red"
      ? ["beta_cohort_simulation_red"]
      : []),
  ];
  const currentRecommendedLaunchStage = !pilot.complianceApproved
    ? "PRE_A2P_HOLD"
    : sms.sendsDisabled
      ? "ONE_NUMBER_SELF_TEST"
      : "A2P_APPROVED_REVIEW";
  return {
    launchDrillAvailable: true,
    launchRiskLevel: pilot.publicLaunchEnabled ? ("red" as const) : blockers.length ? ("yellow" as const) : ("green" as const),
    launchBlockerCount: blockers.length,
    currentRecommendedLaunchStage,
    designPartnerLaunchReady: false,
    publicBetaCandidateReady: false,
    betaCohortSimulationReady:
      betaCohortSimulation.requiredSimulationsPassed,
    lastLaunchDrillRunAt: lastRun.lastLaunchDrillRunAt,
  };
}

async function auditLaunchDrillEvent(input: {
  action: string;
  stage?: LaunchDrillStageId | null;
  status?: LaunchDrillStageStatus | null;
  riskLevel?: LaunchRiskLevel | null;
  blockersCount?: number;
  warningsCount?: number;
  notes?: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  await logAudit({
    actorType: "ADMIN",
    action: input.action,
    entityType: "LaunchDrill",
    entityId: input.stage || "launch-drill",
    metadata: redactSensitiveJson({
      stage: input.stage || null,
      status: input.status || null,
      riskLevel: input.riskLevel || null,
      blockersCount: input.blockersCount || 0,
      warningsCount: input.warningsCount || 0,
      hasNotes: Boolean(input.notes),
      dryRunOnly: true,
      noSmsSent: true,
      noTwilioSendCall: true,
      noSecrets: true,
    }),
  });
}

export async function runLaunchReadinessDrillForAdmin(input?: {
  notes?: string | null;
}) {
  await auditLaunchDrillEvent({
    action: launchDrillAuditEvents.runStarted,
    notes: input?.notes,
  });
  const result = await evaluateLaunchReadinessDrill();
  for (const stage of result.stages) {
    await auditLaunchDrillEvent({
      action: launchDrillAuditEvents.stageEvaluated,
      stage: stage.id,
      status: stage.status,
      riskLevel: result.launchRiskLevel,
      blockersCount: stage.blockers.length,
      warningsCount: stage.warnings.length,
    });
    if (stage.blockers.length > 0) {
      await auditLaunchDrillEvent({
        action: launchDrillAuditEvents.blockerDetected,
        stage: stage.id,
        status: stage.status,
        riskLevel: result.launchRiskLevel,
        blockersCount: stage.blockers.length,
        warningsCount: stage.warnings.length,
      });
    }
  }
  await auditLaunchDrillEvent({
    action: launchDrillAuditEvents.runCompleted,
    stage: result.currentRecommendedStage,
    status: result.overallReady ? "PASSED" : "BLOCKED",
    riskLevel: result.launchRiskLevel,
    blockersCount: result.globalBlockers.length,
    warningsCount: result.globalWarnings.length,
    notes: input?.notes,
  });
  return result;
}

export async function recordLaunchDrillManualEvidence(input: {
  stage: LaunchDrillStageId;
  status: LaunchDrillStageStatus;
  notes?: string | null;
}) {
  await auditLaunchDrillEvent({
    action: launchDrillAuditEvents.manualEvidenceRecorded,
    stage: input.stage,
    status: input.status,
    notes: input.notes,
  });
}

export function simulateRollbackDrill() {
  return safeLaunchDrillResult({
    simulatedAt: new Date().toISOString(),
    dryRunOnly: true,
    actions: [
      "Would set SMS_SENDS_DISABLED=true.",
      "Would set PILOT_REPLY_MODE=draft_only.",
      "Would set PILOT_STAGE=internal_test.",
      "Would clear or reduce SMS_ALLOWED_NUMBERS.",
      "Would disable or remove Twilio webhook if needed.",
      "Would pause PilotParticipant records.",
      "Would preserve audit logs and avoid data deletion until review.",
    ],
    noEnvChanged: true,
    noSmsSent: true,
    noTwilioSendCall: true,
  });
}

export function simulateIncidentDrill() {
  const scenarios = [
    "unexpected_outbound_sms",
    "duplicate_replies",
    "openai_unsafe_output",
    "twilio_webhook_failure",
    "pipeline_backlog",
    "database_unavailable",
    "data_exposure",
    "public_launch_enabled_accidentally",
  ].map((scenario) => ({
    scenario,
    detectionSignal:
      scenario === "unexpected_outbound_sms"
        ? "Twilio outbound logs or observability detect outbound activity while sends should be disabled."
        : "Observability, audit logs, admin report, or operator report detects the issue.",
    immediateResponse:
      "Keep or set SMS_SENDS_DISABLED=true, pause affected stage, preserve logs, and notify the pilot operator.",
    owner: "Pilot operator plus engineer on call.",
    rollback: "Use docs/pilot-rollback-runbook.md and preserve audit logs.",
    codexBugReportTemplate:
      "Incident, route/script, expected behavior, observed behavior, audit IDs, env safety flags, reproduction without SMS.",
  }));

  return safeLaunchDrillResult({
    simulatedAt: new Date().toISOString(),
    dryRunOnly: true,
    scenarios,
    noEnvChanged: true,
    noSmsSent: true,
    noTwilioSendCall: true,
  });
}

export async function simulateRollbackDrillForAdmin() {
  const result = simulateRollbackDrill();
  await auditLaunchDrillEvent({
    action: launchDrillAuditEvents.rollbackSimulated,
    stage: "ROLLBACK_DRILL",
    status: "READY",
    warningsCount: 1,
  });
  return result;
}

export async function simulateIncidentDrillForAdmin() {
  const result = simulateIncidentDrill();
  await auditLaunchDrillEvent({
    action: launchDrillAuditEvents.incidentSimulated,
    stage: "INCIDENT_DRILL",
    status: "READY",
    warningsCount: 1,
  });
  return result;
}

export function formatLaunchDrillReport(result: LaunchReadinessDrillResult) {
  const lines = [
    "# Saga SMS Producer Launch Readiness Drill",
    "",
    `Generated: ${result.generatedAt}`,
    `Risk level: ${result.launchRiskLevel}`,
    `Current recommended stage: ${result.currentRecommendedStage}`,
    `Overall ready: ${result.overallReady}`,
    "",
    "## Blockers",
    ...(result.globalBlockers.length
      ? result.globalBlockers.map((blocker) => `- ${blocker}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(result.globalWarnings.length
      ? result.globalWarnings.map((warning) => `- ${warning}`)
      : ["- none"]),
    "",
    "## Stages",
    ...result.stages.flatMap((stage) => [
      `### ${stage.id}: ${stage.title}`,
      `- Status: ${stage.status}`,
      `- Goal: ${stage.goal}`,
      `- Blockers: ${stage.blockers.length ? stage.blockers.join("; ") : "none"}`,
      `- Warnings: ${stage.warnings.length ? stage.warnings.join("; ") : "none"}`,
      `- Next operator step: ${stage.operatorSteps[0] || "review"}`,
      "",
    ]),
    "## Evidence Summary",
    "```json",
    JSON.stringify(result.evidenceSummary, null, 2),
    "```",
    "",
    "No SMS was sent. No Twilio send API was called. No design partners were invited.",
  ];

  return lines.join("\n");
}
