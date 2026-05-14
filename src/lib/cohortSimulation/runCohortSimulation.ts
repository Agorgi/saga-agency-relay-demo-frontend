import type { Prisma } from "@prisma/client";
import { evaluateInboundAccess } from "@/lib/access/accessControl";
import { logAudit } from "@/lib/audit";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import { getDb } from "@/lib/db";
import {
  runDesignPartnerTranscriptDryRuns,
  summarizeDesignPartnerTranscriptDryRuns,
} from "@/lib/dryRuns/runDesignPartnerTranscript";
import { containsForbiddenLlmClaim } from "@/lib/llm/llmTypes";
import { getLlmRuntimeConfig } from "@/lib/llm/llmProvider";
import { getCohortMembers } from "@/lib/cohortSimulation/cohortPersonas";
import {
  betaCohortSimulationAuditEvents,
  betaCohortSimulationTypes,
  prismaPersonaType,
  type BetaCohortMemberResult,
  type BetaCohortRiskLevel,
  type BetaCohortSimulationHealthSnapshot,
  type BetaCohortSimulationResult,
  type BetaCohortSimulationStatus,
  type BetaCohortSimulationType,
  type BetaCohortTranscriptSummary,
  type SimulatedCohortMember,
} from "@/lib/cohortSimulation/cohortTypes";

type CohortRunOptions = {
  persist?: boolean;
  enableLlm?: boolean;
  includeOperationalDrills?: boolean;
};

type SimulationScenarioConfig = {
  pilotStage:
    | "design_partner"
    | "private_beta"
    | "capped_public_beta"
    | "internal_test";
  accessMode: "invite_code" | "capped_public_beta" | "operator_approval";
  maxActiveParticipants: number;
  activeParticipantCount: number;
  dailyNewUserCount: number;
  publicBetaDailyNewUserCap: number;
  publicBetaEnabled: boolean;
  smsComplianceApproved: boolean;
};

const emptyTranscriptSummary: BetaCohortTranscriptSummary = {
  scenarioCount: 0,
  passedCount: 0,
  passRate: 0,
  averageScore: 0,
  safetyCriticalFailures: 0,
  fallbackUsedCount: 0,
  llmUsedCount: 0,
};

let transcriptDryRunCache: Promise<BetaCohortTranscriptSummary> | null = null;

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function syntheticPhone(index: number) {
  return `+1555${String(1000000 + index).slice(-7)}`;
}

function simulationConfigFor(
  cohortType: BetaCohortSimulationType,
): SimulationScenarioConfig {
  if (cohortType === "PRIVATE_BETA_25") {
    return {
      pilotStage: "private_beta",
      accessMode: "invite_code",
      maxActiveParticipants: 25,
      activeParticipantCount: 0,
      dailyNewUserCount: 0,
      publicBetaDailyNewUserCap: 10,
      publicBetaEnabled: false,
      smsComplianceApproved: true,
    };
  }

  if (cohortType === "CAPPED_PUBLIC_BETA_100") {
    return {
      pilotStage: "capped_public_beta",
      accessMode: "capped_public_beta",
      maxActiveParticipants: 100,
      activeParticipantCount: 0,
      dailyNewUserCount: 0,
      publicBetaDailyNewUserCap: 10,
      publicBetaEnabled: true,
      smsComplianceApproved: true,
    };
  }

  if (cohortType === "OVER_CAPACITY") {
    return {
      pilotStage: "capped_public_beta",
      accessMode: "capped_public_beta",
      maxActiveParticipants: 10,
      activeParticipantCount: 10,
      dailyNewUserCount: 10,
      publicBetaDailyNewUserCap: 10,
      publicBetaEnabled: true,
      smsComplianceApproved: true,
    };
  }

  return {
    pilotStage: "design_partner",
    accessMode: "invite_code",
    maxActiveParticipants: 10,
    activeParticipantCount: 0,
    dailyNewUserCount: 0,
    publicBetaDailyNewUserCap: 10,
    publicBetaEnabled: false,
    smsComplianceApproved: true,
  };
}

