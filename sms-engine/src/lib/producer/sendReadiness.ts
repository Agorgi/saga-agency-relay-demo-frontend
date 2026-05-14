import { createHash } from "node:crypto";
import type {
  OutboundDraftRecipientKind,
  OutboundDraftStatus,
  OutboundDraftType,
  PilotParticipantStatus,
  Prisma,
} from "@prisma/client";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getTwilioConfigPresence } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import {
  getPilotPublicLaunchStatus,
  type PilotReplyMode,
  type PilotStage,
} from "@/lib/pilotControls";
import { allowedSmsNumbers, getSmsSafetyConfig } from "@/lib/smsSafety";
import { checkProducerDraftSafety } from "@/lib/producer/outboundDrafts";

export const producerDraftSendReadinessAuditEvent =
  "producer.draft_send_readiness_evaluated";

export const sendReadinessStatuses = [
  "READY_IN_DRY_RUN",
  "BLOCKED_BY_SENDS_DISABLED",
  "BLOCKED_BY_COMPLIANCE",
  "BLOCKED_BY_ALLOWLIST",
  "BLOCKED_BY_OPTOUT",
  "BLOCKED_BY_DRAFT_STATUS",
  "BLOCKED_BY_MISSING_RECIPIENT",
  "BLOCKED_BY_FORBIDDEN_CLAIMS",
  "BLOCKED_BY_PILOT_STAGE",
  "BLOCKED_BY_UNKNOWN",
] as const;

export type SendReadinessStatus = (typeof sendReadinessStatuses)[number];

export type DraftSendReadinessInput = {
  draftId: string;
  type: OutboundDraftType | string;
  status: OutboundDraftStatus | string;
  body: string;
  editedBody?: string | null;
  recipientKind: OutboundDraftRecipientKind | string;
  projectBriefId?: string | null;
  projectId?: string | null;
  shortlistPacketId?: string | null;
  shortlistPacketStatus?: string | null;
  candidateRecommendationId?: string | null;
  candidateRecommendationStatus?: string | null;
  candidateDoNotContact?: boolean;
  recipientPhone?: string | null;
  recipientOptedOut?: boolean;
  pilotParticipantStatus?: PilotParticipantStatus | string | null;
  consentToGroupChat?: boolean | null;
};

export type SendReadinessConfigInput = {
  providerMode?: string;
  sendsDisabled?: boolean;
  allowlistRequired?: boolean;
  allowedNumbers?: string[];
  allowedNumbersCount?: number;
  twilioStagingMode?: boolean;
  webhookValidationEnabled?: boolean;
  twilioConfigured?: boolean;
  complianceApproved?: boolean;
  publicLaunchEnabled?: boolean;
  pilotStage?: PilotStage | string;
  pilotReplyMode?: PilotReplyMode | string;
  autoRepliesEnabled?: boolean;
  supportContactConfigured?: boolean;
  privacyUrlConfigured?: boolean;
  termsUrlConfigured?: boolean;
  dailySendCapConfigured?: boolean;
  dailyInboundCapConfigured?: boolean;
  maxActiveParticipantsConfigured?: boolean;
};

export type DraftSendReadinessResult = {
  draftId: string;
  eligible: boolean;
  dryRunOnly: true;
  readinessStatus: SendReadinessStatus;
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
  safetySnapshot: {
    providerMode: string;
    sendsDisabled: boolean;
    allowlistRequired: boolean;
    allowedNumbersCount: number;
    twilioStagingMode: boolean;
    webhookValidationEnabled: boolean;
    pilotStage: string;
    pilotReplyMode: string;
    complianceApproved: boolean;
    publicLaunchEnabled: boolean;
  };
  recipientSummary: {
    kind: string;
    redactedPhone: string | null;
    isAllowlisted: boolean;
    optedOut: boolean;
    pilotParticipantStatus: string | null;
  };
  explanationForAudit: string;
};

type Blocker = {
  status: SendReadinessStatus;
  message: string;
  requiredAction: string;
};

