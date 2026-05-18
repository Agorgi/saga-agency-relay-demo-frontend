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
import {
  upsertSessionIdentitySignals,
  upsertSessionIdentitySignalsFromExtracted,
} from "@/lib/sessionPersonStore";
import type { ProjectJourney } from "@/lib/journey/types";
import { captureServerError } from "@/lib/observability";
import {
  bindNextStepToProject,
  conversationReferencesBoundProject,
} from "@/lib/webChatNextStep";

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
    captureServerError("persistBriefAndAdvanceJourney", error, {
      tags: {
        persona: persona ?? "unknown",
        route: "/api/web-chat",
        operation: "upsertProjectFromBrief",
      },
    });
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

  // Post-archive guard (PR #56): if the session's projectId is null but
  // the latest conversation references a bound `/projects/<cuid>` route,
  // the user must have archived the project that conversation was
  // about (archive clears `WebSession.projectId` and the project's
  // journey is now at `archived`). Restoring the old conversation
  // would show the user the brief they just discarded.
  //
  // PR #55 covers the primary archive paths via `?fresh=1`, which the
  // chat client uses to skip GET entirely. This guard catches the
  // edge case where the user navigates to /chat directly (typed URL,
  // bookmark, back button) without the flag — server returns an
  // empty conversation so the chat client starts fresh.
  //
  // False-positive safety: the only way for `session.projectId` to be
  // null AND a message to carry a bound `/projects/<cuid>` route is
  // if the user once had a project and lost the binding. That happens
  // only via `archiveProject` today; chat without a brief never
  // routes the user at a bound project URL.
  if (
    !session.projectId &&
    conversationReferencesBoundProject(latestConversation.messages)
  ) {
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

  // Identity-signal capture (PR #64). Runs on every chat turn,
  // every persona — fandoms / interests mentioned in the user's
  // message accumulate on the session's anchor Person row regardless
  // of whether they came in through host / creative / venue / fan
  // intake. The matching helper in PR #68 reads from these arrays;
  // PR #65's de-robot templates read from them to reflect captured
  // signals back at the user.
  //
  // Defensive: failure to capture must not break chat. A DB outage
  // here would normally throw and surface as a 500; we log it as
  // a server error (Sentry-tagged) and let the chat reply continue.
  try {
    await upsertSessionIdentitySignals({
      sessionId: session.session.id,
      message: latestMessage,
    });
  } catch (error) {
    captureServerError("upsertSessionIdentitySignals", error, {
      tags: {
        persona: persona ?? "unknown",
        route: "/api/web-chat",
        operation: "identitySignals",
      },
    });
  }

  try {
    const effectiveAutonomous = await getEffectiveAutonomous();

    if (!effectiveAutonomous) {
      const holdingReply = buildMockAgentReply({
        persona,
        history,
        latestMessage,
      });

      // Persist + bind BEFORE appendTurn so the assistant message
      // stored in WebChatMessage carries the bound /projects/<cuid>
      // route. Restoring a conversation via GET would otherwise
      // serve the stale /projects/new route from message metadata,
      // even though this POST response was rewritten.
      const { projectId, journey } = await persistBriefAndAdvanceJourney({
        sessionId: session.session.id,
        persona,
        extractedFields: holdingReply.extractedFields,
      });
      const boundNextStep = bindNextStepToProject(holdingReply.nextStep, projectId);

      const turn = await appendTurn({
        sessionId: session.session.id,
        conversationId,
        userMessage: latestMessage,
        assistantReply: holdingReply.reply,
        mode: "holding",
        sessionPersona: persona,
        assistantMeta: {
          persona,
          route: boundNextStep?.route ?? null,
          nextStep: boundNextStep,
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

      return successResponse({
        conversationId,
        persona,
        reply: holdingReply.reply,
        turn,
        mode: "holding",
        sessionCookieValue,
        nextStep: boundNextStep,
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
      captureServerError(
        "sagasan_live_reply_failed",
        result.errorMessage || new Error(result.errorCategory || "unknown"),
        {
          metadata: {
            errorCategory: result.errorCategory,
          },
          tags: {
            persona: persona ?? "unknown",
            route: "/api/web-chat",
            operation: "generateAgentReply",
          },
        },
      );
      await recordSystemHoldingFallback();
    }

    const replyMode: ReplyMode =
      result.data.diagnostics.providerState === "openai_not_called_gate_closed"
        ? "holding"
        : "autonomous";

    // PR #67: when the LLM ran and returned `extractedSignals`,
    // route its fandoms / interests through the identity-graph
    // pipeline. The regex pass above is the safety net; this is
    // the primary path once LLM mode is live, and catches the
    // signals the regex pattern bank misses (cultural references
    // it doesn't yet know about, unusual venue types, etc.).
    // Wrapped — failure must never break chat reply.
    const llmSignals = result.data.llmExtractedSignals;
    if (llmSignals) {
      try {
        await upsertSessionIdentitySignalsFromExtracted({
          sessionId: session.session.id,
          signals: {
            fandoms: llmSignals.fandoms,
            interests: llmSignals.interests,
          },
        });
      } catch (error) {
        captureServerError("upsertSessionIdentitySignalsLlm", error, {
          tags: {
            persona: result.data.persona ?? "unknown",
            route: "/api/web-chat",
            operation: "identitySignalsLlm",
          },
        });
      }
    }

    // Persist + bind BEFORE appendTurn so the assistant message
    // stored in WebChatMessage carries the bound /projects/<cuid>
    // route. Restoring a conversation via GET would otherwise serve
    // the stale /projects/new route from message metadata, even
    // though this POST response was rewritten.
    const { projectId, journey } = await persistBriefAndAdvanceJourney({
      sessionId: session.session.id,
      persona: result.data.persona,
      extractedFields: result.data.extractedFields,
    });
    const boundNextStep = bindNextStepToProject(result.data.nextStep, projectId);

    const turn = await appendTurn({
      sessionId: session.session.id,
      conversationId,
      userMessage: latestMessage,
      assistantReply: result.data.reply,
      mode: replyMode,
      sessionPersona: result.data.persona,
      assistantMeta: {
        persona: result.data.persona,
        route: boundNextStep?.route ?? null,
        nextStep: boundNextStep,
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

    return successResponse({
      conversationId,
      persona: result.data.persona,
      reply: result.data.reply,
      turn,
      mode: replyMode,
      sessionCookieValue,
      nextStep: boundNextStep,
      projectId,
      journey,
    });
  } catch (error) {
    captureServerError("web_chat_request_failed", error, {
      tags: {
        persona: persona ?? "unknown",
        route: "/api/web-chat",
      },
    });
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
      captureServerError("web_chat_fallback_persistence_failed", persistError, {
        tags: {
          persona: persona ?? "unknown",
          route: "/api/web-chat",
          operation: "appendTurn",
        },
      });
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
