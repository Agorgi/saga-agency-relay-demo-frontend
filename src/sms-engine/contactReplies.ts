import type { Contact, Outreach, ProjectStatus } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { createInboundMessage, sendSmsMessage } from "@/sms-engine/messages";
import { maybeMarkShortlistReady } from "@/sms-engine/outreach";
import { isStartMessage, isStopMessage, normalizePhone } from "@/sms-engine/phone";
import { enforceContactRateLimit } from "@/sms-engine/rateLimit";
import {
  assessMessageSafety,
  escalationHoldingReply,
  optInReply,
  optOutReply,
} from "@/sms-engine/safety";
import {
  assertOutreachStatusTransition,
  assertProjectBriefStatusTransition,
  logWorkflowTransition,
} from "@/sms-engine/workflowStateMachine";

type OutreachWithProject = Outreach & {
  contact: Contact;
  projectBrief: {
    id: string;
    status: ProjectStatus;
    previousStatus: ProjectStatus | null;
    adminNotes: string | null;
  };
};

export function detectContactReplyIntent(body: string) {
  const text = body.trim().toLowerCase();

  if (/\b(no|nope|not interested|pass|can't|cannot|do not|don't)\b/.test(text)) {
    return "NO";
  }

  if (/\b(yes|yeah|yep|sure|happy to|interested|open to|sounds good|ok|okay|introduce|add me)\b/.test(text)) {
    return "YES";
  }

  if (/\b(maybe|possibly|depends|send info|more info|not sure)\b/.test(text)) {
    return "MAYBE";
  }

  return "UNKNOWN";
}

export function classifyOutreachReplyState({
  currentStatus,
  consentToGroupChat,
  body,
}: {
  currentStatus: Outreach["status"];
  consentToGroupChat: boolean;
  body: string;
}) {
  const intent = detectContactReplyIntent(body);
  let reply =
    "Thanks - I've got your response. A human on the Saga side will review the next step.";
  let status = currentStatus;
  let nextConsentToGroupChat = consentToGroupChat;
  let unclearNeedsAdmin = false;

  if (currentStatus === "INTERESTED") {
    if (intent === "YES") {
      status = "APPROVED_FOR_GROUPCHAT";
      nextConsentToGroupChat = true;
      reply =
        "Perfect - I'll only add you once the organizer-side group is ready and everyone else has confirmed.";
    } else if (intent === "NO") {
      status = "NOT_INTERESTED";
      reply = "Understood - I won't add you to the group text.";
    } else {
      reply =
        "Just to confirm: can I introduce you in a group text with the organizer and a few other team members for this project?";
    }
  } else if (intent === "YES") {
    status = "INTERESTED";
    reply =
      "Amazing - can I introduce you in a group text with the organizer and a few other team members for this project?";
  } else if (intent === "NO") {
    status = "NOT_INTERESTED";
    reply = "All good - thanks for letting me know. I won't follow up on this project.";
  } else if (intent === "MAYBE") {
    status = "MAYBE";
    reply =
      "Totally fair. I'll mark you as maybe for now, and a human on the Saga side can follow up with more context.";
  } else {
    status = "MAYBE";
    unclearNeedsAdmin = true;
    reply =
      "Thanks - I'll mark this for human review so we don't over-assume your availability or interest.";
  }

  return {
    intent,
    reply,
    status,
    consentToGroupChat: nextConsentToGroupChat,
    unclearNeedsAdmin,
  };
}