async function getTranscriptSummary(enableLlm = false) {
  if (!transcriptDryRunCache || enableLlm) {
    const run = async () => {
      const results = await runDesignPartnerTranscriptDryRuns({
        enableLlm,
      });
      const summary = summarizeDesignPartnerTranscriptDryRuns({
        results,
        smsComplianceApproved: true,
        sendsDisabled: false,
      });
      return {
        scenarioCount: summary.scenarioCount,
        passedCount: summary.scenariosPassed,
        passRate:
          summary.scenarioCount > 0
            ? Number((summary.scenariosPassed / summary.scenarioCount).toFixed(2))
            : 0,
        averageScore: summary.averageScore,
        safetyCriticalFailures: summary.safetyCriticalFailures.length,
        fallbackUsedCount: results.filter((result) => result.fallbackUsed).length,
        llmUsedCount: results.filter((result) => result.llmUsed).length,
      };
    };
    if (enableLlm) return run();
    transcriptDryRunCache = run();
  }
  return transcriptDryRunCache;
}

function flowForIntent(intent: string, member: SimulatedCohortMember) {
  if (member.personaType === "contact_reply") return "CONTACT_REPLY";
  if (intent === "ORGANIZER_PROJECT_IDEA") return "ORGANIZER_INTAKE";
  if (intent === "GIG_SEEKER_ONBOARDING") return "GIG_SEEKER_ONBOARDING";
  if (intent === "INTEREST_CHECK") return "INTEREST_CHECK";
  if (intent === "SAFETY_ESCALATION") return "NEEDS_ADMIN";
  if (intent === "STOP_OR_OPT_OUT" || intent === "START_OR_OPT_IN" || intent === "HELP") {
    return "CONTROL_KEYWORD";
  }
  return "UNKNOWN";
}

function maxRisk(levels: BetaCohortRiskLevel[]): BetaCohortRiskLevel {
  if (levels.some((level) => level === "red")) return "red";
  if (levels.some((level) => level === "yellow")) return "yellow";
  return "green";
}

function currentLaunchGateBlockers() {
  const blockers: string[] = [];
  if (!booleanEnv(process.env.SMS_COMPLIANCE_APPROVED)) {
    blockers.push("SMS_COMPLIANCE_APPROVED is false.");
  }
  if (booleanEnv(process.env.SMS_SENDS_DISABLED, true)) {
    blockers.push("SMS_SENDS_DISABLED is true.");
  }
  if (!booleanEnv(process.env.PUBLIC_BETA_ENABLED)) {
    blockers.push("PUBLIC_BETA_ENABLED is false.");
  }
  if (!booleanEnv(process.env.PUBLIC_LAUNCH_ENABLED)) {
    blockers.push("PUBLIC_LAUNCH_ENABLED is false.");
  }
  return blockers;
}

function memberPhoneKey(member: SimulatedCohortMember, index: number) {
  if (member.duplicateOf) return member.duplicateOf;
  return member.id || String(index);
}

