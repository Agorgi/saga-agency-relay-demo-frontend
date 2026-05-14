import { handleConversationMessageWebhook } from "@/sms-engine/groupChat";
import {
  messageExistsForTwilioSid,
  shouldSkipDuplicateTwilioMessageSid,
} from "@/sms-engine/messages";
import { logServerError } from "@/sms-engine/safeLogging";
import {
  forbiddenTwilioResponse,
  formDataToRecord,
  validateTwilioWebhookRequest,
} from "@/sms-engine/twilioWebhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = formDataToRecord(await request.formData());
  const eventType = payload.EventType || payload.EventTypeName;
  const conversationSid = payload.ConversationSid;
  const body = payload.Body || "";
  const author = payload.Author || payload.Identity;
  const messageSid = payload.MessageSid || payload.EventSid || null;

  if (!conversationSid) {
    return Response.json({ ok: false, error: "Missing ConversationSid" }, { status: 400 });
  }

  const valid = await validateTwilioWebhookRequest({
    request,
    payload,
    route: "/api/twilio/conversations-webhook",
  });
  if (!valid) return forbiddenTwilioResponse();

  if (author === "Saga" || !body || (eventType && eventType !== "onMessageAdded")) {
    return Response.json({ ok: true, ignored: true });
  }

  if (
    shouldSkipDuplicateTwilioMessageSid({
      twilioMessageSid: messageSid,
      exists: messageSid ? await messageExistsForTwilioSid(messageSid) : false,
    })
  ) {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    const result = await handleConversationMessageWebhook({
      conversationSid,
      messageSid,
      author,
      body,
      raw: payload,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    logServerError("Twilio Conversations webhook failed", error);
    return Response.json(
      {
        ok: false,
        error: "Webhook failed",
      },
      { status: 500 },
    );
  }
}
