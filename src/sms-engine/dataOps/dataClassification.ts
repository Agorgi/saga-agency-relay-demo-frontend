import { createHash } from "node:crypto";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { normalizePhone } from "@/sms-engine/phone";
import { redactForLog } from "@/sms-engine/safeLogging";

export type DataClassification =
  | "public_safe"
  | "admin_only"
  | "pii"
  | "sensitive"
  | "secret"
  | "internal_only"
  | "redact_by_default";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:whatsapp:)?(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gi;

const secretKeyPattern =
  /(password|token|secret|api[_-]?key|auth|database[_-]?url|connectionstring|account[_-]?sid)/i;
const piiKeyPattern = /(phone|email|sender|recipient|address)/i;
const sensitiveKeyPattern =
  /(body|message|notes|adminNotes|internalNotes|prompt|output|completion|rawText|rateNotes|availabilityNotes)/i;

export function redactPhone(value?: string | null) {
  if (!value) return null;
  return redactPhoneForDisplay(value);
}

export function redactEmail(value?: string | null) {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return "[redacted-email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function hashPhoneForLookup(value?: string | null) {
  if (!value) return null;
  try {
    return createHash("sha256").update(normalizePhone(value)).digest("hex");
  } catch {
    return createHash("sha256").update(value.trim()).digest("hex");
  }
}

function redactText(value: string) {
  const safe = redactForLog(value);
  const text = typeof safe === "string" ? safe : "[redacted]";
  return text
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]");
}

export function classifyModelField(fieldName: string): DataClassification {
  if (secretKeyPattern.test(fieldName)) return "secret";
  if (piiKeyPattern.test(fieldName)) return "pii";
  if (sensitiveKeyPattern.test(fieldName)) return "redact_by_default";
  if (/metadata|audit|status|sid|id$/i.test(fieldName)) return "internal_only";
  return "admin_only";
}

export function redactSensitiveJson(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[redacted-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveJson(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        const classification = classifyModelField(key);
        if (classification === "secret") return [key, "[redacted-secret]"];
        if (classification === "pii") {
          if (/email/i.test(key) && typeof item === "string") {
            return [key, redactEmail(item)];
          }
          if (/phone|sender|recipient/i.test(key) && typeof item === "string") {
            return [key, redactPhone(item)];
          }
          return [key, "[redacted-pii]"];
        }
        if (
          classification === "redact_by_default" &&
          /prompt|output|completion|rawText/i.test(key)
        ) {
          return [key, "[redacted-by-default]"];
        }
        return [key, redactSensitiveJson(item, depth + 1)];
      }),
    );
  }
  return "[redacted]";
}

export function safeExportValue(value: unknown) {
  return redactSensitiveJson(value);
}

export function assertNoRawPiiOrSecrets(value: unknown) {
  const serialized = JSON.stringify(value);
  const hasPhone = PHONE_PATTERN.test(serialized);
  PHONE_PATTERN.lastIndex = 0;
  const hasEmail = EMAIL_PATTERN.test(serialized);
  EMAIL_PATTERN.lastIndex = 0;
  const knownSecret = [
    "OPENAI_API_KEY",
    "TWILIO_AUTH_TOKEN",
    "INTERNAL_API_KEY",
    "ADMIN_PASSWORD",
    "DATABASE_URL",
  ].some((key) => {
    const envValue = process.env[key];
    return Boolean(envValue && envValue.length >= 4 && serialized.includes(envValue));
  });

  return !hasPhone && !hasEmail && !knownSecret;
}
