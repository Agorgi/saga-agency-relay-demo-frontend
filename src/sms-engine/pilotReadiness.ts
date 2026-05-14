import { createHash } from "node:crypto";
import type {
  PilotFeedback,
  PilotParticipant,
  PilotParticipantRole,
  PilotParticipantStatus,
} from "@prisma/client";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { getConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { getTwilioConfigPresence } from "@/sms-engine/env";
import { normalizePhone } from "@/sms-engine/phone";
import { getPilotPublicLaunchStatus } from "@/sms-engine/pilotControls";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";

export const PILOT_FEEDBACK_CATEGORIES = [
  "intake_quality",
  "tone",
  "trust",
  "confusion",
  "usefulness",
  "matching",
  "safety",
  "bug",
  "other",
] as const;

export type PilotFeedbackCategory = (typeof PILOT_FEEDBACK_CATEGORIES)[number];

const PILOT_PARTICIPANT_ROLES: PilotParticipantRole[] = [
  "ORGANIZER",
  "CREATOR",
  "BOTH",
  "OBSERVER",
  "INTERNAL_TEST",
];

const PILOT_PARTICIPANT_STATUSES: PilotParticipantStatus[] = [
  "INVITED",
  "ACTIVE",
  "PAUSED",
  "WAITLISTED",
  "REJECTED",
  "OPTED_OUT",
  "COMPLETED",
];

export const PILOT_COHORTS = [
  "internal",
  "design_partner",
  "private_beta",
  "public_beta",
  "public_waitlist",
] as const;

export type PilotCohort = (typeof PILOT_COHORTS)[number];

export function normalizePilotFeedbackCategory(
  value?: string | null,
): PilotFeedbackCategory {
  if (
    value &&
    PILOT_FEEDBACK_CATEGORIES.includes(value as PilotFeedbackCategory)
  ) {
    return value as PilotFeedbackCategory;
  }

  return "other";
}

export function normalizePilotParticipantRole(
  value?: string | null,
): PilotParticipantRole {
  return PILOT_PARTICIPANT_ROLES.includes(value as PilotParticipantRole)
    ? (value as PilotParticipantRole)
    : "INTERNAL_TEST";
}

export function normalizePilotParticipantStatus(
  value?: string | null,
): PilotParticipantStatus {
  return PILOT_PARTICIPANT_STATUSES.includes(value as PilotParticipantStatus)
    ? (value as PilotParticipantStatus)
    : "INVITED";
}

export function normalizePilotCohort(value?: string | null): PilotCohort {
  return PILOT_COHORTS.includes(value as PilotCohort)
    ? (value as PilotCohort)
    : "internal";
}

export function preparePilotParticipantPhone(rawPhone?: string | null) {
  if (!rawPhone) return { phoneHash: null, redactedPhone: null };

  try {
    const normalized = normalizePhone(rawPhone);
    return {
      phoneHash: createHash("sha256").update(normalized).digest("hex"),
      redactedPhone: redactPhoneForDisplay(normalized),
    };
  } catch {
    return {
      phoneHash: createHash("sha256").update(rawPhone.trim()).digest("hex"),
      redactedPhone: "[redacted-phone]",
    };
  }
}

export function safePilotFeedbackSummary(feedback: PilotFeedback) {
  return {
    id: feedback.id,
    projectBriefId: feedback.projectBriefId,
    personId: feedback.personId,
    pilotParticipantId: feedback.pilotParticipantId,
    category: normalizePilotFeedbackCategory(feedback.category),
    rating: feedback.rating,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

export function safePilotParticipantSummary(participant: PilotParticipant) {
  return {
    id: participant.id,
    personId: participant.personId,
    projectBriefId: participant.projectBriefId,
    redactedPhone: participant.redactedPhone,
    name: participant.name,
    email: participant.email ? "[redacted-email]" : null,
    role: participant.role,
    cohort: participant.cohort,
    status: participant.status,
    consentSource: participant.consentSource,
    consentTimestamp: participant.consentTimestamp,
    joinedAt: participant.joinedAt,
    lastActiveAt: participant.lastActiveAt,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
}

export function getDesignPartnerPilotReadinessSnapshot() {
  const sms = getSmsSafetyHealth();
  const twilio = getTwilioConfigPresence();
  const publicLaunch = getPilotPublicLaunchStatus({
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
  });
  const conversationEngine = getConversationEngineRuntime({
    providerMode: sms.providerMode,
  });
  const twilioConfigured =
    twilio.accountSidConfigured &&
    twilio.authTokenConfigured &&
    twilio.messagingConfigured;

  return {
    providerMode: sms.providerMode,
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
    allowedNumbersCount: sms.allowedNumbersCount,
    twilioConfigured,
    webhookValidationEnabled: twilio.webhookValidationEnabled,
    conversationEngineMode: conversationEngine.mode,
    conversationEngineEffectiveActive: conversationEngine.effectiveActive,
    sendReadinessAvailable: true,
    outboundSelfTestReadinessAvailable: true,
    ...publicLaunch,
    manualGates: [
      {
        label: "A2P/compliance approved",
        status: "manual_review_required",
      },
      {
        label: "STOP/START/HELP tested with staging number",
        status: "manual_review_required",
      },
      {
        label: "Design partner runbook exists",
        status: "documented",
      },
      {
        label: "Design partner runbook reviewed",
        status: "manual_review_required",
      },
      {
        label: "No production Saga app integration",
        status: "required_boundary",
      },
      {
        label: "Public launch disabled",
        status: publicLaunch.publicLaunchEnabled
          ? "manual_review_required"
          : "required_boundary",
      },
    ],
  };
}

export function getPilotModeBanners() {
  const readiness = getDesignPartnerPilotReadinessSnapshot();
  const banners = [`PILOT STAGE: ${readiness.pilotStage.toUpperCase()}`];

  if (readiness.pilotReplyMode === "draft_only") {
    banners.push("DRAFT ONLY");
  } else if (readiness.pilotReplyMode === "manual_approval") {
    banners.push("MANUAL APPROVAL");
  } else {
    banners.push("AUTO ALLOWLISTED: FUTURE ONLY");
  }

  if (!readiness.publicLaunchEnabled) {
    banners.push("PUBLIC LAUNCH DISABLED");
  }

  return banners;
}

export const pilotParticipantRoleOptions = PILOT_PARTICIPANT_ROLES;
export const pilotParticipantStatusOptions = PILOT_PARTICIPANT_STATUSES;
