import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildMockAgentReply,
  buildUiFallbackReply,
  generateAgentReply,
  normalizeRouteLlmMode,
  organizerFieldsFromStored,
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
  type StoredExtractedFields,
  WEB_SESSION_COOKIE_MAX_AGE,
  WEB_SESSION_COOKIE_NAME,
} from "@/lib/webChatSessionStore";
import {
  getEffectiveAutonomous,
  recordSystemHoldingFallback,
} from "@/lib/webChatRuntimeSettings";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import type { ProjectJourney } from "@/lib/journey/types";
import { logServerError } from "@/sms-engine/safeLogging";

type ReplyMode = "autonomous" | "holding";

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
  projectId = null,
  journey = null,
}: {
  conversationId: string;
  persona: Persona | null;
  reply: string;
  turn: number;
  mode: ReplyMode;
  sessionCookieValue?: string;
  nextStep?: unknown;
  projectId?: string | null;
  journey?: ProjectJourney | null;
}) {
  return json(
    {
      conversationId,
      persona,
      reply,
      turn,
      mode,
      nextStep,
      projectId,
      journey,
    },
    undefined,
    {
      sessionCookieValue,
      persona,
    },
  );
}

/**
 * Persist the host brief to a Project row and advance the journey when
 * readiness crosses the brief_ready threshold. No-ops cleanly for non-host
 * personas and when the DB isn't available (legacy/preview paths).
 *
 * Errors are caught and logged but do not fail the chat reply — the user's
 * conversation continues working even if the persistence side fails.
 */
async function persistBriefAndAdvanceJourney({
  sessionId,
  persona,
  extractedFields,
}: {
  sessionId: string;
  persona: Persona | null;
  extractedFields: StoredExtractedFields;
}): Promise<{ projectId: string | null; journey: ProjectJourney | null }> {
  try {
    const organizerFields =
      persona === "host" ? organizerFieldsFromStored(extractedFields) : null;
    const result = await upsertProjectFromBrief({
      sessionId,
      persona,
      organizerFields,
    });
    return { projectId: result.projectId, journey: result.journey };
  } catch (error) {
    logServerError("persistBriefAndAdvanceJourney", error);
    return { projectId: null, journey: null };
  }
}

export async function GET(req: NextRequest) {
  const session = await getExistingSession(req);
  const persona = normalizePersona(
    req.cookies.get(PERSONA_COOKIE_NAME)?.value || session?.persona || null,
  );
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
    personaHint: rawPersonaHint,
  } = body as {
    conversationId?: unknown;
    message?: unknown;
    persona?: unknown;
    personaHint?: unknown;
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
    personaHint: rawPersonaHint,
    explicitPersona: rawPersona,
    sessionPersona: session.session.persona,
    cookiePersona: req.cookies.get(PERSONA_COOKIE_NAME)?.value,
    latestMessage,
  });
  const sessionCookieValue = session.isNew ? session.session.id : undefined;

  try {
    const effectiveAutonomous = await getEffectiveAutonomous();

    if (!effectiveAutonomous) {
      const holdingReply = buildMockAgentReply({
        persona,
        history,
        latestMessage,
      });
      const turn = await appendTurn({
        sessionId: session.session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: holdingReply.reply,
        mode: "holding",
        sessionPersona: persona,
        assistantMeta: {
          persona,
          route: holdingReply.nextStep?.route ?? null,
          nextStep: holdingReply.nextStep,
          extractedFields: holdingReply.extractedFields,
          operation: holdingReply.diagnostics.operation,
          selectedReplySource: "holding_template",
          fallbackReason: "runtime_gate_closed",
          providerState: "openai_not_called_gate_closed",
          model: holdingReply.diagnostics.model,
          configuredMode: holdingReply.diagnostics.configuredMode,
          effectiveMode: "holding",
        },
      });

      const { projectId, journey } = await persistBriefAndAdvanceJourney({
        sessionId: session.session.id,
        persona,
        extractedFields: holdingReply.extractedFields,
      });

      return successResponse({
        conversationId,
        persona,
        reply: holdingReply.reply,
        turn,
        mode: "holding",
        sessionCookieValue,
        nextStep: holdingReply.nextStep,
        projectId,
        journey,
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
    }

    const replyMode: ReplyMode =
      result.data.diagnostics.providerState === "openai_not_called_gate_closed"
        ? "holding"
        : "autonomous";

    const turn = await appendTurn({
      sessionId: session.session.id,
      conversationId,
      userMessage: latestMessage,
      assistantReply: result.data.reply,
      mode: replyMode,
      sessionPersona: result.data.persona,
      assistantMeta: {
        persona: result.data.persona,
        route: result.data.nextStep?.route ?? null,
        nextStep: result.data.nextStep,
        extractedFields: result.data.extractedFields,
        operation: result.data.diagnostics.operation,
        selectedReplySource: result.data.diagnostics.selectedReplySource,
        fallbackReason: result.data.diagnostics.fallbackReason,
        providerState: result.data.diagnostics.providerState,
        model: result.data.diagnostics.model,
        configuredMode: result.data.diagnostics.configuredMode,
        effectiveMode: result.data.diagnostics.effectiveMode,
      },
    });

    const { projectId, journey } = await persistBriefAndAdvanceJourney({
      sessionId: session.session.id,
      persona: result.data.persona,
      extractedFields: result.data.extractedFields,
    });

    return successResponse({
      conversationId,
      persona: result.data.persona,
      reply: result.data.reply,
      turn,
      mode: replyMode,
      sessionCookieValue,
      nextStep: result.data.nextStep,
      projectId,
      journey,
    });
  } catch (error) {
    console.error("Web chat request failed", error);
    const reply = buildUiFallbackReply(persona);
    let turn = history.filter((message) => message.role === "assistant").length;

    try {
      turn = await appendTurn({
        sessionId: session.session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: reply,
        mode: "holding",
        sessionPersona: persona,
        assistantMeta: {
          persona,
          route: null,
          nextStep: null,
          extractedFields: {
            persona,
            city: null,
            neighborhood: null,
            dateWindow: null,
            roles: [],
            vibeTags: [],
            venueType: null,
            projectIdea: null,
            interests: [],
            portfolio: null,
            availability: null,
            rates: null,
            scale: null,
            scopeFormat: null,
            themeVibe: null,
            lineupStatus: null,
            helpNeeded: null,
            budget: null,
            budgetStatus: null,
            inspirationStatus: null,
            inspirationReferences: [],
            userRole: null,
            userIdentity: null,
            organization: null,
            socials: [],
            audience: null,
            ticketingModel: null,
            safetyFlags: [],
            urgency: null,
            desiredTalentRoles: [],
            readinessStage: null,
            missingRequiredFields: [],
            missingImportantFields: [],
            nextRoute: null,
          },
          operation: persona ? `sagasan_${persona}_intake` : "sagasan_router",
          selectedReplySource: "holding_template",
          fallbackReason: "request_failed",
          providerState: "openai_called_failed",
          model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
          configuredMode: normalizeRouteLlmMode(process.env.LLM_MODE),
          effectiveMode: "holding",
        },
      });
    } catch (persistError) {
      console.error("Web chat fallback persistence failed", persistError);
    }

    return successResponse({
      conversationId,
      persona,
      reply,
      turn,
      mode: "holding",
      sessionCookieValue,
    });
  }
}
