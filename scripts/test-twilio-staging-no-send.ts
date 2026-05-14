import { GET as healthGet } from "@/app/api/health/route";
import { TwilioMessagingProvider } from "@/lib/messagingProvider";
import { redactForLog } from "@/lib/safeLogging";

function requireExactEnv(name: string, expected: string) {
  if (process.env[name] !== expected) {
    throw new Error(`${name} must be set to ${expected} for this no-send smoke test.`);
  }
}

function requirePresentEnv(name: string) {
  if (!process.env[name]) {
    throw new Error(`${name} must be configured for this no-send smoke test.`);
  }
}

function requireTwilioStagingEnv() {
  requireExactEnv("MESSAGING_PROVIDER", "TWILIO");
  requireExactEnv("SMS_SENDS_DISABLED", "true");
  requireExactEnv("SMS_REQUIRE_ALLOWLIST", "true");
  requirePresentEnv("TWILIO_ACCOUNT_SID");
  requirePresentEnv("TWILIO_AUTH_TOKEN");

  if (!process.env.TWILIO_PHONE_NUMBER && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    throw new Error(
      "Either TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID must be configured.",
    );
  }
}

function rawAllowedNumbers() {
  return (process.env.SMS_ALLOWED_NUMBERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function assertHealthState() {
  const response = await healthGet();
  const text = await response.text();

  for (const value of rawAllowedNumbers()) {
    if (text.includes(value)) {
      throw new Error("Health output exposed a raw allowlisted phone number.");
    }
  }

  const body = JSON.parse(text) as {
    twilio?: {
      accountSidConfigured?: boolean;
      authTokenConfigured?: boolean;
      messagingConfigured?: boolean;
    };
    sms?: {
      providerMode?: string;
      sendsDisabled?: boolean;
      allowlistRequired?: boolean;
      allowedNumbersCount?: number;
    };
  };

  if (!body.twilio?.accountSidConfigured) {
    throw new Error("Health check does not show Twilio account SID configured.");
  }
  if (!body.twilio?.authTokenConfigured) {
    throw new Error("Health check does not show Twilio auth token configured.");
  }
  if (!body.twilio?.messagingConfigured) {
    throw new Error("Health check does not show Twilio messaging configured.");
  }
  if (body.sms?.providerMode !== "TWILIO") {
    throw new Error("Health check does not show MESSAGING_PROVIDER=TWILIO.");
  }
  if (body.sms?.sendsDisabled !== true) {
    throw new Error("Health check does not show SMS_SENDS_DISABLED=true.");
  }
  if (body.sms?.allowlistRequired !== true) {
    throw new Error("Health check does not show SMS_REQUIRE_ALLOWLIST=true.");
  }
  if (typeof body.sms?.allowedNumbersCount !== "number") {
    throw new Error("Health check does not include allowedNumbersCount.");
  }
}

async function assertTwilioSendPathIsBlocked() {
  const previousGuard = process.env.TWILIO_API_CALLS_FORBIDDEN;
  process.env.TWILIO_API_CALLS_FORBIDDEN = "true";

  try {
    const provider = new TwilioMessagingProvider();
    const result = await provider.sendMessage({
      to: "+15550000000",
      body: "Saga Twilio staging no-send smoke test.",
    });

    if (result.blocked !== true) {
      throw new Error("Twilio send path did not return a blocked result.");
    }
    if (result.blockReason !== "sms_sends_disabled") {
      throw new Error("Twilio send path was not blocked by SMS_SENDS_DISABLED.");
    }
    if (result.sid !== null || result.mock !== true) {
      throw new Error("Twilio send path did not return the synthetic blocked shape.");
    }
  } finally {
    if (previousGuard === undefined) {
      delete process.env.TWILIO_API_CALLS_FORBIDDEN;
    } else {
      process.env.TWILIO_API_CALLS_FORBIDDEN = previousGuard;
    }
  }
}

async function main() {
  requireTwilioStagingEnv();
  await assertHealthState();
  await assertTwilioSendPathIsBlocked();
  console.log(
    "Twilio staging no-send smoke test passed: configured Twilio stayed blocked before any provider API call.",
  );
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
