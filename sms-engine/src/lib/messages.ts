import type { MessageChannel, MessageDirection, Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getAppEnv } from "@/lib/env";
import {
  getMessagingProvider,
  type MessagingProviderName,
} from "@/lib/messagingProvider";
import { logStructuredEvent } from "@/lib/safeLogging";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function metadataObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function jsonMetadata(value: unknown) {
  return toJson(value);
}

function statusCallbackUrl() {
  try {
    const { APP_BASE_URL } = getAppEnv();
    return `${APP_BASE_URL.replace(/\/$/, "")}/api/twilio/status`;
  } catch {
    return undefined;
  }
}

export async function createInboundMessage({
  body,
  channel,
  userId,
  projectBriefId,
  contactId,
  twilioMessageSid,
  metadata,
}: {
  body: string;
  channel: MessageChannel;
  userId?: string | null;
  projectBriefId?: string | null;
  contactId?: string | null;
  twilioMessageSid?: string | null;
  metadata?: unknown;
}) {
  const data = {
    body,
    direction: "INBOUND" as MessageDirection,
    channel,
    userId,
    projectBriefId,
    contactId,
    twilioMessageSid,
    metadata: toJson(metadata),
  };

  const message = twilioMessageSid
    ? await getDb().message.upsert({
      where: { twilioMessageSid },
      update: data,
      create: data,
    })
    : await getDb().message.create({ data });

  if (twilioMessageSid) {
    const eventMetadata = {
      channel,
      userId,
      projectBriefId,
      contactId,
      twilioMessageSid,
      providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
    };

    logStructuredEvent({
      action: "message.inbound_persisted",
      entityType: "Message",
      entityId: message.id,
      status: "persisted",
      result: "success",
      metadata: eventMetadata,
    });

    await logAudit({
      actorType: "SYSTEM",
      action: "message.inbound_persisted",
      entityType: "Message",
      entityId: message.id,
      metadata: eventMetadata,
    });
  }

  return message;
}

export async function messageExistsForTwilioSid(twilioMessageSid?: string | null) {
  if (!twilioMessageSid) return false;
  const existing = await getDb().message.findUnique({
    where: { twilioMessageSid },
    select: { id: true },
  });
  return Boolean(existing);
}

export function shouldSkipDuplicateTwilioMessageSid({
  twilioMessageSid,
  exists,
}: {
  twilioMessageSid?: string | null;
  exists: boolean;
}) {
  return Boolean(twilioMessageSid && exists);
}

