"use server";

import type { Prisma, ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/adminAuth";
import { accessAuditEvents, hashInviteCode } from "@/lib/access/accessControl";
import { logAudit } from "@/lib/audit";
import { evaluateCommandCenterForAdmin } from "@/lib/commandCenter/commandCenterSummary";
import { parseContactCsv } from "@/lib/contactCsv";
import { getDb } from "@/lib/db";
import {
  createGroupChatForProject,
  parseTaskStatus,
  sendTaskReminder,
} from "@/lib/groupChat";
import {
  retryOutboundMessage,
  sendGroupSmsMessage,
  sendSmsMessage,
} from "@/lib/messages";
import { normalizePhone } from "@/lib/phone";
import {
  normalizePilotFeedbackCategory,
  normalizePilotCohort,
  normalizePilotParticipantRole,
  normalizePilotParticipantStatus,
  preparePilotParticipantPhone,
} from "@/lib/pilotReadiness";
import {
  generateProducerInternalCandidates,
  generateProducerProjectUnderstanding,
  generateProducerRoleMap,
  generateProducerShortlistDraft,
  generateProducerSourcingPlan,
} from "@/lib/producer";
import {
  approveShortlistPacket,
  editShortlistPacket,
  generateShortlistPacketForProjectBrief,
  normalizeCandidateReviewStatus,
  rejectShortlistPacket,
  reviewCandidateRecommendationForShortlist,
} from "@/lib/producer/approvalQueue";
import {
  approveOutboundDraft,
  editOutboundDraft,
  generateCandidateOutreachDraftsForProjectBrief,
  generateOrganizerShortlistMessageDraftForPacket,
  rejectOutboundDraft,
} from "@/lib/producer/outboundDrafts";
import {
  markInboundProcessingJobSkipped,
  retryInboundProcessingJob,
} from "@/lib/messagingPipeline";
import {
  launchDrillStageIds,
  launchDrillStageStatuses,
  recordLaunchDrillManualEvidence,
  runLaunchReadinessDrillForAdmin,
  simulateIncidentDrillForAdmin,
  simulateRollbackDrillForAdmin,
  type LaunchDrillStageId,
  type LaunchDrillStageStatus,
} from "@/lib/launchDrill/launchReadinessDrill";
import { evaluateOutboundSelfTestReadinessForAdmin } from "@/lib/producer/outboundSelfTestReadiness";
import { evaluateOutboundDraftSendReadiness } from "@/lib/producer/sendReadiness";
import { evaluateLiveReplyReadinessForAdmin } from "@/lib/conversation/liveReplyExecutor";
import {
  normalizeConversationAutonomyMode,
  prepareConversationAutonomyPhone,
  upsertConversationAutonomySetting,
} from "@/lib/conversation/conversationAutonomy";
import {
  getPilotSummaryExport,
  recordPilotExportCreated,
} from "@/lib/dataOps/pilotExport";
import {
  markPilotParticipantCompleted,
  markPilotParticipantOptedOut,
  markPilotParticipantPaused,
  recordBackupCheck,
  redactConversationMessageBodies,
  redactPilotFeedbackNotes,
  redactPilotParticipant,
} from "@/lib/dataOps/pilotRedaction";
import {
  evaluateCappedPublicBetaReadiness,
} from "@/lib/publicBeta/publicBetaAdmission";
import {
  evaluatePublicBetaAdmissionForEntry,
  normalizePublicBetaWaitlistStatus,
  recordPublicBetaConsentEvent,
  updatePublicBetaWaitlistStatus,
} from "@/lib/publicBeta/publicBetaWaitlist";
import {
  publicBetaAuditEvents,
} from "@/lib/publicBeta/publicBetaConfig";
import {
  approveAndSendOutreach,
  approveAndSendSingleOutreach,
  draftOutreachForProject,
  generateRoleMapForProject,
  sendShortlistToOrganizer,
} from "@/lib/outreach";
import { syncContactToPersonCreatorProfile } from "@/lib/networkBridge";
import {
  assertProjectBriefStatusTransition,
  assertTaskStatusTransition,
} from "@/lib/workflowStateMachine";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ids(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0,
    );
}

