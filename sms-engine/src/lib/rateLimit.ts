import type { Contact, ProjectBrief, User } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { sendSmsMessage } from "@/lib/messages";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function throttlingReply() {
  return "I got a lot of messages quickly, so I'm going to slow this thread down and have a human on the Saga team review before continuing.";
}

async function inboundCount(where: {
  userId?: string;
  contactId?: string;
  since: Date;
}) {
  return getDb().message.count({
    where: {
      direction: "INBOUND",
      channel: "SMS",
      createdAt: { gte: where.since },
      ...(where.userId ? { userId: where.userId } : {}),
      ...(where.contactId ? { contactId: where.contactId } : {}),
    },
  });
}

async function evaluateCounts({
  userId,
  contactId,
}: {
  userId?: string;
  contactId?: string;
}) {
  const now = Date.now();
  const [tenMinuteCount, dayCount] = await Promise.all([
    inboundCount({
      userId,
      contactId,
      since: new Date(now - TEN_MINUTES_MS),
    }),
    inboundCount({
      userId,
      contactId,
      since: new Date(now - ONE_DAY_MS),
    }),
  ]);

  return {
    exceeded: isInboundRateLimited({ tenMinuteCount, dayCount }),
    tenMinuteCount,
    dayCount,
  };
}

export function isInboundRateLimited({
  tenMinuteCount,
  dayCount,
}: {
  tenMinuteCount: number;
  dayCount: number;
}) {
  return tenMinuteCount > 10 || dayCount > 30;
}

export async function enforceOrganizerRateLimit({
  user,
  projectBrief,
}: {
  user: User;
  projectBrief: ProjectBrief;
}) {
  const result = await evaluateCounts({ userId: user.id });
  if (!result.exceeded) return { limited: false as const, ...result };

  await getDb().projectBrief.update({
    where: { id: projectBrief.id },
    data: {
      previousStatus:
        projectBrief.status === "NEEDS_ADMIN" ? projectBrief.previousStatus : projectBrief.status,
      status: "NEEDS_ADMIN",
      escalationReason: "rate_limit",
      escalationFlags: ["rate_limit"],
      adminNotes: projectBrief.adminNotes
        ? `${projectBrief.adminNotes}\nRate limit exceeded: ${result.tenMinuteCount}/10min, ${result.dayCount}/day`
        : `Rate limit exceeded: ${result.tenMinuteCount}/10min, ${result.dayCount}/day`,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "rate_limit.exceeded",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    metadata: {
      userId: user.id,
      phone: user.phone,
      tenMinuteCount: result.tenMinuteCount,
      dayCount: result.dayCount,
    },
  });

  if (!user.smsOptedOutAt) {
    await sendSmsMessage({
      to: user.phone,
      body: throttlingReply(),
      userId: user.id,
      projectBriefId: projectBrief.id,
      metadata: {
        generatedBy: "system",
        reason: "rate_limit",
      },
    });
  }

  return { limited: true as const, ...result };
}

export async function enforceContactRateLimit({
  contact,
  projectBriefId,
}: {
  contact: Contact;
  projectBriefId: string;
}) {
  const result = await evaluateCounts({ contactId: contact.id });
  if (!result.exceeded) return { limited: false as const, ...result };

  await getDb().projectBrief.update({
    where: { id: projectBriefId },
    data: {
      status: "NEEDS_ADMIN",
      escalationReason: "contact_rate_limit",
      escalationFlags: ["rate_limit"],
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "rate_limit.exceeded",
    entityType: "Contact",
    entityId: contact.id,
    metadata: {
      projectBriefId,
      phone: contact.phone,
      tenMinuteCount: result.tenMinuteCount,
      dayCount: result.dayCount,
    },
  });

  if (!contact.smsOptedOutAt) {
    await sendSmsMessage({
      to: contact.phone,
      body: throttlingReply(),
      contactId: contact.id,
      projectBriefId,
      metadata: {
        generatedBy: "system",
        reason: "rate_limit",
      },
    });
  }

  return { limited: true as const, ...result };
}
