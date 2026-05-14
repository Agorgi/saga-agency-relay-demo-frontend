import type { ConversationProvider } from "@prisma/client";
import {
  addSmsParticipantToConversation,
  createTwilioConversation,
  sendConversationMessage,
  sendSmsViaTwilio,
} from "@/lib/twilio";
import {
  blockedProviderResult,
  checkConversationSendAllowed,
  checkSmsSendAllowed,
} from "@/lib/smsSafety";

export type MessagingProviderName = ConversationProvider;

export type ProviderSendInput = {
  to: string;
  body: string;
  statusCallback?: string;
};

export type ProviderConversationInput = {
  friendlyName: string;
};

export type ProviderParticipantInput = {
  conversationSid: string;
  phone: string;
};

export type ProviderConversationMessageInput = {
  conversationSid: string;
  body: string;
};

export type ProviderResult = {
  sid: string | null;
  provider: string;
  mock: boolean;
  blocked?: boolean;
  blockReason?: string;
  allowedNumbersCount?: number;
};

export interface MessagingProvider {
  name: MessagingProviderName;
  sendMessage(input: ProviderSendInput): Promise<ProviderResult>;
  createGroupConversation(
    input: ProviderConversationInput,
  ): Promise<ProviderResult>;
  addParticipant(input: ProviderParticipantInput): Promise<ProviderResult>;
  sendConversationMessage(
    input: ProviderConversationMessageInput,
  ): Promise<ProviderResult>;
  parseWebhook(input: unknown): Promise<Record<string, unknown>>;
  validateWebhook(input: unknown): Promise<boolean>;
}

export class MockMessagingProvider implements MessagingProvider {
  name = "MOCK" as const;

  async sendMessage(): Promise<ProviderResult> {
    return {
      sid: `mock-message-${crypto.randomUUID()}`,
      provider: "mock",
      mock: true,
    };
  }

  async createGroupConversation(): Promise<ProviderResult> {
    return {
      sid: `mock-conversation-${crypto.randomUUID()}`,
      provider: "mock",
      mock: true,
    };
  }

  async addParticipant(): Promise<ProviderResult> {
    return {
      sid: `mock-participant-${crypto.randomUUID()}`,
      provider: "mock",
      mock: true,
    };
  }

  async sendConversationMessage(): Promise<ProviderResult> {
    return {
      sid: `mock-conversation-message-${crypto.randomUUID()}`,
      provider: "mock",
      mock: true,
    };
  }

  async parseWebhook(input: unknown) {
    return input && typeof input === "object" ? { ...(input as object) } : {};
  }

  async validateWebhook() {
    return true;
  }
}

export class TwilioMessagingProvider implements MessagingProvider {
  name = "TWILIO" as const;

  async sendMessage(input: ProviderSendInput): Promise<ProviderResult> {
    const safety = checkSmsSendAllowed({
      to: input.to,
      providerMode: "TWILIO",
    });
    if (!safety.allowed) return blockedProviderResult(safety.reason, "twilio");

    return sendSmsViaTwilio(input);
  }

  async createGroupConversation(
    input: ProviderConversationInput,
  ): Promise<ProviderResult> {
    const safety = checkConversationSendAllowed({ providerMode: "TWILIO" });
    if (!safety.allowed && safety.reason === "sms_sends_disabled") {
      return blockedProviderResult(safety.reason, "twilio-conversations");
    }

    return createTwilioConversation(input);
  }

  async addParticipant(input: ProviderParticipantInput): Promise<ProviderResult> {
    const safety = checkSmsSendAllowed({
      to: input.phone,
      providerMode: "TWILIO",
    });
    if (!safety.allowed) {
      return blockedProviderResult(safety.reason, "twilio-conversations");
    }

    const result = await addSmsParticipantToConversation(input);
    return {
      ...result,
      provider: "twilio-conversations",
    };
  }

  async sendConversationMessage(
    input: ProviderConversationMessageInput,
  ): Promise<ProviderResult> {
    const safety = checkConversationSendAllowed({ providerMode: "TWILIO" });
    if (!safety.allowed) {
      return blockedProviderResult(safety.reason, "twilio-conversations");
    }

    const result = await sendConversationMessage(input);
    return {
      ...result,
      provider: "twilio-conversations",
    };
  }

  async parseWebhook(input: unknown) {
    return input && typeof input === "object" ? { ...(input as object) } : {};
  }

  async validateWebhook() {
    return true;
  }
}

export function getMessagingProvider(
  provider?: MessagingProviderName | "MOCK" | "TWILIO",
): MessagingProvider {
  if (
    provider === "MOCK" ||
    process.env.MESSAGING_PROVIDER?.toUpperCase() === "MOCK"
  ) {
    return new MockMessagingProvider();
  }

  return new TwilioMessagingProvider();
}
