import { createHash } from "node:crypto";
import type {
  BetaInviteCode,
  PilotParticipant,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getPilotStage, type PilotStage } from "@/lib/pilotControls";
import { allowedSmsNumbers } from "@/lib/smsSafety";

export const smsAccessModes = [
  "allowlist_only",
  "invite_code",
  "operator_approval",
  "capped_public_beta",
  "public_closed",
] as const;

export type SmsAccessMode = (typeof smsAccessModes)[number];

export type AccessStatus =
  | "ALLOWLISTED"
  | "ACTIVE_PARTICIPANT"
  | "INVITE_CODE_ACCEPTED"
  | "WAITLISTED"
  | "BLOCKED_NOT_ALLOWLISTED"
  | "BLOCKED_INVALID_INVITE"
  | "BLOCKED_CAP_REACHED"
  | "BLOCKED_PAUSED"
  | "BLOCKED_OPTED_OUT"
  | "BLOCKED_PUBLIC_CLOSED";

export type AccessCohort =
  | "internal"
  | "design_partner"
  | "private_beta"
  | "public_beta"
  | "public_waitlist";

export type InboundAccessParticipant = Pick<
  PilotParticipant,
  "id" | "status" | "cohort" | "redactedPhone"
> | null;

export type InboundAccessInviteCode = Pick<
  BetaInviteCode,
  "id" | "cohort" | "status" | "uses" | "maxUses" | "expiresAt"
> | null;

export type InboundAccessDecision = {
  allowed: boolean;
  accessStatus: AccessStatus;
  shouldCreateParticipant: boolean;
  shouldWaitlist: boolean;
  shouldEscalate: boolean;
  blockers: string[];
  warnings: string[];
  cohort?: AccessCohort;
  participantId?: string | null;
  inviteCodeId?: string | null;
  redactedPhone: string;
  capSnapshot: {
    activeCount: number;
    maxActiveParticipants: number;
    publicBetaDailyNewUserCap: number;
  };
  explanationForAudit: string;
};

export type EvaluateInboundAccessInput = {
  normalizedPhone: string;
  messageBody?: string | null;
  pilotStage: PilotStage;
  accessMode: SmsAccessMode;
  allowedNumbers: string[];
  participant?: InboundAccessParticipant;
  inviteCode?: InboundAccessInviteCode;
  optedOut?: boolean;
  activeParticipantCount: number;
  maxActiveParticipants: number;
  publicBetaDailyNewUserCap?: number;
  publicBetaEnabled: boolean;
  publicLaunchEnabled: boolean;
  smsComplianceApproved: boolean;
};

export const accessAuditEvents = {
  inboundEvaluated: "access.inbound_evaluated",
  inviteCodeCreated: "access.invite_code_created",
  inviteCodeUsed: "access.invite_code_used",
  inviteCodePaused: "access.invite_code_paused",
  participantCreated: "access.participant_created",
  participantActivated: "access.participant_activated",
  participantPaused: "access.participant_paused",
  participantWaitlisted: "access.participant_waitlisted",
  participantRejected: "access.participant_rejected",
  participantCompleted: "access.participant_completed",
  unknownInboundBlocked: "access.unknown_inbound_blocked",
  capReached: "access.cap_reached",
} as const;

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function positiveIntEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSmsAccessMode(): SmsAccessMode {
  const normalized = (process.env.SMS_ACCESS_MODE || "allowlist_only")
    .trim()
    .toLowerCase();
  return smsAccessModes.includes(normalized as SmsAccessMode)
    ? (normalized as SmsAccessMode)
    : "allowlist_only";
}

export function getAccessModeEffective() {
  const configured = getSmsAccessMode();
  const pilotStage = getPilotStage();
  const publicBetaEnabled = booleanEnv(process.env.PUBLIC_BETA_ENABLED);
  const publicLaunchEnabled = booleanEnv(process.env.PUBLIC_LAUNCH_ENABLED);
  const warnings: string[] = [];
  let effective = configured;

  if (configured === "capped_public_beta" && !publicBetaEnabled) {
    effective = "public_closed";
    warnings.push("public_beta_disabled");
  }

  if (pilotStage === "public_live" && !publicLaunchEnabled) {
    effective = "public_closed";
    warnings.push("public_launch_disabled");
  }

  if (pilotStage === "public_candidate" && configured === "capped_public_beta") {
    effective = "public_closed";
    warnings.push("public_candidate_no_public_access");
  }

  return {
    configured,
    effective,
    warnings,
  };
}