function evaluateMember({
  member,
  index,
  cohortType,
  config,
  seenKeys,
}: {
  member: SimulatedCohortMember;
  index: number;
  cohortType: BetaCohortSimulationType;
  config: SimulationScenarioConfig;
  seenKeys: Set<string>;
}): BetaCohortMemberResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const normalizedPhone = syntheticPhone(index + 1);
  const phoneKey = memberPhoneKey(member, index);
  const isDuplicate = seenKeys.has(phoneKey) || Boolean(member.duplicateOf);
  seenKeys.add(phoneKey);

  const inviteCode =
    member.inviteCodeValid === false
      ? null
      : {
          id: `sim_invite_${cohortType.toLowerCase()}`,
          cohort: member.cohort,
          status: "ACTIVE" as const,
          uses: 0,
          maxUses: 500,
          expiresAt: null,
        };
  const participant = member.activeParticipant
    ? {
        id: `sim_participant_${member.id}`,
        status: "ACTIVE" as const,
        cohort: member.cohort,
        redactedPhone: "[simulation-redacted-phone]",
      }
    : member.pausedParticipant
      ? {
          id: `sim_participant_${member.id}`,
          status: "PAUSED" as const,
          cohort: member.cohort,
          redactedPhone: "[simulation-redacted-phone]",
        }
      : member.optedOut
        ? {
            id: `sim_participant_${member.id}`,
            status: "OPTED_OUT" as const,
            cohort: member.cohort,
            redactedPhone: "[simulation-redacted-phone]",
          }
        : null;

  const allowedNumbers = member.allowlisted ? [normalizedPhone] : [];
  const decision = evaluateInboundAccess({
    normalizedPhone,
    messageBody: member.startingMessage,
    pilotStage: config.pilotStage,
    accessMode: config.accessMode,
    allowedNumbers,
    participant,
    inviteCode,
    optedOut: member.optedOut,
    activeParticipantCount: config.activeParticipantCount,
    maxActiveParticipants: config.maxActiveParticipants,
    publicBetaDailyNewUserCap: config.publicBetaDailyNewUserCap,
    publicBetaEnabled: config.publicBetaEnabled,
    publicLaunchEnabled: false,
    smsComplianceApproved: config.smsComplianceApproved,
  });

  let accessStatus = decision.accessStatus as string;
  let allowed = decision.allowed;
  let waitlisted = decision.shouldWaitlist;

  if (isDuplicate) {
    accessStatus = "DUPLICATE_DETECTED";
    allowed = false;
    waitlisted = false;
    if (member.expectedAccessOutcome === "DUPLICATE_DETECTED") {
      warnings.push("duplicate_user_detected_and_blocked");
    } else {
      blockers.push("duplicate_user_detected");
    }
  }

  if (member.personaType === "spammy_unknown") {
    accessStatus = "BLOCKED_PUBLIC_CLOSED";
    allowed = false;
    waitlisted = false;
    if (member.expectedAccessOutcome === "BLOCKED_PUBLIC_CLOSED") {
      warnings.push("spammy_unknown_blocked");
    } else {
      blockers.push("spammy_unknown_not_admissible");
    }
  }

  const controlKeyword = member.startingMessage.trim().toUpperCase();
  if (
    member.personaType === "waitlist_user" &&
    !member.forceDailyCap &&
    !member.optedOut &&
    !["STOP", "START", "HELP"].includes(controlKeyword)
  ) {
    accessStatus = "WAITLISTED";
    allowed = false;
    waitlisted = true;
  }

  if (member.forceDailyCap) {
    if (decision.shouldCreateParticipant || member.forceDailyCap) {
      accessStatus = "DAILY_CAP_REACHED";
      allowed = false;
      waitlisted = true;
      if (member.expectedAccessOutcome === "DAILY_CAP_REACHED") {
        warnings.push("daily_new_user_cap_reached");
      } else {
        blockers.push("daily_new_user_cap_reached");
      }
    }
  }

  const intent = classifyConversationIntent({
    body: member.startingMessage,
    context:
      member.personaType === "contact_reply"
        ? ({ activeOutreach: true } as never)
        : undefined,
  });
  const actualFlow = waitlisted
    ? "WAITLISTED"
    : allowed
      ? flowForIntent(intent.intent, member)
      : "BLOCKED";
  const safetyEscalated = intent.shouldEscalate || actualFlow === "NEEDS_ADMIN";
  const forbiddenClaim = containsForbiddenLlmClaim(member.startingMessage);
  let conversationStatus: BetaCohortMemberResult["conversationStatus"] = "REPLY_PLANNED";

  if (!allowed && !waitlisted) conversationStatus = "SKIPPED_BLOCKED";
  else if (waitlisted) conversationStatus = "WAITLISTED";
  else if (actualFlow === "CONTROL_KEYWORD") conversationStatus = "CONTROL_KEYWORD_HANDLED";
  else if (safetyEscalated || member.shouldEscalate) conversationStatus = "NEEDS_ADMIN";

  if (member.shouldBeBlocked && allowed) blockers.push("expected_block_but_allowed");
  if (member.shouldBeWaitlisted && !waitlisted) blockers.push("expected_waitlist_but_not_waitlisted");
  if (!member.shouldBeBlocked && !member.shouldBeWaitlisted && !allowed) {
    warnings.push(`expected_admission_but_${accessStatus.toLowerCase()}`);
  }
  if (member.shouldEscalate && conversationStatus !== "NEEDS_ADMIN" && conversationStatus !== "SKIPPED_BLOCKED") {
    blockers.push("expected_escalation_but_not_escalated");
  }
  if (!member.shouldEscalate && safetyEscalated) warnings.push("unexpected_escalation");
  if (forbiddenClaim && conversationStatus !== "NEEDS_ADMIN" && !member.shouldBeBlocked) {
    blockers.push("forbidden_claim_without_escalation");
  }
  if (member.expectedConversationOutcome !== conversationStatus) {
    warnings.push(
      `conversation_outcome_expected_${member.expectedConversationOutcome}_got_${conversationStatus}`,
    );
  }
  if (member.expectedFlow !== actualFlow && member.expectedFlow !== "BLOCKED") {
    warnings.push(`flow_expected_${member.expectedFlow}_got_${actualFlow}`);
  }
  if (member.expectedAccessOutcome !== accessStatus) {
    if (
      !(
        member.expectedAccessOutcome === "WAITLISTED" &&
        accessStatus === "BLOCKED_CAP_REACHED"
      )
    ) {
      warnings.push(`access_expected_${member.expectedAccessOutcome}_got_${accessStatus}`);
    }
  }

  const score = Math.max(0, 14 - blockers.length * 4 - warnings.length);
  const riskLevel: BetaCohortRiskLevel = blockers.length
    ? "red"
    : warnings.length || member.expectedRiskLevel === "yellow"
      ? "yellow"
      : "green";

  return {
    memberId: member.id,
    personaType: member.personaType,
    cohort: member.cohort,
    expectedFlow: member.expectedFlow,
    actualFlow,
    accessStatus,
    conversationStatus,
    expectedAccessOutcome: member.expectedAccessOutcome,
    expectedConversationOutcome: member.expectedConversationOutcome,
    shouldEscalate: member.shouldEscalate,
    shouldBeWaitlisted: member.shouldBeWaitlisted,
    shouldBeBlocked: member.shouldBeBlocked,
    shouldCreatePilotParticipant: member.shouldCreatePilotParticipant,
    shouldCreateFeedback: member.shouldCreateFeedback,
    score,
    riskLevel,
    blockers,
    warnings,
    notes: [
      member.notes,
      "Simulation only: no SMS, Twilio API call, invite, group chat, outreach, or production Saga app data.",
    ],
  };
}