export async function sendSmsMessage({
  to,
  body,
  userId,
  projectBriefId,
  contactId,
  metadata = {},
  provider,
}: {
  to: string;
  body: string;
  userId?: string | null;
  projectBriefId?: string | null;
  contactId?: string | null;
  metadata?: Record<string, unknown>;
  provider?: MessagingProviderName;
}) {
  const db = getDb();
  const messagingProvider = getMessagingProvider(provider);
  const message = await db.message.create({
    data: {
      body,
      direction: "OUTBOUND",
      channel: "SMS",
      userId,
      projectBriefId,
      contactId,
      metadata: toJson(metadata),
    },
  });

  try {
    const result = await messagingProvider.sendMessage({
      to,
      body,
      statusCallback: statusCallbackUrl(),
    });

    const updated = await db.message.update({
      where: { id: message.id },
      data: {
        twilioMessageSid: result.sid,
        metadata: toJson({
          ...metadata,
          provider: result.provider,
          mock: result.mock,
          messagingProvider: messagingProvider.name,
          blocked: result.blocked || false,
          blockReason: result.blockReason,
          allowedNumbersCount: result.allowedNumbersCount,
        }),
      },
    });
    const inboundTwilioMessageSid =
      typeof metadata.inboundTwilioMessageSid === "string"
        ? metadata.inboundTwilioMessageSid
        : undefined;
    await logAudit({
      actorType: "SYSTEM",
      action: result.blocked ? "message.send_blocked" : "message.sent",
      entityType: "Message",
      entityId: updated.id,
      metadata: {
        provider: result.provider,
        mock: result.mock,
        messagingProvider: messagingProvider.name,
        blocked: result.blocked || false,
        blockReason: result.blockReason,
        allowedNumbersCount: result.allowedNumbersCount,
        inboundTwilioMessageSid,
        to,
        projectBriefId,
      },
    });
    if (result.blocked) {
      logStructuredEvent({
        level: "warn",
        action: "message.send_blocked",
        entityType: "Message",
        entityId: updated.id,
        status: "blocked",
        result: "success",
        metadata: {
          provider: result.provider,
          messagingProvider: messagingProvider.name,
          blockReason: result.blockReason,
          allowedNumbersCount: result.allowedNumbersCount,
          inboundTwilioMessageSid,
          to,
          projectBriefId,
        },
      });
    }
    return updated;
  } catch (error) {
    await db.message.update({
      where: { id: message.id },
      data: {
        metadata: toJson({
          ...metadata,
          sendError: error instanceof Error ? error.message : "Unknown error",
        }),
      },
    });
    await logAudit({
      actorType: "SYSTEM",
      action: "message.send_failed",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        to,
        projectBriefId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function retryOutboundMessage(messageId: string) {
  const db = getDb();
  const message = await db.message.findUniqueOrThrow({
    where: { id: messageId },
    include: {
      user: true,
      contact: true,
    },
  });

  if (message.direction !== "OUTBOUND" || message.channel !== "SMS") {
    throw new Error("Only outbound SMS messages can be retried here.");
  }

  const to = message.contact?.phone || message.user?.phone;
  if (!to) throw new Error("No recipient phone number found for retry.");
  if (message.contact?.smsOptedOutAt || message.user?.smsOptedOutAt) {
    throw new Error("Recipient has opted out.");
  }

  const metadata = {
    ...metadataObject(message.metadata),
    retryOfMessageId: message.id,
    retryAt: new Date().toISOString(),
  };

  const retried = await sendSmsMessage({
    to,
    body: message.body,
    userId: message.userId,
    contactId: message.contactId,
    projectBriefId: message.projectBriefId,
    metadata,
  });

  await db.message.update({
    where: { id: message.id },
    data: {
      metadata: jsonMetadata({
        ...metadataObject(message.metadata),
        retriedByMessageId: retried.id,
      }),
    },
  });

  return retried;
}

export async function sendGroupSmsMessage({
  conversationSid,
  body,
  projectBriefId,
  metadata = {},
  provider,
}: {
  conversationSid: string;
  body: string;
  projectBriefId?: string | null;
  metadata?: Record<string, unknown>;
  provider?: MessagingProviderName;
}) {
  const db = getDb();
  const messagingProvider = getMessagingProvider(provider);
  const message = await db.message.create({
    data: {
      body,
      direction: "OUTBOUND",
      channel: "GROUP_SMS",
      projectBriefId,
      metadata: toJson({
        ...metadata,
        conversationSid,
      }),
    },
  });

  try {
    const result = await messagingProvider.sendConversationMessage({
      conversationSid,
      body,
    });

    const updated = await db.message.update({
      where: { id: message.id },
      data: {
        twilioMessageSid: result.sid,
        metadata: toJson({
          ...metadata,
          conversationSid,
          mock: result.mock,
          provider: result.provider,
          messagingProvider: messagingProvider.name,
          blocked: result.blocked || false,
          blockReason: result.blockReason,
          allowedNumbersCount: result.allowedNumbersCount,
        }),
      },
    });
    await logAudit({
      actorType: "SYSTEM",
      action: result.blocked ? "message.send_blocked" : "message.sent",
      entityType: "Message",
      entityId: updated.id,
      metadata: {
        channel: "GROUP_SMS",
        conversationSid,
        mock: result.mock,
        provider: result.provider,
        messagingProvider: messagingProvider.name,
        blocked: result.blocked || false,
        blockReason: result.blockReason,
        allowedNumbersCount: result.allowedNumbersCount,
        projectBriefId,
      },
    });
    return updated;
  } catch (error) {
    await db.message.update({
      where: { id: message.id },
      data: {
        metadata: toJson({
          ...metadata,
          conversationSid,
          sendError: error instanceof Error ? error.message : "Unknown error",
        }),
      },
    });
    await logAudit({
      actorType: "SYSTEM",
      action: "message.send_failed",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        conversationSid,
        projectBriefId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
