import { hashPhoneForLookup } from "@/sms-engine/dataOps/dataClassification";
import { getDb } from "@/sms-engine/db";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { logAudit } from "@/sms-engine/audit";
import { normalizePhone } from "@/sms-engine/phone";

export const conversationAutonomyModes = [
  "MANUAL_REVIEW",
  "AUTONOMOUS_UNTIL_OUTREACH",
  "PAUSED",
] as const;

export type ConversationAutonomyMode = (typeof conversationAutonomyModes)[number];

export const autonomyAuditEvents = {
  settingCreated: "autonomy.setting_created",
  settingUpdated: "autonomy.setting_updated",
  replyEvaluated: "autonomy.reply_evaluated",
  replyAllowed: "autonomy.reply_allowed",
  replyBlocked: "autonomy.reply_blocked",
  handoffRequired: "autonomy.handoff_required",
  candidateOutreachBoundaryReached:
    "autonomy.candidate_outreach_boundary_reached",
  shortlistBoundaryReached: "autonomy.shortlist_boundary_reached",
  groupChatBoundaryReached: "autonomy.group_chat_boundary_reached",
  pausedInboundReceived: "autonomy.paused_inbound_received",
} as const;

export const autonomyNeedsAttentionAuditActions = [
  autonomyAuditEvents.replyBlocked,
  autonomyAuditEvents.handoffRequired,
  autonomyAuditEvents.candidateOutreachBoundaryReached,
  autonomyAuditEvents.shortlistBoundaryReached,
  autonomyAuditEvents.groupChatBoundaryReached,
  autonomyAuditEvents.pausedInboundReceived,
] as const;

export type ConversationAutonomyDecision =
  | "ALLOW_AUTONOMOUS_REPLY"
  | "BLOCKED_MANUAL_REVIEW"
  | "BLOCKED_PAUSED"
  | "BLOCKED_OPTOUT"
  | "BLOCKED_SENDS_DISABLED"
  | "BLOCKED_NOT_ALLOWLISTED"
  | "HANDOFF_REQUIRED_CANDIDATE_OUTREACH"
  | "HANDOFF_REQUIRED_SHORTLIST"
  | "HANDOFF_REQUIRED_GROUP_CHAT"
  | "HANDOFF_REQUIRED_SAFETY"
  | "HANDOFF_REQUIRED_PAYMENT_OR_RATE"
  | "HANDOFF_REQUIRED_UNKNOWN";

export type ConversationAutonomyInput = {
  normalizedPhone?: string | null;
  phoneHash?: string | null;
  redactedPhone?: string | null;
  mode?: ConversationAutonomyMode | string | null;
  personId?: string | null;
  contactId?: string | null;
  pilotParticipantId?: string | null;
  optedOut?: boolean;
  doNotContact?: boolean;
  smsSafetyConfig?: {
    sendsDisabled?: boolean;
    allowlistRequired?: boolean;
    allowedNumbers?: string[];
  };
  pilotStage?: string | null;
  pilotReplyMode?: string | null;
  currentConversationFlow?: string | null;
  currentReplyPlan?: {
    shouldEscalate?: boolean;
    escalationReason?: string | null;
  } | null;
  hasCandidateOutreachBoundary?: boolean;
  hasShortlistBoundary?: boolean;
  hasGroupChatBoundary?: boolean;
  hasTeamConfirmationBoundary?: boolean;
  hasPublicWebCandidateContact?: boolean;
  hasExternalAction?: boolean;
};

export type ConversationAutonomyEvaluation = {
  allowed: boolean;
  mode: ConversationAutonomyMode;
  decision: ConversationAutonomyDecision;
  blockers: string[];
  warnings: string[];
  needsAttention: boolean;
  explanationForAudit: string;
};

export type ConversationAutonomySettingInput = {
  phoneHash: string;
  redactedPhone: string;
  mode: ConversationAutonomyMode;
  personId?: string | null;
  contactId?: string | null;
  pilotParticipantId?: string | null;
  reason?: string | null;
  notes?: string | null;
  updatedBy?: string | null;
};

export type ConversationAutonomyAdminSetting = {
  id?: string | null;
  mode?: string | null;
  enabled?: boolean | null;
  phoneHash?: string | null;
  redactedPhone?: string | null;
  reason?: string | null;
  notes?: string | null;
  updatedAt?: Date | string | null;
  lastAutonomousReplyAt?: Date | string | null;
  lastHandoffAt?: Date | string | null;
};

const ordinaryAutonomousFlows = new Set([
  "CAPABILITY_FAQ",
  "ORGANIZER_INTAKE",
  "ORGANIZER_PROJECT_CLARIFICATION",
  "GIG_SEEKER_ONBOARDING",
  "INTEREST_CHECK",
]);