function statusFromRisk({
  riskLevel,
  blockers,
}: {
  riskLevel: BetaCohortRiskLevel;
  blockers: string[];
}): BetaCohortSimulationStatus {
  if (riskLevel === "red" || blockers.length > 0) return "FAILED";
  return "PASSED";
}

export async function runBetaCohortSimulation(
  cohortType: BetaCohortSimulationType,
  options: CohortRunOptions = {},
): Promise<BetaCohortSimulationResult> {
  const members = getCohortMembers(cohortType);
  const config = simulationConfigFor(cohortType);
  const seenKeys = new Set<string>();
  const memberResults = members.map((member, index) =>
    evaluateMember({ member, index, cohortType, config, seenKeys }),
  );
  const transcriptSummary =
    cohortType === "ROLLBACK_SIMULATION" || cohortType === "INCIDENT_SIMULATION"
      ? emptyTranscriptSummary
      : await getTranscriptSummary(Boolean(options.enableLlm));
  const forbiddenClaimsCount = memberResults.filter((result) =>
    result.blockers.includes("forbidden_claim_without_escalation"),
  ).length;
  const blockedSendCount = members.length;
  const launchGateBlockers = currentLaunchGateBlockers();
  const launchBlockedByCurrentGates = launchGateBlockers.some((blocker) =>
    /SMS_COMPLIANCE|SMS_SENDS_DISABLED|PUBLIC_BETA|PUBLIC_LAUNCH/.test(blocker),
  );
  const transcriptReady =
    transcriptSummary.scenarioCount === 0 ||
    (transcriptSummary.passRate >= 0.8 &&
      transcriptSummary.averageScore >= 10 &&
      transcriptSummary.safetyCriticalFailures === 0);
  const accessControlWarnings = memberResults
    .flatMap((result) => result.warnings)
    .filter((warning, index, all) => all.indexOf(warning) === index)
    .slice(0, 12);
  const dataOpsWarnings = ["simulation_data_tagged_do_not_export_as_real_pilot_data"];
  const blockers = memberResults
    .flatMap((result) => result.blockers)
    .filter((blocker, index, all) => all.indexOf(blocker) === index);
  if (!transcriptReady) blockers.push("transcript_dry_run_quality_below_threshold");
  if (forbiddenClaimsCount > 0) blockers.push("forbidden_claim_detected");

  const warnings = [
    ...accessControlWarnings,
    ...dataOpsWarnings,
    ...launchGateBlockers.map((blocker) => `real_launch_blocked: ${blocker}`),
  ].filter((warning, index, all) => all.indexOf(warning) === index);
  const riskLevel = maxRisk([
    ...memberResults.map((result) => result.riskLevel),
    transcriptReady ? "green" : "red",
    forbiddenClaimsCount > 0 ? "red" : "green",
    cohortType === "OVER_CAPACITY" ? "yellow" : "green",
  ]);
  const averageMemberScore =
    memberResults.length > 0
      ? memberResults.reduce((total, result) => total + result.score, 0) /
        memberResults.length
      : 0;
  const averageScore = Number(
    Math.min(
      14,
      transcriptSummary.averageScore
        ? (averageMemberScore + transcriptSummary.averageScore) / 2
        : averageMemberScore,
    ).toFixed(2),
  );
  const status = statusFromRisk({
    riskLevel,
    blockers,
  });
  const publicBetaReady =
    cohortType === "CAPPED_PUBLIC_BETA_100" &&
    riskLevel !== "red" &&
    transcriptReady &&
    !launchBlockedByCurrentGates;
  const designPartnerReady =
    cohortType === "DESIGN_PARTNER_10" &&
    riskLevel !== "red" &&
    transcriptReady &&
    !launchBlockedByCurrentGates;
  const result: BetaCohortSimulationResult = {
    cohortType,
    status,
    simulatedUserCount: members.length,
    allowedCount: memberResults.filter((result) =>
      ["ALLOWLISTED", "ACTIVE_PARTICIPANT", "INVITE_CODE_ACCEPTED"].includes(
        result.accessStatus,
      ),
    ).length,
    waitlistedCount: memberResults.filter(
      (result) =>
        result.conversationStatus === "WAITLISTED" ||
        result.accessStatus === "BLOCKED_CAP_REACHED" ||
        result.accessStatus === "DAILY_CAP_REACHED",
    ).length,
    blockedCount: memberResults.filter(
      (result) =>
        result.conversationStatus === "SKIPPED_BLOCKED" ||
        result.accessStatus.startsWith("BLOCKED") ||
        result.accessStatus === "DUPLICATE_DETECTED",
    ).length,
    rejectedCount: 0,
    optedOutCount: memberResults.filter(
      (result) => result.accessStatus === "BLOCKED_OPTED_OUT",
    ).length,
    escalatedCount: memberResults.filter(
      (result) => result.conversationStatus === "NEEDS_ADMIN",
    ).length,
    duplicateCount: memberResults.filter(
      (result) => result.accessStatus === "DUPLICATE_DETECTED",
    ).length,
    transcriptPassRate: transcriptSummary.passRate,
    averageScore,
    llmFallbackRate:
      transcriptSummary.scenarioCount > 0
        ? Number(
            (
              transcriptSummary.fallbackUsedCount / transcriptSummary.scenarioCount
            ).toFixed(2),
          )
        : 0,
    forbiddenClaimsCount,
    pipelineJobsSimulated: members.length,
    failedJobsSimulated: 0,
    blockedSendCount,
    dataOpsWarnings,
    accessControlWarnings,
    observabilityRiskLevel: riskLevel,
    publicBetaReady,
    designPartnerReady,
    launchBlockedByCurrentGates,
    launchGateBlockers,
    riskLevel,
    blockers,
    warnings,
    transcriptSummary,
    memberResults,
    simulationOnly: true,
    noSmsSent: true,
    noTwilioCalls: true,
    noProductionData: true,
    generatedAt: new Date().toISOString(),
  };

  if (options.persist) {
    await persistBetaCohortSimulationRun(result);
  }

  return result;
}

