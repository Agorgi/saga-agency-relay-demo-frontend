import type { Contact, Outreach, ProjectBrief } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { findContactMatches } from "@/sms-engine/contactMatching";
import { getDb } from "@/sms-engine/db";
import { logLlmFallbackUsed } from "@/sms-engine/llmAudit";
import { sendSmsMessage } from "@/sms-engine/messages";
import {
  ensureNetworkLinksForOutreach,
  syncRoleOpeningsFromProjectBrief,
} from "@/sms-engine/networkBridge";
import {
  draftOutreachMessage,
  suggestRequiredRoles,
  summarizeShortlist,
} from "@/sms-engine/producerAgent";
import { briefTitle, parseRequiredRoles } from "@/sms-engine/workflow";
import {
  assertOutreachStatusTransition,
  assertProjectBriefStatusTransition,
  logWorkflowTransition,
} from "@/sms-engine/workflowStateMachine";

export async function generateRoleMapForProject(projectId: string) {
  const db = getDb();
  const project = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });

  const roles = await suggestRequiredRoles(project);
  await logLlmFallbackUsed({
    operation: "suggestRequiredRoles",
    entityType: "ProjectBrief",
    entityId: project.id,
  });
  const nextStatus =
    project.status === "BRIEF_READY_FOR_REVIEW" ? "ROLE_MAPPING_READY" : project.status;
  assertProjectBriefStatusTransition(project.status, nextStatus);
  const updated = await db.projectBrief.update({
    where: { id: project.id },
    data: {
      requiredRoles: roles,
      status: nextStatus,
    },
  });
  await logWorkflowTransition({
    action: "project_brief.status_transitioned",
    entityType: "ProjectBrief",
    entityId: project.id,
    fromStatus: project.status,
    toStatus: nextStatus,
    metadata: { reason: "role_map_generated" },
  });

  await logAudit({
    actorType: "LLM",
    action: "roles.generated",
    entityType: "ProjectBrief",
    entityId: project.id,
    metadata: { roles },
  });

  await syncRoleOpeningsFromProjectBrief(project.id);

  return updated;
}

async function ensureRoleMap(project: ProjectBrief) {
  const existing = parseRequiredRoles(project.requiredRoles);
  if (existing.length > 0) return project;

  return generateRoleMapForProject(project.id);
}

export async function draftOutreachForProject(
  projectId: string,
  selectedContactIds?: string[],
) {
  const db = getDb();
  const project = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectId },
  });
  const projectWithRoles = await ensureRoleMap(project);
  const matchesByRole = await findContactMatches(projectWithRoles);
  const drafted: Outreach[] = [];
  const seenContactIds = new Set<string>();
  const selectedContacts =
    selectedContactIds && selectedContactIds.length > 0
      ? await db.contact.findMany({
          where: {
            id: { in: selectedContactIds },
            smsOptedOutAt: null,
          },
        })
      : [];

  const contactsToDraft =
    selectedContacts.length > 0
      ? selectedContacts
      : matchesByRole.flatMap((roleMatches) =>
          roleMatches.matches.slice(0, 3).map((match) => match.contact),
        );

  for (const contact of contactsToDraft) {
    if (seenContactIds.has(contact.id)) continue;
    seenContactIds.add(contact.id);

    const draftedMessage = await draftOutreachMessage(projectWithRoles, contact);
    await logLlmFallbackUsed({
      operation: "draftOutreachMessage",
      entityType: "ProjectBrief",
      entityId: projectWithRoles.id,
      metadata: { contactId: contact.id },
    });

    const outreach = await db.outreach.upsert({
      where: {
        projectBriefId_contactId: {
          projectBriefId: projectWithRoles.id,
          contactId: contact.id,
        },
      },
      update: {
        draftedMessage,
        status: "DRAFTED",
      },
      create: {
        projectBriefId: projectWithRoles.id,
        contactId: contact.id,
        draftedMessage,
        status: "DRAFTED",
      },
    });

    await ensureNetworkLinksForOutreach(outreach.id);
    drafted.push(outreach);
  }

  const nextStatus =
    [
      "OUTREACH_IN_PROGRESS",
      "SHORTLIST_READY",
      "SHORTLIST_SENT",
      "GROUPCHAT_PENDING",
      "GROUPCHAT_ACTIVE",
      "PRODUCTION_IN_PROGRESS",
    ].includes(projectWithRoles.status)
      ? projectWithRoles.status
      : "OUTREACH_DRAFTED";
  assertProjectBriefStatusTransition(projectWithRoles.status, nextStatus);
  await db.projectBrief.update({
    where: { id: projectWithRoles.id },
    data: { status: nextStatus },
  });
  await logWorkflowTransition({
    action: "project_brief.status_transitioned",
    entityType: "ProjectBrief",
    entityId: projectWithRoles.id,
    fromStatus: projectWithRoles.status,
    toStatus: nextStatus,
    metadata: { reason: "outreach_drafted" },
  });

  await logAudit({
    actorType: "LLM",
    action: "outreach.drafted",
    entityType: "ProjectBrief",
    entityId: projectWithRoles.id,
    metadata: {
      draftedCount: drafted.length,
      selectedContactIds,
      roles: parseRequiredRoles(projectWithRoles.requiredRoles).map(
        (role) => role.role,
      ),
    },
  });

  return drafted;
}

