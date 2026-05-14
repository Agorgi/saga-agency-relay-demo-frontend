import { z } from "zod";

export const conversationEngineModeSchema = z.enum(["shadow", "mock_active"]);
export type ConversationEngineMode = z.infer<typeof conversationEngineModeSchema>;

type ConversationEngineRuntimeInput = {
  providerMode?: string | null;
  requestedMode?: string | null;
  source?: "twilio_webhook" | "admin_dev" | "mock" | "unknown";
};

function normalizeProviderMode(providerMode?: string | null) {
  return (providerMode || process.env.MESSAGING_PROVIDER || "MOCK").toUpperCase();
}

export function getConversationEngineMode(
  requestedMode?: string | null,
): ConversationEngineMode {
  const raw =
    requestedMode ||
    process.env.CONVERSATION_ENGINE_MODE ||
    (process.env.CONVERSATION_ENGINE_ACTIVE === "true"
      ? "mock_active"
      : "shadow");

  const parsed = conversationEngineModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "shadow";
}

export function getConversationEngineRuntime(
  input: ConversationEngineRuntimeInput = {},
) {
  const providerMode = normalizeProviderMode(input.providerMode);
  const mode = getConversationEngineMode(input.requestedMode);
  const activeAllowed =
    mode === "mock_active" &&
    (providerMode === "MOCK" || input.source === "admin_dev");
  const effectiveActive = mode === "mock_active" && activeAllowed;
  const activeBlockedForProvider =
    mode === "mock_active" && !activeAllowed && providerMode === "TWILIO";

  return {
    mode,
    providerMode,
    effectiveActive,
    activeAllowed,
    activeBlockedForProvider,
    blockedReason: activeBlockedForProvider
      ? "conversation_engine_active_blocked_for_twilio"
      : null,
  };
}

export type ConversationEngineRuntime = ReturnType<
  typeof getConversationEngineRuntime
>;