export function getParticipantCapForStage(stage = getPilotStage()) {
  if (stage === "private_beta") {
    return positiveIntEnv(process.env.PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS, 50);
  }
  if (stage === "capped_public_beta" || stage === "public_candidate") {
    return positiveIntEnv(process.env.PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS, 100);
  }
  return positiveIntEnv(process.env.PILOT_MAX_ACTIVE_PARTICIPANTS, 10);
}

export function getPublicBetaAccessConfig() {
  const pilotStage = getPilotStage();
  const accessMode = getSmsAccessMode();
  const accessModeResolution = getAccessModeEffective();
  const publicBetaEnabled = booleanEnv(process.env.PUBLIC_BETA_ENABLED);
  const publicLaunchEnabled = booleanEnv(process.env.PUBLIC_LAUNCH_ENABLED);
  const smsComplianceApproved = booleanEnv(process.env.SMS_COMPLIANCE_APPROVED);
  const maxActiveParticipants = getParticipantCapForStage(pilotStage);
  const publicBetaDailyNewUserCap = positiveIntEnv(
    process.env.PUBLIC_BETA_NEW_USER_DAILY_CAP,
    10,
  );

  return {
    pilotStage,
    smsAccessMode: accessMode,
    accessModeConfigured: accessModeResolution.configured,
    accessModeEffective: accessModeResolution.effective,
    accessModeWarnings: accessModeResolution.warnings,
    publicBetaEnabled,
    publicLaunchEnabled,
    smsComplianceApproved,
    maxActiveParticipants,
    publicBetaDailyNewUserCap,
    unknownInboundBehavior:
      accessModeResolution.effective === "operator_approval" ||
      accessModeResolution.effective === "capped_public_beta"
        ? "waitlist_or_block"
        : "blocked",
  };
}

