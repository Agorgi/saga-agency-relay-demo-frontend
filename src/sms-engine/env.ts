import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const booleanString = z.preprocess(
  (value) => {
    if (value === "" || value === undefined) return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  },
  z.boolean().optional(),
);

const baseEnvSchema = z.object({
  DATABASE_URL: nonEmpty,
  TWILIO_ACCOUNT_SID: nonEmpty,
  TWILIO_AUTH_TOKEN: nonEmpty,
  TWILIO_MESSAGING_SERVICE_SID: optionalNonEmpty,
  TWILIO_PHONE_NUMBER: optionalNonEmpty,
  TWILIO_CONVERSATIONS_SERVICE_SID: nonEmpty,
  TWILIO_VALIDATE_WEBHOOKS: booleanString,
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_BASE_URL: optionalNonEmpty,
  OPENAI_MODEL: optionalNonEmpty,
  LLM_PROVIDER: optionalNonEmpty,
  LLM_MODE: optionalNonEmpty,
  LLM_TIMEOUT_MS: optionalNonEmpty,
  LLM_DAILY_CALL_CAP: optionalNonEmpty,
  LLM_LOG_PROMPTS: booleanString,
  LLM_LOG_OUTPUTS: booleanString,
  MESSAGING_PROVIDER: optionalNonEmpty,
  SMS_SENDS_DISABLED: booleanString,
  SMS_REQUIRE_ALLOWLIST: booleanString,
  SMS_ALLOWED_NUMBERS: optionalNonEmpty,
  TWILIO_STAGING_MODE: booleanString,
  PILOT_STAGE: optionalNonEmpty,
  PILOT_REPLY_MODE: optionalNonEmpty,
  SMS_ACCESS_MODE: optionalNonEmpty,
  PUBLIC_BETA_ENABLED: booleanString,
  PUBLIC_LAUNCH_ENABLED: booleanString,
  SMS_COMPLIANCE_APPROVED: booleanString,
  PILOT_SUPPORT_CONTACT: optionalNonEmpty,
  PILOT_PRIVACY_URL: optionalNonEmpty,
  PILOT_TERMS_URL: optionalNonEmpty,
  SMS_DAILY_SEND_CAP: optionalNonEmpty,
  SMS_PER_NUMBER_DAILY_SEND_CAP: optionalNonEmpty,
  SMS_AUTONOMOUS_REPLY_DAILY_CAP: optionalNonEmpty,
  SMS_DAILY_INBOUND_CAP: optionalNonEmpty,
  PILOT_MAX_ACTIVE_PARTICIPANTS: optionalNonEmpty,
  PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS: optionalNonEmpty,
  PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS: optionalNonEmpty,
  PUBLIC_BETA_NEW_USER_DAILY_CAP: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_ENABLED: booleanString,
  PUBLIC_WEB_RESEARCH_MODE: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_PROVIDER: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_MAX_RESULTS: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS: booleanString,
  PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS: booleanString,
  PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED: booleanString,
  PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES: optionalNonEmpty,
  PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG: optionalNonEmpty,
  RUN_LIVE_WEB_RESEARCH_TESTS: booleanString,
  MESSAGE_PROCESSING_MODE: optionalNonEmpty,
  CONVERSATION_ENGINE_ACTIVE: booleanString,
  CONVERSATION_ENGINE_MODE: optionalNonEmpty,
  ADMIN_PASSWORD: nonEmpty,
  APP_BASE_URL: nonEmpty,
  INTERNAL_API_KEY: optionalNonEmpty,
  PORT: optionalNonEmpty,
  RAILWAY_ENVIRONMENT: optionalNonEmpty,
  RAILWAY_PROJECT_ID: optionalNonEmpty,
  RAILWAY_SERVICE_ID: optionalNonEmpty,
});

function requireSmsSender(
  env: {
    TWILIO_PHONE_NUMBER?: string;
    TWILIO_MESSAGING_SERVICE_SID?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (!env.TWILIO_PHONE_NUMBER && !env.TWILIO_MESSAGING_SERVICE_SID) {
    ctx.addIssue({
      code: "custom",
      path: ["TWILIO_PHONE_NUMBER"],
      message:
        "Set either TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID for outbound SMS.",
    });
  }
}

const fullEnvSchema = baseEnvSchema.superRefine(requireSmsSender);

const twilioEnvSchema = baseEnvSchema.pick({
  TWILIO_ACCOUNT_SID: true,
  TWILIO_AUTH_TOKEN: true,
  TWILIO_MESSAGING_SERVICE_SID: true,
  TWILIO_PHONE_NUMBER: true,
  TWILIO_CONVERSATIONS_SERVICE_SID: true,
  TWILIO_VALIDATE_WEBHOOKS: true,
}).superRefine(requireSmsSender);

const adminEnvSchema = baseEnvSchema.pick({
  ADMIN_PASSWORD: true,
});

const llmEnvSchema = baseEnvSchema.pick({
  OPENAI_API_KEY: true,
  OPENAI_BASE_URL: true,
  OPENAI_MODEL: true,
  LLM_PROVIDER: true,
  LLM_MODE: true,
  LLM_TIMEOUT_MS: true,
  LLM_DAILY_CALL_CAP: true,
  LLM_LOG_PROMPTS: true,
  LLM_LOG_OUTPUTS: true,
});

const appEnvSchema = baseEnvSchema.pick({
  APP_BASE_URL: true,
  INTERNAL_API_KEY: true,
  PORT: true,
  RAILWAY_ENVIRONMENT: true,
  RAILWAY_PROJECT_ID: true,
  RAILWAY_SERVICE_ID: true,
});

function formatEnvError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
}

