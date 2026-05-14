import type { NextRequest } from "next/server";
import { getDb } from "@/sms-engine/db";

export const WEB_SESSION_COOKIE_NAME = "web_session_id";
export const WEB_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type ReplyMode = "autonomous" | "holding";
type ChatRole = "user" | "assistant";

export type StoredWebChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  mode: ReplyMode | null;
  turn: number;
  createdAt: string;
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
}: {
  sessionId: string;
  conversationId: string;
  userMessage: string;
  assistantReply: string;
  mode: ReplyMode;
}) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const turn = await tx.webChatMessage.count({
      where: { sessionId, conversationId, role: "assistant" },
    });
    await tx.webChatMessage.createMany({
      data: [
        {
          sessionId,
          conversationId,
          role: "user",
          content: userMessage,
          mode: null,
          turn,
        },
        {
          sessionId,
          conversationId,
          role: "assistant",
          content: assistantReply,
          mode,
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
      turn: true,
      createdAt: true,
    },
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    mode: message.mode === "autonomous" || message.mode === "holding" ? message.mode : null,
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
