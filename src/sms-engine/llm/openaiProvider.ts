import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { compactLlmText } from "@/sms-engine/llm/llmTypes";
import { redactForLog } from "@/sms-engine/safeLogging";

let cachedClient: OpenAI | null = null;
let cachedClientKey: string | null = null;
let cachedClientBaseUrl: string | null = null;

export type OpenAiStructuredInput<T extends z.ZodType> = {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  timeoutMs: number;
  schema: T;
  schemaName: string;
  instructions: string;
  prompt: string;
  maxOutputTokens?: number;
};

export type OpenAiStructuredResult<T> =
  | {
      ok: true;
      data: T;
      rawText: string | null;
      responseId: string | null;
    }
  | {
      ok: false;
      errorCategory: string;
      errorMessage: string;
      statusCode?: number | null;
      redactedMessageSnippet?: string | null;
      rawText: string | null;
      responseId: string | null;
    };

function getOpenAiClient({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl?: string | null;
}) {
  const normalizedBaseUrl = baseUrl || null;
  if (
    cachedClient &&
    cachedClientKey === apiKey &&
    cachedClientBaseUrl === normalizedBaseUrl
  ) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: normalizedBaseUrl || undefined,
    maxRetries: 1,
  });
  cachedClientKey = apiKey;
  cachedClientBaseUrl = normalizedBaseUrl;
  return cachedClient;
}

function readErrorString(error: unknown, key: string) {
  if (!error || typeof error !== "object" || !(key in error)) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>).status;
  return typeof value === "number" ? value : null;
}

function redactedSnippet(message: string) {
  const safe = String(redactForLog(message) || "");
  return compactLlmText(safe, 120);
}

export function categorizeOpenAiProviderError(error: unknown) {
  const statusCode = readErrorStatus(error);
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message : "Unknown OpenAI provider error.";
  const code = readErrorString(error, "code");
  const type = readErrorString(error, "type");
  const combined = `${name} ${code} ${type} ${message}`.toLowerCase();

  let errorCategory = "unknown";
  if (
    /zod field|json schema|structured output|response[_ -]?format|schema/.test(
      combined,
    )
  ) {
    errorCategory = "invalid_schema";
  } else if (
    statusCode === 401 ||
    statusCode === 403 ||
    /auth|permission|api key/.test(combined)
  ) {
    errorCategory = "auth_error";
  } else if (
    statusCode === 404 &&
    /model|not found|does not exist|access/.test(combined)
  ) {
    errorCategory = "model_not_found";
  } else if (statusCode === 429 || /rate limit|quota/.test(combined)) {
    errorCategory = "rate_limit";
  } else if (/timeout|timed out|abort/.test(combined)) {
    errorCategory = "timeout";
  } else if (
    statusCode === 400 ||
    /bad request|invalid request/.test(combined)
  ) {
    errorCategory = "invalid_request";
  } else if (typeof statusCode === "number" && statusCode >= 500) {
    errorCategory = "provider_5xx";
  } else if (/network|fetch|econnreset|enotfound|socket/.test(combined)) {
    errorCategory = "network_error";
  }

  return {
    errorCategory,
    statusCode,
    redactedMessageSnippet: redactedSnippet(message),
  };
}

export async function callOpenAiStructured<T extends z.ZodType>({
  apiKey,
  baseUrl,
  model,
  timeoutMs,
  schema,
  schemaName,
  instructions,
  prompt,
  maxOutputTokens = 1200,
}: OpenAiStructuredInput<T>): Promise<OpenAiStructuredResult<z.infer<T>>> {
  const client = getOpenAiClient({ apiKey, baseUrl });

  try {
    const requestOptions: OpenAI.RequestOptions = {
      timeout: timeoutMs,
      maxRetries: 1,
    };
    const response = await client.responses.parse(
      {
        model,
        instructions,
        input: prompt,
        text: {
          format: zodTextFormat(schema, schemaName),
        },
        temperature: 0.2,
        max_output_tokens: maxOutputTokens,
      },
      requestOptions,
    );
    const parsed = response.output_parsed;
    const rawText =
      typeof response.output_text === "string"
        ? compactLlmText(response.output_text)
        : null;

    if (!parsed) {
      return {
        ok: false,
        errorCategory: "EmptyStructuredOutput",
        errorMessage: "OpenAI returned no parsed structured output.",
        rawText,
        responseId: response.id || null,
      };
    }

    return {
      ok: true,
      data: parsed,
      rawText,
      responseId: response.id || null,
    };
  } catch (error) {
    const details = categorizeOpenAiProviderError(error);
    return {
      ok: false,
      errorCategory: details.errorCategory,
      errorMessage:
        error instanceof Error ? error.message : "Unknown OpenAI provider error.",
      statusCode: details.statusCode,
      redactedMessageSnippet: details.redactedMessageSnippet,
      rawText: null,
      responseId: null,
    };
  }
}
