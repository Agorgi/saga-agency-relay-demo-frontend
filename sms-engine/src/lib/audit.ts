import type { AuditActorType, AuditLog, Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { logServerError, redactForLog } from "@/lib/safeLogging";

type AuditMetadata = unknown;

const PRIVATE_AUDIT_KEY_PATTERN =
  /(phone|email|body|message|draftedMessage|sentMessage|notes|adminNotes|internalNotes|rateNotes|availabilityNotes|password|token|secret|api[_-]?key|auth|account[_-]?sid|accountSid)/i;

function shouldRedactAuditKey(key: string) {
  if (/^(phoneHash|redactedPhone)$/i.test(key)) {
    return false;
  }

  if (
    /^(twilioMessageSid|inboundTwilioMessageSid|messageSid|smsMessageSid|smsSid)$/i.test(
      key,
    )
  ) {
    return false;
  }

  return PRIVATE_AUDIT_KEY_PATTERN.test(key);
}

export function sanitizeAuditMetadata(value: unknown, depth = 0): Prisma.JsonValue {
  if (depth > 5) return "[redacted-depth]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return redactForLog(value) as string;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        shouldRedactAuditKey(key)
          ? "[redacted]"
          : sanitizeAuditMetadata(item, depth + 1),
      ]),
    );
  }
  return "[redacted]";
}

export async function logAudit({
  actorType,
  action,
  entityType,
  entityId,
  metadata = {},
}: {
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: AuditMetadata;
}) {
  if (!process.env.DATABASE_URL) return;

  try {
    const safeMetadata = sanitizeAuditMetadata(metadata) as Prisma.InputJsonValue;
    await getDb().auditLog.create({
      data: {
        actorType,
        action,
        entityType,
        entityId,
        metadata: safeMetadata,
      },
    });
  } catch (error) {
    logServerError("Failed to write audit log", error, {
      entityType,
      entityId,
      metadata: { auditAction: action },
    });
  }
}

export function safeAuditLogForDisplay(log: AuditLog) {
  return {
    id: log.id,
    actorType: log.actorType,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: sanitizeAuditMetadata(log.metadata),
    createdAt: log.createdAt,
  };
}