function normalizePhoneOrNull(rawPhone?: string | null) {
  if (!rawPhone) return null;
  try {
    return normalizePhone(rawPhone);
  } catch {
    return null;
  }
}

function phoneHash(rawPhone: string) {
  return createHash("sha256").update(rawPhone).digest("hex");
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function getRuntimeReadinessConfig(): Required<SendReadinessConfigInput> {
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
    allowedNumbers: allowedSmsNumbers(),
    allowedNumbersCount: sms.allowedNumbersCount,
    twilioStagingMode: sms.twilioStagingMode,
    webhookValidationEnabled: twilio.webhookValidationEnabled,
    twilioConfigured:
      twilio.accountSidConfigured &&
      twilio.authTokenConfigured &&
      twilio.messagingConfigured,
    complianceApproved: pilot.complianceApproved,
    publicLaunchEnabled: pilot.publicLaunchEnabled,
    pilotStage: pilot.pilotStage,
    pilotReplyMode: pilot.pilotReplyMode,
    autoRepliesEnabled: pilot.autoRepliesEnabled,
    supportContactConfigured: pilot.supportContactConfigured,
    privacyUrlConfigured: pilot.privacyUrlConfigured,
    termsUrlConfigured: pilot.termsUrlConfigured,
    dailySendCapConfigured: pilot.dailySendCapConfigured,
    dailyInboundCapConfigured: pilot.dailyInboundCapConfigured,
    maxActiveParticipantsConfigured: pilot.maxActiveParticipantsConfigured,
  };
}

