import type { GroupChat, TaskStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { logLlmFallbackUsed } from "@/lib/llmAudit";
import { createInboundMessage, sendGroupSmsMessage, sendSmsMessage } from "@/lib/messages";
import { getMessagingProvider } from "@/lib/messagingProvider";
import {
  ensureProductionConversationForGroupChat,
  ensureProjectForProjectBrief,
} from "@/lib/networkBridge";
import { normalizePhone } from "@/lib/phone";
import {
  generateGroupChatKickoff,
  suggestTasksFromGroupChat,
} from "@/lib/producerAgent";
import { assessMessageSafety } from "@/lib/safety";
import { briefTitle } from "@/lib/workflow";
import {
  assertGroupChatStatusTransition,
  assertProductionConversationStatusTransition,
  assertProjectBriefStatusTransition,
  logWorkflowTransition,
} from "@/lib/workflowStateMachine";

function parseDueDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createGroupChatForProject(
  projectId: string,
  selectedContactIds?: string[],
) {
  const db = getDb();
  const project = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      user: true,
      outreaches: {
        where: {
          status: "APPROVED_FOR_GROUPCHAT",
          consentToGroupChat: true,
          ...(selectedContactIds && selectedContactIds.length > 0
            ? { contactId: { in: selectedContactIds } }
            : {}),
          contact: {
            smsOptedOutAt: null,
          },
        },
        include: {
          contact: true,
        },
      },
    },
  });

  if (project.user.smsOptedOutAt) {
    throw new Error("Organizer has opted out of SMS.");
  }

  if (project.outreaches.length === 0) {
    throw new Error("No contacts have consented to group chat yet.");
  }

  const existingActive = await db.groupChat.findFirst({
    where: {
      projectBriefId: project.id,
      status: "ACTIVE",
    },
  });

  if (existingActive) return existingActive;

  const groupChat = await db.groupChat.create({
    data: {
      projectBriefId: project.id,
      status: "DRAFT",
    },
  });

  const messagingProvider = getMessagingProvider();
  const conversation = await messagingProvider.createGroupConversation({
    friendlyName: `Saga: ${briefTitle(project)}`,
  });
  const conversationSid =
    conversation.sid || `mock-conversation-${groupChat.id}`;

  const updatedGroupChat = await db.groupChat.update({
    where: { id: groupChat.id },
    data: {
      twilioConversationSid: conversationSid,
    },
  });
  const productionConversation =
    await ensureProductionConversationForGroupChat(updatedGroupChat.id);

  const participants = [
    {
      name: project.user.name || "Organizer",
      role: "Organizer",
      phone: project.user.phone,
      userId: project.user.id,
      contactId: null,
      consentConfirmed: true,
    },
    ...project.outreaches.map((outreach) => ({
      name: outreach.contact.name,
      role: outreach.contact.roles[0] || "Team member",
      phone: outreach.contact.phone,
      userId: null,
      contactId: outreach.contact.id,
      consentConfirmed: outreach.consentToGroupChat,
    })),
  ];

  for (const participant of participants) {
    if (!participant.consentConfirmed) {
      throw new Error(`Missing group chat consent for ${participant.phone}.`);
    }

    await db.groupChatParticipant.create({
      data: {
        groupChatId: updatedGroupChat.id,
        userId: participant.userId,
        contactId: participant.contactId,
        role: participant.role,
        phone: participant.phone,
        consentConfirmed: participant.consentConfirmed,
      },
    });

    await messagingProvider.addParticipant({
      conversationSid,
      phone: participant.phone,
    });
  }

  assertGroupChatStatusTransition(updatedGroupChat.status, "ACTIVE", {
    participantCount: participants.length,
  });
  const activeGroupChat = await db.groupChat.update({
    where: { id: updatedGroupChat.id },
    data: { status: "ACTIVE" },
  });
  await logWorkflowTransition({
    actorType: "ADMIN",
    action: "groupchat.status_transitioned",
    entityType: "GroupChat",
    entityId: activeGroupChat.id,
    fromStatus: updatedGroupChat.status,
    toStatus: "ACTIVE",
    metadata: { participantCount: participants.length },
  });
  assertProductionConversationStatusTransition(
    productionConversation.status,
    "ACTIVE",
    { participantCount: participants.length },
  );
  const activeProductionConversation = await db.productionConversation.update({
    where: { id: productionConversation.id },
    data: { status: "ACTIVE" },
  });
  await logWorkflowTransition({
    actorType: "ADMIN",
    action: "production_conversation.status_transitioned",
    entityType: "ProductionConversation",
    entityId: activeProductionConversation.id,
    fromStatus: productionConversation.status,
    toStatus: "ACTIVE",
    metadata: { groupChatId: activeGroupChat.id, participantCount: participants.length },
  });

  const kickoff = await generateGroupChatKickoff(project, participants);
  await logLlmFallbackUsed({
    operation: "generateGroupChatKickoff",
    entityType: "GroupChat",
    entityId: activeGroupChat.id,
    metadata: { projectBriefId: project.id },
  });
  await sendGroupSmsMessage({
    conversationSid,
    body: kickoff,
    projectBriefId: project.id,
    metadata: {
      generatedBy: "producerAgent",
      approvedBy: "admin",
      groupChatId: activeGroupChat.id,
      productionConversationId: activeProductionConversation.id,
    },
  });

  assertProjectBriefStatusTransition(project.status, "GROUPCHAT_ACTIVE");
  await db.projectBrief.update({
    where: { id: project.id },
    data: {
      status: "GROUPCHAT_ACTIVE",
    },
  });
  await logWorkflowTransition({
    actorType: "ADMIN",
    action: "project_brief.status_transitioned",
    entityType: "ProjectBrief",
    entityId: project.id,
    fromStatus: project.status,
    toStatus: "GROUPCHAT_ACTIVE",
    metadata: { groupChatId: activeGroupChat.id },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "groupchat.created",
    entityType: "GroupChat",
    entityId: activeGroupChat.id,
    metadata: {
      projectBriefId: project.id,
      twilioConversationSid: conversationSid,
      participantPhones: participants.map((participant) => participant.phone),
      mock: conversation.mock,
      messagingProvider: messagingProvider.name,
    },
  });

  return activeGroupChat;
}

