import type { Message } from "@prisma/client";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { logAudit } from "@/lib/audit";
import {
  autonomyAuditActionForDecision,
  autonomyAuditEvents,
  evaluateConversationAutonomy,
  loadConversationAutonomySettingForPhone,
  prepareConversationAutonomyPhone,
  recordConversationAutonomyHandoff,
  recordConversationAutonomyReplyAllowed,
  type ConversationAutonomyMode,
} from "@/lib/conversation/conversationAutonomy";
import { getDb } from "@/lib/db";
import { getTwilioConfigPresence } from "@/lib/env";
import { metadataObject } from "@/lib/messages";
import {
  getPilotPublicLaunchStatus,
  type PilotReplyMode,
  type PilotStage,
} from "@/lib/pilotControls";
import { normalizePhone } from "@/lib/phone";
import { checkProducerDraftSafety } from "@/lib/producer/outboundDrafts";
import { getSmsSafetyConfig } from "@/lib/smsSafety";

export const liveReplyAuditEvents = {
  evaluated: "live_reply.evaluated",
  blocked: "live_reply.blocked",
  sent: "live_reply.sent",
  idempotencyBlocked: "live_reply.idempotency_blocked",
  capBlocked: "live_reply.cap_blocked",
  needsAdmin: "live_reply.needs_admin",
} as const;

export const liveReplyStatuses = [
  "SENT",
  "BLOCKED_BY_SENDS_DISABLED",
  "BLOCKED_BY_COMPLIANCE",
  "BLOCKED_BY_ALLOWLIST",
  "BLOCKED_BY_OPTOUT",
  "BLOCKED_BY_PILOT_STAGE",
  "BLOCKED_BY_REPLY_MODE",
  "BLOCKED_BY_FLOW",
  "BLOCKED_BY_IDEMPOTENCY",
  "BLOCKED_BY_SAFETY",
  "NEEDS_ADMIN",
] as const;

export type LiveReplyAction =
  | "sent"
  | "blocked"
  | "drafted_only"
  | "needs_admin"
  | "not_applicable";

export type LiveReplyStatus = (typeof liveReplyStatuses)[number];

export type LiveReplyFlow =
  | "ORGANIZER_INTAKE"
  | "CAPABILITY_FAQ"
  | "ORGANIZER_PROJECT_CLARIFICATION"
  | "GIG_SEEKER_ONBOARDING"
  | "INTEREST_CHECK"
  | "CONTACT_REPLY"
  | "CANDIDATE_OUTREACH"
  | "ORGANIZER_SHORTLIST"
  | "GROUP_CHAT"
  | "ADMIN_REVIEW"
  | "UNKNOWN"
  | string;

export type LiveReplyConfigInput = {
  providerMode?: string;
  sendsDisabled?: boolean;
  allowlistRequired?: boolean;
  allowedNumbers?: string[];
  allowedNumbersCount?: number;
  twilioStagingMode?: boolean;
  webhookValidationEnabled?: boolean;
  smsComplianceApproved?: boolean;
  pilotStage?: PilotStage | string;
  pilotReplyMode?: PilotReplyMode | string;
  publicLaunchEnabled?: boolean;
  twilioConfigured?: boolean;
};

export type LiveReplyCapsInput = {
  dailySendCap?: number;
  perNumberDailySendCap?: number;
  autonomousReplyDailyCap?: number;
  dailySendCount?: number;
  perNumberDailySendCount?: number;
  autonomousReplyDailyCount?: number;
};

export type LiveReplyInput = {
  inboundMessage?: {
    id?: string | null;
    twilioMessageSid?: string | null;
    from?: string | null;
    userId?: string | null;
    projectBriefId?: string | null;
    contactId?: string | null;
  } | null;
  replyText?: string | null;
  flow: LiveReplyFlow;
  replyPlan?: {
    shouldEscalate?: boolean;
    escalationReason?: string | null;
    confidence?: number | null;
  } | null;
  recipientPhone?: string | null;
  recipientOptedOut?: boolean;
  conversationAutonomy?: {
    mode?: ConversationAutonomyMode | string | null;
    phoneHash?: string | null;
    redactedPhone?: string | null;
    personId?: string | null;
    contactId?: string | null;
    pilotParticipantId?: string | null;
    optedOut?: boolean;
    doNotContact?: boolean;
  } | null;
  hasActiveOutreachContext?: boolean;
  hasGroupChatAction?: boolean;
  idempotency?: {
    alreadyRepliedToInboundSid?: boolean;
    latestMessageAlreadyHandled?: boolean;
  };
  config?: LiveReplyConfigInput;
  caps?: LiveReplyCapsInput;
  dryRun?: boolean;
  sendMessage?: (input: {
    to: string;
    body: string;
    metadata: Record<string, unknown>;
  }) => Promise<{ messageId?: string | null; twilioMessageSid?: string | null }>;
  audit?: (event: {
    action: string;
    metadata: Record<string, unknown>;
  }) => Promise<void> | void;
};

