import { logAudit } from "@/sms-engine/audit";
import { getLlmConfigPresence } from "@/sms-engine/env";

export async function logLlmFallbackUsed({
  operation,
  entityType,
  entityId,
  metadata = {},
}: {
  operation: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const llm = getLlmConfigPresence();

  if (llm.configured) return;

  await logAudit({
    actorType: "LLM",
    action: "llm.fallback_used",
    entityType,
    entityId,
    metadata: {
      operation,
      provider: llm.provider,
      mode: llm.mode,
      providerConfigured: llm.providerConfigured,
      providerEffective: llm.providerEffective,
      modeConfigured: llm.modeConfigured,
      modeEffective: llm.modeEffective,
      warnings: llm.warnings,
      ...metadata,
    },
  });
}