export async function approveAndSendOutreach(outreachIds: string[]) {
  const db = getDb();
  const outreaches = await db.outreach.findMany({
    where: { id: { in: outreachIds } },
    include: {
      contact: true,
      projectBrief: true,
    },
  });
  const sent: Outreach[] = [];

  for (const outreach of outreaches) {
    if (outreach.contact.smsOptedOutAt) continue;

    const body = outreach.sentMessage || outreach.draftedMessage;
    assertOutreachStatusTransition(outreach.status, "SENT", {
      adminApproved: true,
      hasMessage: Boolean(body.trim()),
    });
    await sendSmsMessage({
      to: outreach.contact.phone,
      body,
      contactId: outreach.contact.id,
      projectBriefId: outreach.projectBriefId,
      metadata: {
        generatedBy: "producerAgent",
        approvedBy: "admin",
        outreachId: outreach.id,
      },
    });

    const updated = await db.outreach.update({
      where: { id: outreach.id },
      data: {
        status: "SENT",
        adminApproved: true,
        sentMessage: body,
      },
    });

    await ensureNetworkLinksForOutreach(outreach.id);

    assertProjectBriefStatusTransition(
      outreach.projectBrief.status,
      "OUTREACH_IN_PROGRESS",
    );
    await db.projectBrief.update({
      where: { id: outreach.projectBriefId },
      data: { status: "OUTREACH_IN_PROGRESS" },
    });
    await logWorkflowTransition({
      actorType: "ADMIN",
      action: "project_brief.status_transitioned",
      entityType: "ProjectBrief",
      entityId: outreach.projectBriefId,
      fromStatus: outreach.projectBrief.status,
      toStatus: "OUTREACH_IN_PROGRESS",
      metadata: { reason: "outreach_sent", outreachId: outreach.id },
    });

    await logAudit({
      actorType: "ADMIN",
      action: "outreach.approved_and_sent",
      entityType: "Outreach",
      entityId: outreach.id,
      metadata: {
        contactId: outreach.contactId,
        projectBriefId: outreach.projectBriefId,
      },
    });

    sent.push(updated);
  }

  return sent;
}

export async function approveAndSendSingleOutreach(outreachId: string) {
  return approveAndSendOutreach([outreachId]);
}

export async function maybeMarkShortlistReady(projectBriefId: string) {
  const db = getDb();
  const interestedCount = await db.outreach.count({
    where: {
      projectBriefId,
      status: { in: ["INTERESTED", "APPROVED_FOR_GROUPCHAT"] },
    },
  });

  if (interestedCount === 0) return;

  const project = await db.projectBrief.findUnique({
    where: { id: projectBriefId },
  });

  if (
    project &&
    ["OUTREACH_DRAFTED", "OUTREACH_IN_PROGRESS"].includes(project.status)
  ) {
    assertProjectBriefStatusTransition(project.status, "SHORTLIST_READY");
    await db.projectBrief.update({
      where: { id: projectBriefId },
      data: { status: "SHORTLIST_READY" },
    });
    await logWorkflowTransition({
      action: "project_brief.status_transitioned",
      entityType: "ProjectBrief",
      entityId: projectBriefId,
      fromStatus: project.status,
      toStatus: "SHORTLIST_READY",
      metadata: { reason: "interested_contacts" },
    });
  }
}

export function buildShortlistMessage(project: ProjectBrief, contacts: Contact[]) {
  return `Good news - I found a few people interested in helping bring this to life. Here's the first shortlist:\n${contacts
    .map((contact) => {
      const role = contact.roles[0] || "Collaborator";
      const reason =
        [...contact.roles, ...contact.tags].slice(0, 2).join(", ") ||
        "their background";
      return `* ${contact.name} - ${role}${contact.city ? `, ${contact.city}` : ""}. Good fit based on ${reason}.`;
    })
    .join("\n")}`;
}

export async function sendShortlistToOrganizer(
  projectId: string,
  selectedContactIds?: string[],
  editedMessage?: string | null,
) {
  const db = getDb();
  const project = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      user: true,
      outreaches: {
        where: {
          status: { in: ["INTERESTED", "APPROVED_FOR_GROUPCHAT"] },
          ...(selectedContactIds && selectedContactIds.length > 0
            ? { contactId: { in: selectedContactIds } }
            : {}),
        },
        include: {
          contact: true,
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  const contacts = project.outreaches.map(
    (outreach) => outreach.contact,
  ) as Contact[];

  if (contacts.length === 0) {
    await logAudit({
      actorType: "ADMIN",
      action: "shortlist.skipped_empty",
      entityType: "ProjectBrief",
      entityId: project.id,
      metadata: {},
    });
    return null;
  }

  const body =
    editedMessage?.trim() ||
    (await summarizeShortlist(project, contacts)) ||
    buildShortlistMessage(project, contacts);
  await logLlmFallbackUsed({
    operation: "summarizeShortlist",
    entityType: "ProjectBrief",
    entityId: project.id,
    metadata: { edited: Boolean(editedMessage?.trim()) },
  });

  if (!project.user.smsOptedOutAt) {
    await sendSmsMessage({
      to: project.user.phone,
      body,
      userId: project.userId,
      projectBriefId: project.id,
      metadata: {
        generatedBy: "producerAgent",
        approvedBy: "admin",
        contactIds: contacts.map((contact) => contact.id),
      },
    });
  }

  assertProjectBriefStatusTransition(project.status, "SHORTLIST_SENT");
  await db.projectBrief.update({
    where: { id: project.id },
    data: { status: "SHORTLIST_SENT" },
  });
  await logWorkflowTransition({
    actorType: "ADMIN",
    action: "project_brief.status_transitioned",
    entityType: "ProjectBrief",
    entityId: project.id,
    fromStatus: project.status,
    toStatus: "SHORTLIST_SENT",
    metadata: { reason: "shortlist_sent" },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "shortlist.sent",
    entityType: "ProjectBrief",
    entityId: project.id,
    metadata: {
      title: briefTitle(project),
      contactIds: contacts.map((contact) => contact.id),
    },
  });

  return body;
}
