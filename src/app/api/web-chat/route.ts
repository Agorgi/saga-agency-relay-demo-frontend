import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAiStructured } from "@/sms-engine/llm/openaiProvider";
import { buildSystemPrompt } from "@/lib/sagasanSystemPrompt";
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
import { getEffectiveAutonomous } from "@/lib/webChatRuntimeSettings";

type ChatRole = "user" | "assistant";
type RouteLlmMode = "active_mock" | "live";
type ReplyMode = "autonomous" | "holding";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

const HOLDING_REPLY = "Thanks - we've logged your message and will reply soon.";
const TICKET_REPLY = "Tickets live elsewhere — Saga doesn't handle those.";

const liveReplySchema = z.object({
  message: z.string().min(1),
});

const PERSONA_QUESTION_SETS: Record<Persona, string[]> = {
  host: [
    "What are you hosting, and what should it feel like?",
    "What city is it in, when is it happening, and roughly how many people are you planning for?",
    "What kind of creative help do you want most?",
  ],
  creative: [
    "What kind of work do you want, and what do you make?",
    "Where can Sagasan see your work, and what city are you based in?",
    "What does your availability and rate range look like?",
  ],
  venue: [
    "What kind of space do you run, and what does it feel like?",
    "What neighborhood is it in, and about how many people can it hold?",
    "What dates or windows are you open for?",
  ],
  fan: [
    "What city are you in, and what scenes do you want more of?",
    "What kinds of nights or creators do you never want to miss?",
    "Where should Saga send future drops?",
  ],
};

const PERSONA_COMPLETIONS: Record<Persona, string> = {
  host: "Perfect. Open Discover when you're ready for picks.",
  creative: "Perfect. Open For me to track the work Saga sends your way.",
  venue: "Great. Open Spaces to manage requests and listings.",
  fan: "Perfect. Open Discover to see what's happening next.",
};

export const dynamic = "force-dynamic";

function normalizeRouteLlmMode(value: string | undefined): RouteLlmMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "live" || normalized === "active_live") {
    return "live";
  }
  return "active_mock";
}

function getPersonaFromRequest(req: NextRequest, rawPersona: unknown) {
  const explicitPersona =
    typeof rawPersona === "string" ? normalizePersona(rawPersona) : null;
  return explicitPersona ?? normalizePersona(req.cookies.get(PERSONA_COOKIE_NAME)?.value);
}

function buildTranscript(history: ChatMessage[], latestMessage: string) {
  return [...history, { role: "user" as const, content: latestMessage }]
    .map((message) => `${message.role === "assistant" ? "Sagasan" : "User"}: ${message.content}`)
    .join("\n");
}

function shouldAnswerTickets(message: string) {
  return /\bticket|tickets|admission|entry pass|passes\b/i.test(message);
}

function buildMockReply(persona: Persona | null, history: ChatMessage[], latestMessage: string) {
  if (shouldAnswerTickets(latestMessage)) {
    return TICKET_REPLY;
  }

  if (!persona) {
    return "Which path fits you best: host, creative, venue, or fan?";
  }

  const assistantTurns = history.filter((message) => message.role === "assistant").length;
  const nextQuestion = PERSONA_QUESTION_SETS[persona][assistantTurns];
  return nextQuestion ?? PERSONA_COMPLETIONS[persona];
}

async function generateLiveReply({
  persona,
  history,
  latestMessage,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { error: "LLM not configured" as const, reply: null };
  }

  if (shouldAnswerTickets(latestMessage)) {
    return { error: null, reply: TICKET_REPLY };
  }

  const response = await callOpenAiStructured({
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || null,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
    schema: liveReplySchema,
    schemaName: "sagasan_router_reply",
    instructions: buildSystemPrompt(persona),
    prompt: [
      `Persona: ${persona ?? "router"}`,
      "Conversation so far:",
      buildTranscript(history, latestMessage),
      "Reply with the next Sagasan message only.",
    ].join("\n\n"),
  });

  if (!response.ok) {
    console.error("Web chat live reply failed", {
      errorCategory: response.errorCategory,
      statusCode: response.statusCode ?? null,
      responseId: response.responseId ?? null,
    });
    return { error: "Engine error" as const, reply: null };
  }

  return { error: null, reply: response.data.message };
}

async function generateReply({
  persona,
  history,
  latestMessage,
  mode,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
  mode: RouteLlmMode;
}) {
  if (mode === "live") {
    return generateLiveReply({ persona, history, latestMessage });
  }

  return {
    error: null,
    reply: buildMockReply(persona, history, latestMessage),
  };
}

function appendPersonaCookie(
  response: NextResponse,
  persona: Persona | null,
) {
  if (persona) {
    response.cookies.set({
      name: PERSONA_COOKIE_NAME,
      value: persona,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEB_SESSION_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set({
      name: PERSONA_COOKIE_NAME,
      value: "",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
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

    if (messages.length > 0) {
      return json({
        conversationId: requestedConversationId,
        persona,
        messages,
      });
    }
  }

  const latestConversation = await loadLatestConversationForSession(session.id);
  if (!latestConversation) {
    return json({ conversationId: null, persona, messages: [] });
  }

  return json({
    ...latestConversation,
    persona,
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

  const { message, conversationId: rawConversationId, persona: rawPersona } = body as {
    conversationId?: unknown;
    message?: unknown;
    persona?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const conversationId =
    typeof rawConversationId === "string" && rawConversationId.trim().length > 0
      ? rawConversationId.trim()
      : crypto.randomUUID();

  const latestMessage = message.trim();
  const persona = getPersonaFromRequest(req, rawPersona);

  try {
    const { session, isNew } = await getOrCreateSession(req);
    const autonomousEnabled = await getEffectiveAutonomous();
    const history = await loadConversationHistory({
      sessionId: session.id,
      conversationId,
    });

    const cookieOptions = {
      sessionCookieValue: isNew ? session.id : undefined,
      persona,
    };

    if (!autonomousEnabled) {
      const turn = await appendTurn({
        sessionId: session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: HOLDING_REPLY,
        mode: "holding",
      });

      return json(
        {
          conversationId,
          reply: HOLDING_REPLY,
          turn,
          mode: "holding" satisfies ReplyMode,
        },
        undefined,
        cookieOptions,
      );
    }

    const mode = normalizeRouteLlmMode(process.env.LLM_MODE);
    const result = await generateReply({
      persona,
      history,
      latestMessage,
      mode,
    });

    if (result.error === "LLM not configured") {
      return json({ error: "LLM not configured" }, { status: 503 }, cookieOptions);
    }

    if (result.error || !result.reply) {
      return json({ error: "Engine error" }, { status: 502 }, cookieOptions);
    }

    const turn = await appendTurn({
      sessionId: session.id,
      conversationId,
      userMessage: latestMessage,
      assistantReply: result.reply,
      mode: "autonomous",
    });

    return json(
      {
        conversationId,
        reply: result.reply,
        turn,
        mode: "autonomous" satisfies ReplyMode,
      },
      undefined,
      cookieOptions,
    );
  } catch (error) {
    console.error("Web chat request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
