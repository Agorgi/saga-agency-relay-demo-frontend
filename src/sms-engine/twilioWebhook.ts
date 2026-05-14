import twilio from "twilio";
import { logAudit } from "@/sms-engine/audit";
import { shouldValidateTwilioWebhooks } from "@/sms-engine/env";

function hasTwilioWebhookConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN,
  );
}

export function formDataToRecord(formData: FormData) {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value.name,
    ]),
  );
}

function canonicalWebhookUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const baseUrl =
    process.env.APP_BASE_URL ||
    `${request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "")}://${request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host}`;
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${requestUrl.pathname}${requestUrl.search}`;
}

export async function validateTwilioWebhookRequest({
  request,
  payload,
  route,
}: {
  request: Request;
  payload: Record<string, string>;
  route: string;
}) {
  if (!hasTwilioWebhookConfig()) {
    await logAudit({
      actorType: "SYSTEM",
      action: "twilio.webhook_unconfigured",
      entityType: "Webhook",
      entityId: route,
      metadata: {
        route,
        provider: process.env.MESSAGING_PROVIDER || null,
      },
    });
    return false;
  }

  if (!shouldValidateTwilioWebhooks()) {
    return true;
  }

  const signature = request.headers.get("x-twilio-signature") || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";

  if (!signature || !authToken) {
    await logAudit({
      actorType: "SYSTEM",
      action: "twilio.webhook_signature_missing",
      entityType: "Webhook",
      entityId: route,
      metadata: {
        route,
        hasSignature: Boolean(signature),
        hasAuthToken: Boolean(authToken),
      },
    });
    return false;
  }

  const ok = twilio.validateRequest(
    authToken,
    signature,
    canonicalWebhookUrl(request),
    payload,
  );

  if (!ok) {
    await logAudit({
      actorType: "SYSTEM",
      action: "twilio.webhook_signature_failed",
      entityType: "Webhook",
      entityId: route,
      metadata: {
        route,
        url: canonicalWebhookUrl(request),
        from: payload.From || payload.Author || null,
        messageSid: payload.MessageSid || payload.SmsMessageSid || null,
      },
    });
  }

  return ok;
}

export function forbiddenTwilioResponse() {
  return new Response("Forbidden", { status: 403 });
}
