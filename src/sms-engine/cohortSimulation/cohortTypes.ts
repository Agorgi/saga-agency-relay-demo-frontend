import type { AccessStatus } from "@/sms-engine/access/accessControl";

export const betaCohortSimulationTypes = [
  "DESIGN_PARTNER_10",
  "PRIVATE_BETA_25",
  "CAPPED_PUBLIC_BETA_100",
  "OVER_CAPACITY",
  "ROLLBACK_SIMULATION",
  "INCIDENT_SIMULATION",
] as const;

export type BetaCohortSimulationType =
  (typeof betaCohortSimulationTypes)[number];

export type BetaCohortRiskLevel = "green" | "yellow" | "red";

export type BetaCohortSimulationStatus =
  | "PASSED"
  | "FAILED"
  | "BLOCKED"
  | "COMPLETED";

export type BetaCohortPersonaType =
  | "organizer"
  | "creator"
  | "interest_check"
  | "contact_reply"
  | "edge_safety"
  | "spammy_unknown"
  | "opted_out"
  | "duplicate"
  | "non_allowlisted"
  | "waitlist_user"
  | "support_confusion";

export type SimulatedCohortMember = {
  id: string;
  personaType: BetaCohortPersonaType;
  cohort: "design_partner" | "private_beta" | "public_beta" | "public_waitlist";
  city: string;
  fandoms: string[];
  expectedFlow:
    | "ORGANIZER_INTAKE"
    | "GIG_SEEKER_ONBOARDING"
    | "INTEREST_CHECK"
    | "CONTACT_REPLY"
    | "NEEDS_ADMIN"
    | "CONTROL_KEYWORD"
    | "BLOCKED"
    | "WAITLISTED";
  startingMessage: string;
  expectedAccessOutcome:
    | AccessStatus
    | "DUPLICATE_DETECTED"
    | "DAILY_CAP_REACHED";
  expectedConversationOutcome:
    | "REPLY_PLANNED"
    | "NEEDS_ADMIN"
    | "WAITLISTED"
    | "BLOCKED"
    | "CONTROL_KEYWORD_HANDLED"
    | "SKIPPED_BLOCKED";
  expectedRiskLevel: BetaCohortRiskLevel;
  shouldEscalate: boolean;
  shouldBeWaitlisted: boolean;
  shouldBeBlocked: boolean;
  shouldCreatePilotParticipant: boolean;
  shouldCreateFeedback: boolean;
  notes: string;
  allowlisted?: boolean;
  inviteCodeValid?: boolean;
  consentCaptured?: boolean;
  optedOut?: boolean;
  duplicateOf?: string;
  forceDailyCap?: boolean;
  activeParticipant?: boolean;
  pausedParticipant?: boolean;
  supportQuestion?: boolean;
};

export type BetaCohortMemberResult = {
  memberId: string;
  personaType: BetaCohortPersonaType;
  cohort: SimulatedCohortMember["cohort"];
  expectedFlow: SimulatedCohortMember["expectedFlow"];
  actualFlow: string;
  accessStatus: string;
  conversationStatus: SimulatedCohortMember["expectedConversationOutcome"];
  expectedAccessOutcome: SimulatedCohortMember["expectedAccessOutcome"];
  expectedConversationOutcome: SimulatedCohortMember["expectedConversationOutcome"];
  shouldEscalate: boolean;
  shouldBeWaitlisted: boolean;
  shouldBeBlocked: boolean;
  shouldCreatePilotParticipant: boolean;
  shouldCreateFeedback: boolean;
  score: number;
  riskLevel: BetaCohortRiskLevel;
  blockers: string[];
  warnings: string[];
  notes: string[];
};

export type BetaCohortTranscriptSummary = {
  scenarioCount: number;
  passedCount: number;
  passRate: number;
  averageScore: number;
  safetyCriticalFailures: number;
  fallbackUsedCount: number;
  llmUsedCount: number;
};

export type BetaCohortSimulationResult = {
  cohortType: BetaCohortSimulationType;
  status: BetaCohortSimulationStatus;
  simulatedUserCount: number;
  allowedCount: number;
  waitlistedCount: number;
  blockedCount: number;
  rejectedCount: number;
  optedOutCount: number;
  escalatedCount: number;
  duplicateCount: number;
  transcriptPassRate: number;
  averageScore: number;
  llmFallbackRate: number;
  forbiddenClaimsCount: number;
  pipelineJobsSimulated: number;
  failedJobsSimulated: number;
  blockedSendCount: number;
  dataOpsWarnings: string[];
  accessControlWarnings: string[];
  observabilityRiskLevel: BetaCohortRiskLevel;
  publicBetaReady: boolean;
  designPartnerReady: boolean;
  launchBlockedByCurrentGates: boolean;
  launchGateBlockers: string[];
  riskLevel: BetaCohortRiskLevel;
  blockers: string[];
  warnings: string[];
  transcriptSummary: BetaCohortTranscriptSummary;
  memberResults: BetaCohortMemberResult[];
  simulationOnly: true;
  noSmsSent: true;
  noTwilioCalls: true;
  noProductionData: true;
  generatedAt: string;
};

export type BetaCohortSimulationHealthSnapshot = {
  betaCohortSimulationAvailable: true;
  lastDesignPartnerSimulationResult: BetaCohortSimulationResult | null;
  lastPrivateBetaSimulationResult: BetaCohortSimulationResult | null;
  lastCappedPublicBetaSimulationResult: BetaCohortSimulationResult | null;
  lastOverCapacitySimulationResult: BetaCohortSimulationResult | null;
  simulationRiskLevel: BetaCohortRiskLevel;
  simulationBlockerCount: number;
  designPartnerSimulationReady: boolean;
  privateBetaSimulationReady: boolean;
  publicBetaSimulationReady: boolean;
  overCapacitySimulationReady: boolean;
  requiredSimulationsPassed: boolean;
  warnings: string[];
  blockers: string[];
  latestRunAt: string | null;
};

export const betaCohortSimulationAuditEvents = {
  runStarted: "beta_cohort_simulation.run_started",
  runCompleted: "beta_cohort_simulation.run_completed",
  memberEvaluated: "beta_cohort_simulation.member_evaluated",
  blockerDetected: "beta_cohort_simulation.blocker_detected",
  reportGenerated: "beta_cohort_simulation.report_generated",
} as const;

export function prismaSimulationType(value: BetaCohortSimulationType) {
  return value;
}

export function prismaPersonaType(value: BetaCohortPersonaType) {
  return value.toUpperCase() as
    | "ORGANIZER"
    | "CREATOR"
    | "INTEREST_CHECK"
    | "CONTACT_REPLY"
    | "EDGE_SAFETY"
    | "SPAMMY_UNKNOWN"
    | "OPTED_OUT"
    | "DUPLICATE"
    | "NON_ALLOWLISTED"
    | "WAITLIST_USER"
    | "SUPPORT_CONFUSION";
}

