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

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ConversationState = {
  messages: ChatMessage[];
};

type RouteLlmMode = "active_mock" | "live";

const conversations = new Map<string, ConversationState>();

const LIVE_INSTRUCTIONS = [
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
  forbiddenClaimsGuidance,
].join("\n");

export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
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

export async function POST(req: Request) {
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

  const state = conversations.get(conversationId) ?? { messages: [] };
  const assistantTurn = state.messages.filter(
    (entry) => entry.role === "assistant",
  ).length;
  const latestMessage = message.trim();
  const mode = normalizeRouteLlmMode(process.env.LLM_MODE);

  try {
    const result = await generateReply({
      history: state.messages,
      latestMessage,
      mode,
    });

    if (result.error === "LLM not configured") {
      return json({ error: "LLM not configured" }, { status: 503 });
    }

    if (result.error || !result.reply) {
      return json({ error: "Engine error" }, { status: 502 });
    }

    state.messages.push(
      { role: "user", content: latestMessage },
      { role: "assistant", content: result.reply },
    );
    conversations.set(conversationId, state);

    return json({
      conversationId,
      reply: result.reply,
      turn: assistantTurn,
    });
  } catch (error) {
    console.error("Web chat engine request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
