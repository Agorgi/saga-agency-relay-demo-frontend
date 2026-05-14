import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { logServerError } from "@/lib/safeLogging";
import {
  forbiddenTwilioResponse,
  formDataToRecord,
  validateTwilioWebhookRequest,
} from "@/lib/twilioWebhook";

export const runtime = "nodejs";

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const payload = formDataToRecord(await request.formData());
    const valid = await validateTwilioWebhookRequest({
      request,
      payload,
      route: "/api/twilio/status",
    });
    if (!valid) return forbiddenTwilioResponse();

    const sid = payload.MessageSid || payload.SmsSid;

    if (!sid) {
      return Response.json(
        { ok: false, error: "Missing MessageSid" },
        { status: 400 },
      );
    }

    const db = getDb();
    const message = await db.message.findUnique({
      where: { twilioMessageSid: sid },
    });

    if (!message) {
      await logAudit({
        actorType: "SYSTEM",
        action: "twilio.status_unmatched",
        entityType: "Message",
        entityId: sid,
        metadata: payload,
      });

      return Response.json({ ok: true, matched: false });
    }

    await db.message.update({
      where: { id: message.id },
      data: {
        metadata: {
          ...jsonObject(message.metadata),
          twilioStatus: payload.MessageStatus || payload.SmsStatus,
          twilioErrorCode: payload.ErrorCode || null,
          twilioErrorMessage: payload.ErrorMessage || null,
          twilioStatusRaw: payload,
          providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
        },
      },
    });

    await logAudit({
      actorType: "SYSTEM",
      action: "twilio.status_updated",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        twilioStatus: payload.MessageStatus || payload.SmsStatus,
        twilioErrorCode: payload.ErrorCode || null,
        providerMode: process.env.MESSAGING_PROVIDER || "MOCK",
      },
    });

    return Response.json({ ok: true, matched: true });
  } catch (error) {
    logServerError("Twilio status webhook failed", error);
    return Response.json(
      {
        ok: false,
        error: "Webhook failed.",
      },
      { status: 500 },
    );
  }
}
