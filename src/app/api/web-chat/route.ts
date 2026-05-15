import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  generateAgentReply,
  normalizeRouteLlmMode,
  resolvePersona,
  type ChatMessage,
} from "@/lib/sagasanAgent";
import {
  normalizePersona,
  PERSONA_COOKIE_NAME,
  type Persona,
} from "@/lib/sagasanPersonas";
import {
  appendTurn,
  getExistingSession,
  getOrCreateSession,
  loadConversationMessages,
  loadLatestConversationForSession,
  WEB_SESSION_COOKIE_MAX_AGE,
  WEB_SESSION_COOKIE_NAME,
} from "@/lib/webChatSessionStore";
import {
  getEffectiveAutonomous,
  recordSystemHoldingFallback,
} from "@/lib/webChatRuntimeSettings";

type ReplyMode = "autonomous" | "holding";

const HOLDING_REPLY = "Thanks - we've logged your message and will reply soon.";

export const dynamic = "force-dynamic";

function appendPersonaCookie(response: NextResponse, persona: Persona | null) {
  if (persona) {
    response.cookies.set({
      name: PERSONA_COOKIE_NAME,
      value: persona,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEB_SESSION_COOKIE_MAX_AGE,
    });
    return;
  }

  response.cookies.set({
    name: PERSONA_COOKIE_NAME,
    value: "",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function json(
  data: unknown,
  init?: ResponseInit,
  options?: {
    sessionCookieValue?: string;
    persona?: Persona | null;
  },
) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store");

  if (options?.sessionCookieValue) {
    response.cookies.set({
      name: WEB_SESSION_COOKIE_NAME,
      value: options.sessionCookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEB_SESSION_COOKIE_MAX_AGE,
    });
  }

  if (options && "persona" in options) {
    appendPersonaCookie(response, options.persona ?? null);
  }

  return response;
}

async function loadConversationHistory({
  sessionId,
  conversationId,
}: {
  sessionId: string;
  conversationId: string;
}) {
  const messages = await loadConversationMessages({ sessionId, conversationId });

  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  })) satisfies ChatMessage[];
}

function successResponse({
  conversationId,
  persona,
  reply,
  turn,
  mode,
  sessionCookieValue,
  nextStep = null,
}: {
  conversationId: string;
  persona: Persona | null;
  reply: string;
  turn: number;
  mode: ReplyMode;
  sessionCookieValue?: string;
  nextStep?: unknown;
}) {
  return json(
    {
      conversationId,
      persona,
      reply,
      turn,
      mode,
      nextStep,
    },
    undefined,
    {
      sessionCookieValue,
      persona,
    },
  );
}

export async function GET(req: NextRequest) {
  const persona = normalizePersona(req.cookies.get(PERSONA_COOKIE_NAME)?.value);
  const session = await getExistingSession(req);
  if (!session) {
    return json({ conversationId: null, persona, messages: [] });
  }

  const requestedConversationId =
    req.nextUrl.searchParams.get("conversationId")?.trim() || null;

  if (requestedConversationId) {
    const messages = await loadConversationMessages({
      sessionId: session.id,
      conversationId: requestedConversationId,
    });

    return json({
      conversationId: requestedConversationId,
      persona,
      messages,
    });
  }

  const latestConversation = await loadLatestConversationForSession(session.id);
  if (!latestConversation) {
    return json({ conversationId: null, persona, messages: [] });
  }

  return json({
    conversationId: latestConversation.conversationId,
    persona,
    messages: latestConversation.messages,
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const {
    message,
    conversationId: rawConversationId,
    persona: rawPersona,
  } = body as {
    conversationId?: unknown;
    message?: unknown;
    persona?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const latestMessage = message.trim();
  const session = await getOrCreateSession(req);
  const conversationId =
    typeof rawConversationId === "string" && rawConversationId.trim().length > 0
      ? rawConversationId.trim()
      : crypto.randomUUID();
  const history = await loadConversationHistory({
    sessionId: session.session.id,
    conversationId,
  });
  const persona = resolvePersona({
    explicitPersona: rawPersona,
    cookiePersona: req.cookies.get(PERSONA_COOKIE_NAME)?.value,
    latestMessage,
  });
  const sessionCookieValue = session.isNew ? session.session.id : undefined;

  try {
    const effectiveAutonomous = await getEffectiveAutonomous();

    if (!effectiveAutonomous) {
      const turn = await appendTurn({
        sessionId: session.session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: HOLDING_REPLY,
        mode: "holding",
      });

      return successResponse({
        conversationId,
        persona,
        reply: HOLDING_REPLY,
        turn,
        mode: "holding",
        sessionCookieValue,
      });
    }

    const mode = normalizeRouteLlmMode(process.env.LLM_MODE);
    const result = await generateAgentReply({
      persona,
      history,
      latestMessage,
      mode,
      apiKey: process.env.OPENAI_API_KEY || null,
    });

    if (!result.ok) {
      console.error("Sagasan live reply failed", {
        errorCategory: result.errorCategory,
        errorMessage: result.errorMessage,
      });
      await recordSystemHoldingFallback();
      const turn = await appendTurn({
        sessionId: session.session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: HOLDING_REPLY,
        mode: "holding",
      });

      return successResponse({
        conversationId,
        persona,
        reply: HOLDING_REPLY,
        turn,
        mode: "holding",
        sessionCookieValue,
      });
    }

    const turn = await appendTurn({
      sessionId: session.session.id,
      conversationId,
      userMessage: latestMessage,
      assistantReply: result.data.reply,
      mode: "autonomous",
    });

    return successResponse({
      conversationId,
      persona: result.data.persona,
      reply: result.data.reply,
      turn,
      mode: "autonomous",
      sessionCookieValue,
      nextStep: result.data.nextStep,
    });
  } catch (error) {
    console.error("Web chat request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
