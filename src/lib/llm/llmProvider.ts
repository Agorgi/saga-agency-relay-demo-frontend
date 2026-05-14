import type { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getLlmConfigPresence } from "@/lib/env";
import {
  compactLlmText,
  containsForbiddenLlmClaim,
  type LlmMode,
  type LlmProviderName,
} from "@/lib/llm/llmTypes";
import { callOpenAiStructured } from "@/lib/llm/openaiProvider";
import { runFallbackProvider } from "@/lib/llm/fallbackProvider";
import { sagaLlmSystemPrompt } from "@/lib/llm/prompts";
import { recordLlmReviewItem } from "@/lib/llm/qualityReview";
import { redactForLog } from "@/lib/safeLogging";

export const llmAuditEvents = {
  callStarted: "llm.call_started",
  callSucceeded: "llm.call_succeeded",
  callFailed: "llm.call_failed",
  fallbackUsed: "llm.fallback_used",
  activeMockBlockedForTwilioSurface: "llm.active_mock_blocked_for_twilio_surface",
} as const;

export type LlmExecutionContext = "runtime" | "mock_admin" | "live";
export type LlmExecutionSurface =
  | "admin_dev"
  | "twilio_inbound"
  | "test"
  | "background";

export type LlmBlockedReason =
  | "mode_or_context_not_active"
  | "active_live_disabled"
  | "provider_not_configured"
  | "missing_api_key"
  | "unsupported_surface"
  | "validation_failed"
  | "provider_call_failed";

export type LlmExecutionContextDetails = {
  surface: LlmExecutionSurface;
  providerMode: string;
  conversationEngineMode: string | null;
  llmProvider: LlmProviderName;
  llmMode: LlmMode;
  allowActiveMock: boolean;
  allowActiveLive: boolean;
  sendsDisabled: boolean;
  dryRun: boolean;
};

export type ResolvedLlmExecutionContext = {
  executionContext: LlmExecutionContext;
  details: LlmExecutionContextDetails;
};

export type LlmStructuredProvider = <T extends z.ZodType>(input: {
  schema: T;
  schemaName: string;
  instructions: string;
  prompt: string;
  config: LlmRuntimeConfig;
}) => Promise<
  | {
      ok: true;
      data: z.infer<T>;
      rawText?: string | null;
      responseId?: string | null;
    }
  | {
      ok: false;
      errorCategory: string;
      errorMessage: string;
      statusCode?: number | null;
      redactedMessageSnippet?: string | null;
      rawText?: string | null;
      responseId?: string | null;
    }
>;

export type LlmRuntimeConfig = {
  provider: LlmProviderName;
  mode: LlmMode;
  providerConfigured: LlmProviderName;
  providerEffective: LlmProviderName;
  modeConfigured: LlmMode;
  modeEffective: LlmMode;
  configured: boolean;
  model: string;
  baseUrlConfigured: boolean;
  warnings: string[];
  timeoutMs: number;
  dailyCallCap: number | null;
  logPrompts: boolean;
  logOutputs: boolean;
  activeLiveAllowed: boolean;
};

export type StructuredLlmTaskInput<T extends z.ZodType> = {
  operation: string;
  schema: T;
  schemaName: string;
  prompt: string;
  fallback: z.infer<T>;
  instructions?: string;
  entityType?: string;
  entityId?: string;
  executionContext?: LlmExecutionContext;
  provider?: LlmStructuredProvider;
  metadata?: Record<string, unknown>;
  executionContextDetails?: Partial<LlmExecutionContextDetails>;
};

export type StructuredLlmTaskResult<T> = {
  data: T;
  source: "fallback" | "openai";
  provider: LlmProviderName;
  mode: LlmMode;
  usedFallback: boolean;
  openaiCalled: boolean;
  shadowOutput?: T;
  validationPassed: boolean;
  errorCategory?: string;
  fallbackReason?: LlmBlockedReason | string;
  activeLiveAllowed: boolean;
};

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function numberEnv(value: string | undefined, fallback: number | null) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function activeLiveAllowedNow() {
  return false;
}

