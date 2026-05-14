export function normalizePhone(rawPhone: string) {
  const trimmed = rawPhone.trim();

  if (!trimmed) {
    throw new Error("Phone number is required.");
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Phone number must include 10 to 15 digits.");
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function isStopMessage(body: string) {
  return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body.trim());
}

export function isStartMessage(body: string) {
  return /^(start|unstop|yes)$/i.test(body.trim());
}