function mergedConfig(
  input?: SendReadinessConfigInput,
): Required<SendReadinessConfigInput> {
  const runtime = getRuntimeReadinessConfig();
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

function readinessPriority(status: SendReadinessStatus) {
  const priority: Record<SendReadinessStatus, number> = {
    READY_IN_DRY_RUN: 0,
    BLOCKED_BY_DRAFT_STATUS: 1,
    BLOCKED_BY_MISSING_RECIPIENT: 2,
    BLOCKED_BY_OPTOUT: 3,
    BLOCKED_BY_FORBIDDEN_CLAIMS: 4,
    BLOCKED_BY_ALLOWLIST: 5,
    BLOCKED_BY_SENDS_DISABLED: 6,
    BLOCKED_BY_COMPLIANCE: 7,
    BLOCKED_BY_PILOT_STAGE: 8,
    BLOCKED_BY_UNKNOWN: 9,
  };

  return priority[status];
}

function pickReadinessStatus(blockers: Blocker[]): SendReadinessStatus {
  if (blockers.length === 0) return "READY_IN_DRY_RUN";
  return blockers
    .slice()
    .sort(
      (left, right) =>
        readinessPriority(left.status) - readinessPriority(right.status),
    )[0].status;
}

function groupChatImplicationWithoutConsent(body: string, consent?: boolean | null) {
  if (consent) return false;
  return /\b(group\s*(chat|text|intro|introduction)|introduce you|add you)\b/i.test(
    body,
  );
}

function publicCandidateDocsMissing(config: Required<SendReadinessConfigInput>) {
  return (
    !config.supportContactConfigured ||
    !config.privacyUrlConfigured ||
    !config.termsUrlConfigured ||
    !config.dailySendCapConfigured ||
    !config.dailyInboundCapConfigured ||
    !config.maxActiveParticipantsConfigured
  );
}

function blocker(
  status: SendReadinessStatus,
  message: string,
  requiredAction: string,
): Blocker {
  return { status, message, requiredAction };
}

export function evaluateApprovedDraftSendReadiness({
  draft,
  config: configInput,
}: {
  draft: DraftSendReadinessInput;
  config?: SendReadinessConfigInput;
}): DraftSendReadinessResult {
  const config = mergedConfig(configInput);
  const body = draft.editedBody?.trim() || draft.body;
  const normalizedRecipient = normalizePhoneOrNull(draft.recipientPhone);
  const allowlist = config.allowedNumbers
    .map(normalizePhoneOrNull)
    .filter((phone): phone is string => Boolean(phone));
  const isAllowlisted =
    !config.allowlistRequired ||
    Boolean(normalizedRecipient && allowlist.includes(normalizedRecipient));
  const recipientOptedOut = Boolean(draft.recipientOptedOut);
  const safety = checkProducerDraftSafety({ type: draft.type, body });
  const blockers: Blocker[] = [];
  const warnings: string[] = [
    "Dry run only: no SMS will be sent and no provider API will be called.",
  ];

  if (draft.status !== "APPROVED") {
    blockers.push(
      blocker(
        "BLOCKED_BY_DRAFT_STATUS",
        "Outbound draft is not approved.",
        "Approve the draft after admin review.",
      ),
    );
  }

  if (!normalizedRecipient) {
    blockers.push(
      blocker(
        "BLOCKED_BY_MISSING_RECIPIENT",
        "No resolved SMS recipient is available for this draft.",
        "Link the draft to an organizer or candidate with a valid phone.",
      ),
    );
  }

  if (recipientOptedOut) {
    blockers.push(
      blocker(
        "BLOCKED_BY_OPTOUT",
        "Recipient is opted out.",
        "Do not send unless the recipient explicitly opts back in.",
      ),
    );
  }

  if (!safety.passed) {
    blockers.push(
      blocker(
        "BLOCKED_BY_FORBIDDEN_CLAIMS",
        safety.errors.join(" "),
        "Edit the draft until the forbidden-claims and privacy checks pass.",
      ),
    );
  }

  if (groupChatImplicationWithoutConsent(body, draft.consentToGroupChat)) {
    blockers.push(
      blocker(
        "BLOCKED_BY_FORBIDDEN_CLAIMS",
        "Draft implies group-chat inclusion without explicit consent.",
        "Remove group-intro language or record explicit consent first.",
      ),
    );
  }

  if (draft.type === "ORGANIZER_SHORTLIST") {
    if (!draft.shortlistPacketId || draft.shortlistPacketStatus !== "APPROVED") {
      blockers.push(
        blocker(
          "BLOCKED_BY_DRAFT_STATUS",
          "Organizer shortlist draft is not tied to an approved ShortlistPacket.",
          "Approve the ShortlistPacket before evaluating send readiness.",
        ),
      );
    }
  }

  if (draft.type === "CANDIDATE_OUTREACH") {
    if (draft.candidateDoNotContact) {
      blockers.push(
        blocker(
          "BLOCKED_BY_DRAFT_STATUS",
          "Candidate is marked DO_NOT_CONTACT.",
          "Do not send outreach unless a professional review changes that state.",
        ),
      );
    }
    if (draft.candidateRecommendationStatus !== "APPROVED_FOR_SHORTLIST") {
      blockers.push(
        blocker(
          "BLOCKED_BY_DRAFT_STATUS",
          "Candidate outreach draft is not tied to an approved candidate recommendation.",
          "Approve the candidate for shortlist before outreach readiness.",
        ),
      );
    }
  }

  if (config.allowlistRequired && !isAllowlisted) {
    blockers.push(
      blocker(
        "BLOCKED_BY_ALLOWLIST",
        "Recipient is not in SMS_ALLOWED_NUMBERS.",
        "Add the explicitly opted-in recipient to the staging allowlist.",
      ),
    );
  }

  if (config.sendsDisabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SENDS_DISABLED",
        "SMS_SENDS_DISABLED is true.",
        "Keep sends disabled until compliance and pilot approval are complete.",
      ),
    );
  }

  if (!config.complianceApproved) {
    blockers.push(
      blocker(
        "BLOCKED_BY_COMPLIANCE",
        "SMS_COMPLIANCE_APPROVED is false or missing.",
        "Resolve A2P/provider compliance approval before any outbound pilot send.",
      ),
    );
  }

  if (config.pilotReplyMode === "draft_only") {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PILOT_REPLY_MODE is draft_only.",
        "Use a reviewed future reply mode before actual sending is implemented.",
      ),
    );
  }

  if (config.pilotStage === "internal_test" && !config.sendsDisabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "internal_test requires sends to remain disabled.",
        "Move to an approved pilot stage before outbound tests.",
      ),
    );
  }

  if (
    ["design_partner", "private_beta"].includes(String(config.pilotStage)) &&
    !config.allowlistRequired
  ) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "Invite-only pilot stages require the SMS allowlist.",
        "Set SMS_REQUIRE_ALLOWLIST=true before any outbound pilot send.",
      ),
    );
  }

  if (
    config.pilotStage === "public_candidate" &&
    publicCandidateDocsMissing(config)
  ) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "public_candidate requires support, privacy, terms, and rate-limit readiness.",
        "Complete public launch foundation gates before public rehearsal.",
      ),
    );
  }

  if (config.pilotStage === "public_live" && !config.publicLaunchEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PUBLIC_LAUNCH_ENABLED is false for public_live.",
        "Do not use public_live until explicit public launch approval exists.",
      ),
    );
  }

  if (config.providerMode !== "TWILIO") {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "MESSAGING_PROVIDER is not TWILIO for real SMS readiness.",
        "Evaluate real SMS readiness only in a controlled Twilio staging environment.",
      ),
    );
  }

  if (!config.twilioConfigured) {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "Twilio credentials or sender configuration are missing.",
        "Configure Twilio only in the dedicated Twilio staging environment after approval.",
      ),
    );
  }

  if (!config.twilioStagingMode) {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "TWILIO_STAGING_MODE is not enabled.",
        "Set TWILIO_STAGING_MODE=true for Twilio staging readiness checks.",
      ),
    );
  }

  if (!config.webhookValidationEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "TWILIO_VALIDATE_WEBHOOKS is false.",
        "Enable Twilio webhook signature validation before any live pilot send.",
      ),
    );
  }

  const readinessStatus = pickReadinessStatus(blockers);
  const uniqueBlockers = [...new Set(blockers.map((item) => item.message))];
  const requiredActions = [
    ...new Set(blockers.map((item) => item.requiredAction)),
  ];
  const eligible = readinessStatus === "READY_IN_DRY_RUN";

  return {
    draftId: draft.draftId,
    eligible,
    dryRunOnly: true,
    readinessStatus,
    blockers: uniqueBlockers,
    warnings,
    requiredActions,
    safetySnapshot: {
      providerMode: config.providerMode,
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
      allowedNumbersCount: config.allowedNumbersCount,
      twilioStagingMode: config.twilioStagingMode,
      webhookValidationEnabled: config.webhookValidationEnabled,
      pilotStage: String(config.pilotStage),
      pilotReplyMode: String(config.pilotReplyMode),
      complianceApproved: config.complianceApproved,
      publicLaunchEnabled: config.publicLaunchEnabled,
    },
    recipientSummary: {
      kind: String(draft.recipientKind),
      redactedPhone: normalizedRecipient
        ? redactPhoneForDisplay(normalizedRecipient)
        : null,
      isAllowlisted,
      optedOut: recipientOptedOut,
      pilotParticipantStatus: draft.pilotParticipantStatus || null,
    },
    explanationForAudit: eligible
      ? "Draft passed dry-run readiness gates. No SMS was sent."
      : `Draft blocked in dry-run readiness: ${readinessStatus}. No SMS was sent.`,
  };
}