export type LiveReplyResult = {
  action: LiveReplyAction;
  status: LiveReplyStatus;
  messageId?: string;
  twilioMessageSid?: string;
  blockers: string[];
  warnings: string[];
  dryRun: boolean;
  auditMetadata: Record<string, unknown>;
};

export type LiveReplyReadinessSnapshot = {
  liveReplyExecutionAvailable: true;
  autonomousRepliesEnabled: boolean;
  autonomousReplyBlockerCount: number;
  blockers: string[];
  warnings: string[];
  sendCaps: {
    dailySendCap: number;
    perNumberDailySendCap: number;
    autonomousReplyDailyCap: number;
    dailySendCount: number;
    autonomousReplyDailyCount: number;
  };
  idempotency: {
    usesInboundTwilioMessageSid: true;
    oneReplyPerInboundSid: true;
  };
  safetySnapshot: {
    providerMode: string;
    sendsDisabled: boolean;
    allowlistRequired: boolean;
    allowedNumbersCount: number;
    twilioStagingMode: boolean;
    webhookValidationEnabled: boolean;
    smsComplianceApproved: boolean;
    pilotStage: string;
    pilotReplyMode: string;
    publicLaunchEnabled: boolean;
  };
};

type Blocker = {
  status: LiveReplyStatus;
  message: string;
  requiredAction: string;
  event: (typeof liveReplyAuditEvents)[keyof typeof liveReplyAuditEvents];
};

const allowedAutonomousFlows = new Set([
  "CAPABILITY_FAQ",
  "ORGANIZER_INTAKE",
  "ORGANIZER_PROJECT_CLARIFICATION",
  "GIG_SEEKER_ONBOARDING",
  "INTEREST_CHECK",
]);

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLiveReplyCaps(input?: LiveReplyCapsInput) {
  return {
    dailySendCap:
      input?.dailySendCap ?? numberEnv(process.env.SMS_DAILY_SEND_CAP, 25),
    perNumberDailySendCap:
      input?.perNumberDailySendCap ??
      numberEnv(process.env.SMS_PER_NUMBER_DAILY_SEND_CAP, 5),
    autonomousReplyDailyCap:
      input?.autonomousReplyDailyCap ??
      numberEnv(process.env.SMS_AUTONOMOUS_REPLY_DAILY_CAP, 10),
    dailySendCount: input?.dailySendCount ?? 0,
    perNumberDailySendCount: input?.perNumberDailySendCount ?? 0,
    autonomousReplyDailyCount: input?.autonomousReplyDailyCount ?? 0,
  };
}

function runtimeConfig(): Required<LiveReplyConfigInput> {
  const sms = getSmsSafetyConfig();
  const twilio = getTwilioConfigPresence();
  const pilot = getPilotPublicLaunchStatus({
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
  });

  return {
    providerMode: sms.providerMode,
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
    allowedNumbers: sms.allowedNumbers,
    allowedNumbersCount: sms.allowedNumbersCount,
    twilioStagingMode: booleanEnv(process.env.TWILIO_STAGING_MODE, false),
    webhookValidationEnabled: twilio.webhookValidationEnabled,
    smsComplianceApproved: pilot.complianceApproved,
    pilotStage: pilot.pilotStage,
    pilotReplyMode: pilot.pilotReplyMode,
    publicLaunchEnabled: pilot.publicLaunchEnabled,
    twilioConfigured:
      twilio.accountSidConfigured &&
      twilio.authTokenConfigured &&
      twilio.messagingConfigured,
  };
}

