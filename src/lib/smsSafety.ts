import { normalizePhone } from "@/lib/phone";
import { publicLaunchBlocksOutbound } from "@/lib/pilotControls";

export type SmsBlockReason =
  | "sms_sends_disabled"
  | "recipient_not_allowlisted"
  | "conversation_send_requires_manual_allowlist_verification"
  | "inbound_sender_not_allowlisted"
  | "public_launch_not_ready";

function booleanEnv(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function providerMode(value?: string | null) {
  return (value || process.env.MESSAGING_PROVIDER || "MOCK").toUpperCase();
}

function safeNormalizePhone(rawPhone: string) {
  try {
    return normalizePhone(rawPhone);
  } catch {
    return null;
  }
}

export function allowedSmsNumbers() {
  return (process.env.SMS_ALLOWED_NUMBERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(safeNormalizePhone)
    .filter((phone): phone is string => Boolean(phone));
}

export function getSmsSafetyConfig(input?: { providerMode?: string | null }) {
  const mode = providerMode(input?.providerMode);
  const twilioStagingMode =
    booleanEnv(process.env.TWILIO_STAGING_MODE, false) || mode === "TWILIO";
  const sendsDisabled = booleanEnv(process.env.SMS_SENDS_DISABLED, true);
  const allowlistRequired = booleanEnv(
    process.env.SMS_REQUIRE_ALLOWLIST,
    twilioStagingMode,
  );
  const allowedNumbers = allowedSmsNumbers();

  return {
    providerMode: mode,
    twilioStagingMode,
    sendsDisabled,
    allowlistRequired,
    allowedNumbersCount: allowedNumbers.length,
    allowedNumbers,
  };
}

export function getSmsSafetyHealth() {
  const config = getSmsSafetyConfig();
  return {
    providerMode: config.providerMode,
    twilioStagingMode: config.twilioStagingMode,
    sendsDisabled: config.sendsDisabled,
    allowlistRequired: config.allowlistRequired,
    allowedNumbersCount: config.allowedNumbersCount,
  };
}

export function checkSmsSendAllowed({
  to,
  providerMode: mode,
}: {
  to?: string | null;
  providerMode?: string | null;
}): { allowed: true } | { allowed: false; reason: SmsBlockReason } {
  const config = getSmsSafetyConfig({ providerMode: mode });

  if (config.providerMode !== "TWILIO") {
    return { allowed: true };
  }

  if (
    publicLaunchBlocksOutbound({
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
    })
  ) {
    return { allowed: false, reason: "public_launch_not_ready" };
  }

  if (config.sendsDisabled) {
    return { allowed: false, reason: "sms_sends_disabled" };
  }

  if (config.allowlistRequired) {
    if (!to) return { allowed: false, reason: "recipient_not_allowlisted" };
    const normalized = safeNormalizePhone(to);
    if (!normalized || !config.allowedNumbers.includes(normalized)) {
      return { allowed: false, reason: "recipient_not_allowlisted" };
    }
  }

  return { allowed: true };
}

export function checkConversationSendAllowed({
  providerMode: mode,
}: {
  providerMode?: string | null;
} = {}): { allowed: true } | { allowed: false; reason: SmsBlockReason } {
  const config = getSmsSafetyConfig({ providerMode: mode });

  if (config.providerMode !== "TWILIO") {
    return { allowed: true };
  }

  if (
    publicLaunchBlocksOutbound({
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
    })
  ) {
    return { allowed: false, reason: "public_launch_not_ready" };
  }

  if (config.sendsDisabled) {
    return { allowed: false, reason: "sms_sends_disabled" };
  }

  if (config.allowlistRequired) {
    return {
      allowed: false,
      reason: "conversation_send_requires_manual_allowlist_verification",
    };
  }

  return { allowed: true };
}

export function shouldBlockInboundSmsForAllowlist({
  from,
  body,
}: {
  from: string;
  body?: string | null;
}) {
  const config = getSmsSafetyConfig({ providerMode: "TWILIO" });
  if (!config.allowlistRequired) return false;
  const normalized = safeNormalizePhone(from);
  if (!normalized) return true;
  if (config.allowedNumbers.includes(normalized)) return false;

  const text = (body || "").trim().toUpperCase();
  if (
    ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(text) ||
    ["START", "UNSTOP"].includes(text)
  ) {
    return false;
  }

  return true;
}

export function blockedProviderResult(
  reason: SmsBlockReason,
  provider = "twilio-blocked",
) {
  return {
    sid: null,
    provider,
    mock: true,
    blocked: true,
    blockReason: reason,
    allowedNumbersCount: getSmsSafetyConfig().allowedNumbersCount,
  };
}

export function getAdminSmsSafetyBanners() {
  const config = getSmsSafetyConfig();

  if (config.providerMode === "MOCK") {
    return ["MOCK MODE"];
  }

  const banners: string[] = [];
  if (config.providerMode === "TWILIO" && config.sendsDisabled) {
    banners.push("TWILIO STAGING: SENDS DISABLED");
  }

  if (config.providerMode === "TWILIO" && config.allowlistRequired) {
    banners.push("TWILIO STAGING: ALLOWLISTED SENDS ONLY");
  }

  return banners;
}