type OutboundDraftForReadiness = Prisma.OutboundDraftGetPayload<{
  include: {
    projectBrief: { include: { user: true } };
    project: { include: { organizerPerson: true } };
    shortlistPacket: true;
    candidateRecommendation: {
      include: {
        person: { include: { legacyContact: true } };
      };
    };
    contact: true;
    person: true;
  };
}>;

function draftInputFromDb(
  draft: OutboundDraftForReadiness,
  pilotParticipantStatus?: string | null,
): DraftSendReadinessInput {
  const candidate = draft.candidateRecommendation;
  const candidatePerson = candidate?.person;
  const candidateContact = candidatePerson?.legacyContact;
  const directContact = draft.contact;
  const directPerson = draft.person;
  const organizerUser = draft.projectBrief?.user;
  const organizerPerson = draft.project?.organizerPerson;
  const candidatePhone =
    directContact?.phone ||
    candidateContact?.phone ||
    directPerson?.phone ||
    candidatePerson?.phone ||
    null;
  const organizerPhone = organizerUser?.phone || organizerPerson?.phone || null;
  const recipientPhone =
    draft.recipientKind === "ORGANIZER" ? organizerPhone : candidatePhone;
  const recipientOptedOut =
    draft.recipientKind === "ORGANIZER"
      ? Boolean(organizerUser?.smsOptedOutAt || organizerPerson?.optedOut)
      : Boolean(
          directContact?.smsOptedOutAt ||
            candidateContact?.smsOptedOutAt ||
            directPerson?.optedOut ||
            candidatePerson?.optedOut,
        );

  return {
    draftId: draft.id,
    type: draft.type,
    status: draft.status,
    body: draft.body,
    editedBody: draft.editedBody,
    recipientKind: draft.recipientKind,
    projectBriefId: draft.projectBriefId,
    projectId: draft.projectId,
    shortlistPacketId: draft.shortlistPacketId,
    shortlistPacketStatus: draft.shortlistPacket?.status || null,
    candidateRecommendationId: draft.candidateRecommendationId,
    candidateRecommendationStatus: candidate?.status || null,
    candidateDoNotContact: candidate?.status === "DO_NOT_CONTACT",
    recipientPhone,
    recipientOptedOut,
    pilotParticipantStatus,
  };
}

