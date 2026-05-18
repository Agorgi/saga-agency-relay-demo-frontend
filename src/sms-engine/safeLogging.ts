const SENSITIVE_ENV_KEYS = [
  "DATABASE_URL",
  "INTERNAL_API_KEY",
  "ADMIN_PASSWORD",
  "TWILIO_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_CONVERSATIONS_SERVICE_SID",
];

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|api[_-]?key|auth|account[_-]?sid|accountSid|database_url|databaseurl|connectionstring|phone|email|body|message|notes|adminNotes|internalNotes|rateNotes|availabilityNotes)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:whatsapp:)?(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gi;

function redactText(value: string) {
  let redacted = value;

  for (const key of SENSITIVE_ENV_KEYS) {
    const secret = process.env[key];
    if (secret && secret.length >= 4) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }

  redacted = redacted.replace(
    /(postgres(?:ql)?:\/\/)[^\s"'<>]+/gi,
    "$1[redacted]",
  );
  redacted = redacted.replace(EMAIL_PATTERN, "[redacted-email]");
  redacted = redacted.replace(PHONE_PATTERN, "[redacted-phone]");

  return redacted;
}

function shouldRedactKey(key: string) {
  if (
    /^(twilioMessageSid|inboundTwilioMessageSid|messageSid|smsMessageSid|smsSid)$/i.test(
      key,
    )
  ) {
    return false;
  }

  return SENSITIVE_KEY_PATTERN.test(key);
}

// Default depth limit for structured-log redaction. Logs are usually
// shallow (1-3 levels); this is a defense against runaway recursion
// on user-supplied data.
const DEFAULT_MAX_DEPTH = 5;

// Sentry events legitimately go deeper. A typical exception event puts
// stack frames at `exception.values[].stacktrace.frames[]`, which sits
// at depth 6-7 from the event root, and frame-local vars push another
// level. The default limit truncates frames to "[redacted-depth]",
// losing stack traces exactly when Sentry is enabled. Use this limit
// from the Sentry beforeSend hook.
export const SENTRY_REDACT_MAX_DEPTH = 12;

export function redactForLog(
  value: unknown,
  depth = 0,
  maxDepth = DEFAULT_MAX_DEPTH,
): unknown {
  if (depth > maxDepth) return "[redacted-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (value instanceof Error) {
    const errorWithCode = value as Error & { code?: unknown };
    return {
      name: value.name,
      message: redactText(value.message),
      code:
        typeof errorWithCode.code === "string"
          ? redactText(errorWithCode.code)
          : errorWithCode.code,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1, maxDepth));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        shouldRedactKey(key)
          ? "[redacted]"
          : redactForLog(item, depth + 1, maxDepth),
      ]),
    );
  }

  return "[redacted]";
}

export function logServerError(
  message: string,
  error: unknown,
  context: Omit<StructuredLogInput, "action" | "error" | "level"> = {},
) {
  logStructuredEvent({
    level: "error",
    action: message,
    status: "error",
    result: "failure",
    ...context,
    error,
  });
}

export function errorCategory(error: unknown) {
  if (error instanceof Error) return error.name || "Error";
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code || "UnknownError");
  }
  return "UnknownError";
}

export function getProviderMode() {
  return process.env.MESSAGING_PROVIDER || "MOCK";
}

export function requestCorrelationId(request?: Request | null) {
  if (!request) return undefined;
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-railway-request-id") ||
    undefined
  );
}

export type StructuredLogInput = {
  level?: "info" | "warn" | "error";
  action: string;
  entityType?: string;
  entityId?: string;
  providerMode?: string;
  status?: string;
  result?: string;
  errorCategory?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

export function buildStructuredLogEvent(input: StructuredLogInput) {
  return redactForLog({
    ts: new Date().toISOString(),
    level: input.level || "info",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    providerMode: input.providerMode || getProviderMode(),
    status: input.status,
    result: input.result,
    errorCategory:
      input.errorCategory || (input.error ? errorCategory(input.error) : undefined),
    requestId: input.requestId,
    metadata: input.metadata,
    error: input.error,
  });
}

export function logStructuredEvent(input: StructuredLogInput) {
  const event = buildStructuredLogEvent(input);
  const line = JSON.stringify(event);
  if (input.level === "error") {
    console.error(line);
  } else if (input.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
