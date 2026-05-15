import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getDb } from "@/sms-engine/db";
import type { Persona } from "@/lib/sagasanPersonas";
import type { WebChatNextStep } from "@/lib/webChatNextStep";

export const WEB_SESSION_COOKIE_NAME = "web_session_id";
export const WEB_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type ReplyMode = "autonomous" | "holding";
type ChatRole = "user" | "assistant";
type ProviderState =
  | "openai_not_called_gate_closed"
  | "openai_not_called_mode_mock"
  | "openai_not_called_missing_key"
  | "openai_called_succeeded"
  | "openai_called_failed"
  | "openai_called_validation_failed";

export type StoredExtractedFields = {
  persona: Persona | null;
  city: string | null;
  neighborhood: string | null;
  dateWindow: string | null;
  roles: string[];
  vibeTags: string[];
  venueType: string | null;
  projectIdea: string | null;
  interests: string[];
  portfolio: string | null;
  availability: string | null;
  rates: string | null;
  scale: string | null;
  nextRoute: string | null;
};

export type StoredWebChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  mode: ReplyMode | null;
  persona: Persona | null;
  route: string | null;
  nextStep: WebChatNextStep | null;
  extractedFields: StoredExtractedFields | null;
  selectedReplySource: string | null;
  fallbackReason: string | null;
  providerState: ProviderState | null;
  model: string | null;
  configuredMode: string | null;
  effectiveMode: string | null;
  operation: string | null;
  turn: number;
  createdAt: string;
};

type AssistantTurnMeta = {
  persona: Persona | null;
  route: string | null;
  nextStep: WebChatNextStep | null;
  extractedFields: StoredExtractedFields | null;
  selectedReplySource: string | null;
  fallbackReason: string | null;
  providerState: ProviderState | null;
  model: string | null;
  configuredMode: string | null;
  effectiveMode: string | null;
  operation: string | null;
};

function normalizedUserAgent(req: NextRequest) {
  const value = req.headers.get("user-agent")?.trim();
  return value ? value.slice(0, 512) : null;
}

export async function getOrCreateSession(req: NextRequest) {
  const db = getDb();
  const cookieSessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  const userAgent = normalizedUserAgent(req);

  if (cookieSessionId) {
    const existing = await db.webSession.findUnique({
      where: { id: cookieSessionId },
    });
    if (existing) {
      const session = await db.webSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          userAgent: existing.userAgent ?? userAgent,
        },
      });
      return { session, isNew: false as const };
    }
  }

  const session = await db.webSession.create({
    data: {
      userAgent,
      ipHash: null,
      persona: null,
    },
  });
  return { session, isNew: true as const };
}

export async function getExistingSession(req: NextRequest) {
  const sessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    return null;
  }

  return getDb().webSession.findUnique({
    where: { id: sessionId },
  });
}

export async function appendTurn({
  sessionId,
  conversationId,
  userMessage,
  assistantReply,
  mode,
  sessionPersona,
  assistantMeta,
}: {
  sessionId: string;
  conversationId: string;
  userMessage: string;
  assistantReply: string;
  mode: ReplyMode;
  sessionPersona: Persona | null;
  assistantMeta: AssistantTurnMeta;
}) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const turn = await tx.webChatMessage.count({
      where: { sessionId, conversationId, role: "assistant" },
    });
    await tx.webSession.update({
      where: { id: sessionId },
      data: {
        persona: sessionPersona,
      },
    });
    await tx.webChatMessage.createMany({
      data: [
        {
          sessionId,
          conversationId,
          role: "user",
          content: userMessage,
          mode: null,
          persona: sessionPersona,
          turn,
        },
        {
          sessionId,
          conversationId,
          role: "assistant",
          content: assistantReply,
          mode,
          persona: assistantMeta.persona,
          route: assistantMeta.route,
          nextStep:
            assistantMeta.nextStep === null
              ? Prisma.JsonNull
              : (assistantMeta.nextStep as Prisma.InputJsonValue),
          extractedFields:
            assistantMeta.extractedFields === null
              ? Prisma.JsonNull
              : (assistantMeta.extractedFields as Prisma.InputJsonValue),
          selectedReplySource: assistantMeta.selectedReplySource,
          fallbackReason: assistantMeta.fallbackReason,
          providerState: assistantMeta.providerState,
          model: assistantMeta.model,
          configuredMode: assistantMeta.configuredMode,
          effectiveMode: assistantMeta.effectiveMode,
          operation: assistantMeta.operation,
          turn,
        },
      ],
    });
    return turn;
  });
}

export async function loadConversationMessages({
  sessionId,
  conversationId,
}: {
  sessionId: string;
  conversationId: string;
}) {
  const messages = await getDb().webChatMessage.findMany({
    where: { sessionId, conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      role: true,
      content: true,
      mode: true,
      persona: true,
      route: true,
      nextStep: true,
      extractedFields: true,
      selectedReplySource: true,
      fallbackReason: true,
      providerState: true,
      model: true,
      configuredMode: true,
      effectiveMode: true,
      operation: true,
      turn: true,
      createdAt: true,
    },
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    mode: message.mode === "autonomous" || message.mode === "holding" ? message.mode : null,
    persona:
      message.persona === "host" ||
      message.persona === "creative" ||
      message.persona === "venue" ||
      message.persona === "fan"
        ? message.persona
        : null,
    route: message.route,
    nextStep:
      message.nextStep && typeof message.nextStep === "object"
        ? (message.nextStep as WebChatNextStep)
        : null,
    extractedFields:
      message.extractedFields && typeof message.extractedFields === "object"
        ? (message.extractedFields as StoredExtractedFields)
        : null,
    selectedReplySource: message.selectedReplySource,
    fallbackReason: message.fallbackReason,
    providerState:
      message.providerState === "openai_not_called_gate_closed" ||
      message.providerState === "openai_not_called_mode_mock" ||
      message.providerState === "openai_not_called_missing_key" ||
      message.providerState === "openai_called_succeeded" ||
      message.providerState === "openai_called_failed" ||
      message.providerState === "openai_called_validation_failed"
        ? message.providerState
        : null,
    model: message.model,
    configuredMode: message.configuredMode,
    effectiveMode: message.effectiveMode,
    operation: message.operation,
    turn: message.turn,
    createdAt: message.createdAt.toISOString(),
  })) satisfies StoredWebChatMessage[];
}

export async function loadLatestConversationForSession(sessionId: string) {
  const latestMessage = await getDb().webChatMessage.findFirst({
    where: { sessionId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { conversationId: true },
  });

  if (!latestMessage) {
    return null;
  }

  return {
    conversationId: latestMessage.conversationId,
    messages: await loadConversationMessages({
      sessionId,
      conversationId: latestMessage.conversationId,
    }),
  };
}
