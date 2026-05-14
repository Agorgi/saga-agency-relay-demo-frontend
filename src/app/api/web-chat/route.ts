import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateAdminDevOrganizerReplyWithLlm } from "@/sms-engine/conversation/adminDevLlmReplies";
import { evaluateOrganizerIntakePolicy } from "@/sms-engine/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/sms-engine/conversation/organizerReplyGenerator";
import {
  conversationContextSchema,
  type ConversationContext,
  type OrganizerGeneratedReply,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";
import { callOpenAiStructured } from "@/sms-engine/llm/openaiProvider";
import {
  forbiddenClaimsGuidance,
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
} from "@/sms-engine/llm/prompts";
import { intakeReplySchema } from "@/sms-engine/producerAgent";
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

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type RouteLlmMode = "active_mock" | "live";
type ReplyMode = "autonomous" | "holding";

const HOLDING_REPLY = "Thanks - we've logged your message and will reply soon.";

const LIVE_INSTRUCTIONS = [
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
  forbiddenClaimsGuidance,
].join("\n");

export const dynamic = "force-dynamic";

function json(
  data: unknown,
  init?: ResponseInit,
  sessionCookieValue?: string,
) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  if (sessionCookieValue) {
    response.cookies.set({
      name: WEB_SESSION_COOKIE_NAME,
      value: sessionCookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEB_SESSION_COOKIE_MAX_AGE,
    });
  }
  return response;
}

function normalizeRouteLlmMode(value: string | undefined): RouteLlmMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "live" || normalized === "active_live") {
    return "live";
  }
  return "active_mock";
}

function toPriorMessage(
  message: ChatMessage,
  index: number,
): ConversationContext["priorMessages"][number] {
  return {
    id: `web_chat_${index}`,
    direction: message.role === "user" ? "INBOUND" : "OUTBOUND",
    channel: "SMS",
    body: message.content,
    createdAt: new Date((index + 1) * 1000).toISOString(),
  };
}

function createBaseContext(
  priorMessages: ConversationContext["priorMessages"] = [],
): ConversationContext {
  return conversationContextSchema.parse({
    normalizedPhone: null,
    intent: "ORGANIZER_PROJECT_IDEA",
    priorMessages,
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {},
    missingRequiredFields: ["city", "projectConcept", "scopeOrVibe"],
    missingOptionalFields: [
      "targetDate",
      "budgetRange",
      "expectedAudienceSize",
      "helpNeeded",
    ],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage: "NEW",
  });
}

function rebuildConversationContext(history: ChatMessage[]): ConversationContext {
  let priorMessages: ConversationContext["priorMessages"] = [];
  let context = createBaseContext();

  history.forEach((message, index) => {
    if (message.role === "user") {
      const evaluation = evaluateOrganizerIntakePolicy({
        context,
        latestMessage: message.content,
      });
      const hasCompletedFirstTimeHostQuestion =
        context.hasCompletedFirstTimeHostQuestion ||
        (evaluation.knownFields.firstTimeHost !== null &&
          evaluation.knownFields.firstTimeHost !== undefined);

      context = conversationContextSchema.parse({
        ...context,
        knownFields: evaluation.knownFields,
        missingRequiredFields: evaluation.missingRequiredFields,
        missingOptionalFields: evaluation.missingOptionalFields,
        hasCompletedFirstTimeHostQuestion,
        safetyFlags: evaluation.safetyFlags,
        currentStage: evaluation.replyPlan.nextStage,
      });
    }

    priorMessages = [...priorMessages, toPriorMessage(message, index)];
    context = conversationContextSchema.parse({
      ...context,
      priorMessages,
    });
  });

  return context;
}

