import "dotenv/config";
import assert from "node:assert/strict";
import { z } from "zod";
import { callOpenAiStructured } from "@/sms-engine/llm/openaiProvider";
import { safeLlmHealth } from "@/sms-engine/llm/llmProvider";
import { redactForLog } from "@/sms-engine/safeLogging";

const defaultModel = "gpt-5.4-mini";

const preflightSchema = z.object({
  ok: z.boolean(),
  label: z.string().trim().min(1),
});

function safeText(value: unknown) {
  return String(redactForLog(String(value || "")) || "");
}

function isModelNotFound(errorMessage: string, errorCategory: string) {
  return (
    /notfound|not_found|model_not_found/i.test(errorCategory) ||
    /\b404\b|model.*not.*found|model.*does not exist|does not have access/i.test(
      errorMessage,
    )
  );
}

async function main() {
  const health = safeLlmHealth();
  const model = health.model || defaultModel;
  const apiKeyConfigured = health.configured;

  console.log(
    JSON.stringify({
      providerConfigured: health.providerConfigured,
      providerEffective: health.providerEffective,
      modeConfigured: health.modeConfigured,
      modeEffective: health.modeEffective,
      model,
      openaiConfigured: apiKeyConfigured,
      warnings: health.warnings,
      sendsSms: false,
      requiresTwilio: false,
    }),
  );

  if (!apiKeyConfigured) {
    console.log(
      "Skipping OpenAI model preflight because OPENAI_API_KEY is not configured.",
    );
    return;
  }

  const result = await callOpenAiStructured({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL,
    model,
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "8000", 10),
    schema: preflightSchema,
    schemaName: "llm_model_preflight",
    instructions:
      "Return only the requested structured output. This is a model availability preflight.",
    prompt:
      'Return {"ok": true, "label": "model-preflight"} if you can produce structured output.',
    maxOutputTokens: 80,
  });

  if (!result.ok) {
    const errorCategory = safeText(result.errorCategory);
    const errorMessage = safeText(result.errorMessage);
    if (isModelNotFound(errorMessage, errorCategory)) {
      throw new Error(
        `OpenAI model preflight failed: model not found or unavailable (${model}). Check OPENAI_MODEL and account model access. Category: ${errorCategory}.`,
      );
    }
    throw new Error(
      `OpenAI model preflight failed for ${model}. Category: ${errorCategory}. Message: ${errorMessage}`,
    );
  }

  assert.equal(result.data.ok, true);
  assert.equal(result.data.label, "model-preflight");
  console.log(
    JSON.stringify({
      ok: true,
      model,
      structuredOutput: "passed",
      responseIdPresent: Boolean(result.responseId),
      apiKeyLogged: false,
      sendsSms: false,
      requiresTwilio: false,
    }),
  );
}

main().catch((error) => {
  console.error(safeText(error instanceof Error ? error.message : error));
  process.exit(1);
});