function mergedConfig(
  input?: LiveReplyConfigInput,
): Required<LiveReplyConfigInput> {
  const runtime = runtimeConfig();
  return {
    ...runtime,
    ...input,
    allowedNumbers: input?.allowedNumbers || runtime.allowedNumbers,
    allowedNumbersCount:
      input?.allowedNumbersCount ??
      input?.allowedNumbers?.length ??
      runtime.allowedNumbersCount,
  };
}

function normalizePhoneOrNull(phone?: string | null) {
  if (!phone) return null;
  try {
    return normalizePhone(phone);
  } catch {
    return null;
  }
}

function isAllowlisted({
  phone,
  config,
}: {
  phone: string | null;
  config: Required<LiveReplyConfigInput>;
}) {
  if (!config.allowlistRequired) return true;
  if (!phone) return false;
  const allowed = config.allowedNumbers
    .map(normalizePhoneOrNull)
    .filter((item): item is string => Boolean(item));
  return allowed.includes(phone);
}

function blocker(
  status: LiveReplyStatus,
  message: string,
  requiredAction: string,
  event: (typeof liveReplyAuditEvents)[keyof typeof liveReplyAuditEvents] =
    liveReplyAuditEvents.blocked,
): Blocker {
  return { status, message, requiredAction, event };
}

function statusPriority(status: LiveReplyStatus) {
  const priority: Record<LiveReplyStatus, number> = {
    SENT: 0,
    BLOCKED_BY_SENDS_DISABLED: 1,
    BLOCKED_BY_COMPLIANCE: 2,
    BLOCKED_BY_ALLOWLIST: 3,
    BLOCKED_BY_OPTOUT: 4,
    BLOCKED_BY_PILOT_STAGE: 5,
    BLOCKED_BY_REPLY_MODE: 6,
    BLOCKED_BY_FLOW: 7,
    BLOCKED_BY_IDEMPOTENCY: 8,
    BLOCKED_BY_SAFETY: 9,
    NEEDS_ADMIN: 10,
  };

  return priority[status];
}

function pickStatus(blockers: Blocker[]): LiveReplyStatus {
  if (blockers.length === 0) return "SENT";
  return blockers
    .slice()
    .sort((left, right) => statusPriority(left.status) - statusPriority(right.status))[0]
    .status;
}

function auditActionForStatus(status: LiveReplyStatus, blockers: Blocker[]) {
  if (status === "SENT") return liveReplyAuditEvents.sent;
  if (status === "NEEDS_ADMIN") return liveReplyAuditEvents.needsAdmin;
  if (status === "BLOCKED_BY_IDEMPOTENCY") {
    return liveReplyAuditEvents.idempotencyBlocked;
  }
  if (
    blockers.some((item) =>
      item.message.toLowerCase().includes("cap"),
    )
  ) {
    return liveReplyAuditEvents.capBlocked;
  }
  return liveReplyAuditEvents.blocked;
}

function statusForAutonomyDecision(
  decision: ReturnType<typeof evaluateConversationAutonomy>["decision"],
): LiveReplyStatus | null {
  if (decision === "ALLOW_AUTONOMOUS_REPLY") return null;
  if (decision === "BLOCKED_SENDS_DISABLED") return "BLOCKED_BY_SENDS_DISABLED";
  if (decision === "BLOCKED_NOT_ALLOWLISTED") return "BLOCKED_BY_ALLOWLIST";
  if (decision === "BLOCKED_OPTOUT") return "BLOCKED_BY_OPTOUT";
  return "NEEDS_ADMIN";
}

function requiredActionForAutonomyDecision(
  decision: ReturnType<typeof evaluateConversationAutonomy>["decision"],
) {
  if (decision === "BLOCKED_SENDS_DISABLED") {
    return "Keep the reply as a draft until the approved SMS test window.";
  }
  if (decision === "BLOCKED_NOT_ALLOWLISTED") {
    return "Add the number to the explicit allowlist only after operator approval.";
  }
  if (decision === "BLOCKED_OPTOUT") {
    return "Do not reply unless the user explicitly opts back in.";
  }
  if (decision === "HANDOFF_REQUIRED_CANDIDATE_OUTREACH") {
    return "Review possible collaborators before any candidate is contacted.";
  }
  if (decision === "HANDOFF_REQUIRED_SHORTLIST") {
    return "Review the shortlist before anything becomes organizer-facing.";
  }
  if (decision === "HANDOFF_REQUIRED_GROUP_CHAT") {
    return "Review consent and safety before any group chat is created.";
  }
  if (
    decision === "HANDOFF_REQUIRED_PAYMENT_OR_RATE" ||
    decision === "HANDOFF_REQUIRED_SAFETY"
  ) {
    return "Route this conversation to an operator before replying.";
  }
  return "Review the reply manually before it can move forward.";
}