function isConversationAutonomyMode(value?: string | null): value is ConversationAutonomyMode {
  return conversationAutonomyModes.includes(value as ConversationAutonomyMode);
}

export function normalizeConversationAutonomyMode(
  value?: string | null,
): ConversationAutonomyMode {
  return isConversationAutonomyMode(value) ? value : "MANUAL_REVIEW";
}

export function conversationAutonomyEnabled(mode: ConversationAutonomyMode) {
  return mode === "AUTONOMOUS_UNTIL_OUTREACH";
}

export function conversationAutonomyModeLabel(mode: ConversationAutonomyMode) {
  if (mode === "AUTONOMOUS_UNTIL_OUTREACH") return "On — autonomous until outreach";
  if (mode === "PAUSED") return "Paused";
  return "Off — manual review";
}

export function serializeConversationAutonomySettingForAdmin(
  setting?: ConversationAutonomyAdminSetting | null,
) {
  const mode = normalizeConversationAutonomyMode(setting?.mode);
  const displayPhone = setting?.redactedPhone
    ? setting.redactedPhone.includes("•") ||
      setting.redactedPhone.includes("[redacted")
      ? setting.redactedPhone
      : redactPhoneForDisplay(setting.redactedPhone)
    : null;
  return {
    id: setting?.id || null,
    mode,
    label: conversationAutonomyModeLabel(mode),
    enabled: conversationAutonomyEnabled(mode),
    phoneHash: setting?.phoneHash || null,
    redactedPhone: displayPhone,
    reason: setting?.reason || null,
    notes: setting?.notes || null,
    updatedAt: setting?.updatedAt
      ? new Date(setting.updatedAt).toISOString()
      : null,
    lastAutonomousReplyAt: setting?.lastAutonomousReplyAt
      ? new Date(setting.lastAutonomousReplyAt).toISOString()
      : null,
    lastHandoffAt: setting?.lastHandoffAt
      ? new Date(setting.lastHandoffAt).toISOString()
      : null,
  };
}

export function prepareConversationAutonomyPhone(rawPhone: string) {
  const normalizedPhone = normalizePhone(rawPhone);
  return {
    normalizedPhone,
    phoneHash: hashPhoneForLookup(normalizedPhone) || "",
    redactedPhone: redactPhoneForDisplay(normalizedPhone),
  };
}

function normalizeAllowedNumbers(numbers?: string[]) {
  return (numbers || [])
    .map((phone) => {
      try {
        return normalizePhone(phone);
      } catch {
        return null;
      }
    })
    .filter((phone): phone is string => Boolean(phone));
}

function hasPaymentOrRateIssue(input: ConversationAutonomyInput) {
  const reason = input.currentReplyPlan?.escalationReason || "";
  return /(payment|rate|paid|budget|contract|deposit|legal|permit)/i.test(reason);
}

function hasSafetyIssue(input: ConversationAutonomyInput) {
  const reason = input.currentReplyPlan?.escalationReason || "";
  return Boolean(input.currentReplyPlan?.shouldEscalate) &&
    !hasPaymentOrRateIssue(input) &&
    /(safety|security|minor|alcohol|medical|regulated|unsafe|permit)/i.test(reason);
}

function allowlistBlocked(input: ConversationAutonomyInput) {
  if (!input.smsSafetyConfig?.allowlistRequired) return false;
  if (!input.normalizedPhone) return true;
  const allowed = normalizeAllowedNumbers(input.smsSafetyConfig.allowedNumbers);
  return !allowed.includes(input.normalizedPhone);
}

function result(
  input: ConversationAutonomyInput,
  decision: ConversationAutonomyDecision,
  blockers: string[],
  explanationForAudit: string,
): ConversationAutonomyEvaluation {
  return {
    allowed: decision === "ALLOW_AUTONOMOUS_REPLY",
    mode: normalizeConversationAutonomyMode(input.mode),
    decision,
    blockers,
    warnings: [
      "Per-phone autonomy never overrides SMS_SENDS_DISABLED, allowlist, opt-out, compliance, candidate outreach, shortlist, or group-chat gates.",
    ],
    needsAttention: decision !== "ALLOW_AUTONOMOUS_REPLY",
    explanationForAudit,
  };
}