export function resolveLlmExecutionContext({
  surface,
  providerMode,
  conversationEngineMode = null,
  sendsDisabled = true,
  dryRun = true,
}: {
  surface: LlmExecutionSurface;
  providerMode: string;
  conversationEngineMode?: string | null;
  sendsDisabled?: boolean;
  dryRun?: boolean;
}): ResolvedLlmExecutionContext {
  const config = getLlmRuntimeConfig();
  const normalizedProviderMode = providerMode.toUpperCase();
  const allowActiveMock =
    surface === "admin_dev" &&
    normalizedProviderMode === "MOCK" &&
    config.provider === "openai" &&
    config.mode === "active_mock" &&
    config.configured;

  return {
    executionContext: allowActiveMock ? "mock_admin" : "runtime",
    details: {
      surface,
      providerMode: normalizedProviderMode,
      conversationEngineMode,
      llmProvider: config.provider,
      llmMode: config.mode,
      allowActiveMock,
      allowActiveLive: false,
      sendsDisabled,
      dryRun,
    },
  };
}

export function getLlmRuntimeConfig(): LlmRuntimeConfig {
  const health = getLlmConfigPresence();
  return {
    provider: health.providerEffective as LlmProviderName,
    mode: health.modeEffective as LlmMode,
    providerConfigured: health.providerConfigured as LlmProviderName,
    providerEffective: health.providerEffective as LlmProviderName,
    modeConfigured: health.modeConfigured as LlmMode,
    modeEffective: health.modeEffective as LlmMode,
    configured: health.configured,
    model: health.model || "gpt-5.4-mini",
    baseUrlConfigured: health.customBaseUrlConfigured,
    warnings: health.warnings,
    timeoutMs: numberEnv(process.env.LLM_TIMEOUT_MS, 8000) || 8000,
    dailyCallCap: numberEnv(process.env.LLM_DAILY_CALL_CAP, null),
    logPrompts: booleanEnv(process.env.LLM_LOG_PROMPTS, false),
    logOutputs: booleanEnv(process.env.LLM_LOG_OUTPUTS, false),
    activeLiveAllowed: activeLiveAllowedNow(),
  };
}

async function countLlmCallsToday() {
  if (!process.env.DATABASE_URL) return 0;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  try {
    return await getDb().auditLog.count({
      where: {
        action: llmAuditEvents.callStarted,
        createdAt: { gte: dayStart },
      },
    });
  } catch {
    return 0;
  }
}

function safePreview(value: string, enabled: boolean) {
  if (!enabled) return undefined;
  return compactLlmText(String(redactForLog(value) || ""), 700);
}

export function filterSafeLlmMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !/(prompt|output|completion|rawtext|raw_text)/i.test(key),
    ),
  );
}

async function auditLlm({
  action,
  operation,
  entityType = "LLM",
  entityId = "runtime",
  config,
  metadata = {},
  prompt,
  output,
}: {
  action: string;
  operation: string;
  entityType?: string;
  entityId?: string;
  config: LlmRuntimeConfig;
  metadata?: Record<string, unknown>;
  prompt?: string;
  output?: string | null;
}) {
  const safeMetadata = filterSafeLlmMetadata(metadata);
  await logAudit({
    actorType: "LLM",
    action,
    entityType,
    entityId,
    metadata: {
      operation,
      provider: config.provider,
      mode: config.mode,
      providerConfigured: config.providerConfigured,
      providerEffective: config.providerEffective,
      modeConfigured: config.modeConfigured,
      modeEffective: config.modeEffective,
      model: config.model,
      configured: config.configured,
      activeLiveAllowed: config.activeLiveAllowed,
      warnings: config.warnings,
      promptLoggingEnabled: config.logPrompts,
      outputLoggingEnabled: config.logOutputs,
      promptPreview: safePreview(prompt || "", config.logPrompts),
      outputPreview: output ? safePreview(output, config.logOutputs) : undefined,
      ...safeMetadata,
    },
  });
}

export function buildLlmCallFailedMetadata({
  schemaName,
  config,
  response,
  metadata = {},
}: {
  schemaName: string;
  config: Pick<LlmRuntimeConfig, "mode">;
  response: {
    errorCategory: string;
    statusCode?: number | null;
    redactedMessageSnippet?: string | null;
    responseId?: string | null;
  };
  metadata?: Record<string, unknown>;
}) {
  const safeMetadata = filterSafeLlmMetadata(metadata);

  return {
    schemaName,
    errorCategory: response.errorCategory,
    statusCode: response.statusCode ?? null,
    redactedMessageSnippet: response.redactedMessageSnippet || null,
    responseId: response.responseId || null,
    requestMode: config.mode,
    structuredOutputRequested: true,
    ...safeMetadata,
  };
}