function publicStageBlocked(config: Required<LiveReplyConfigInput>) {
  if (["public_candidate", "public_live", "private_beta"].includes(config.pilotStage)) {
    return true;
  }
  if (config.pilotStage === "public_live" && !config.publicLaunchEnabled) {
    return true;
  }
  return false;
}

function forbiddenClaims(replyText: string) {
  return checkProducerDraftSafety({
    type: "ADMIN_MANUAL",
    body: replyText,
  });
}

export async function evaluateAndExecuteLiveReply(
  input: LiveReplyInput,
): Promise<LiveReplyResult> {
  const config = mergedConfig(input.config);
  const caps = getLiveReplyCaps(input.caps);
  const normalizedRecipient = normalizePhoneOrNull(input.recipientPhone);
  const replyText = input.replyText?.trim() || "";
  const dryRun = input.dryRun !== false;
  const safety = forbiddenClaims(replyText);
  const blockers: Blocker[] = [];
  const warnings = [
    dryRun
      ? "Dry run only: no SMS will be sent and no provider API will be called."
      : "Execution requested: provider send is allowed only after every live-reply gate passes.",
  ];
  const phoneIdentity = normalizedRecipient
    ? prepareConversationAutonomyPhone(normalizedRecipient)
    : {
        normalizedPhone: null,
        phoneHash: input.conversationAutonomy?.phoneHash || null,
        redactedPhone: input.conversationAutonomy?.redactedPhone || null,
      };
  const storedAutonomySetting = input.conversationAutonomy
    ? null
    : await loadConversationAutonomySettingForPhone(normalizedRecipient);
  const autonomyContext = input.conversationAutonomy || storedAutonomySetting;
  const autonomyOverride = input.conversationAutonomy || null;
  const autonomyEvaluation = evaluateConversationAutonomy({
    normalizedPhone: normalizedRecipient,
    phoneHash: autonomyContext?.phoneHash || phoneIdentity.phoneHash,
    redactedPhone:
      autonomyContext?.redactedPhone || phoneIdentity.redactedPhone,
    mode: autonomyContext?.mode || "MANUAL_REVIEW",
    personId: autonomyContext?.personId || null,
    contactId: autonomyContext?.contactId || input.inboundMessage?.contactId || null,
    pilotParticipantId: autonomyContext?.pilotParticipantId || null,
    optedOut: input.recipientOptedOut || autonomyOverride?.optedOut || false,
    doNotContact: autonomyOverride?.doNotContact || false,
    smsSafetyConfig: {
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
      allowedNumbers: config.allowedNumbers,
    },
    pilotStage: String(config.pilotStage),
    pilotReplyMode: String(config.pilotReplyMode),
    currentConversationFlow: input.flow,
    currentReplyPlan: input.replyPlan,
    hasCandidateOutreachBoundary:
      input.hasActiveOutreachContext || input.flow === "CANDIDATE_OUTREACH",
    hasShortlistBoundary: input.flow === "ORGANIZER_SHORTLIST",
    hasGroupChatBoundary: input.hasGroupChatAction || input.flow === "GROUP_CHAT",
    hasTeamConfirmationBoundary: false,
    hasPublicWebCandidateContact: false,
    hasExternalAction: false,
  });

  if (config.providerMode !== "TWILIO") {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "MESSAGING_PROVIDER must be TWILIO for controlled live reply execution.",
        "Use the dedicated Twilio staging environment for live reply execution.",
      ),
    );
  }

  if (!config.twilioConfigured) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "Twilio credentials or sender configuration are missing.",
        "Configure Twilio only in the dedicated Twilio staging environment after approval.",
      ),
    );
  }

  if (!config.twilioStagingMode && !config.publicLaunchEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "TWILIO_STAGING_MODE must be true for pilot live replies.",
        "Set TWILIO_STAGING_MODE=true for internal/design-partner pilot stages.",
      ),
    );
  }

  if (!config.webhookValidationEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "TWILIO_VALIDATE_WEBHOOKS must be true.",
        "Enable Twilio webhook signature validation before live replies.",
      ),
    );
  }

  if (!config.smsComplianceApproved) {
    blockers.push(
      blocker(
        "BLOCKED_BY_COMPLIANCE",
        "SMS_COMPLIANCE_APPROVED is false or missing.",
        "Wait for A2P/provider compliance approval before live replies.",
      ),
    );
  }

  if (config.sendsDisabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SENDS_DISABLED",
        "SMS_SENDS_DISABLED is true.",
        "Keep sends disabled until the approved controlled test window.",
      ),
    );
  }

  if (!config.allowlistRequired && config.pilotStage !== "public_live") {
    blockers.push(
      blocker(
        "BLOCKED_BY_ALLOWLIST",
        "SMS_REQUIRE_ALLOWLIST must be true for pilot live replies.",
        "Require the allowlist for internal/design-partner pilot stages.",
      ),
    );
  }

  if (!isAllowlisted({ phone: normalizedRecipient, config })) {
    blockers.push(
      blocker(
        "BLOCKED_BY_ALLOWLIST",
        "Recipient is not in SMS_ALLOWED_NUMBERS.",
        "Only send autonomous pilot replies to explicitly allowlisted numbers.",
      ),
    );
  }

  if (input.recipientOptedOut) {
    blockers.push(
      blocker(
        "BLOCKED_BY_OPTOUT",
        "Recipient is opted out.",
        "Do not send unless the recipient explicitly opts back in.",
      ),
    );
  }

  if (!["internal_test", "design_partner"].includes(String(config.pilotStage))) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "Controlled live replies are only enabled for internal_test or design_partner stages.",
        "Keep private_beta and public stages disabled until later review.",
      ),
    );
  }

  if (publicStageBlocked(config)) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "Public/private beta stages are not enabled for live replies in v0.1.",
        "Do not use public/private beta stages for controlled live reply execution.",
      ),
    );
  }

  if (config.publicLaunchEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PUBLIC_LAUNCH_ENABLED must remain false for pilot live replies.",
        "Disable public launch for internal and design-partner pilots.",
      ),
    );
  }

  if (config.pilotReplyMode !== "auto_allowlisted") {
    blockers.push(
      blocker(
        "BLOCKED_BY_REPLY_MODE",
        "PILOT_REPLY_MODE must be auto_allowlisted for autonomous live replies.",
        "Use auto_allowlisted only after compliance and operator approval.",
      ),
    );
  }

  if (!allowedAutonomousFlows.has(input.flow)) {
    blockers.push(
      blocker(
        "BLOCKED_BY_FLOW",
        "This flow is not allowed for autonomous live replies.",
        "Keep contact replies, outreach, shortlists, group chats, and admin-review flows manual.",
      ),
    );
  }

  if (input.hasActiveOutreachContext) {
    blockers.push(
      blocker(
        "BLOCKED_BY_FLOW",
        "Active outreach/contact context is present.",
        "Do not use autonomous live replies for contact reply or candidate outreach contexts.",
      ),
    );
  }

  if (input.hasGroupChatAction) {
    blockers.push(
      blocker(
        "BLOCKED_BY_FLOW",
        "Group chat action is present.",
        "Group chat creation and introductions require explicit consent and admin action.",
      ),
    );
  }

  if (input.replyPlan?.shouldEscalate) {
    blockers.push(
      blocker(
        "NEEDS_ADMIN",
        input.replyPlan.escalationReason || "ReplyPlan requires admin review.",
        "Route this conversation to admin review before replying.",
        liveReplyAuditEvents.needsAdmin,
      ),
    );
  }

  const autonomyStatus = statusForAutonomyDecision(
    autonomyEvaluation.decision,
  );
  if (autonomyStatus) {
    blockers.push(
      blocker(
        autonomyStatus,
        autonomyEvaluation.blockers.join(" ") ||
          "Per-phone conversation autonomy requires admin review.",
        requiredActionForAutonomyDecision(autonomyEvaluation.decision),
        autonomyStatus === "NEEDS_ADMIN"
          ? liveReplyAuditEvents.needsAdmin
          : liveReplyAuditEvents.blocked,
      ),
    );
  }

  if (!replyText) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SAFETY",
        "Generated reply is empty.",
        "Generate a reviewed reply before live execution.",
      ),
    );
  }

  if (!safety.passed) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SAFETY",
        safety.errors.join(" "),
        "Edit or regenerate the reply until safety checks pass.",
      ),
    );
  }

  if (input.idempotency?.alreadyRepliedToInboundSid) {
    blockers.push(
      blocker(
        "BLOCKED_BY_IDEMPOTENCY",
        "This inbound Twilio MessageSid already has a recorded live reply attempt.",
        "Do not create a duplicate autonomous reply for a Twilio retry.",
        liveReplyAuditEvents.idempotencyBlocked,
      ),
    );
  }

  if (input.idempotency?.latestMessageAlreadyHandled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_IDEMPOTENCY",
        "The latest inbound message already has a reply, block, or draft state.",
        "Do not create another autonomous reply for the same inbound message.",
        liveReplyAuditEvents.idempotencyBlocked,
      ),
    );
  }

  if (caps.dailySendCount >= caps.dailySendCap) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SAFETY",
        "Daily outbound send cap exceeded.",
        "Pause autonomous live replies until the daily cap resets.",
        liveReplyAuditEvents.capBlocked,
      ),
    );
  }

  if (caps.perNumberDailySendCount >= caps.perNumberDailySendCap) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SAFETY",
        "Per-number daily send cap exceeded.",
        "Do not send more autonomous replies to this number today.",
        liveReplyAuditEvents.capBlocked,
      ),
    );
  }

  if (caps.autonomousReplyDailyCount >= caps.autonomousReplyDailyCap) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SAFETY",
        "Autonomous reply daily cap exceeded.",
        "Pause autonomous live replies until reviewed.",
        liveReplyAuditEvents.capBlocked,
      ),
    );
  }

  const status = pickStatus(blockers);
  const uniqueBlockers = [...new Set(blockers.map((item) => item.message))];
  const baseAuditMetadata = {
    inboundMessageId: input.inboundMessage?.id || null,
    inboundTwilioMessageSid: input.inboundMessage?.twilioMessageSid || null,
    flow: input.flow,
    status,
    blockers: uniqueBlockers,
    dryRun,
    providerMode: config.providerMode,
    pilotStage: String(config.pilotStage),
    replyMode: String(config.pilotReplyMode),
    senderRedacted: input.inboundMessage?.from
      ? redactPhoneForDisplay(input.inboundMessage.from)
      : null,
    recipientRedacted: normalizedRecipient
      ? redactPhoneForDisplay(normalizedRecipient)
      : null,
    sendsDisabled: config.sendsDisabled,
    allowlistRequired: config.allowlistRequired,
    allowedNumbersCount: config.allowedNumbersCount,
    dailySendCap: caps.dailySendCap,
    perNumberDailySendCap: caps.perNumberDailySendCap,
    autonomousReplyDailyCap: caps.autonomousReplyDailyCap,
    dailySendCount: caps.dailySendCount,
    perNumberDailySendCount: caps.perNumberDailySendCount,
    autonomousReplyDailyCount: caps.autonomousReplyDailyCount,
    perPhoneAutonomyAvailable: true,
    autonomyMode: autonomyEvaluation.mode,
    autonomyDecision: autonomyEvaluation.decision,
    autonomyAllowed: autonomyEvaluation.allowed,
    autonomyNeedsAttention: autonomyEvaluation.needsAttention,
    autonomyBlockers: autonomyEvaluation.blockers,
    autonomyExplanation: autonomyEvaluation.explanationForAudit,
    phoneHash: autonomyContext?.phoneHash || phoneIdentity.phoneHash || null,
    redactedPhone:
      autonomyContext?.redactedPhone || phoneIdentity.redactedPhone || null,
    noGroupChatCreated: true,
    noCandidateOutreach: true,
    noShortlistSent: true,
  };
  const autonomyAuditMetadata = {
    ...baseAuditMetadata,
    auditAction: autonomyAuditEvents.replyEvaluated,
  };
  await input.audit?.({
    action: autonomyAuditEvents.replyEvaluated,
    metadata: autonomyAuditMetadata,
  });
  const autonomyDecisionAction = autonomyAuditActionForDecision(
    autonomyEvaluation.decision,
  );
  await input.audit?.({
    action: autonomyDecisionAction,
    metadata: {
      ...baseAuditMetadata,
      auditAction: autonomyDecisionAction,
    },
  });
  if (!autonomyEvaluation.allowed) {
    await recordConversationAutonomyHandoff({
      phoneHash:
        (autonomyContext?.phoneHash || phoneIdentity.phoneHash) ?? null,
      decision: autonomyEvaluation.decision,
    });
  }

  if (status !== "SENT") {
    const action = status === "NEEDS_ADMIN" ? "needs_admin" : "blocked";
    const auditAction = auditActionForStatus(status, blockers);
    await input.audit?.({ action: liveReplyAuditEvents.evaluated, metadata: baseAuditMetadata });
    await input.audit?.({ action: auditAction, metadata: baseAuditMetadata });
    return {
      action,
      status,
      blockers: uniqueBlockers,
      warnings,
      dryRun,
      auditMetadata: {
        ...baseAuditMetadata,
        auditAction,
      },
    };
  }

  await input.audit?.({ action: liveReplyAuditEvents.evaluated, metadata: baseAuditMetadata });

  if (dryRun) {
    return {
      action: "drafted_only",
      status: "SENT",
      blockers: [],
      warnings,
      dryRun,
      auditMetadata: {
        ...baseAuditMetadata,
        auditAction: liveReplyAuditEvents.evaluated,
      },
    };
  }

  if (!input.sendMessage || !normalizedRecipient) {
    const metadata = {
      ...baseAuditMetadata,
      status: "BLOCKED_BY_SAFETY",
      blockers: ["No sendMessage callback or resolved recipient was provided."],
    };
    await input.audit?.({ action: liveReplyAuditEvents.blocked, metadata });
    return {
      action: "blocked",
      status: "BLOCKED_BY_SAFETY",
      blockers: ["No sendMessage callback or resolved recipient was provided."],
      warnings,
      dryRun,
      auditMetadata: metadata,
    };
  }

  const sent = await input.sendMessage({
    to: normalizedRecipient,
    body: replyText,
    metadata: {
      generatedBy: "live_reply_executor",
      flow: input.flow,
      inboundMessageId: input.inboundMessage?.id || null,
      inboundTwilioMessageSid: input.inboundMessage?.twilioMessageSid || null,
      dryRun: false,
    },
  });
  const sentMetadata = {
    ...baseAuditMetadata,
    outboundMessageId: sent.messageId || null,
    outboundTwilioMessageSid: sent.twilioMessageSid || null,
  };
  await input.audit?.({ action: liveReplyAuditEvents.sent, metadata: sentMetadata });
  await recordConversationAutonomyReplyAllowed({
    phoneHash:
      (autonomyContext?.phoneHash || phoneIdentity.phoneHash) ?? null,
  });

  return {
    action: "sent",
    status: "SENT",
    messageId: sent.messageId || undefined,
    twilioMessageSid: sent.twilioMessageSid || undefined,
    blockers: [],
    warnings,
    dryRun: false,
    auditMetadata: sentMetadata,
  };
}