async function pilotParticipantStatusForPhone(phone?: string | null) {
  const normalized = normalizePhoneOrNull(phone);
  if (!normalized || !process.env.DATABASE_URL) return null;

  const participant = await getDb().pilotParticipant.findFirst({
    where: { phoneHash: phoneHash(normalized) },
    orderBy: { updatedAt: "desc" },
    select: { status: true },
  });

  return participant?.status || null;
}

async function buildOutboundDraftSendReadiness(outboundDraftId: string) {
  const db = getDb();
  const draft = await db.outboundDraft.findUniqueOrThrow({
    where: { id: outboundDraftId },
    include: {
      projectBrief: { include: { user: true } },
      project: { include: { organizerPerson: true } },
      shortlistPacket: true,
      candidateRecommendation: {
        include: {
          person: { include: { legacyContact: true } },
        },
      },
      contact: true,
      person: true,
    },
  });
  const preliminaryInput = draftInputFromDb(draft);
  const participantStatus = await pilotParticipantStatusForPhone(
    preliminaryInput.recipientPhone,
  );
  const result = evaluateApprovedDraftSendReadiness({
    draft: draftInputFromDb(draft, participantStatus),
  });

  return { draft, result };
}

export async function previewOutboundDraftSendReadiness(outboundDraftId: string) {
  return (await buildOutboundDraftSendReadiness(outboundDraftId)).result;
}

export async function evaluateOutboundDraftSendReadiness(outboundDraftId: string) {
  const { draft, result } =
    await buildOutboundDraftSendReadiness(outboundDraftId);

  await getDb().outboundDraft.update({
    where: { id: outboundDraftId },
    data: {
      metadata: toJson({
        ...metadataObject(draft.metadata),
        lastReadinessCheck: result,
        dryRunOnly: true,
        noSmsSent: true,
        noTwilioApiCall: true,
        noOutreachCreated: true,
        noGroupChatCreated: true,
      }),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: producerDraftSendReadinessAuditEvent,
    entityType: "OutboundDraft",
    entityId: outboundDraftId,
    metadata: {
      draftId: outboundDraftId,
      projectBriefId: draft.projectBriefId,
      projectId: draft.projectId,
      draftType: draft.type,
      readinessStatus: result.readinessStatus,
      eligible: result.eligible,
      blockersCount: result.blockers.length,
      warningsCount: result.warnings.length,
      dryRunOnly: true,
      recipient: result.recipientSummary.redactedPhone,
      noSmsSent: true,
      noTwilioApiCall: true,
      noOutreachCreated: true,
      noGroupChatCreated: true,
    },
  });

  return result;
}
