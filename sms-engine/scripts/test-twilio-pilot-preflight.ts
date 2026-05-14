import { GET as localHealthGet } from "@/app/api/health/route";
import { redactForLog } from "@/sms-engine/safeLogging";

type HealthShape = {
  twilio?: {
    accountSidConfigured?: boolean;
    authTokenConfigured?: boolean;
    messagingConfigured?: boolean;
    webhookValidationEnabled?: boolean;
  };
  sms?: {
    providerMode?: string;
    sendsDisabled?: boolean;
    allowlistRequired?: boolean;
    allowedNumbersCount?: number;
  };
};

function providerMode() {
  return (process.env.MESSAGING_PROVIDER || "MOCK").toUpperCase();
}

function requireEnv(name: string) {
  if (!process.env[name]) throw new Error(`${name} is required for Twilio pilot preflight.`);
}

function rawSensitiveValues() {
  return [
    process.env.TWILIO_AUTH_TOKEN,
    process.env.TWILIO_ACCOUNT_SID,
    process.env.INTERNAL_API_KEY,
    process.env.ADMIN_PASSWORD,
    process.env.OPENAI_API_KEY,
    process.env.DATABASE_URL,
    ...(process.env.SMS_ALLOWED_NUMBERS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter((value): value is string => Boolean(value && value.length >= 4));
}

function assertNoSensitiveValues(text: string) {
  for (const value of rawSensitiveValues()) {
    if (text.includes(value)) {
      throw new Error("Health response exposed a raw secret or allowlisted number.");
    }
  }
}

function assertLocalEnvShape() {
  const mode = providerMode();
  if (!["MOCK", "TWILIO"].includes(mode)) {
    throw new Error("MESSAGING_PROVIDER must be MOCK or TWILIO.");
  }

  if (mode !== "TWILIO") {
    console.log("Twilio pilot preflight: provider mode is MOCK.");
    return;
  }

  if (process.env.TWILIO_STAGING_MODE !== "true") {
    throw new Error("TWILIO_STAGING_MODE=true is required for Twilio staging.");
  }
  if (process.env.TWILIO_VALIDATE_WEBHOOKS !== "true") {
    throw new Error("TWILIO_VALIDATE_WEBHOOKS=true is required for Twilio staging.");
  }
  if (process.env.SMS_REQUIRE_ALLOWLIST !== "true") {
    throw new Error("SMS_REQUIRE_ALLOWLIST=true is required for Twilio staging.");
  }
  const allowedCount = (process.env.SMS_ALLOWED_NUMBERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean).length;
  if (allowedCount <= 0) {
    throw new Error("SMS_ALLOWED_NUMBERS must contain at least one allowlisted number.");
  }
  if (
    process.env.SMS_SENDS_DISABLED !== "true" &&
    process.env.ALLOW_OUTBOUND_PREFLIGHT !== "true"
  ) {
    throw new Error(
      "SMS_SENDS_DISABLED=true is required unless ALLOW_OUTBOUND_PREFLIGHT=true is explicitly set.",
    );
  }

  requireEnv("TWILIO_ACCOUNT_SID");
  requireEnv("TWILIO_AUTH_TOKEN");
  if (!process.env.TWILIO_PHONE_NUMBER && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    throw new Error("Set TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
  }
  if (!process.env.APP_BASE_URL) {
    console.log(
      "Twilio pilot preflight: APP_BASE_URL is missing, so remote health check is skipped.",
    );
  }
}

async function readLocalHealth() {
  const response = await localHealthGet();
  const text = await response.text();
  assertNoSensitiveValues(text);
  return JSON.parse(text) as HealthShape;
}

async function readRemoteHealth() {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!appBaseUrl) return null;

  const response = await fetch(`${appBaseUrl}/api/health`, {
    headers: { "cache-control": "no-cache" },
  });
  const text = await response.text();
  assertNoSensitiveValues(text);
  if (!response.ok) {
    throw new Error(`Remote /api/health returned ${response.status}.`);
  }
  return JSON.parse(text) as HealthShape;
}

function assertHealthSafety(health: HealthShape, label: string) {
  const mode = providerMode();
  if (health.sms?.providerMode !== mode) {
    throw new Error(`${label} health provider mode mismatch.`);
  }
  if (typeof health.sms.allowedNumbersCount !== "number") {
    throw new Error(`${label} health missing allowedNumbersCount.`);
  }

  if (mode === "TWILIO") {
    if (!health.twilio?.accountSidConfigured) {
      throw new Error(`${label} health does not show Twilio account configured.`);
    }
    if (!health.twilio?.authTokenConfigured) {
      throw new Error(`${label} health does not show Twilio auth configured.`);
    }
    if (!health.twilio?.messagingConfigured) {
      throw new Error(`${label} health does not show Twilio messaging configured.`);
    }
    if (health.twilio?.webhookValidationEnabled !== true) {
      throw new Error(`${label} health does not show webhook validation enabled.`);
    }
    if (health.sms?.allowlistRequired !== true) {
      throw new Error(`${label} health does not show allowlist required.`);
    }
    if (
      health.sms?.sendsDisabled !== true &&
      process.env.ALLOW_OUTBOUND_PREFLIGHT !== "true"
    ) {
      throw new Error(`${label} health does not show sends disabled.`);
    }
    if ((health.sms?.allowedNumbersCount || 0) <= 0) {
      throw new Error(`${label} health must report at least one allowed number.`);
    }
  }
}

async function main() {
  assertLocalEnvShape();
  const localHealth = await readLocalHealth();
  assertHealthSafety(localHealth, "local");

  const remoteHealth = await readRemoteHealth();
  if (remoteHealth) assertHealthSafety(remoteHealth, "remote");

  console.log(
    `Twilio pilot preflight passed in ${providerMode()} mode. Remote health ${
      remoteHealth ? "checked" : "skipped"
    }.`,
  );
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