export function evaluateConversationAutonomy(
  input: ConversationAutonomyInput,
): ConversationAutonomyEvaluation {
  const mode = normalizeConversationAutonomyMode(input.mode);
  const withMode = { ...input, mode };

  if (input.optedOut) {
    return result(withMode, "BLOCKED_OPTOUT", ["Recipient is opted out."], "Opt-out overrides per-phone autonomy.");
  }

  if (input.doNotContact) {
    return result(withMode, "BLOCKED_OPTOUT", ["Recipient is marked do-not-contact."], "Do-not-contact blocks replies and future outreach.");
  }

  if (mode === "PAUSED") {
    return result(withMode, "BLOCKED_PAUSED", ["Autonomy is paused for this phone number."], "Paused numbers require admin review before replies.");
  }

  if (mode === "MANUAL_REVIEW") {
    return result(withMode, "BLOCKED_MANUAL_REVIEW", ["Autonomous SMS replies are off for this phone number."], "Manual review is the default for unknown or untoggled phone numbers.");
  }

  if (input.hasCandidateOutreachBoundary || input.hasPublicWebCandidateContact) {
    return result(withMode, "HANDOFF_REQUIRED_CANDIDATE_OUTREACH", ["Candidate outreach requires human approval."], "Saga reached the candidate outreach boundary.");
  }

  if (input.hasShortlistBoundary) {
    return result(withMode, "HANDOFF_REQUIRED_SHORTLIST", ["Candidate shortlist sending requires human approval."], "Saga reached the shortlist boundary.");
  }

  if (input.hasGroupChatBoundary) {
    return result(withMode, "HANDOFF_REQUIRED_GROUP_CHAT", ["Group chat creation requires human approval."], "Saga reached the group-chat boundary.");
  }

  if (input.hasTeamConfirmationBoundary || input.hasExternalAction) {
    return result(withMode, "HANDOFF_REQUIRED_UNKNOWN", ["External actions require human approval."], "Saga reached an external-action boundary.");
  }

  if (hasPaymentOrRateIssue(input)) {
    return result(withMode, "HANDOFF_REQUIRED_PAYMENT_OR_RATE", ["Payment, rate, contract, or legal issue requires admin review."], "Saga detected a payment/rate/legal handoff.");
  }

  if (hasSafetyIssue(input) || input.currentReplyPlan?.shouldEscalate) {
    return result(withMode, "HANDOFF_REQUIRED_SAFETY", ["Safety or sensitive issue requires admin review."], "Saga detected a safety handoff.");
  }

  if (input.smsSafetyConfig?.sendsDisabled) {
    return result(withMode, "BLOCKED_SENDS_DISABLED", ["SMS_SENDS_DISABLED is true."], "Global SMS send kill switch blocks actual sends.");
  }

  if (allowlistBlocked(input)) {
    return result(withMode, "BLOCKED_NOT_ALLOWLISTED", ["Phone number is not allowlisted."], "SMS allowlist blocks autonomous reply.");
  }

  if (!ordinaryAutonomousFlows.has(input.currentConversationFlow || "")) {
    return result(withMode, "HANDOFF_REQUIRED_UNKNOWN", ["Conversation flow is not approved for autonomy."], "Only ordinary intake, FAQ, gig-seeker, interest-check, and clarification flows are eligible.");
  }

  return {
    allowed: true,
    mode,
    decision: "ALLOW_AUTONOMOUS_REPLY",
    blockers: [],
    warnings: [
      "Autonomy only applies to ordinary conversation. Candidate outreach, shortlist, group chat, payment, legal, and safety boundaries still require admin review.",
    ],
    needsAttention: false,
    explanationForAudit: "Per-phone autonomy allows this ordinary conversation reply, subject to existing live-reply gates.",
  };
}

export async function loadConversationAutonomySettingForPhone(
  normalizedPhone?: string | null,
) {
  if (!normalizedPhone || !process.env.DATABASE_URL) return null;
  const phoneHash = hashPhoneForLookup(normalizedPhone);
  if (!phoneHash) return null;
  try {
    return await getDb().conversationAutonomySetting.findUnique({
      where: { phoneHash },
    });
  } catch {
    return null;
  }
}

export async function upsertConversationAutonomySetting(
  input: ConversationAutonomySettingInput,
) {
  if (!process.env.DATABASE_URL) return null;
  const mode = normalizeConversationAutonomyMode(input.mode);
  const existing = await getDb().conversationAutonomySetting.findUnique({
    where: { phoneHash: input.phoneHash },
  });
  const data = {
    redactedPhone: input.redactedPhone,
    personId: input.personId || null,
    contactId: input.contactId || null,
    pilotParticipantId: input.pilotParticipantId || null,
    mode,
    enabled: conversationAutonomyEnabled(mode),
    reason: input.reason || null,
    notes: input.notes || null,
    updatedBy: input.updatedBy || "admin",
  };
  const setting = await getDb().conversationAutonomySetting.upsert({
    where: { phoneHash: input.phoneHash },
    create: {
      phoneHash: input.phoneHash,
      ...data,
    },
    update: data,
  });

  await logAudit({
    actorType: "ADMIN",
    action: existing ? autonomyAuditEvents.settingUpdated : autonomyAuditEvents.settingCreated,
    entityType: "ConversationAutonomySetting",
    entityId: setting.id,
    metadata: {
      phoneHash: input.phoneHash,
      redactedPhone: input.redactedPhone,
      personId: input.personId || null,
      contactId: input.contactId || null,
      pilotParticipantId: input.pilotParticipantId || null,
      modeBefore: existing?.mode || null,
      modeAfter: mode,
      noSmsSent: true,
      noTwilioCall: true,
    },
  });

  return setting;
}

