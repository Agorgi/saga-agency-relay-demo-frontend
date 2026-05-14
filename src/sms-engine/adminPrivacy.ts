import { redactForLog } from "@/sms-engine/safeLogging";

export function redactPhoneForDisplay(phone?: string | null) {
  if (!phone) return "No phone";

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)}•••${digits.slice(-4)}`;
  }

  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)}•••${digits.slice(-4)}`;
  }

  if (digits.length > 7) {
    const prefix = phone.trim().startsWith("+") ? "+" : "";
    return `${prefix}${digits.slice(0, Math.min(3, digits.length - 4))}•••${digits.slice(-4)}`;
  }

  return "[redacted-phone]";
}

export function adminContactLabel({
  name,
  phone,
  email,
  fallback,
}: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  fallback: string;
}) {
  if (name) return name;
  if (phone) return redactPhoneForDisplay(phone);
  return email || fallback;
}

export function redactSensitiveTextForDisplay(value?: string | null) {
  if (!value) return "";
  const redacted = redactForLog(value);
  return typeof redacted === "string" ? redacted : "[redacted]";
}