function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${formatEnvError(parsed.error)}`);
  }
  return parsed.data;
}

export function validateFullEnv() {
  return parseEnv(fullEnvSchema);
}

export function getTwilioEnv() {
  return parseEnv(twilioEnvSchema);
}

export function getAdminEnv() {
  return parseEnv(adminEnvSchema);
}

export function getLlmEnv() {
  return parseEnv(llmEnvSchema);
}

export function getAppEnv() {
  return parseEnv(appEnvSchema);
}

export function shouldValidateTwilioWebhooks() {
  if (process.env.TWILIO_VALIDATE_WEBHOOKS === "false") {
    return false;
  }

  return true;
}

export function getTwilioConfigPresence() {
  return {
    accountSidConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID),
    authTokenConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
    messagingConfigured: Boolean(
      process.env.TWILIO_MESSAGING_SERVICE_SID ||
        process.env.TWILIO_PHONE_NUMBER,
    ),
    conversationsConfigured: Boolean(
      process.env.TWILIO_CONVERSATIONS_SERVICE_SID &&
        process.env.TWILIO_PHONE_NUMBER,
    ),
    webhookValidationEnabled: shouldValidateTwilioWebhooks(),
    forcedProvider: process.env.MESSAGING_PROVIDER || null,
  };
}

const llmProviderValues = ["fallback", "openai"] as const;
const llmModeValues = [
  "fallback",
  "shadow",
  "active_mock",
  "active_live",
] as const;

function cleanEnvText(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^["'](.*)["']$/, "$1").trim();
  return unquoted;
}

function normalizeEnvKey(value: string) {
  return cleanEnvText(value).toUpperCase();
}

function readRuntimeEnv(name: string) {
  const exact = process.env[name];
  if (cleanEnvText(exact)) {
    return { value: exact, source: "exact" as const };
  }

  const expectedKey = normalizeEnvKey(name);
  for (const [key, value] of Object.entries(process.env)) {
    if (key === name) continue;
    if (normalizeEnvKey(key) === expectedKey && cleanEnvText(value)) {
      return { value, source: "normalized_key" as const };
    }
  }

  return {
    value: exact,
    source: exact === undefined ? ("missing" as const) : ("empty" as const),
  };
}

function normalizeEnvToken(value: string | undefined) {
  return cleanEnvText(value).toLowerCase();
}

export function getLlmConfigPresence() {
  const warnings: string[] = [];
  const providerEnv = readRuntimeEnv("LLM_PROVIDER");
  const modeEnv = readRuntimeEnv("LLM_MODE");
  const apiKeyEnv = readRuntimeEnv("OPENAI_API_KEY");
  const modelEnv = readRuntimeEnv("OPENAI_MODEL");
  const baseUrlEnv = readRuntimeEnv("OPENAI_BASE_URL");

  if (providerEnv.source === "normalized_key") {
    warnings.push("llm_provider_env_key_normalized");
  }

  if (modeEnv.source === "normalized_key") {
    warnings.push("llm_mode_env_key_normalized");
  }

  const requestedProvider = normalizeEnvToken(providerEnv.value);
  const providerIsKnown = llmProviderValues.some(
    (value) => value === requestedProvider,
  );
  const providerConfigured =
    providerIsKnown && requestedProvider
      ? requestedProvider
      : ("fallback" as const);

  if (requestedProvider && !providerIsKnown) {
    warnings.push("invalid_llm_provider");
  }

  const requestedMode = normalizeEnvToken(modeEnv.value);
  const modeIsKnown = llmModeValues.some((value) => value === requestedMode);
  const modeConfigured =
    modeIsKnown && requestedMode ? requestedMode : ("fallback" as const);

  if (requestedMode && !modeIsKnown) {
    warnings.push("invalid_llm_mode");
  }

  const apiKeyConfigured = Boolean(cleanEnvText(apiKeyEnv.value));
  let providerEffective = providerConfigured;
  let modeEffective = modeConfigured;

  if (providerConfigured === "openai" && !apiKeyConfigured) {
    providerEffective = "fallback";
    modeEffective = "fallback";
    warnings.push("openai_api_key_missing");
  }

  if (modeConfigured === "active_live") {
    modeEffective = "fallback";
    warnings.push("active_live_disabled");
  }

  if (providerEffective === "fallback") {
    if (providerConfigured === "fallback" && modeConfigured !== "fallback") {
      warnings.push("llm_mode_inactive_without_openai_provider");
    }
    modeEffective = "fallback";
  }

  return {
    configured: apiKeyConfigured,
    providerConfigured,
    providerEffective,
    modeConfigured,
    modeEffective,
    provider: providerEffective,
    mode: modeEffective,
    model: cleanEnvText(modelEnv.value) || "gpt-5.4-mini",
    customBaseUrlConfigured: Boolean(cleanEnvText(baseUrlEnv.value)),
    shadowMode: modeEffective === "shadow",
    activeLiveAllowed: false,
    warnings,
  };
}

export function getDeploymentInfo() {
  return {
    platform: process.env.RAILWAY_ENVIRONMENT ? "railway" : "local",
    environment:
      process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development",
    portConfigured: Boolean(process.env.PORT),
  };
}