export async function findActiveOutreachForPhone(phone: string) {
  const contact = await getDb().contact.findUnique({
    where: { phone },
  });

  if (!contact) return null;

  const outreach = await getDb().outreach.findFirst({
    where: {
      contactId: contact.id,
      status: {
        in: ["SENT", "INTERESTED", "MAYBE", "NO_RESPONSE"],
      },
    },
    include: {
      contact: true,
      projectBrief: {
        select: {
          id: true,
          status: true,
          previousStatus: true,
          adminNotes: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return outreach as OutreachWithProject | null;
}

export async function handleContactInbound({
  from,
  body,
  twilioMessageSid,
  metadata,
}: {
  from: string;
  body: string;
  twilioMessageSid?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const phone = normalizePhone(from);
  const activeOutreach = await findActiveOutreachForPhone(phone);

  if (!activeOutreach) {
    const existingContact = await getDb().contact.findUnique({
      where: { phone },
    });

    if (existingContact && isStopMessage(body)) {
      const optedOutBeforeInbound = Boolean(existingContact.smsOptedOutAt);
      await getDb().contact.update({
        where: { id: existingContact.id },
        data: { smsOptedOutAt: new Date() },
      });
      await createInboundMessage({
        body,
        channel: "SMS",
        contactId: existingContact.id,
        twilioMessageSid,
        metadata: {
          ...metadata,
          optOut: true,
          noActiveOutreach: true,
          optedOutBeforeInbound,
          replyBlocked: true,
          blockReason: "opted_out",
        },
      });
      await logAudit({
        actorType: "CONTACT",
        action: "sms.opted_out",
        entityType: "Contact",
        entityId: existingContact.id,
        metadata: { phone, noActiveOutreach: true },
      });
      return {
        handled: true,
        reply: optOutReply(),
        sent: false,
        optedOut: true,
        optedOutBeforeInbound,
        replyBlocked: true,
        blockReason: "opted_out",
      };
    }

    if (
      existingContact &&
      isStartMessage(body) &&
      existingContact.smsOptedOutAt
    ) {
      const updatedContact = await getDb().contact.update({
        where: { id: existingContact.id },
        data: { smsOptedOutAt: null },
      });
      await createInboundMessage({
        body,
        channel: "SMS",
        contactId: updatedContact.id,
        twilioMessageSid,
        metadata: {
          ...metadata,
          optIn: true,
          noActiveOutreach: true,
          optedOutBeforeInbound: true,
        },
      });
      await logAudit({
        actorType: "CONTACT",
        action: "sms.opted_in",
        entityType: "Contact",
        entityId: updatedContact.id,
        metadata: { phone, noActiveOutreach: true },
      });
      const reply = optInReply();
      await sendSmsMessage({
        to: updatedContact.phone,
        body: reply,
        contactId: updatedContact.id,
        metadata: {
          generatedBy: "system",
          reason: "opt_in",
          inboundTwilioMessageSid: twilioMessageSid,
        },
      });
      return {
        handled: true,
        reply,
        sent: true,
        optedOut: false,
        optedOutBeforeInbound: true,
        replyBlocked: false,
        blockReason: null,
      };
    }

    if (existingContact?.smsOptedOutAt) {
      await createInboundMessage({
        body,
        channel: "SMS",
        contactId: existingContact.id,
        twilioMessageSid,
        metadata: {
          ...metadata,
          noActiveOutreach: true,
          optedOutBeforeInbound: true,
          replyBlocked: true,
          blockReason: "opted_out",
        },
      });

      return {
        handled: true,
        reply: null,
        sent: false,
        optedOut: true,
        optedOutBeforeInbound: true,
        replyBlocked: true,
        blockReason: "opted_out",
      };
    }

    return {
      handled: false,
      sent: false,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: false,
      blockReason: null,
    };
  }

  const { contact, projectBrief } = activeOutreach;

  if (isStopMessage(body)) {
    const optedOutBeforeInbound = Boolean(contact.smsOptedOutAt);
    await getDb().contact.update({
      where: { id: contact.id },
      data: { smsOptedOutAt: new Date() },
    });

    await createInboundMessage({
      body,
      channel: "SMS",
      contactId: contact.id,
      projectBriefId: projectBrief.id,
      twilioMessageSid,
      metadata: {
        ...metadata,
        optOut: true,
        optedOutBeforeInbound,
        replyBlocked: true,
        blockReason: "opted_out",
      },
    });

    await logAudit({
      actorType: "CONTACT",
      action: "sms.opted_out",
      entityType: "Contact",
      entityId: contact.id,
      metadata: { phone },
    });

    return {
      handled: true,
      reply: optOutReply(),
      sent: false,
      optedOut: true,
      optedOutBeforeInbound,
      replyBlocked: true,
      blockReason: "opted_out",
    };
  }

  if (isStartMessage(body) && contact.smsOptedOutAt) {
    const updatedContact = await getDb().contact.update({
      where: { id: contact.id },
      data: { smsOptedOutAt: null },
    });

    await createInboundMessage({
      body,
      channel: "SMS",
      contactId: contact.id,
      projectBriefId: projectBrief.id,
      twilioMessageSid,
      metadata: {
        ...metadata,
        optIn: true,
        optedOutBeforeInbound: true,
      },
    });

    await logAudit({
      actorType: "CONTACT",
      action: "sms.opted_in",
      entityType: "Contact",
      entityId: contact.id,
      metadata: { phone },
    });

    const reply = optInReply();
    await sendSmsMessage({
      to: updatedContact.phone,
      body: reply,
      contactId: updatedContact.id,
      projectBriefId: projectBrief.id,
      metadata: {
        generatedBy: "system",
        reason: "opt_in",
        inboundTwilioMessageSid: twilioMessageSid,
      },
    });

    return {
      handled: true,
      reply,
      sent: true,
      optedOut: false,
      optedOutBeforeInbound: true,
      replyBlocked: false,
      blockReason: null,
    };
  }

  await createInboundMessage({
    body,
    channel: "SMS",
    contactId: contact.id,
    projectBriefId: projectBrief.id,
    twilioMessageSid,
    metadata: {
      ...(metadata || {}),
      optedOutBeforeInbound: Boolean(contact.smsOptedOutAt),
      replyBlocked: Boolean(contact.smsOptedOutAt),
      blockReason: contact.smsOptedOutAt ? "opted_out" : undefined,
    },
  });

  if (contact.smsOptedOutAt) {
    return {
      handled: true,
      reply: null,
      sent: false,
      optedOut: true,
      optedOutBeforeInbound: true,
      replyBlocked: true,
      blockReason: "opted_out",
    };
  }

  const rateLimit = await enforceContactRateLimit({
    contact,
    projectBriefId: projectBrief.id,
  });
  if (rateLimit.limited) {
    return {
      handled: true,
      reply: null,
      sent: false,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: true,
      blockReason: "rate_limit",
    };
  }

  const safety = assessMessageSafety(body);
  if (safety.needsAdmin) {
    assertProjectBriefStatusTransition(projectBrief.status, "NEEDS_ADMIN");
    await getDb().projectBrief.update({
      where: { id: projectBrief.id },
      data: {
        previousStatus:
          projectBrief.status === "NEEDS_ADMIN"
            ? projectBrief.previousStatus
            : projectBrief.status,
        status: "NEEDS_ADMIN",
        escalationReason: "contact_safety_escalation",
        escalationFlags: safety.flags,
        escalationResolvedAt: null,
        adminNotes: projectBrief.adminNotes
          ? `${projectBrief.adminNotes}\nContact escalation from ${contact.name}: ${safety.flags.join(", ")}`
          : `Contact escalation from ${contact.name}: ${safety.flags.join(", ")}`,
      },
    });

    await logAudit({
      actorType: "CONTACT",
      action: "contact_reply.escalated",
      entityType: "Outreach",
      entityId: activeOutreach.id,
      metadata: { flags: safety.flags, body },
    });

    const reply = escalationHoldingReply();
    if (!contact.smsOptedOutAt) {
      await sendSmsMessage({
        to: phone,
        body: reply,
        contactId: contact.id,
        projectBriefId: projectBrief.id,
        metadata: {
          generatedBy: "system",
          reason: "contact_safety_escalation",
          inboundTwilioMessageSid: twilioMessageSid,
        },
      });
    }

    return {
      handled: true,
      reply,
      sent: true,
      optedOut: false,
      optedOutBeforeInbound: false,
      replyBlocked: false,
      blockReason: null,
    };
  }

  const {
    intent,
    reply,
    status,
    consentToGroupChat,
    unclearNeedsAdmin,
  } = classifyOutreachReplyState({
    currentStatus: activeOutreach.status,
    consentToGroupChat: activeOutreach.consentToGroupChat,
    body,
  });

  assertOutreachStatusTransition(activeOutreach.status, status, {
    hasConsent: consentToGroupChat,
  });
  const updated = await getDb().outreach.update({
    where: { id: activeOutreach.id },
    data: {
      status,
      consentToGroupChat,
      lastResponse: body,
    },
  });
  await logWorkflowTransition({
    actorType: "CONTACT",
    action: "outreach.status_transitioned",
    entityType: "Outreach",
    entityId: updated.id,
    fromStatus: activeOutreach.status,
    toStatus: status,
    metadata: {
      consentToGroupChat,
      intent,
    },
  });

  await logAudit({
    actorType: "CONTACT",
    action: "contact_reply.updated_outreach",
    entityType: "Outreach",
    entityId: updated.id,
    metadata: {
      previousStatus: activeOutreach.status,
      nextStatus: status,
      consentToGroupChat,
      intent,
    },
  });

  if (unclearNeedsAdmin) {
    assertProjectBriefStatusTransition(projectBrief.status, "NEEDS_ADMIN");
    await getDb().projectBrief.update({
      where: { id: projectBrief.id },
      data: {
        previousStatus:
          projectBrief.status === "NEEDS_ADMIN"
            ? projectBrief.previousStatus
            : projectBrief.status,
        status: "NEEDS_ADMIN",
        escalationReason: "unclear_contact_reply",
        escalationFlags: ["unclear_contact_reply"],
        escalationResolvedAt: null,
      },
    });

    await logAudit({
      actorType: "CONTACT",
      action: "contact_reply.needs_admin",
      entityType: "Outreach",
      entityId: updated.id,
      metadata: {
        body,
        intent,
      },
    });
  }

  if (status === "INTERESTED" || status === "APPROVED_FOR_GROUPCHAT") {
    await maybeMarkShortlistReady(projectBrief.id);
  }

  if (!contact.smsOptedOutAt) {
    await sendSmsMessage({
      to: phone,
      body: reply,
      contactId: contact.id,
      projectBriefId: projectBrief.id,
      metadata: {
        generatedBy: "system",
        intent,
        outreachStatus: status,
        inboundTwilioMessageSid: twilioMessageSid,
      },
    });
  }

  return {
    handled: true,
    reply,
    sent: !contact.smsOptedOutAt,
    optedOut: Boolean(contact.smsOptedOutAt),
    optedOutBeforeInbound: Boolean(contact.smsOptedOutAt),
    replyBlocked: Boolean(contact.smsOptedOutAt),
    blockReason: contact.smsOptedOutAt ? "opted_out" : null,
  };
}
