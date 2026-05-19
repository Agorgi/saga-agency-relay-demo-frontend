import type { NextRequest } from "next/server";
import {
  normalizeRouteLlmMode,
  organizerFieldsFromStored,
  resolvePersona,
  streamAgentReply,
  type AgentReply,
  type ChatMessage,
} from "@/lib/sagasanAgent";
import {
  normalizePersona,
  PERSONA_COOKIE_NAME,
  type Persona,
} from "@/lib/sagasanPersonas";
import {
  appendTurn,
  getOrCreateSession,
  loadConversationMessages,
  type StoredExtractedFields,
  WEB_SESSION_COOKIE_MAX_AGE,
  WEB_SESSION_COOKIE_NAME,
} from "@/lib/webChatSessionStore";
import { getEffectiveAutonomous } from "@/lib/webChatRuntimeSettings";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import {
  upsertSessionIdentitySignals,
  upsertSessionIdentitySignalsFromExtracted,
} from "@/lib/sessionPersonStore";
import type { ProjectJourney } from "@/lib/journey/types";
import { captureServerError } from "@/lib/observability";
import { bindNextStepToProject } from "@/lib/webChatNextStep";

export const dynamic = "force-dynamic";

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
        route: "/api/web-chat/stream",
        operation: "upsertProjectFromBrief",
      },
    });
    return { projectId: null, journey: null };
  }
}

function sseHeaders(
  sessionCookieValue: string | undefined,
  persona: Persona | null,
): Headers {
  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (sessionCookieValue) {
    headers.append(
      "Set-Cookie",
      `${WEB_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionCookieValue)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEB_SESSION_COOKIE_MAX_AGE}${secure}`,
    );
  }
  if (persona) {
    headers.append(
      "Set-Cookie",
      `${PERSONA_COOKIE_NAME}=${encodeURIComponent(persona)}; SameSite=Lax; Path=/; Max-Age=${WEB_SESSION_COOKIE_MAX_AGE}${secure}`,
    );
  } else {
    headers.append(
      "Set-Cookie",
      `${PERSONA_COOKIE_NAME}=; SameSite=Lax; Path=/; Max-Age=0${secure}`,
    );
  }
  return headers;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body || typeof body !== "object") {
    return new Response(
      JSON.stringify({ error: "Message must be a non-empty string." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
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
    return new Response(
      JSON.stringify({ error: "Message must be a non-empty string." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
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
  const normalizedPersona = normalizePersona(persona);
  const sessionCookieValue = session.isNew ? session.session.id : undefined;

  try {
    await upsertSessionIdentitySignals({
      sessionId: session.session.id,
      message: latestMessage,
    });
  } catch (error) {
    captureServerError("upsertSessionIdentitySignals", error, {
      tags: {
        persona: normalizedPersona ?? "unknown",
        route: "/api/web-chat/stream",
        operation: "identitySignals",
      },
    });
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      }

      try {
        send("open", { conversationId, persona: normalizedPersona });

        const effectiveAutonomous = await getEffectiveAutonomous();
        const mode = effectiveAutonomous
          ? normalizeRouteLlmMode(process.env.LLM_MODE)
          : "active_mock";

        let finalData: AgentReply | null = null;
        let errored: { errorCategory: string; errorMessage: string } | null =
          null;

        const generator = streamAgentReply({
          persona: normalizedPersona,
          history,
          latestMessage,
          mode,
          apiKey: process.env.OPENAI_API_KEY || null,
        });

        for await (const event of generator) {
          if (event.type === "delta") {
            send("delta", { text: event.text });
          } else if (event.type === "complete") {
            finalData = event.data;
          } else if (event.type === "error") {
            errored = {
              errorCategory: event.errorCategory,
              errorMessage: event.errorMessage,
            };
            finalData = event.data;
          }
        }

        if (errored) {
          captureServerError(
            "sagasan_live_reply_failed",
            errored.errorMessage || new Error(errored.errorCategory),
            {
              metadata: { errorCategory: errored.errorCategory },
              tags: {
                persona: normalizedPersona ?? "unknown",
                route: "/api/web-chat/stream",
                operation: "streamAgentReply",
              },
            },
          );
        }

        if (!finalData) {
          send("error", {
            errorCategory: "no_final_data",
            errorMessage: "Stream ended without a final payload.",
          });
          controller.close();
          return;
        }

        const llmSignals = finalData.llmExtractedSignals;
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
                persona: finalData.persona ?? "unknown",
                route: "/api/web-chat/stream",
                operation: "identitySignalsLlm",
              },
            });
          }
        }

        const { projectId, journey } = await persistBriefAndAdvanceJourney({
          sessionId: session.session.id,
          persona: finalData.persona,
          extractedFields: finalData.extractedFields,
        });
        const boundNextStep = bindNextStepToProject(
          finalData.nextStep,
          projectId,
        );

        const replyMode =
          finalData.diagnostics.providerState ===
          "openai_not_called_gate_closed"
            ? "holding"
            : "autonomous";

        const turn = await appendTurn({
          sessionId: session.session.id,
          conversationId,
          userMessage: latestMessage,
          assistantReply: finalData.reply,
          mode: replyMode,
          sessionPersona: finalData.persona,
          assistantMeta: {
            persona: finalData.persona,
            route: boundNextStep?.route ?? null,
            nextStep: boundNextStep,
            extractedFields: finalData.extractedFields,
            operation: finalData.diagnostics.operation,
            selectedReplySource: finalData.diagnostics.selectedReplySource,
            fallbackReason: finalData.diagnostics.fallbackReason,
            providerState: finalData.diagnostics.providerState,
            model: finalData.diagnostics.model,
            configuredMode: finalData.diagnostics.configuredMode,
            effectiveMode: finalData.diagnostics.effectiveMode,
          },
        });

        send("complete", {
          conversationId,
          persona: finalData.persona,
          reply: finalData.reply,
          turn,
          mode: replyMode,
          nextStep: boundNextStep,
          projectId,
          journey,
        });
      } catch (error) {
        captureServerError("web_chat_stream_unexpected", error, {
          tags: {
            persona: normalizedPersona ?? "unknown",
            route: "/api/web-chat/stream",
            operation: "sseStream",
          },
        });
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              errorCategory: "stream_failed",
              errorMessage: "Unexpected stream failure.",
            })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: sseHeaders(sessionCookieValue, normalizedPersona),
  });
}
