import twilio from "twilio";
import { getTwilioEnv } from "@/lib/env";

type TwilioClient = ReturnType<typeof twilio>;

let cachedClient: TwilioClient | null = null;

function assertTwilioApiCallsAllowed() {
  if (process.env.TWILIO_API_CALLS_FORBIDDEN === "true") {
    throw new Error(
      "Twilio API call guard triggered: a real provider call would have been attempted.",
    );
  }
}

function hasTwilioSmsConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID ||
        process.env.TWILIO_PHONE_NUMBER),
  );
}

function hasTwilioConversationConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_CONVERSATIONS_SERVICE_SID &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

export function getTwilioClient() {
  assertTwilioApiCallsAllowed();

  if (!cachedClient) {
    const env = getTwilioEnv();
    cachedClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  return cachedClient;
}

export async function sendSmsViaTwilio({
  to,
  body,
  statusCallback,
}: {
  to: string;
  body: string;
  statusCallback?: string;
}) {
  if (!hasTwilioSmsConfig()) {
    return {
      sid: null,
      mock: true,
      provider: "twilio",
    };
  }

  const env = getTwilioEnv();
  const client = getTwilioClient();
  const message = await client.messages.create({
    to,
    body,
    ...(env.TWILIO_MESSAGING_SERVICE_SID
      ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID }
      : { from: env.TWILIO_PHONE_NUMBER }),
    ...(statusCallback ? { statusCallback } : {}),
  });

  return {
    sid: message.sid,
    mock: false,
    provider: "twilio",
  };
}

export async function createTwilioConversation({
  friendlyName,
}: {
  friendlyName: string;
}) {
  if (!hasTwilioConversationConfig()) {
    return {
      sid: `mock-conversation-${crypto.randomUUID()}`,
      mock: true,
      provider: "twilio-conversations",
    };
  }

  const env = getTwilioEnv();
  const conversation = await getTwilioClient()
    .conversations.v1.services(env.TWILIO_CONVERSATIONS_SERVICE_SID)
    .conversations.create({ friendlyName });

  return {
    sid: conversation.sid,
    mock: false,
    provider: "twilio-conversations",
  };
}

export async function addSmsParticipantToConversation({
  conversationSid,
  phone,
}: {
  conversationSid: string;
  phone: string;
}) {
  if (!hasTwilioConversationConfig() || conversationSid.startsWith("mock-")) {
    return {
      sid: `mock-participant-${crypto.randomUUID()}`,
      mock: true,
    };
  }

  const env = getTwilioEnv();
  const participant = await getTwilioClient()
    .conversations.v1.services(env.TWILIO_CONVERSATIONS_SERVICE_SID)
    .conversations(conversationSid)
    .participants.create({
      "messagingBinding.address": phone,
      "messagingBinding.proxyAddress": env.TWILIO_PHONE_NUMBER,
    });

  return {
    sid: participant.sid,
    mock: false,
  };
}

export async function sendConversationMessage({
  conversationSid,
  body,
}: {
  conversationSid: string;
  body: string;
}) {
  if (!hasTwilioConversationConfig() || conversationSid.startsWith("mock-")) {
    return {
      sid: `mock-conversation-message-${crypto.randomUUID()}`,
      mock: true,
    };
  }

  const env = getTwilioEnv();
  const message = await getTwilioClient()
    .conversations.v1.services(env.TWILIO_CONVERSATIONS_SERVICE_SID)
    .conversations(conversationSid)
    .messages.create({
      author: "Saga",
      body,
    });

  return {
    sid: message.sid,
    mock: false,
  };
}