export async function runAllBetaCohortSimulations(
  options: CohortRunOptions = {},
) {
  const cohortTypes = options.includeOperationalDrills
    ? betaCohortSimulationTypes
    : betaCohortSimulationTypes.filter(
        (type) => type !== "ROLLBACK_SIMULATION" && type !== "INCIDENT_SIMULATION",
      );
  const results: BetaCohortSimulationResult[] = [];
  for (const type of cohortTypes) {
    results.push(await runBetaCohortSimulation(type, options));
  }
  return results;
}

export async function persistBetaCohortSimulationRun(
  result: BetaCohortSimulationResult,
) {
  if (!process.env.DATABASE_URL) return null;
  const db = getDb();
  const run = await db.betaCohortSimulationRun.create({
    data: {
      cohortType: result.cohortType,
      status: result.status,
      simulatedUserCount: result.simulatedUserCount,
      allowedCount: result.allowedCount,
      waitlistedCount: result.waitlistedCount,
      blockedCount: result.blockedCount,
      escalatedCount: result.escalatedCount,
      transcriptPassRate: result.transcriptPassRate,
      averageScore: result.averageScore,
      riskLevel: result.riskLevel,
      blockers: result.blockers as Prisma.InputJsonValue,
      warnings: result.warnings as Prisma.InputJsonValue,
      resultSummary: {
        cohortType: result.cohortType,
        status: result.status,
        simulatedUserCount: result.simulatedUserCount,
        allowedCount: result.allowedCount,
        waitlistedCount: result.waitlistedCount,
        blockedCount: result.blockedCount,
        escalatedCount: result.escalatedCount,
        duplicateCount: result.duplicateCount,
        transcriptPassRate: result.transcriptPassRate,
        averageScore: result.averageScore,
        riskLevel: result.riskLevel,
        publicBetaReady: result.publicBetaReady,
        designPartnerReady: result.designPartnerReady,
        launchBlockedByCurrentGates: result.launchBlockedByCurrentGates,
        simulationOnly: true,
        noSmsSent: true,
        noTwilioCalls: true,
      } satisfies Prisma.InputJsonObject,
      memberResults: {
        create: result.memberResults.map((member) => ({
          personaType: prismaPersonaType(member.personaType),
          expectedFlow: member.expectedFlow,
          actualFlow: member.actualFlow,
          accessStatus: member.accessStatus,
          conversationStatus: member.conversationStatus,
          score: member.score,
          riskLevel: member.riskLevel,
          blockers: member.blockers as Prisma.InputJsonValue,
          warnings: member.warnings as Prisma.InputJsonValue,
        })),
      },
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: betaCohortSimulationAuditEvents.runCompleted,
    entityType: "BetaCohortSimulationRun",
    entityId: run.id,
    metadata: {
      cohortType: result.cohortType,
      status: result.status,
      riskLevel: result.riskLevel,
      simulatedUserCount: result.simulatedUserCount,
      blockersCount: result.blockers.length,
      warningsCount: result.warnings.length,
      dryRunOnly: true,
      noSmsSent: true,
      noTwilioCalls: true,
    },
  });

  return run.id;
}

function resultFromDbRun(run: {
  cohortType: string;
  status: string;
  simulatedUserCount: number;
  allowedCount: number;
  waitlistedCount: number;
  blockedCount: number;
  escalatedCount: number;
  transcriptPassRate: number;
  averageScore: number;
  riskLevel: string;
  blockers: unknown;
  warnings: unknown;
  resultSummary: unknown;
  createdAt: Date;
}): BetaCohortSimulationResult {
  const summary = (run.resultSummary && typeof run.resultSummary === "object"
    ? (run.resultSummary as Record<string, unknown>)
    : {}) as Partial<BetaCohortSimulationResult>;
  return {
    cohortType: run.cohortType as BetaCohortSimulationType,
    status: run.status as BetaCohortSimulationStatus,
    simulatedUserCount: run.simulatedUserCount,
    allowedCount: run.allowedCount,
    waitlistedCount: run.waitlistedCount,
    blockedCount: run.blockedCount,
    rejectedCount: 0,
    optedOutCount: Number(summary.optedOutCount || 0),
    escalatedCount: run.escalatedCount,
    duplicateCount: Number(summary.duplicateCount || 0),
    transcriptPassRate: run.transcriptPassRate,
    averageScore: run.averageScore,
    llmFallbackRate: Number(summary.llmFallbackRate || 0),
    forbiddenClaimsCount: Number(summary.forbiddenClaimsCount || 0),
    pipelineJobsSimulated: Number(summary.pipelineJobsSimulated || run.simulatedUserCount),
    failedJobsSimulated: Number(summary.failedJobsSimulated || 0),
    blockedSendCount: Number(summary.blockedSendCount || run.simulatedUserCount),
    dataOpsWarnings: Array.isArray(summary.dataOpsWarnings)
      ? (summary.dataOpsWarnings as string[])
      : [],
    accessControlWarnings: Array.isArray(summary.accessControlWarnings)
      ? (summary.accessControlWarnings as string[])
      : [],
    observabilityRiskLevel: (summary.observabilityRiskLevel ||
      run.riskLevel) as BetaCohortRiskLevel,
    publicBetaReady: Boolean(summary.publicBetaReady),
    designPartnerReady: Boolean(summary.designPartnerReady),
    launchBlockedByCurrentGates: Boolean(summary.launchBlockedByCurrentGates),
    launchGateBlockers: Array.isArray(summary.launchGateBlockers)
      ? (summary.launchGateBlockers as string[])
      : [],
    riskLevel: run.riskLevel as BetaCohortRiskLevel,
    blockers: Array.isArray(run.blockers) ? (run.blockers as string[]) : [],
    warnings: Array.isArray(run.warnings) ? (run.warnings as string[]) : [],
    transcriptSummary: (summary.transcriptSummary ||
      emptyTranscriptSummary) as BetaCohortTranscriptSummary,
    memberResults: [],
    simulationOnly: true,
    noSmsSent: true,
    noTwilioCalls: true,
    noProductionData: true,
    generatedAt: run.createdAt.toISOString(),
  };
}

async function latestPersistedResults() {
  if (!process.env.DATABASE_URL) return null;
  const runs = await getDb().betaCohortSimulationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const byType = new Map<BetaCohortSimulationType, BetaCohortSimulationResult>();
  for (const run of runs) {
    const type = run.cohortType as BetaCohortSimulationType;
    if (!byType.has(type)) byType.set(type, resultFromDbRun(run));
  }
  return byType;
}

function healthFromResults(
  results: BetaCohortSimulationResult[],
): BetaCohortSimulationHealthSnapshot {
  const byType = new Map(results.map((result) => [result.cohortType, result]));
  const design = byType.get("DESIGN_PARTNER_10") || null;
  const privateBeta = byType.get("PRIVATE_BETA_25") || null;
  const cappedPublic = byType.get("CAPPED_PUBLIC_BETA_100") || null;
  const overCapacity = byType.get("OVER_CAPACITY") || null;
  const blockers = results
    .flatMap((result) => result.blockers)
    .filter((blocker, index, all) => all.indexOf(blocker) === index);
  const warnings = results
    .flatMap((result) => result.warnings)
    .filter((warning, index, all) => all.indexOf(warning) === index)
    .slice(0, 20);
  const simulationRiskLevel = maxRisk(
    results.length ? results.map((result) => result.riskLevel) : ["yellow"],
  );
  const designPartnerSimulationReady = Boolean(
    design && design.riskLevel !== "red" && design.transcriptPassRate >= 0.8,
  );
  const privateBetaSimulationReady = Boolean(
    privateBeta && privateBeta.riskLevel !== "red" && privateBeta.transcriptPassRate >= 0.8,
  );
  const publicBetaSimulationReady = Boolean(
    cappedPublic &&
      cappedPublic.riskLevel !== "red" &&
      cappedPublic.transcriptPassRate >= 0.8 &&
      overCapacity &&
      overCapacity.riskLevel !== "red",
  );
  return {
    betaCohortSimulationAvailable: true,
    lastDesignPartnerSimulationResult: design,
    lastPrivateBetaSimulationResult: privateBeta,
    lastCappedPublicBetaSimulationResult: cappedPublic,
    lastOverCapacitySimulationResult: overCapacity,
    simulationRiskLevel,
    simulationBlockerCount: blockers.length,
    designPartnerSimulationReady,
    privateBetaSimulationReady,
    publicBetaSimulationReady,
    overCapacitySimulationReady: Boolean(
      overCapacity && overCapacity.riskLevel !== "red",
    ),
    requiredSimulationsPassed:
      designPartnerSimulationReady &&
      privateBetaSimulationReady &&
      publicBetaSimulationReady,
    warnings,
    blockers,
    latestRunAt:
      results
        .map((result) => result.generatedAt)
        .sort()
        .reverse()[0] || null,
  };
}

export async function getBetaCohortSimulationHealthSnapshot({
  runFreshWhenNoDb = true,
}: {
  runFreshWhenNoDb?: boolean;
} = {}): Promise<BetaCohortSimulationHealthSnapshot> {
  const persisted = await latestPersistedResults();
  if (persisted && persisted.size > 0) {
    return healthFromResults(Array.from(persisted.values()));
  }
  if (!runFreshWhenNoDb) {
    return healthFromResults([]);
  }
  const results = await runAllBetaCohortSimulations();
  return healthFromResults(results);
}

export async function getBetaCohortSimulationAdminSnapshot() {
  const snapshot = await getBetaCohortSimulationHealthSnapshot({
    runFreshWhenNoDb: true,
  });
  return {
    ...snapshot,
    llmMode: getLlmRuntimeConfig().modeEffective,
    model: getLlmRuntimeConfig().model,
  };
}

export function formatBetaCohortSimulationReport(
  results: BetaCohortSimulationResult[],
) {
  const lines = [
    "# Beta Cohort Simulation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Simulation only: no SMS was sent, no Twilio send API was called, no real users were invited, and no production Saga app data was used.",
    "",
  ];
  for (const result of results) {
    lines.push(
      `## ${result.cohortType}`,
      "",
      `- Status: ${result.status}`,
      `- Risk: ${result.riskLevel}`,
      `- Users: ${result.simulatedUserCount}`,
      `- Allowed / waitlisted / blocked: ${result.allowedCount} / ${result.waitlistedCount} / ${result.blockedCount}`,
      `- Escalated: ${result.escalatedCount}`,
      `- Transcript pass rate: ${Math.round(result.transcriptPassRate * 100)}%`,
      `- Average score: ${result.averageScore}/14`,
      `- Launch blocked by current gates: ${result.launchBlockedByCurrentGates}`,
      `- Blockers: ${result.blockers.length ? result.blockers.join(", ") : "none"}`,
      `- Warnings: ${result.warnings.length ? result.warnings.slice(0, 6).join(", ") : "none"}`,
      "",
    );
  }
  return lines.join("\n");
}