function textArray(value: string | null) {
  if (!value) return [];
  return value
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanValue(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function dateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function positiveIntValue(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredRolesJson(value: string | null) {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function parseProjectStatus(value: string | null): ProjectStatus | undefined {
  const statuses: ProjectStatus[] = [
    "NEW_INBOUND",
    "INTAKE_IN_PROGRESS",
    "BRIEF_READY_FOR_REVIEW",
    "ROLE_MAPPING_READY",
    "OUTREACH_DRAFTED",
    "OUTREACH_IN_PROGRESS",
    "SHORTLIST_READY",
    "SHORTLIST_SENT",
    "GROUPCHAT_PENDING",
    "GROUPCHAT_ACTIVE",
    "PRODUCTION_IN_PROGRESS",
    "ARCHIVED",
    "NEEDS_ADMIN",
  ];
  return statuses.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : undefined;
}

export async function updateProjectBriefAction(
  projectId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const firstTimeHost = booleanValue(text(formData, "firstTimeHost"));
  const parsedRequiredRoles = requiredRolesJson(text(formData, "requiredRoles"));
  const status = parseProjectStatus(text(formData, "status"));

  const existing = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });
  if (status) {
    assertProjectBriefStatusTransition(existing.status, status, {
      allowAdminOverride: true,
    });
  }
  await getDb().projectBrief.update({
    where: { id: projectId },
    data: {
      status,
      ...(status && status !== existing.status
        ? { previousStatus: existing.status }
        : {}),
      firstTimeHost,
      city: text(formData, "city"),
      projectType: text(formData, "projectType"),
      title: text(formData, "title"),
      description: text(formData, "description"),
      targetDate: text(formData, "targetDate"),
      budgetRange: text(formData, "budgetRange"),
      expectedAudienceSize: text(formData, "expectedAudienceSize"),
      scope: text(formData, "scope"),
      vibe: text(formData, "vibe"),
      helpNeeded: text(formData, "helpNeeded"),
      adminNotes: text(formData, "adminNotes"),
      ...(parsedRequiredRoles ? { requiredRoles: parsedRequiredRoles } : {}),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: status && status !== existing.status ? "project.status_changed" : "project.updated",
    entityType: "ProjectBrief",
    entityId: projectId,
    metadata: {},
  });

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
}

export async function generateRoleMapAction(projectId: string) {
  await requireAdminForAction();
  await generateRoleMapForProject(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function generateProducerProjectUnderstandingAction(
  projectId: string,
) {
  await requireAdminForAction();
  await generateProducerProjectUnderstanding(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function generateProducerRoleMapAction(projectId: string) {
  await requireAdminForAction();
  await generateProducerRoleMap(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/role-openings");
  revalidatePath("/admin/audit");
}

export async function generateProducerSourcingPlanAction(projectId: string) {
  await requireAdminForAction();
  await generateProducerSourcingPlan(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function generateProducerInternalCandidatesAction(
  projectId: string,
) {
  await requireAdminForAction();
  await generateProducerInternalCandidates(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/recommendations");
  revalidatePath("/admin/audit");
}

export async function generateProducerShortlistDraftAction(projectId: string) {
  await requireAdminForAction();
  await generateProducerShortlistDraft(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function reviewCandidateRecommendationAction(
  projectId: string,
  candidateRecommendationId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const status = normalizeCandidateReviewStatus(text(formData, "status"));
  if (!status) {
    throw new Error("Unsupported candidate review status.");
  }
  await reviewCandidateRecommendationForShortlist({
    candidateRecommendationId,
    status,
    adminReviewNotes: text(formData, "adminReviewNotes"),
    shortlistReasonOverride: text(formData, "shortlistReasonOverride"),
    organizerFacingSummaryOverride: text(
      formData,
      "organizerFacingSummaryOverride",
    ),
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/recommendations");
  revalidatePath("/admin/audit");
}

export async function generateShortlistPacketAction(projectId: string) {
  await requireAdminForAction();
  await generateShortlistPacketForProjectBrief(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function editShortlistPacketAction(
  projectId: string,
  shortlistPacketId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  await editShortlistPacket({
    shortlistPacketId,
    organizerFacingSummary:
      text(formData, "organizerFacingSummary") ||
      "Here's a draft shortlist based on the brief. These are not confirmed team members yet - they're people Saga thinks may be worth considering.",
    adminNotes: text(formData, "adminNotes"),
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function approveShortlistPacketAction(
  projectId: string,
  shortlistPacketId: string,
) {
  await requireAdminForAction();
  await approveShortlistPacket({ shortlistPacketId });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function rejectShortlistPacketAction(
  projectId: string,
  shortlistPacketId: string,
  formData?: FormData,
) {
  await requireAdminForAction();
  await rejectShortlistPacket({
    shortlistPacketId,
    adminNotes: formData ? text(formData, "adminNotes") : null,
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/audit");
}

export async function generateOrganizerShortlistMessageDraftAction(
  projectId: string,
  shortlistPacketId: string,
) {
  await requireAdminForAction();
  await generateOrganizerShortlistMessageDraftForPacket(shortlistPacketId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/audit");
}

export async function generateCandidateOutreachDraftsAction(projectId: string) {
  await requireAdminForAction();
  await generateCandidateOutreachDraftsForProjectBrief(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/audit");
}

export async function editOutboundDraftAction(
  projectId: string,
  outboundDraftId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  await editOutboundDraft({
    outboundDraftId,
    editedBody: text(formData, "editedBody") || "",
    adminNotes: text(formData, "adminNotes"),
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/audit");
}

export async function approveOutboundDraftAction(
  projectId: string,
  outboundDraftId: string,
) {
  await requireAdminForAction();
  await approveOutboundDraft({ outboundDraftId });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/audit");
}

export async function rejectOutboundDraftAction(
  projectId: string,
  outboundDraftId: string,
  formData?: FormData,
) {
  await requireAdminForAction();
  await rejectOutboundDraft({
    outboundDraftId,
    adminNotes: formData ? text(formData, "adminNotes") : null,
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/audit");
}

export async function evaluateOutboundDraftSendReadinessAction(
  projectId: string,
  outboundDraftId: string,
) {
  await requireAdminForAction();
  await evaluateOutboundDraftSendReadiness(outboundDraftId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outbound-drafts");
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}

export async function evaluateOutboundSelfTestReadinessAction() {
  await requireAdminForAction();
  await evaluateOutboundSelfTestReadinessForAdmin();
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}

export async function evaluateLiveReplyReadinessAction() {
  await requireAdminForAction();
  await evaluateLiveReplyReadinessForAdmin();
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}

export async function draftOutreachAction(projectId: string) {
  await requireAdminForAction();
  await draftOutreachForProject(projectId);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outreach");
}

export async function draftSelectedOutreachAction(
  projectId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  await draftOutreachForProject(projectId, ids(formData, "contactIds"));
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outreach");
}

export async function approveSelectedOutreachAction(
  projectId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const outreachIds = ids(formData, "outreachIds");

  for (const outreachId of outreachIds) {
    const editedDraft = text(formData, `draftedMessage:${outreachId}`);
    if (editedDraft) {
      await getDb().outreach.update({
        where: { id: outreachId },
        data: { draftedMessage: editedDraft },
      });
    }
  }

  await approveAndSendOutreach(outreachIds);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/outreach");
}

export async function sendShortlistAction(
  projectId: string,
  formData?: FormData,
) {
  await requireAdminForAction();
  await sendShortlistToOrganizer(
    projectId,
    formData ? ids(formData, "contactIds") : undefined,
    formData ? text(formData, "shortlistMessage") : null,
  );
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
}

export async function createGroupChatAction(
  projectId: string,
  formData?: FormData,
) {
  await requireAdminForAction();
  await createGroupChatForProject(
    projectId,
    formData ? ids(formData, "contactIds") : undefined,
  );
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/groupchats");
}

export async function markNeedsAdminAction(projectId: string, formData: FormData) {
  await requireAdminForAction();
  const note = text(formData, "adminNotes");
  const project = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });
  assertProjectBriefStatusTransition(project.status, "NEEDS_ADMIN");
  await getDb().projectBrief.update({
    where: { id: projectId },
    data: {
      previousStatus:
        project.status === "NEEDS_ADMIN" ? project.previousStatus : project.status,
      status: "NEEDS_ADMIN",
      escalationReason: "admin_marked",
      escalationFlags: ["admin_marked"],
      escalationResolvedAt: null,
      ...(note ? { adminNotes: note } : {}),
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: "project.marked_needs_admin",
    entityType: "ProjectBrief",
    entityId: projectId,
    metadata: {},
  });
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function resolveNeedsAdminAction(
  projectId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const requestedStatus = parseProjectStatus(text(formData, "returnStatus"));
  const project = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });
  const nextStatus =
    requestedStatus ||
    project.previousStatus ||
    "INTAKE_IN_PROGRESS";
  assertProjectBriefStatusTransition(project.status, nextStatus, {
    allowAdminOverride: Boolean(requestedStatus),
  });

  await getDb().projectBrief.update({
    where: { id: projectId },
    data: {
      status: nextStatus,
      escalationResolvedAt: new Date(),
      escalationReason: null,
      escalationFlags: [],
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: "project.escalation_resolved",
    entityType: "ProjectBrief",
    entityId: projectId,
    metadata: {
      nextStatus,
      previousStatus: project.status,
    },
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
}

export async function archiveProjectAction(projectId: string) {
  await requireAdminForAction();
  const project = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });
  assertProjectBriefStatusTransition(project.status, "ARCHIVED", {
    allowAdminOverride: true,
  });
  await getDb().projectBrief.update({
    where: { id: projectId },
    data: {
      previousStatus: "ARCHIVED",
      status: "ARCHIVED",
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: "project.archived",
    entityType: "ProjectBrief",
    entityId: projectId,
    metadata: {},
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
}

export async function sendManualMessageAction(
  projectId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const body = text(formData, "body");
  const recipient = text(formData, "recipient");
  if (!body || !recipient) return;

  const project = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      user: true,
      outreaches: { include: { contact: true } },
      groupChats: true,
    },
  });

  if (recipient === "organizer") {
    if (project.user.smsOptedOutAt) {
      throw new Error("Organizer has opted out.");
    }
    await sendSmsMessage({
      to: project.user.phone,
      body,
      userId: project.user.id,
      projectBriefId: project.id,
      metadata: {
        generatedBy: "admin",
        manual: true,
      },
    });
  } else if (recipient.startsWith("contact:")) {
    const contactId = recipient.replace("contact:", "");
    const contact = project.outreaches.find(
      (outreach) => outreach.contactId === contactId,
    )?.contact;
    if (!contact) throw new Error("Contact not found for project.");
    if (contact.smsOptedOutAt) throw new Error("Contact has opted out.");
    await sendSmsMessage({
      to: contact.phone,
      body,
      contactId: contact.id,
      projectBriefId: project.id,
      metadata: {
        generatedBy: "admin",
        manual: true,
      },
    });
  } else if (recipient.startsWith("group:")) {
    const groupChatId = recipient.replace("group:", "");
    const groupChat = project.groupChats.find(
      (item) => item.id === groupChatId && item.status === "ACTIVE",
    );
    if (!groupChat?.twilioConversationSid) {
      throw new Error("Active group chat not found.");
    }
    await sendGroupSmsMessage({
      conversationSid: groupChat.twilioConversationSid,
      body,
      projectBriefId: project.id,
      metadata: {
        generatedBy: "admin",
        manual: true,
        groupChatId,
      },
    });
  }

  await logAudit({
    actorType: "ADMIN",
    action: "message.manual_sent",
    entityType: "ProjectBrief",
    entityId: projectId,
    metadata: {
      recipient,
    },
  });
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/groupchats");
}

export async function retryMessageAction(messageId: string) {
  await requireAdminForAction();
  const retried = await retryOutboundMessage(messageId);
  await logAudit({
    actorType: "ADMIN",
    action: "message.retry_requested",
    entityType: "Message",
    entityId: messageId,
    metadata: {
      retriedMessageId: retried.id,
    },
  });
  if (retried.projectBriefId) {
    revalidatePath(`/admin/projects/${retried.projectBriefId}`);
  }
  revalidatePath("/admin/groupchats");
}

export async function createPilotFeedbackAction(formData: FormData) {
  await requireAdminForAction();
  const notes = text(formData, "notes");
  if (!notes) return;

  const ratingText = text(formData, "rating");
  const parsedRating = ratingText ? Number.parseInt(ratingText, 10) : null;
  const rating =
    parsedRating && parsedRating >= 1 && parsedRating <= 5 ? parsedRating : null;
  const projectBriefId = text(formData, "projectBriefId");
  const personId = text(formData, "personId");
  const pilotParticipantId = text(formData, "pilotParticipantId");

  const feedback = await getDb().pilotFeedback.create({
    data: {
      category: normalizePilotFeedbackCategory(text(formData, "category")),
      rating,
      notes,
      projectBriefId,
      personId,
      pilotParticipantId,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "pilot.feedback_created",
    entityType: "PilotFeedback",
    entityId: feedback.id,
    metadata: {
      category: feedback.category,
      rating: feedback.rating,
      projectBriefId,
      personId,
      pilotParticipantId,
    },
  });

  revalidatePath("/admin/pilot-feedback");
  if (projectBriefId) revalidatePath(`/admin/projects/${projectBriefId}`);
}

export async function createPilotParticipantAction(formData: FormData) {
  await requireAdminForAction();
  const rawPhone = text(formData, "phone");
  const phone = preparePilotParticipantPhone(rawPhone);
  const consentTimestamp = dateValue(text(formData, "consentTimestamp"));
  const status = normalizePilotParticipantStatus(text(formData, "status"));
  const joinedAt =
    status === "ACTIVE" ? dateValue(text(formData, "joinedAt")) || new Date() : null;

  const participant = await getDb().pilotParticipant.create({
    data: {
      personId: text(formData, "personId"),
      projectBriefId: text(formData, "projectBriefId"),
      phoneHash: phone.phoneHash,
      redactedPhone: phone.redactedPhone,
      name: text(formData, "name"),
      email: text(formData, "email"),
      role: normalizePilotParticipantRole(text(formData, "role")),
      cohort: normalizePilotCohort(text(formData, "cohort")),
      status,
      consentSource: text(formData, "consentSource"),
      consentTimestamp,
      joinedAt,
      lastActiveAt: joinedAt,
      notes: text(formData, "notes"),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "pilot.participant_created",
    entityType: "PilotParticipant",
    entityId: participant.id,
    metadata: {
      personId: participant.personId,
      projectBriefId: participant.projectBriefId,
      redactedPhone: participant.redactedPhone,
      role: participant.role,
      cohort: participant.cohort,
      status: participant.status,
      hasConsent: Boolean(participant.consentTimestamp),
    },
  });

  revalidatePath("/admin/pilot");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/access");
}

export async function createBetaInviteCodeAction(formData: FormData) {
  await requireAdminForAction();
  const code = text(formData, "code");
  if (!code) {
    throw new Error("Invite code is required.");
  }
  const maxUses = positiveIntValue(text(formData, "maxUses"), 1);
  const expiresAt = dateValue(text(formData, "expiresAt"));
  const cohort = normalizePilotCohort(text(formData, "cohort"));
  const inviteCode = await getDb().betaInviteCode.create({
    data: {
      codeHash: hashInviteCode(code),
      label: text(formData, "label"),
      cohort,
      maxUses,
      expiresAt,
      createdBy: "admin",
      metadata: {
        plaintextDisplayedOnce: true,
        noSmsSent: true,
      },
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: accessAuditEvents.inviteCodeCreated,
    entityType: "BetaInviteCode",
    entityId: inviteCode.id,
    metadata: {
      inviteCodeId: inviteCode.id,
      cohort: inviteCode.cohort,
      maxUses: inviteCode.maxUses,
      status: inviteCode.status,
      plaintextStored: false,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/audit");
}

export async function pauseBetaInviteCodeAction(inviteCodeId: string) {
  await requireAdminForAction();
  const inviteCode = await getDb().betaInviteCode.update({
    where: { id: inviteCodeId },
    data: { status: "PAUSED" },
  });

  await logAudit({
    actorType: "ADMIN",
    action: accessAuditEvents.inviteCodePaused,
    entityType: "BetaInviteCode",
    entityId: inviteCode.id,
    metadata: {
      inviteCodeId: inviteCode.id,
      cohort: inviteCode.cohort,
      status: inviteCode.status,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/audit");
}

export async function updateBetaParticipantStatusAction(
  participantId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const status = normalizePilotParticipantStatus(text(formData, "status"));
  const existing = await getDb().pilotParticipant.findUniqueOrThrow({
    where: { id: participantId },
  });
  const participant = await getDb().pilotParticipant.update({
    where: { id: participantId },
    data: {
      status,
      notes: text(formData, "notes") ?? existing.notes,
      ...(status === "ACTIVE"
        ? {
            joinedAt: existing.joinedAt || new Date(),
            lastActiveAt: new Date(),
          }
        : {}),
    },
  });
  const action =
    status === "ACTIVE"
      ? accessAuditEvents.participantActivated
      : status === "PAUSED"
        ? accessAuditEvents.participantPaused
        : status === "WAITLISTED"
          ? accessAuditEvents.participantWaitlisted
          : status === "REJECTED"
            ? accessAuditEvents.participantRejected
            : status === "COMPLETED"
              ? accessAuditEvents.participantCompleted
              : "access.participant_updated";

  await logAudit({
    actorType: "ADMIN",
    action,
    entityType: "PilotParticipant",
    entityId: participant.id,
    metadata: {
      participantId: participant.id,
      oldStatus: existing.status,
      newStatus: participant.status,
      cohort: participant.cohort,
      redactedPhone: participant.redactedPhone,
    },
  });

  revalidatePath("/admin/access");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/audit");
}

export async function updatePublicBetaWaitlistStatusAction(
  waitlistEntryId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  await updatePublicBetaWaitlistStatus({
    waitlistEntryId,
    status: normalizePublicBetaWaitlistStatus(text(formData, "status")),
    notes: text(formData, "notes"),
  });

  revalidatePath("/admin/public-beta");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function recordPublicBetaWaitlistConsentAction(
  waitlistEntryId: string,
) {
  await requireAdminForAction();
  const entry = await getDb().publicBetaWaitlistEntry.findUniqueOrThrow({
    where: { id: waitlistEntryId },
  });
  await recordPublicBetaConsentEvent({
    waitlistEntryId: entry.id,
    phoneHash: entry.phoneHash,
    emailHash: entry.emailHash,
    consentType: "PUBLIC_BETA",
    source: "ADMIN",
    metadata: {
      recordedFromAdmin: true,
      noSmsSent: true,
    },
  });

  revalidatePath("/admin/public-beta");
  revalidatePath("/admin/audit");
}

export async function evaluatePublicBetaAdmissionAction(waitlistEntryId: string) {
  await requireAdminForAction();
  await evaluatePublicBetaAdmissionForEntry(waitlistEntryId);
  revalidatePath("/admin/public-beta");
  revalidatePath("/admin/audit");
}

export async function admitPublicBetaWaitlistEntryAction(waitlistEntryId: string) {
  await requireAdminForAction();
  const decision = await evaluatePublicBetaAdmissionForEntry(waitlistEntryId);
  if (!decision.admissible) {
    revalidatePath("/admin/public-beta");
    return;
  }

  const entry = await getDb().publicBetaWaitlistEntry.findUniqueOrThrow({
    where: { id: waitlistEntryId },
  });
  const participant = await getDb().pilotParticipant.create({
    data: {
      phoneHash: entry.phoneHash,
      redactedPhone: entry.redactedPhone,
      name: entry.name,
      email: entry.email,
      role:
        entry.desiredUseCase === "ORGANIZER"
          ? "ORGANIZER"
          : entry.desiredUseCase === "CREATOR"
            ? "CREATOR"
            : "OBSERVER",
      cohort: "public_beta",
      status: "ACTIVE",
      inviteCodeId: entry.inviteCodeId,
      consentSource: entry.consentCaptured ? "public_beta_waitlist" : null,
      consentTimestamp: entry.consentCapturedAt,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      notes: "Created from public beta waitlist admission. No SMS sent.",
    },
  });

  await getDb().publicBetaWaitlistEntry.update({
    where: { id: entry.id },
    data: { status: "ADMITTED" },
  });

  await logAudit({
    actorType: "ADMIN",
    action: publicBetaAuditEvents.entryAdmitted,
    entityType: "PublicBetaWaitlistEntry",
    entityId: entry.id,
    metadata: {
      waitlistEntryId: entry.id,
      participantId: participant.id,
      status: "ADMITTED",
      admissionStatus: decision.admissionStatus,
      cohort: "public_beta",
      noSmsSent: true,
      noTwilioSendCall: true,
    },
  });

  revalidatePath("/admin/public-beta");
  revalidatePath("/admin/access");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/audit");
}

export async function evaluateCappedPublicBetaReadinessAction() {
  await requireAdminForAction();
  const readiness = await evaluateCappedPublicBetaReadiness();
  await logAudit({
    actorType: "ADMIN",
    action: publicBetaAuditEvents.readinessEvaluated,
    entityType: "PublicBeta",
    entityId: readiness.publicBetaStage,
    metadata: {
      publicBetaReady: readiness.publicBetaReady,
      publicBetaStage: readiness.publicBetaStage,
      blockersCount: readiness.blockers.length,
      warningsCount: readiness.warnings.length,
      noSmsSent: true,
      noTwilioSendCall: true,
    },
  });

  revalidatePath("/admin/public-beta");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function createContactAction(formData: FormData) {
  await requireAdminForAction();
  const phone = text(formData, "phone");
  const name = text(formData, "name");

  if (!phone || !name) return;

  const contact = await getDb().contact.create({
    data: {
      name,
      phone: normalizePhone(phone),
      email: text(formData, "email"),
      city: text(formData, "city"),
      roles: textArray(text(formData, "roles")),
      tags: textArray(text(formData, "tags")),
      portfolioUrl: text(formData, "portfolioUrl"),
      instagramUrl: text(formData, "instagramUrl"),
      notes: text(formData, "notes"),
    },
  });
  await syncContactToPersonCreatorProfile(contact.id);

  revalidatePath("/admin/contacts");
}

export async function updateContactAction(contactId: string, formData: FormData) {
  await requireAdminForAction();
  const phone = text(formData, "phone");
  const name = text(formData, "name");

  if (!phone || !name) return;

  const contact = await getDb().contact.update({
    where: { id: contactId },
    data: {
      name,
      phone: normalizePhone(phone),
      email: text(formData, "email"),
      city: text(formData, "city"),
      roles: textArray(text(formData, "roles")),
      tags: textArray(text(formData, "tags")),
      portfolioUrl: text(formData, "portfolioUrl"),
      instagramUrl: text(formData, "instagramUrl"),
      notes: text(formData, "notes"),
    },
  });
  await syncContactToPersonCreatorProfile(contact.id);

  revalidatePath("/admin/contacts");
}

export async function updateContactConversationAutonomyAction(
  contactId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const contact = await getDb().contact.findUniqueOrThrow({
    where: { id: contactId },
    select: { id: true, phone: true, personId: true },
  });
  const phone = prepareConversationAutonomyPhone(contact.phone);
  await upsertConversationAutonomySetting({
    phoneHash: phone.phoneHash,
    redactedPhone: phone.redactedPhone,
    mode: normalizeConversationAutonomyMode(text(formData, "mode")),
    personId: contact.personId,
    contactId: contact.id,
    reason: text(formData, "reason"),
    notes: text(formData, "notes"),
    updatedBy: "admin",
  });

  revalidatePath("/admin/contacts");
  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/audit");
}

export async function updatePilotParticipantConversationAutonomyAction(
  participantId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  const participant = await getDb().pilotParticipant.findUniqueOrThrow({
    where: { id: participantId },
    select: {
      id: true,
      phoneHash: true,
      redactedPhone: true,
      personId: true,
    },
  });
  if (!participant.phoneHash || !participant.redactedPhone) {
    throw new Error("Pilot participant does not have a phone hash/redacted phone.");
  }

  await upsertConversationAutonomySetting({
    phoneHash: participant.phoneHash,
    redactedPhone: participant.redactedPhone,
    mode: normalizeConversationAutonomyMode(text(formData, "mode")),
    personId: participant.personId,
    pilotParticipantId: participant.id,
    reason: text(formData, "reason"),
    notes: text(formData, "notes"),
    updatedBy: "admin",
  });

  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/audit");
}

export async function deleteContactAction(contactId: string) {
  await requireAdminForAction();
  await getDb().contact.delete({
    where: { id: contactId },
  });
  revalidatePath("/admin/contacts");
}

export async function importContactsCsvAction(formData: FormData) {
  await requireAdminForAction();
  const csv = text(formData, "csv");
  if (!csv) return;

  const parsed = parseContactCsv(csv);
  if (parsed.errors.length > 0) {
    await logAudit({
      actorType: "ADMIN",
      action: "contacts.import_rejected",
      entityType: "Contact",
      entityId: "csv",
      metadata: {
        errors: parsed.errors,
      },
    });
    return;
  }

  for (const contact of parsed.contacts) {
    const upserted = await getDb().contact.upsert({
      where: { phone: contact.phone },
      update: {
        name: contact.name,
        email: contact.email,
        city: contact.city,
        roles: contact.roles,
        tags: contact.tags,
        portfolioUrl: contact.portfolioUrl,
        instagramUrl: contact.instagramUrl,
        notes: contact.notes,
      },
      create: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        city: contact.city,
        roles: contact.roles,
        tags: contact.tags,
        portfolioUrl: contact.portfolioUrl,
        instagramUrl: contact.instagramUrl,
        notes: contact.notes,
      },
    });
    await syncContactToPersonCreatorProfile(upserted.id);
  }

  revalidatePath("/admin/contacts");
}

export async function updateOutreachAction(
  outreachId: string,
  formData: FormData,
) {
  await requireAdminForAction();
  await getDb().outreach.update({
    where: { id: outreachId },
    data: {
      draftedMessage: text(formData, "draftedMessage") || "",
      lastResponse: text(formData, "lastResponse"),
    },
  });
  revalidatePath("/admin/outreach");
}

export async function approveSingleOutreachAction(outreachId: string) {
  await requireAdminForAction();
  await approveAndSendSingleOutreach(outreachId);
  revalidatePath("/admin/outreach");
}

export async function createTaskAction(formData: FormData) {
  await requireAdminForAction();
  const projectBriefId = text(formData, "projectBriefId");
  const networkProjectId = text(formData, "projectId");
  const title = text(formData, "title");

  if ((!projectBriefId && !networkProjectId) || !title) return;

  await getDb().task.create({
    data: {
      projectBriefId,
      projectId: networkProjectId,
      groupChatId: text(formData, "groupChatId"),
      productionConversationId: text(formData, "productionConversationId"),
      ownerName: text(formData, "ownerName"),
      ownerPhone: text(formData, "ownerPhone")
        ? normalizePhone(text(formData, "ownerPhone") as string)
        : null,
      title,
      description: text(formData, "description"),
      dueDate: dateValue(text(formData, "dueDate")),
      status: parseTaskStatus(formData.get("status")),
    },
  });

  if (projectBriefId) revalidatePath(`/admin/projects/${projectBriefId}`);
  if (networkProjectId) revalidatePath(`/admin/network-projects/${networkProjectId}`);
  revalidatePath("/admin/tasks");
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  await requireAdminForAction();
  const existing = await getDb().task.findUniqueOrThrow({
    where: { id: taskId },
  });
  const status = parseTaskStatus(formData.get("status"));
  assertTaskStatusTransition(existing.status, status, { allowAdminOverride: true });
  await getDb().task.update({
    where: { id: taskId },
    data: {
      ownerName: text(formData, "ownerName"),
      ownerPhone: text(formData, "ownerPhone")
        ? normalizePhone(text(formData, "ownerPhone") as string)
        : null,
      groupChatId: text(formData, "groupChatId"),
      productionConversationId: text(formData, "productionConversationId"),
      title: text(formData, "title") || "Untitled task",
      description: text(formData, "description"),
      dueDate: dateValue(text(formData, "dueDate")),
      status,
    },
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/groupchats");
}

export async function deleteTaskAction(taskId: string) {
  await requireAdminForAction();
  await getDb().task.delete({
    where: { id: taskId },
  });
  revalidatePath("/admin/tasks");
}

export async function sendTaskReminderAction(taskId: string) {
  await requireAdminForAction();
  await sendTaskReminder(taskId);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/groupchats");
}

export async function retryInboundProcessingJobAction(jobId: string) {
  await requireAdminForAction();
  await retryInboundProcessingJob(jobId);
  revalidatePath("/admin/pipeline");
}

export async function markInboundProcessingJobSkippedAction(jobId: string) {
  await requireAdminForAction();
  await markInboundProcessingJobSkipped(jobId);
  revalidatePath("/admin/pipeline");
}

export async function dataOpsPauseParticipantAction(participantId: string) {
  await requireAdminForAction();
  await markPilotParticipantPaused(participantId);
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsCompleteParticipantAction(participantId: string) {
  await requireAdminForAction();
  await markPilotParticipantCompleted(participantId);
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsOptOutParticipantAction(participantId: string) {
  await requireAdminForAction();
  await markPilotParticipantOptedOut(participantId);
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsRedactParticipantAction(participantId: string) {
  await requireAdminForAction();
  await redactPilotParticipant({
    participantId,
    redactPhone: true,
    redactNotes: true,
    softDelete: true,
  });
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/pilot-participants");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsRedactProjectMessagesAction(projectBriefId: string) {
  await requireAdminForAction();
  await redactConversationMessageBodies(projectBriefId);
  revalidatePath("/admin/data-ops");
  revalidatePath(`/admin/projects/${projectBriefId}`);
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsRedactFeedbackNotesAction(feedbackId: string) {
  await requireAdminForAction();
  await redactPilotFeedbackNotes(feedbackId);
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/pilot-feedback");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsRecordChecklistAction(formData: FormData) {
  await requireAdminForAction();
  const kind = text(formData, "kind");
  await recordBackupCheck({
    kind:
      kind === "restore" || kind === "retention"
        ? kind
        : "backup",
    notes: text(formData, "notes"),
  });
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function dataOpsRecordPilotSummaryExportAction() {
  await requireAdminForAction();
  const exportData = await getPilotSummaryExport();
  await recordPilotExportCreated(exportData);
  revalidatePath("/admin/data-ops");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

function parseLaunchDrillStage(value: string | null): LaunchDrillStageId {
  return launchDrillStageIds.includes(value as LaunchDrillStageId)
    ? (value as LaunchDrillStageId)
    : "PRE_A2P_HOLD";
}

function parseLaunchDrillStatus(value: string | null): LaunchDrillStageStatus {
  return launchDrillStageStatuses.includes(value as LaunchDrillStageStatus)
    ? (value as LaunchDrillStageStatus)
    : "NOT_STARTED";
}

export async function runLaunchReadinessDrillAction(formData?: FormData) {
  await requireAdminForAction();
  await runLaunchReadinessDrillForAdmin({
    notes: formData ? text(formData, "notes") : null,
  });
  revalidatePath("/admin/launch-drill");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}

export async function recordLaunchDrillManualEvidenceAction(formData: FormData) {
  await requireAdminForAction();
  await recordLaunchDrillManualEvidence({
    stage: parseLaunchDrillStage(text(formData, "stage")),
    status: parseLaunchDrillStatus(text(formData, "status")),
    notes: text(formData, "notes"),
  });
  revalidatePath("/admin/launch-drill");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}

export async function simulateRollbackDrillAction() {
  await requireAdminForAction();
  await simulateRollbackDrillForAdmin();
  revalidatePath("/admin/launch-drill");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function simulateIncidentDrillAction() {
  await requireAdminForAction();
  await simulateIncidentDrillForAdmin();
  revalidatePath("/admin/launch-drill");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/audit");
}

export async function evaluateCommandCenterAction(formData?: FormData) {
  await requireAdminForAction();
  await evaluateCommandCenterForAdmin({
    notes: formData ? text(formData, "notes") : null,
  });
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/launch-drill");
  revalidatePath("/admin/observability");
  revalidatePath("/admin/pilot");
  revalidatePath("/admin/audit");
}