function buildOrganizerReplyPrompt({
  context,
  replyPlan,
  latestMessage,
}: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
}) {
  return `
Admin/dev mock organizer reply language only. The backend state machine has
already selected the stage and next question; rewrite only the reply language.
Do not change workflow state. Ask at most one clear question. Do not promise
bookings, payment, revenue, attendance, venue access, confirmed team members,
celebrity/influencer participation, or group-chat inclusion.

Latest organizer message:
${latestMessage}

ReplyPlan JSON:
${JSON.stringify({
  flow: replyPlan.flow,
  stage: replyPlan.stage,
  nextStage: replyPlan.nextStage,
  nextQuestion: replyPlan.nextQuestion,
  enoughInfoForBrief: replyPlan.enoughInfoForBrief,
  shouldEscalate: replyPlan.shouldEscalate,
  explanationForAudit: replyPlan.explanationForAudit,
})}

Known context JSON:
${JSON.stringify({
  knownFields: context.knownFields,
  missingRequiredFields: context.missingRequiredFields,
  missingOptionalFields: context.missingOptionalFields,
})}

Return JSON with message, confidence, needsAdmin, and reason.
  `.trim();
}

async function generateLiveReply({
  context,
  replyPlan,
  latestMessage,
  fallbackReply,
  apiKey,
}: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
  fallbackReply: OrganizerGeneratedReply;
  apiKey: string;
}) {
  const response = await callOpenAiStructured({
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || null,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    instructions: LIVE_INSTRUCTIONS,
    prompt: buildOrganizerReplyPrompt({
      context,
      replyPlan,
      latestMessage,
    }),
  });

  if (!response.ok) {
    console.error("Web chat engine live reply failed", {
      errorCategory: response.errorCategory,
      statusCode: response.statusCode ?? null,
      responseId: response.responseId ?? null,
    });
    return null;
  }

  return response.data.message || fallbackReply.replyText;
}

async function generateReply({
  history,
  latestMessage,
  mode,
}: {
  history: ChatMessage[];
  latestMessage: string;
  mode: RouteLlmMode;
}) {
  const context = rebuildConversationContext(history);
  const evaluation = evaluateOrganizerIntakePolicy({
    context,
    latestMessage,
  });
  const fallbackReply = generateOrganizerReplyFromPlan({
    context,
    replyPlan: evaluation.replyPlan,
    latestMessage,
  });

  if (mode === "live") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { error: "LLM not configured" as const, reply: null };
    }

    const liveReply = await generateLiveReply({
      context,
      replyPlan: evaluation.replyPlan,
      latestMessage,
      fallbackReply,
      apiKey,
    });

    if (!liveReply) {
      return { error: "Engine error" as const, reply: null };
    }

    return { error: null, reply: liveReply };
  }

  const reply = await generateAdminDevOrganizerReplyWithLlm({
    context,
    replyPlan: evaluation.replyPlan,
    latestMessage,
    fallbackReply,
    conversationEngineMode: "mock_active",
  });

  return { error: null, reply: reply.replyText };
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
  const session = await getExistingSession(req);
  if (!session) {
    return json({ conversationId: null, messages: [] });
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
        messages,
      });
    }
  }

  const latestConversation = await loadLatestConversationForSession(session.id);
  if (!latestConversation) {
    return json({ conversationId: null, messages: [] });
  }

  return json(latestConversation);
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

  const { message, conversationId: rawConversationId } = body as {
    conversationId?: unknown;
    message?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const conversationId =
    typeof rawConversationId === "string" && rawConversationId.trim().length > 0
      ? rawConversationId.trim()
      : crypto.randomUUID();

  const latestMessage = message.trim();

  try {
    const { session, isNew } = await getOrCreateSession(req);
    const sessionCookieValue = isNew ? session.id : undefined;
    const autonomousEnabled = await getEffectiveAutonomous();
    const history = await loadConversationHistory({
      sessionId: session.id,
      conversationId,
    });

    if (!autonomousEnabled) {
      // Persist holding turns so later review flows can load them from durable storage.
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
        sessionCookieValue,
      );
    }

    const mode = normalizeRouteLlmMode(process.env.LLM_MODE);
    const result = await generateReply({
      history,
      latestMessage,
      mode,
    });

    if (result.error === "LLM not configured") {
      return json(
        { error: "LLM not configured" },
        { status: 503 },
        sessionCookieValue,
      );
    }

    if (result.error || !result.reply) {
      return json({ error: "Engine error" }, { status: 502 }, sessionCookieValue);
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
      sessionCookieValue,
    );
  } catch (error) {
    console.error("Web chat engine request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