export function autonomyAuditActionForDecision(
  decision: ConversationAutonomyDecision,
) {
  if (decision === "ALLOW_AUTONOMOUS_REPLY") return autonomyAuditEvents.replyAllowed;
  if (decision === "BLOCKED_PAUSED") return autonomyAuditEvents.pausedInboundReceived;
  if (decision === "HANDOFF_REQUIRED_CANDIDATE_OUTREACH") {
    return autonomyAuditEvents.candidateOutreachBoundaryReached;
  }
  if (decision === "HANDOFF_REQUIRED_SHORTLIST") return autonomyAuditEvents.shortlistBoundaryReached;
  if (decision === "HANDOFF_REQUIRED_GROUP_CHAT") return autonomyAuditEvents.groupChatBoundaryReached;
  if (decision.startsWith("HANDOFF_REQUIRED")) return autonomyAuditEvents.handoffRequired;
  return autonomyAuditEvents.replyBlocked;
}

export async function recordConversationAutonomyHandoff(input: {
  phoneHash?: string | null;
  decision: ConversationAutonomyDecision;
}) {
  if (!process.env.DATABASE_URL || !input.phoneHash) return;
  if (
    input.decision === "ALLOW_AUTONOMOUS_REPLY" ||
    input.decision === "BLOCKED_SENDS_DISABLED" ||
    input.decision === "BLOCKED_NOT_ALLOWLISTED"
  ) {
    return;
  }
  try {
    await getDb().conversationAutonomySetting.updateMany({
      where: { phoneHash: input.phoneHash },
      data: { lastHandoffAt: new Date() },
    });
  } catch {
    // The autonomy audit event is the source of truth if the optional setting row is unavailable.
  }
}

export async function recordConversationAutonomyReplyAllowed(input: {
  phoneHash?: string | null;
}) {
  if (!process.env.DATABASE_URL || !input.phoneHash) return;
  try {
    await getDb().conversationAutonomySetting.updateMany({
      where: { phoneHash: input.phoneHash },
      data: { lastAutonomousReplyAt: new Date() },
    });
  } catch {
    // Optional timestamp only; never block the reply evaluator on this write.
  }
}

export async function getConversationAutonomyHealthSnapshot() {
  if (!process.env.DATABASE_URL) {
    return {
      perPhoneAutonomyAvailable: true,
      autonomousParticipantCount: 0,
      autonomousParticipantsCount: 0,
      manualReviewParticipantCount: 0,
      manualReviewParticipantsCount: 0,
      pausedParticipantCount: 0,
      pausedParticipantsCount: 0,
      autonomyHandoffCount: 0,
      candidateOutreachHandoffCount: 0,
    };
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      autonomousParticipantCount,
      manualReviewParticipantCount,
      pausedParticipantCount,
      autonomyHandoffCount,
      candidateOutreachHandoffCount,
    ] = await Promise.all([
      getDb().conversationAutonomySetting.count({
        where: { mode: "AUTONOMOUS_UNTIL_OUTREACH" },
      }),
      getDb().conversationAutonomySetting.count({
        where: { mode: "MANUAL_REVIEW" },
      }),
      getDb().conversationAutonomySetting.count({
        where: { mode: "PAUSED" },
      }),
      getDb().auditLog.count({
        where: {
          action: { in: [...autonomyNeedsAttentionAuditActions] },
          createdAt: { gte: since },
        },
      }),
      getDb().auditLog.count({
        where: {
          action: autonomyAuditEvents.candidateOutreachBoundaryReached,
          createdAt: { gte: since },
        },
      }),
    ]);

    return {
      perPhoneAutonomyAvailable: true,
      autonomousParticipantCount,
      autonomousParticipantsCount: autonomousParticipantCount,
      manualReviewParticipantCount,
      manualReviewParticipantsCount: manualReviewParticipantCount,
      pausedParticipantCount,
      pausedParticipantsCount: pausedParticipantCount,
      autonomyHandoffCount,
      candidateOutreachHandoffCount,
    };
  } catch {
    return {
      perPhoneAutonomyAvailable: true,
      autonomousParticipantCount: 0,
      autonomousParticipantsCount: 0,
      manualReviewParticipantCount: 0,
      manualReviewParticipantsCount: 0,
      pausedParticipantCount: 0,
      pausedParticipantsCount: 0,
      autonomyHandoffCount: 0,
      candidateOutreachHandoffCount: 0,
    };
  }
}