export function hashInviteCode(code: string) {
  return createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

export function hashAccessPhone(normalizedPhone: string) {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}

export function extractInviteCode(messageBody?: string | null) {
  const body = (messageBody || "").trim();
  if (!body) return null;
  const explicit = body.match(/\b(?:invite|code|beta)\s*[:#-]?\s*([A-Z0-9_-]{4,64})\b/i);
  if (explicit?.[1]) return explicit[1].toUpperCase();
  if (/^[A-Z0-9_-]{4,64}$/i.test(body)) return body.toUpperCase();
  return null;
}

export function detectControlKeyword(messageBody?: string | null) {
  const text = (messageBody || "").trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(text)) {
    return "STOP" as const;
  }
  if (["START", "UNSTOP"].includes(text)) return "START" as const;
  if (text === "HELP") return "HELP" as const;
  return null;
}

function cohortForStage(stage: PilotStage): AccessCohort {
  if (stage === "design_partner") return "design_partner";
  if (stage === "private_beta") return "private_beta";
  if (stage === "capped_public_beta") return "public_beta";
  if (stage === "public_live") return "public_beta";
  return "internal";
}

function normalizedCohort(value?: string | null): AccessCohort {
  if (
    value === "internal" ||
    value === "design_partner" ||
    value === "private_beta" ||
    value === "public_beta" ||
    value === "public_waitlist"
  ) {
    return value;
  }
  return "internal";
}

function baseDecision(
  input: EvaluateInboundAccessInput,
  accessStatus: AccessStatus,
  overrides: Partial<InboundAccessDecision> = {},
): InboundAccessDecision {
  const allowed = overrides.allowed ?? false;
  const redactedPhone = redactPhoneForDisplay(input.normalizedPhone);
  return {
    allowed,
    accessStatus,
    shouldCreateParticipant: false,
    shouldWaitlist: false,
    shouldEscalate: !allowed,
    blockers: allowed ? [] : [accessStatus.toLowerCase()],
    warnings: [],
    cohort: overrides.cohort,
    participantId: input.participant?.id ?? null,
    inviteCodeId: input.inviteCode?.id ?? null,
    redactedPhone,
    capSnapshot: {
      activeCount: input.activeParticipantCount,
      maxActiveParticipants: input.maxActiveParticipants,
      publicBetaDailyNewUserCap: input.publicBetaDailyNewUserCap ?? 10,
    },
    explanationForAudit: accessStatus.toLowerCase(),
    ...overrides,
  };
}

function capReached(input: EvaluateInboundAccessInput) {
  return input.activeParticipantCount >= input.maxActiveParticipants;
}

function inviteIsUsable(inviteCode: InboundAccessInviteCode) {
  if (!inviteCode) return false;
  if (inviteCode.status !== "ACTIVE") return false;
  if (inviteCode.expiresAt && inviteCode.expiresAt.getTime() < Date.now()) {
    return false;
  }
  return inviteCode.uses < inviteCode.maxUses;
}

export function nextInviteCodeUsageState(inviteCode: Pick<
  BetaInviteCode,
  "uses" | "maxUses" | "status"
>) {
  const uses = inviteCode.uses + 1;
  return {
    uses,
    status: uses >= inviteCode.maxUses ? ("EXHAUSTED" as const) : inviteCode.status,
  };
}

export function shouldContinueInboundConversation(decision: InboundAccessDecision) {
  return decision.allowed;
}

export function evaluateInboundAccess(
  input: EvaluateInboundAccessInput,
): InboundAccessDecision {
  const keyword = detectControlKeyword(input.messageBody);
  const isAllowlisted = input.allowedNumbers.includes(input.normalizedPhone);
  const participant = input.participant;
  const participantStatus = participant?.status;
  const participantCohort = normalizedCohort(participant?.cohort);

  if (input.optedOut || participantStatus === "OPTED_OUT") {
    return baseDecision(input, "BLOCKED_OPTED_OUT", {
      explanationForAudit: "opted_out_precedence",
    });
  }

  if (keyword) {
    return baseDecision(input, isAllowlisted ? "ALLOWLISTED" : "ACTIVE_PARTICIPANT", {
      allowed: true,
      shouldEscalate: false,
      blockers: [],
      warnings: isAllowlisted ? [] : ["control_keyword_allowed_without_normal_flow"],
      cohort: participantCohort,
      explanationForAudit: `${keyword.toLowerCase()}_keyword_precedence`,
    });
  }

  if (isAllowlisted) {
    return baseDecision(input, "ALLOWLISTED", {
      allowed: true,
      shouldEscalate: false,
      blockers: [],
      cohort: participantCohort,
      explanationForAudit: "hard_allowlist_match",
    });
  }

  if (participantStatus === "PAUSED") {
    return baseDecision(input, "BLOCKED_PAUSED", {
      cohort: participantCohort,
      explanationForAudit: "participant_paused",
    });
  }

  if (participantStatus === "WAITLISTED" || participantStatus === "REJECTED") {
    return baseDecision(input, "WAITLISTED", {
      shouldWaitlist: true,
      cohort: participantCohort,
      explanationForAudit: `participant_${participantStatus.toLowerCase()}`,
    });
  }

  if (participantStatus === "ACTIVE") {
    return baseDecision(input, "ACTIVE_PARTICIPANT", {
      allowed: true,
      shouldEscalate: false,
      blockers: [],
      cohort: participantCohort,
      explanationForAudit: "active_participant",
    });
  }

  if (input.accessMode === "allowlist_only") {
    return baseDecision(input, "BLOCKED_NOT_ALLOWLISTED", {
      explanationForAudit: "allowlist_only_unknown_sender",
    });
  }

  if (input.accessMode === "public_closed") {
    return baseDecision(input, "BLOCKED_PUBLIC_CLOSED", {
      explanationForAudit: "public_access_closed",
    });
  }

  if (input.accessMode === "operator_approval") {
    return baseDecision(input, "WAITLISTED", {
      shouldCreateParticipant: !participant,
      shouldWaitlist: true,
      cohort: "public_waitlist",
      warnings: ["operator_approval_required"],
      explanationForAudit: "operator_approval_waitlist",
    });
  }

  if (input.accessMode === "invite_code") {
    const inviteCode = input.inviteCode ?? null;
    if (!inviteIsUsable(inviteCode)) {
      return baseDecision(input, "BLOCKED_INVALID_INVITE", {
        explanationForAudit: "invite_code_missing_invalid_expired_or_exhausted",
      });
    }
    if (capReached(input)) {
      return baseDecision(input, "BLOCKED_CAP_REACHED", {
        shouldWaitlist: true,
        cohort: "public_waitlist",
        explanationForAudit: "participant_cap_reached",
      });
    }
    return baseDecision(input, "INVITE_CODE_ACCEPTED", {
      allowed: true,
      shouldCreateParticipant: !participant,
      shouldEscalate: false,
      blockers: [],
      cohort: normalizedCohort(input.inviteCode?.cohort) || cohortForStage(input.pilotStage),
      explanationForAudit: "valid_invite_code",
    });
  }

  if (input.accessMode === "capped_public_beta") {
    if (
      !input.publicBetaEnabled ||
      !input.smsComplianceApproved ||
      input.pilotStage !== "capped_public_beta"
    ) {
      return baseDecision(input, "BLOCKED_PUBLIC_CLOSED", {
        explanationForAudit: "capped_public_beta_gates_closed",
      });
    }
    if (capReached(input)) {
      return baseDecision(input, "BLOCKED_CAP_REACHED", {
        shouldCreateParticipant: !participant,
        shouldWaitlist: true,
        cohort: "public_waitlist",
        explanationForAudit: "public_beta_cap_reached",
      });
    }
    return baseDecision(input, "ACTIVE_PARTICIPANT", {
      allowed: true,
      shouldCreateParticipant: !participant,
      shouldEscalate: false,
      blockers: [],
      cohort: "public_beta",
      explanationForAudit: "capped_public_beta_gates_passed",
    });
  }

  return baseDecision(input, "BLOCKED_PUBLIC_CLOSED", {
    explanationForAudit: "unknown_access_mode",
  });
}

function accessMetadata(decision: InboundAccessDecision, input?: {
  twilioMessageSid?: string | null;
  pilotStage?: string;
  accessMode?: string;
}) {
  return {
    participantId: decision.participantId || undefined,
    inviteCodeId: decision.inviteCodeId || undefined,
    accessStatus: decision.accessStatus,
    pilotStage: input?.pilotStage,
    accessMode: input?.accessMode,
    cohort: decision.cohort,
    capSnapshot: decision.capSnapshot,
    allowed: decision.allowed,
    shouldWaitlist: decision.shouldWaitlist,
    shouldCreateParticipant: decision.shouldCreateParticipant,
    blockers: decision.blockers,
    warnings: decision.warnings,
    redactedPhone: decision.redactedPhone,
    twilioMessageSid: input?.twilioMessageSid,
    explanationForAudit: decision.explanationForAudit,
  };
}

export async function evaluateAndApplyInboundAccess(input: {
  from: string;
  body: string;
  twilioMessageSid?: string | null;
}) {
  const normalizedPhone = normalizePhone(input.from);
  const config = getPublicBetaAccessConfig();
  const allowedNumbers = allowedSmsNumbers();
  const phoneHash = hashAccessPhone(normalizedPhone);
  const inviteCodeText = extractInviteCode(input.body);
  const inviteCodeHash = inviteCodeText ? hashInviteCode(inviteCodeText) : null;

  if (!process.env.DATABASE_URL) {
    const decision = evaluateInboundAccess({
      normalizedPhone,
      messageBody: input.body,
      pilotStage: config.pilotStage,
      accessMode: config.accessModeEffective,
      allowedNumbers,
      participant: null,
      inviteCode: null,
      optedOut: false,
      activeParticipantCount: 0,
      maxActiveParticipants: config.maxActiveParticipants,
      publicBetaDailyNewUserCap: config.publicBetaDailyNewUserCap,
      publicBetaEnabled: config.publicBetaEnabled,
      publicLaunchEnabled: config.publicLaunchEnabled,
      smsComplianceApproved: config.smsComplianceApproved,
    });
    return { decision, participant: null, inviteCode: null };
  }

  const db = getDb();
  return db.$transaction(async (tx) => {
    const [participant, inviteCode, activeParticipantCount] = await Promise.all([
      tx.pilotParticipant.findFirst({
        where: { phoneHash },
        orderBy: { updatedAt: "desc" },
      }),
      inviteCodeHash
        ? tx.betaInviteCode.findUnique({ where: { codeHash: inviteCodeHash } })
        : Promise.resolve(null),
      tx.pilotParticipant.count({ where: { status: "ACTIVE" } }),
    ]);

    let decision = evaluateInboundAccess({
      normalizedPhone,
      messageBody: input.body,
      pilotStage: config.pilotStage,
      accessMode: config.accessModeEffective,
      allowedNumbers,
      participant,
      inviteCode,
      optedOut: participant?.status === "OPTED_OUT",
      activeParticipantCount,
      maxActiveParticipants: config.maxActiveParticipants,
      publicBetaDailyNewUserCap: config.publicBetaDailyNewUserCap,
      publicBetaEnabled: config.publicBetaEnabled,
      publicLaunchEnabled: config.publicLaunchEnabled,
      smsComplianceApproved: config.smsComplianceApproved,
    });

    let appliedParticipant = participant;
    if (decision.shouldCreateParticipant) {
      const now = new Date();
      appliedParticipant = await tx.pilotParticipant.create({
        data: {
          phoneHash,
          redactedPhone: decision.redactedPhone,
          role:
            decision.cohort === "internal" ? "INTERNAL_TEST" : "OBSERVER",
          cohort: decision.cohort || cohortForStage(config.pilotStage),
          status: decision.allowed ? "ACTIVE" : "WAITLISTED",
          inviteCodeId: inviteCode?.id,
          consentSource: decision.allowed ? "invite_code_or_access_gate" : null,
          consentTimestamp: decision.allowed ? now : null,
          joinedAt: decision.allowed ? now : null,
          lastActiveAt: now,
        },
      });
      decision = {
        ...decision,
        participantId: appliedParticipant.id,
      };
    } else if (appliedParticipant && decision.allowed) {
      appliedParticipant = await tx.pilotParticipant.update({
        where: { id: appliedParticipant.id },
        data: { lastActiveAt: new Date() },
      });
    }

    if (decision.accessStatus === "INVITE_CODE_ACCEPTED" && inviteCode) {
      const nextUsage = nextInviteCodeUsageState(inviteCode);
      const updated = await tx.betaInviteCode.update({
        where: { id: inviteCode.id },
        data: {
          uses: { increment: 1 },
          status: nextUsage.status,
        },
      });
      await logAudit({
        actorType: "SYSTEM",
        action: accessAuditEvents.inviteCodeUsed,
        entityType: "BetaInviteCode",
        entityId: inviteCode.id,
        metadata: {
          inviteCodeId: inviteCode.id,
          accessStatus: decision.accessStatus,
          pilotStage: config.pilotStage,
          accessMode: config.accessModeEffective,
          cohort: updated.cohort,
          uses: updated.uses,
          maxUses: updated.maxUses,
          redactedPhone: decision.redactedPhone,
          twilioMessageSid: input.twilioMessageSid,
        },
      });
    }

    await logAudit({
      actorType: "SYSTEM",
      action: accessAuditEvents.inboundEvaluated,
      entityType: "Access",
      entityId: appliedParticipant?.id || input.twilioMessageSid || "inbound",
      metadata: accessMetadata(decision, {
        pilotStage: config.pilotStage,
        accessMode: config.accessModeEffective,
        twilioMessageSid: input.twilioMessageSid,
      }),
    });

    if (!decision.allowed) {
      const blockedAction =
        decision.accessStatus === "WAITLISTED"
          ? accessAuditEvents.participantWaitlisted
          : decision.accessStatus === "BLOCKED_CAP_REACHED"
            ? accessAuditEvents.capReached
            : accessAuditEvents.unknownInboundBlocked;
      await logAudit({
        actorType: "SYSTEM",
        action: blockedAction,
        entityType: "Access",
        entityId: appliedParticipant?.id || input.twilioMessageSid || "inbound",
        metadata: accessMetadata(decision, {
          pilotStage: config.pilotStage,
          accessMode: config.accessModeEffective,
          twilioMessageSid: input.twilioMessageSid,
        }),
      });
    } else if (decision.shouldCreateParticipant && appliedParticipant) {
      await logAudit({
        actorType: "SYSTEM",
        action: accessAuditEvents.participantCreated,
        entityType: "PilotParticipant",
        entityId: appliedParticipant.id,
        metadata: accessMetadata(decision, {
          pilotStage: config.pilotStage,
          accessMode: config.accessModeEffective,
          twilioMessageSid: input.twilioMessageSid,
        }),
      });
    }

    return { decision, participant: appliedParticipant, inviteCode };
  });
}

export async function getPublicBetaAccessHealthSnapshot() {
  const config = getPublicBetaAccessConfig();
  if (!process.env.DATABASE_URL) {
    return {
      publicBetaAccessAvailable: true,
      ...config,
      publicAccessEnabled:
        config.accessModeEffective === "capped_public_beta" &&
        config.publicBetaEnabled &&
        config.smsComplianceApproved,
      currentActiveParticipants: null,
      waitlistedParticipantCount: null,
      inviteCodeCount: null,
      recentBlockedInboundCount: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      currentActiveParticipants,
      waitlistedParticipantCount,
      inviteCodeCount,
      recentBlockedInboundCount,
    ] = await Promise.all([
      getDb().pilotParticipant.count({ where: { status: "ACTIVE" } }),
      getDb().pilotParticipant.count({ where: { status: "WAITLISTED" } }),
      getDb().betaInviteCode.count(),
      getDb().auditLog.count({
        where: {
          action: {
            in: [
              accessAuditEvents.unknownInboundBlocked,
              accessAuditEvents.participantWaitlisted,
              accessAuditEvents.capReached,
            ],
          },
          createdAt: { gte: since },
        },
      }),
    ]);

    return {
      publicBetaAccessAvailable: true,
      ...config,
      publicAccessEnabled:
        config.accessModeEffective === "capped_public_beta" &&
        config.publicBetaEnabled &&
        config.smsComplianceApproved,
      currentActiveParticipants,
      waitlistedParticipantCount,
      inviteCodeCount,
      recentBlockedInboundCount,
    };
  } catch {
    return {
      publicBetaAccessAvailable: true,
      ...config,
      publicAccessEnabled: false,
      currentActiveParticipants: null,
      waitlistedParticipantCount: null,
      inviteCodeCount: null,
      recentBlockedInboundCount: null,
      warnings: ["public_beta_access_db_unavailable"],
    };
  }
}

export async function getPublicBetaAccessAdminSnapshot() {
  const health = await getPublicBetaAccessHealthSnapshot();
  if (!process.env.DATABASE_URL) {
    return {
      health,
      participants: [],
      inviteCodes: [],
      recentAccessEvents: [],
    };
  }

  const [participants, inviteCodes, recentAccessEvents] = await Promise.all([
    getDb().pilotParticipant.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        redactedPhone: true,
        role: true,
        cohort: true,
        status: true,
        joinedAt: true,
        lastActiveAt: true,
        updatedAt: true,
        inviteCodeId: true,
      },
    }),
    getDb().betaInviteCode.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        label: true,
        cohort: true,
        maxUses: true,
        uses: true,
        expiresAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    getDb().auditLog.findMany({
      where: { action: { startsWith: "access." } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    health,
    participants,
    inviteCodes,
    recentAccessEvents,
  };
}

export function safeAccessDecisionForAudit(decision: InboundAccessDecision) {
  return accessMetadata(decision);
}