async function recordQualityReviewItem({
  operation,
  entityType,
  entityId,
  config,
  metadata,
  fallbackData,
  llmData,
  selectedData,
  selectedReplySource,
  validationStatus,
  fallbackUsed,
  fallbackReason,
  forbiddenClaimsDetected = false,
}: {
  operation: string;
  entityType?: string;
  entityId?: string;
  config: LlmRuntimeConfig;
  metadata?: Record<string, unknown>;
  fallbackData?: unknown;
  llmData?: unknown;
  selectedData?: unknown;
  selectedReplySource?: string | null;
  validationStatus: string;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
  forbiddenClaimsDetected?: boolean;
}) {
  await recordLlmReviewItem({
    operation,
    entityType,
    entityId,
    metadata,
    provider: config.provider,
    model: config.model,
    mode: config.mode,
    fallbackValue: fallbackData,
    llmValue: llmData,
    selectedValue: selectedData,
    selectedReplySource,
    validationStatus,
    safetyFlags: metadata?.safetyFlags,
    forbiddenClaimsDetected,
    fallbackUsed,
    fallbackReason,
  });
}

function shouldCallOpenAi({
  config,
  executionContext,
}: {
  config: LlmRuntimeConfig;
  executionContext: LlmExecutionContext;
}) {
  return !getLlmCallBlockedReason({ config, executionContext });
}

function getLlmCallBlockedReason({
  config,
  executionContext,
}: {
  config: LlmRuntimeConfig;
  executionContext: LlmExecutionContext;
}): LlmBlockedReason | null {
  if (config.providerConfigured === "openai" && !config.configured) {
    return "missing_api_key";
  }
  if (config.provider !== "openai") return "provider_not_configured";
  if (config.mode === "fallback") return "mode_or_context_not_active";
  if (config.mode === "active_mock" && executionContext !== "mock_admin") {
    return "unsupported_surface";
  }
  if (config.mode === "active_live" && !config.activeLiveAllowed) {
    return "active_live_disabled";
  }
  return null;
}

function shouldUseProviderOutput({
  config,
  executionContext,
}: {
  config: LlmRuntimeConfig;
  executionContext: LlmExecutionContext;
}) {
  if (config.mode === "shadow") return false;
  if (config.mode === "active_mock") return executionContext === "mock_admin";
  if (config.mode === "active_live") {
    return executionContext === "live" && config.activeLiveAllowed;
  }
  return false;
}

export async function runStructuredLlmTask<T extends z.ZodType>({
  operation,
  schema,
  schemaName,
  prompt,
  fallback,
  instructions = sagaLlmSystemPrompt,
  entityType,
  entityId,
  executionContext = "runtime",
  provider,
  metadata = {},
  executionContextDetails,
}: StructuredLlmTaskInput<T>): Promise<
  StructuredLlmTaskResult<z.infer<T>>