export async function hasRecordedLiveReplyForInboundSid(
  twilioMessageSid?: string | null,
) {
  if (!twilioMessageSid || !process.env.DATABASE_URL) return false;
  const recentOutbound = await getDb().message.findMany({
    where: {
      direction: "OUTBOUND",
      channel: "SMS",
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return recentOutbound.some((message) => {
    const metadata = metadataObject(message.metadata);
    return (
      metadata.inboundTwilioMessageSid === twilioMessageSid &&
      (metadata.generatedBy === "live_reply_executor" ||
        metadata.liveReplyAttempted === true ||
        metadata.liveReplyBlocked === true)
    );
  });
}

async function liveReplyCountsSince(dayStart: Date) {
  if (!process.env.DATABASE_URL) {
    return {
      dailySendCount: 0,
      autonomousReplyDailyCount: 0,
    };
  }

  try {
    const messages = await getDb().message.findMany({
      where: {
        direction: "OUTBOUND",
        channel: "SMS",
        createdAt: { gte: dayStart },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      dailySendCount: messages.length,
      autonomousReplyDailyCount: messages.filter((message: Message) => {
        const metadata = metadataObject(message.metadata);
        return metadata.generatedBy === "live_reply_executor";
      }).length,
    };
  } catch {
    return {
      dailySendCount: 0,
      autonomousReplyDailyCount: 0,
    };
  }
}

export async function getLiveReplyExecutionReadinessSnapshot(): Promise<LiveReplyReadinessSnapshot> {
  const config = mergedConfig();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const counts = await liveReplyCountsSince(dayStart);
  const caps = getLiveReplyCaps(counts);
  const sample = await evaluateAndExecuteLiveReply({
    flow: "ORGANIZER_INTAKE",
    replyText: "Saga here. What city should this happen in?",
    recipientPhone: config.allowedNumbers[0] || null,
    config,
    caps,
    dryRun: true,
  });

  return {
    liveReplyExecutionAvailable: true,
    autonomousRepliesEnabled:
      sample.status === "SENT" &&
      config.pilotReplyMode === "auto_allowlisted" &&
      !config.sendsDisabled,
    autonomousReplyBlockerCount: sample.blockers.length,
    blockers: sample.blockers,
    warnings: sample.warnings,
    sendCaps: {
      dailySendCap: caps.dailySendCap,
      perNumberDailySendCap: caps.perNumberDailySendCap,
      autonomousReplyDailyCap: caps.autonomousReplyDailyCap,
      dailySendCount: caps.dailySendCount,
      autonomousReplyDailyCount: caps.autonomousReplyDailyCount,
    },
    idempotency: {
      usesInboundTwilioMessageSid: true,
      oneReplyPerInboundSid: true,
    },
    safetySnapshot: {
      providerMode: config.providerMode,
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
      allowedNumbersCount: config.allowedNumbersCount,
      twilioStagingMode: config.twilioStagingMode,
      webhookValidationEnabled: config.webhookValidationEnabled,
      smsComplianceApproved: config.smsComplianceApproved,
      pilotStage: String(config.pilotStage),
      pilotReplyMode: String(config.pilotReplyMode),
      publicLaunchEnabled: config.publicLaunchEnabled,
    },
  };
}

export function safeLiveReplyHealthSummary(snapshot: LiveReplyReadinessSnapshot) {
  return {
    liveReplyExecutionAvailable: snapshot.liveReplyExecutionAvailable,
    autonomousRepliesEnabled: snapshot.autonomousRepliesEnabled,
    autonomousReplyBlockerCount: snapshot.autonomousReplyBlockerCount,
    sendCaps: snapshot.sendCaps,
  };
}

export async function evaluateLiveReplyReadinessForAdmin() {
  const snapshot = await getLiveReplyExecutionReadinessSnapshot();
  await logAudit({
    actorType: "ADMIN",
    action: liveReplyAuditEvents.evaluated,
    entityType: "PilotReadiness",
    entityId: "controlled-live-reply",
    metadata: {
      autonomousRepliesEnabled: snapshot.autonomousRepliesEnabled,
      autonomousReplyBlockerCount: snapshot.autonomousReplyBlockerCount,
      blockers: snapshot.blockers,
      providerMode: snapshot.safetySnapshot.providerMode,
      pilotStage: snapshot.safetySnapshot.pilotStage,
      replyMode: snapshot.safetySnapshot.pilotReplyMode,
      sendsDisabled: snapshot.safetySnapshot.sendsDisabled,
      allowlistRequired: snapshot.safetySnapshot.allowlistRequired,
      allowedNumbersCount: snapshot.safetySnapshot.allowedNumbersCount,
      dailySendCap: snapshot.sendCaps.dailySendCap,
      perNumberDailySendCap: snapshot.sendCaps.perNumberDailySendCap,
      autonomousReplyDailyCap: snapshot.sendCaps.autonomousReplyDailyCap,
      noSmsSent: true,
      noTwilioApiCall: true,
      noGroupChatCreated: true,
    },
  });
  return snapshot;
}