export async function suggestAndCreateTasksFromGroupChat(groupChat: GroupChat) {
  const db = getDb();
  const project = await db.projectBrief.findUniqueOrThrow({
    where: { id: groupChat.projectBriefId },
  });
  const networkProject = await ensureProjectForProjectBrief(project.id);
  const productionConversation =
    groupChat.productionConversationId
      ? await db.productionConversation.findUnique({
          where: { id: groupChat.productionConversationId },
        })
      : await ensureProductionConversationForGroupChat(groupChat.id);
  const recentMessages = await db.message.findMany({
    where: {
      projectBriefId: project.id,
      channel: "GROUP_SMS",
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const suggestions = await suggestTasksFromGroupChat(
    project,
    recentMessages.reverse().map((message) => message.body),
  );
  await logLlmFallbackUsed({
    operation: "suggestTasksFromGroupChat",
    entityType: "GroupChat",
    entityId: groupChat.id,
    metadata: { projectBriefId: project.id },
  });

  if (suggestions.needsAdmin || suggestions.confidence < 0.4) {
    assertProjectBriefStatusTransition(project.status, "NEEDS_ADMIN");
    await db.projectBrief.update({
      where: { id: project.id },
      data: {
        previousStatus:
          project.status === "NEEDS_ADMIN" ? project.previousStatus : project.status,
        status: "NEEDS_ADMIN",
        escalationReason: "groupchat_task_suggestion_low_confidence",
        escalationFlags: ["groupchat_task_suggestion_low_confidence"],
        escalationResolvedAt: null,
      },
    });
    await logAudit({
      actorType: "LLM",
      action: "groupchat.task_suggestion_escalated",
      entityType: "GroupChat",
      entityId: groupChat.id,
      metadata: {
        confidence: suggestions.confidence,
        needsAdmin: suggestions.needsAdmin,
      },
    });
    return [];
  }

  const created = [];

  for (const task of suggestions.tasks) {
    const existing = await db.task.findFirst({
      where: {
        projectBriefId: project.id,
        groupChatId: groupChat.id,
        projectId: networkProject.id,
        productionConversationId: productionConversation?.id,
        title: task.title,
        status: { not: "DONE" },
      },
    });

    if (existing) continue;

    created.push(
      await db.task.create({
        data: {
          projectBriefId: project.id,
          groupChatId: groupChat.id,
          title: task.title,
          description: task.description || undefined,
          ownerName: task.ownerName || undefined,
          ownerPhone: task.ownerPhone
            ? normalizePhone(task.ownerPhone)
            : undefined,
          dueDate: parseDueDate(task.dueDate),
          status: "TODO",
        },
      }),
    );
  }

  if (created.length > 0) {
    await logAudit({
      actorType: "LLM",
      action: "tasks.suggested_from_groupchat",
      entityType: "GroupChat",
      entityId: groupChat.id,
      metadata: {
        taskIds: created.map((task) => task.id),
        confidence: suggestions.confidence,
      },
    });
  }

  return created;
}

export async function handleConversationMessageWebhook({
  conversationSid,
  messageSid,
  author,
  body,
  raw,
}: {
  conversationSid: string;
  messageSid?: string | null;
  author?: string | null;
  body: string;
  raw: Record<string, unknown>;
}) {
  const db = getDb();
  const groupChat = await db.groupChat.findUnique({
    where: { twilioConversationSid: conversationSid },
    include: {
      participants: true,
      projectBrief: true,
    },
  });

  if (!groupChat) return { handled: false };

  const normalizedAuthor =
    author && author.startsWith("+") ? normalizePhone(author) : author;
  const participant = groupChat.participants.find(
    (item) => item.phone === normalizedAuthor,
  );

  await createInboundMessage({
    body,
    channel: "GROUP_SMS",
    userId: participant?.userId,
    contactId: participant?.contactId,
    projectBriefId: groupChat.projectBriefId,
    twilioMessageSid: messageSid,
    metadata: {
      ...raw,
      conversationSid,
      author,
      groupChatId: groupChat.id,
    },
  });

  const safety = assessMessageSafety(body);
  if (safety.needsAdmin) {
    assertProjectBriefStatusTransition(groupChat.projectBrief.status, "NEEDS_ADMIN");
    await db.projectBrief.update({
      where: { id: groupChat.projectBriefId },
      data: {
        previousStatus:
          groupChat.projectBrief.status === "NEEDS_ADMIN"
            ? groupChat.projectBrief.previousStatus
            : groupChat.projectBrief.status,
        status: "NEEDS_ADMIN",
        escalationReason: "groupchat_message_safety",
        escalationFlags: safety.flags,
        escalationResolvedAt: null,
      },
    });
    await logAudit({
      actorType: participant?.contactId ? "CONTACT" : "USER",
      action: "groupchat.message_escalated",
      entityType: "GroupChat",
      entityId: groupChat.id,
      metadata: { flags: safety.flags, body },
    });
    return { handled: true, escalated: true };
  }

  const tasks = await suggestAndCreateTasksFromGroupChat(groupChat);
  return { handled: true, taskCount: tasks.length };
}

export async function sendTaskReminder(taskId: string) {
  const db = getDb();
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      projectBrief: {
        include: { user: true },
      },
      project: true,
      productionConversation: true,
      groupChat: true,
    },
  });

  const due = task.dueDate
    ? ` due ${task.dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`
    : "";
  const owner = task.ownerName ? `${task.ownerName}: ` : "";
  const body = `Quick Saga reminder - ${owner}${task.title}${due}. Reply with an update when you can.`;

  if (task.groupChat?.twilioConversationSid && task.groupChat.status === "ACTIVE") {
    await sendGroupSmsMessage({
      conversationSid: task.groupChat.twilioConversationSid,
      body,
      projectBriefId: task.projectBriefId,
      metadata: {
        generatedBy: "system",
        reminderForTaskId: task.id,
      },
    });
  } else if (task.ownerPhone) {
    await sendSmsMessage({
      to: task.ownerPhone,
      body,
      projectBriefId: task.projectBriefId,
      provider: task.productionConversation?.provider === "MOCK" ? "MOCK" : undefined,
      metadata: {
        generatedBy: "system",
        reminderForTaskId: task.id,
      },
    });
  } else if (task.projectBrief && !task.projectBrief.user.smsOptedOutAt) {
    await sendSmsMessage({
      to: task.projectBrief.user.phone,
      body,
      userId: task.projectBrief.userId,
      projectBriefId: task.projectBriefId,
      metadata: {
        generatedBy: "system",
        reminderForTaskId: task.id,
      },
    });
  }

  await logAudit({
    actorType: "ADMIN",
    action: "task.reminder_sent",
    entityType: "Task",
    entityId: task.id,
    metadata: {},
  });
}

export function parseTaskStatus(value: FormDataEntryValue | null): TaskStatus {
  const status = String(value || "TODO");
  if (["TODO", "IN_PROGRESS", "DONE", "BLOCKED"].includes(status)) {
    return status as TaskStatus;
  }
  return "TODO";
}