> {
  const config = getLlmRuntimeConfig();
  const fallbackResult = await runFallbackProvider({ schema, fallback });
  const fallbackData = fallbackResult.data;
  const inactiveReason = getLlmCallBlockedReason({ config, executionContext });

  if (!shouldCallOpenAi({ config, executionContext })) {
    if (
      config.modeConfigured === "active_mock" &&
      executionContextDetails?.surface === "twilio_inbound"
    ) {
      await auditLlm({
        action: llmAuditEvents.activeMockBlockedForTwilioSurface,
        operation,
        entityType,
        entityId,
        config,
        metadata: {
          reason: "unsupported_surface",
          executionContext,
          ...executionContextDetails,
          ...metadata,
        },
      });
    }
    await auditLlm({
      action: llmAuditEvents.fallbackUsed,
      operation,
      entityType,
      entityId,
      config,
      prompt,
      metadata: {
        reason: inactiveReason || "mode_or_context_not_active",
        executionContext,
        ...executionContextDetails,
        ...metadata,
      },
    });
    await recordQualityReviewItem({
      operation,
      entityType,
      entityId,
      config,
      metadata,
      fallbackData,
      selectedData: fallbackData,
      selectedReplySource: "deterministic_fallback",
      validationStatus: "PROVIDER_FAILED",
      fallbackUsed: true,
      fallbackReason: "provider_call_failed",
    });
    return {
      data: fallbackData,
      source: "fallback",
      provider: config.provider,
      mode: config.mode,
      usedFallback: true,
      openaiCalled: false,
      validationPassed: true,
      fallbackReason: inactiveReason || "mode_or_context_not_active",
      activeLiveAllowed: config.activeLiveAllowed,
    };
  }

  if (config.dailyCallCap !== null) {
    const callsToday = await countLlmCallsToday();
    if (callsToday >= config.dailyCallCap) {
      await auditLlm({
        action: llmAuditEvents.fallbackUsed,
        operation,
        entityType,
        entityId,
        config,
        prompt,
        metadata: {
          reason: "daily_call_cap_exceeded",
          dailyCallCap: config.dailyCallCap,
          callsToday,
          executionContext,
          ...executionContextDetails,
          ...metadata,
        },
      });
      return {
        data: fallbackData,
        source: "fallback",
        provider: config.provider,
        mode: config.mode,
        usedFallback: true,
        openaiCalled: false,
        validationPassed: true,
        errorCategory: "LlmDailyCallCapExceeded",
        fallbackReason: "daily_call_cap_exceeded",
        activeLiveAllowed: config.activeLiveAllowed,
      };
    }
  }

  await auditLlm({
    action: llmAuditEvents.callStarted,
    operation,
    entityType,
    entityId,
    config,
    prompt,
    metadata: {
      schemaName,
      executionContext,
      ...executionContextDetails,
      ...metadata,
    },
  });

  const adapter =
    provider ||
    (async <Schema extends z.ZodType>(input: {
      schema: Schema;
      schemaName: string;
      instructions: string;
      prompt: string;
      config: LlmRuntimeConfig;
    }) =>
      callOpenAiStructured({
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: process.env.OPENAI_BASE_URL,
        model: input.config.model,
        timeoutMs: input.config.timeoutMs,
        schema: input.schema,
        schemaName: input.schemaName,
        instructions: input.instructions,
        prompt: input.prompt,
      }));

  const response = await adapter({
    schema,
    schemaName,
    instructions,
    prompt,
    config,
  });

  if (!response.ok) {
    await auditLlm({
      action: llmAuditEvents.callFailed,
      operation,
      entityType,
      entityId,
      config,
      output: response.rawText || null,
      metadata: buildLlmCallFailedMetadata({
        schemaName,
        config,
        response,
        metadata: {
          executionContext,
          ...executionContextDetails,
          ...metadata,
        },
      }),
    });
    await auditLlm({
      action: llmAuditEvents.fallbackUsed,
      operation,
      entityType,
      entityId,
      config,
      metadata: {
        reason: "provider_call_failed",
        errorCategory: response.errorCategory,
        statusCode: response.statusCode ?? null,
        requestMode: config.mode,
        structuredOutputRequested: true,
        executionContext,
        ...executionContextDetails,
        ...metadata,
      },
    });
    await recordQualityReviewItem({
      operation,
      entityType,
      entityId,
      config,
      metadata,
      fallbackData,
      selectedData: fallbackData,
      selectedReplySource: "deterministic_fallback",
      validationStatus: "PROVIDER_FAILED",
      fallbackUsed: true,
      fallbackReason: "provider_call_failed",
    });
    return {
      data: fallbackData,
      source: "fallback",
      provider: config.provider,
      mode: config.mode,
      usedFallback: true,
      openaiCalled: true,
      validationPassed: false,
      errorCategory: response.errorCategory,
      fallbackReason: "provider_call_failed",
      activeLiveAllowed: config.activeLiveAllowed,
    };
  }

  const validation = schema.safeParse(response.data);
  const forbiddenClaims = containsForbiddenLlmClaim(response.data);
  if (!validation.success || forbiddenClaims) {
    await auditLlm({
      action: llmAuditEvents.callFailed,
      operation,
      entityType,
      entityId,
      config,
      output: response.rawText || null,
      metadata: {
        schemaName,
        errorCategory: forbiddenClaims
          ? "ForbiddenClaimsDetected"
          : "StructuredOutputValidationFailed",
        statusCode: null,
        redactedMessageSnippet: null,
        requestMode: config.mode,
        structuredOutputRequested: true,
        responseId: response.responseId,
        executionContext,
        ...executionContextDetails,
        ...metadata,
      },
    });
    await auditLlm({
      action: llmAuditEvents.fallbackUsed,
      operation,
      entityType,
      entityId,
      config,
      metadata: {
        reason: forbiddenClaims
          ? "forbidden_claims_detected"
          : "validation_failed",
        executionContext,
        ...executionContextDetails,
        ...metadata,
      },
    });
    await recordQualityReviewItem({
      operation,
      entityType,
      entityId,
      config,
      metadata,
      fallbackData,
      llmData: response.data,
      selectedData: fallbackData,
      selectedReplySource: "deterministic_fallback",
      validationStatus: forbiddenClaims ? "FORBIDDEN_CLAIMS" : "INVALID",
      fallbackUsed: true,
      fallbackReason: forbiddenClaims
        ? "forbidden_claims_detected"
        : "validation_failed",
      forbiddenClaimsDetected: forbiddenClaims,
    });
    return {
      data: fallbackData,
      source: "fallback",
      provider: config.provider,
      mode: config.mode,
      usedFallback: true,
      openaiCalled: true,
      validationPassed: false,
      errorCategory: forbiddenClaims
        ? "ForbiddenClaimsDetected"
        : "StructuredOutputValidationFailed",
      fallbackReason: "validation_failed",
      activeLiveAllowed: config.activeLiveAllowed,
    };
  }

  await auditLlm({
    action: llmAuditEvents.callSucceeded,
    operation,
    entityType,
    entityId,
    config,
    output: response.rawText || JSON.stringify(response.data),
    metadata: {
      schemaName,
      responseId: response.responseId,
      executionContext,
      ...executionContextDetails,
      usedForUserFacingOutput: shouldUseProviderOutput({
        config,
        executionContext,
      }),
      ...metadata,
    },
  });

  const useProviderOutput = shouldUseProviderOutput({ config, executionContext });
  if (!useProviderOutput) {
    await recordQualityReviewItem({
      operation,
      entityType,
      entityId,
      config,
      metadata,
      fallbackData,
      llmData: validation.data,
      selectedData: fallbackData,
      selectedReplySource: "deterministic_fallback",
      validationStatus: "VALID",
      fallbackUsed: true,
      fallbackReason: "shadow_mode_not_user_facing",
      forbiddenClaimsDetected: false,
    });
    return {
      data: fallbackData,
      source: "fallback",
      provider: config.provider,
      mode: config.mode,
      usedFallback: true,
      openaiCalled: true,
      shadowOutput: validation.data,
      validationPassed: true,
      activeLiveAllowed: config.activeLiveAllowed,
    };
  }

  await recordQualityReviewItem({
    operation,
    entityType,
    entityId,
    config,
    metadata,
    fallbackData,
    llmData: validation.data,
    selectedData: validation.data,
    selectedReplySource:
      config.mode === "active_mock" ? "openai_active_mock" : "openai",
    validationStatus: "VALID",
    fallbackUsed: false,
    fallbackReason: null,
    forbiddenClaimsDetected: false,
  });

  return {
    data: validation.data,
    source: "openai",
    provider: config.provider,
    mode: config.mode,
    usedFallback: false,
    openaiCalled: true,
    validationPassed: true,
    activeLiveAllowed: config.activeLiveAllowed,
  };
}

export function safeLlmHealth() {
  const config = getLlmRuntimeConfig();
  return {
    provider: config.provider,
    mode: config.mode,
    providerConfigured: config.providerConfigured,
    providerEffective: config.providerEffective,
    modeConfigured: config.modeConfigured,
    modeEffective: config.modeEffective,
    configured: config.configured,
    model: config.model,
    customBaseUrlConfigured: config.baseUrlConfigured,
    shadowMode: config.mode === "shadow",
    activeMockAvailable: config.mode === "active_mock" && config.configured,
    activeLiveAllowed: config.activeLiveAllowed,
    warnings: config.warnings,
    timeoutMs: config.timeoutMs,
    dailyCallCap: config.dailyCallCap,
    promptLoggingEnabled: config.logPrompts,
    outputLoggingEnabled: config.logOutputs,
  };
}
