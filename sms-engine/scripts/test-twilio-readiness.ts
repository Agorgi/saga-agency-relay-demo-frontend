import assert from "node:assert/strict";
import { POST as inboundPost } from "@/app/api/twilio/inbound/route";
import { POST as statusPost } from "@/app/api/twilio/status/route";
import { POST as conversationsPost } from "@/app/api/twilio/conversations-webhook/route";
import { GET as healthGet } from "@/app/api/health/route";
import {
  classifyOutreachReplyState,
  detectContactReplyIntent,
} from "@/sms-engine/contactReplies";
import {
  getMessagingProvider,
  TwilioMessagingProvider,
} from "@/sms-engine/messagingProvider";
import {
  shouldSkipDuplicateTwilioMessageSid,
} from "@/sms-engine/messages";
import { normalizePhone, isStartMessage, isStopMessage } from "@/sms-engine/phone";
import { isInboundRateLimited } from "@/sms-engine/rateLimit";
import { redactForLog } from "@/sms-engine/safeLogging";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";
import { formDataToRecord, validateTwilioWebhookRequest } from "@/sms-engine/twilioWebhook";

const fakeTwilioEnv = {
  MESSAGING_PROVIDER: "MOCK",
  TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  TWILIO_AUTH_TOKEN: "fake_twilio_auth_token_for_tests",
  TWILIO_PHONE_NUMBER: "+15550109999",
  TWILIO_CONVERSATIONS_SERVICE_SID: "IS00000000000000000000000000000000",
};

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  run: () => T | Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(updates).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function formRequest(
  path: string,
  payload: Record<string, string>,
  headers: Record<string, string> = {},
) {
  return new Request(`https://saga.example.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(payload),
  });
}

async function readFormFixture(payload: Record<string, string>) {
  return formDataToRecord(await formRequest("/fixture", payload).formData());
}

function fakeInboundSms(overrides: Record<string, string> = {}) {
  return {
    MessageSid: "SM00000000000000000000000000000001",
    SmsSid: "SM00000000000000000000000000000001",
    From: "+15550100001",
    To: "+15550109999",
    Body: "I want to produce an anime art pop-up in LA.",
    ...overrides,
  };
}

function fakeStatusCallback(overrides: Record<string, string> = {}) {
  return {
    MessageSid: "SM00000000000000000000000000000002",
    SmsStatus: "delivered",
    MessageStatus: "delivered",
    To: "+15550100001",
    From: "+15550109999",
    ...overrides,
  };
}

async function testInboundSmsFixture() {
  const record = await readFormFixture(fakeInboundSms());
  assert.equal(record.MessageSid, "SM00000000000000000000000000000001");
  assert.equal(normalizePhone(record.From), "+15550100001");
  assert.equal(record.Body, "I want to produce an anime art pop-up in LA.");
}

async function testStatusCallbackFixture() {
  const record = await readFormFixture(fakeStatusCallback());
  assert.equal(record.MessageSid, "SM00000000000000000000000000000002");
  assert.equal(record.MessageStatus, "delivered");
}

function testDuplicateMessageSidIdempotency() {
  assert.equal(
    shouldSkipDuplicateTwilioMessageSid({
      twilioMessageSid: "SM00000000000000000000000000000003",
      exists: true,
    }),
    true,
  );
  assert.equal(
    shouldSkipDuplicateTwilioMessageSid({
      twilioMessageSid: "SM00000000000000000000000000000003",
      exists: false,
    }),
    false,
  );
  assert.equal(
    shouldSkipDuplicateTwilioMessageSid({
      twilioMessageSid: null,
      exists: true,
    }),
    false,
  );
}

function testStopAndStartFixtures() {
  for (const body of ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]) {
    assert.equal(isStopMessage(body), true, `${body} should be STOP`);
  }
  for (const body of ["START", "UNSTOP", "YES"]) {
    assert.equal(isStartMessage(body), true, `${body} should be START`);
  }
  assert.equal(isStopMessage("I might stop by"), false);
}

async function testInvalidSignatureWebhook() {
  await withEnv(
    {
      ...fakeTwilioEnv,
      TWILIO_VALIDATE_WEBHOOKS: "true",
      DATABASE_URL: undefined,
    },
    async () => {
      const request = formRequest("/api/twilio/inbound", fakeInboundSms(), {
        "x-twilio-signature": "invalid-signature",
      });
      const response = await inboundPost(request);
      assert.equal(response.status, 403);

      const direct = await validateTwilioWebhookRequest({
        request: formRequest("/api/twilio/inbound", fakeInboundSms(), {
          "x-twilio-signature": "invalid-signature",
        }),
        payload: fakeInboundSms(),
        route: "/api/twilio/inbound",
      });
      assert.equal(direct, false);
    },
  );
}

async function testMissingFieldWebhooks() {
  await withEnv(
    {
      ...fakeTwilioEnv,
      TWILIO_VALIDATE_WEBHOOKS: "false",
      DATABASE_URL: undefined,
    },
    async () => {
      const inboundMissingBody = await inboundPost(
        formRequest("/api/twilio/inbound", {
          MessageSid: "SM00000000000000000000000000000004",
          From: "+15550100001",
          To: "+15550109999",
        }),
      );
      assert.equal(inboundMissingBody.status, 400);

      const statusMissingSid = await statusPost(
        formRequest("/api/twilio/status", {
          MessageStatus: "delivered",
          To: "+15550100001",
          From: "+15550109999",
        }),
      );
      assert.equal(statusMissingSid.status, 400);

      const conversationMissingSid = await conversationsPost(
        formRequest("/api/twilio/conversations-webhook", {
          EventType: "onMessageAdded",
          Author: "+15550100001",
          Body: "Hello everyone",
        }),
      );
      assert.equal(conversationMissingSid.status, 400);
    },
  );
}

function testRateLimitFixture() {
  assert.equal(isInboundRateLimited({ tenMinuteCount: 10, dayCount: 30 }), false);
  assert.equal(isInboundRateLimited({ tenMinuteCount: 11, dayCount: 1 }), true);
  assert.equal(isInboundRateLimited({ tenMinuteCount: 1, dayCount: 31 }), true);
}

function testContactReplyFixtures() {
  assert.equal(detectContactReplyIntent("YES, sounds good"), "YES");
  assert.equal(detectContactReplyIntent("no thanks"), "NO");
  assert.equal(detectContactReplyIntent("maybe send info"), "MAYBE");
  assert.equal(detectContactReplyIntent("what is this"), "UNKNOWN");

  const yes = classifyOutreachReplyState({
    currentStatus: "SENT",
    consentToGroupChat: false,
    body: "yes, interested",
  });
  assert.equal(yes.status, "INTERESTED");
  assert.equal(yes.consentToGroupChat, false);
  assert.match(yes.reply, /can I introduce you/i);

  const no = classifyOutreachReplyState({
    currentStatus: "SENT",
    consentToGroupChat: false,
    body: "no thanks",
  });
  assert.equal(no.status, "NOT_INTERESTED");

  const maybe = classifyOutreachReplyState({
    currentStatus: "SENT",
    consentToGroupChat: false,
    body: "maybe, send info",
  });
  assert.equal(maybe.status, "MAYBE");

  const unknown = classifyOutreachReplyState({
    currentStatus: "SENT",
    consentToGroupChat: false,
    body: "who is this",
  });
  assert.equal(unknown.status, "MAYBE");
  assert.equal(unknown.unclearNeedsAdmin, true);
}

function testConsentReplyFixture() {
  const consent = classifyOutreachReplyState({
    currentStatus: "INTERESTED",
    consentToGroupChat: false,
    body: "yes you can add me",
  });
  assert.equal(consent.status, "APPROVED_FOR_GROUPCHAT");
  assert.equal(consent.consentToGroupChat, true);

  const declinedConsent = classifyOutreachReplyState({
    currentStatus: "INTERESTED",
    consentToGroupChat: false,
    body: "no, please do not add me",
  });
  assert.equal(declinedConsent.status, "NOT_INTERESTED");
  assert.equal(declinedConsent.consentToGroupChat, false);
}

async function testMockProviderCannotCallTwilio() {
  await withEnv(
    {
      ...fakeTwilioEnv,
      TWILIO_VALIDATE_WEBHOOKS: "true",
      DATABASE_URL: undefined,
    },
    async () => {
      const provider = getMessagingProvider("TWILIO");
      assert.equal(provider.name, "MOCK");
      const message = await provider.sendMessage({
        to: "+15550100001",
        body: "Mock readiness test",
      });
      assert.equal(message.mock, true);
      assert.equal(message.provider, "mock");

      const conversation = await provider.createGroupConversation({
        friendlyName: "Mock readiness conversation",
      });
      assert.equal(conversation.mock, true);
      assert.match(conversation.sid || "", /^mock-conversation-/);
    },
  );
}

async function testSendsDisabledBlocksTwilioSends() {
  await withEnv(
    {
      MESSAGING_PROVIDER: "TWILIO",
      SMS_SENDS_DISABLED: "true",
      SMS_REQUIRE_ALLOWLIST: "false",
      SMS_ALLOWED_NUMBERS: "",
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
      TWILIO_MESSAGING_SERVICE_SID: undefined,
      TWILIO_CONVERSATIONS_SERVICE_SID: undefined,
    },
    async () => {
      const provider = new TwilioMessagingProvider();
      const result = await provider.sendMessage({
        to: "+15550100010",
        body: "This should be blocked before Twilio.",
      });

      assert.equal(result.blocked, true);
      assert.equal(result.blockReason, "sms_sends_disabled");
      assert.equal(result.sid, null);
      assert.equal(result.mock, true);
    },
  );
}

async function testAllowlistBlocksNonAllowedRecipient() {
  await withEnv(
    {
      MESSAGING_PROVIDER: "TWILIO",
      SMS_SENDS_DISABLED: "false",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15550100011",
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
      TWILIO_MESSAGING_SERVICE_SID: undefined,
      TWILIO_CONVERSATIONS_SERVICE_SID: undefined,
    },
    async () => {
      const provider = new TwilioMessagingProvider();
      const result = await provider.sendMessage({
        to: "+15550100012",
        body: "This should be blocked by the allowlist.",
      });

      assert.equal(result.blocked, true);
      assert.equal(result.blockReason, "recipient_not_allowlisted");
      assert.equal(result.allowedNumbersCount, 1);
    },
  );
}

async function testAllowlistPermitsAllowedRecipientWithoutLiveTwilio() {
  await withEnv(
    {
      MESSAGING_PROVIDER: "TWILIO",
      SMS_SENDS_DISABLED: "false",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15550100013",
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
      TWILIO_MESSAGING_SERVICE_SID: undefined,
      TWILIO_CONVERSATIONS_SERVICE_SID: undefined,
    },
    async () => {
      const provider = new TwilioMessagingProvider();
      const result = await provider.sendMessage({
        to: "(555) 010-0013",
        body: "This should pass safety but stay mocked without credentials.",
      });

      assert.equal(result.blocked, undefined);
      assert.equal(result.mock, true);
      assert.equal(result.provider, "twilio");
    },
  );
}

async function testHealthDoesNotExposeAllowedNumbers() {
  await withEnv(
    {
      MESSAGING_PROVIDER: "TWILIO",
      SMS_SENDS_DISABLED: "true",
      SMS_REQUIRE_ALLOWLIST: "true",
      SMS_ALLOWED_NUMBERS: "+15550100014,+15550100015",
      DATABASE_URL: undefined,
      ADMIN_PASSWORD: "fake-admin-password",
      APP_BASE_URL: "https://saga.example.test",
      INTERNAL_API_KEY: "fake-internal-key",
    },
    async () => {
      const safety = getSmsSafetyHealth();
      assert.equal(safety.allowedNumbersCount, 2);

      const response = await healthGet();
      const text = await response.text();
      assert.equal(text.includes("+15550100014"), false);
      assert.equal(text.includes("+15550100015"), false);

      const body = JSON.parse(text) as {
        sms: {
          providerMode: string;
          sendsDisabled: boolean;
          allowlistRequired: boolean;
          allowedNumbersCount: number;
        };
      };
      assert.equal(body.sms.providerMode, "TWILIO");
      assert.equal(body.sms.sendsDisabled, true);
      assert.equal(body.sms.allowlistRequired, true);
      assert.equal(body.sms.allowedNumbersCount, 2);
    },
  );
}

async function main() {
  await testInboundSmsFixture();
  await testStatusCallbackFixture();
  testDuplicateMessageSidIdempotency();
  testStopAndStartFixtures();
  await testInvalidSignatureWebhook();
  await testMissingFieldWebhooks();
  testRateLimitFixture();
  testContactReplyFixtures();
  testConsentReplyFixture();
  await testMockProviderCannotCallTwilio();
  await testSendsDisabledBlocksTwilioSends();
  await testAllowlistBlocksNonAllowedRecipient();
  await testAllowlistPermitsAllowedRecipientWithoutLiveTwilio();
  await testHealthDoesNotExposeAllowedNumbers();
  console.log("Twilio readiness fixture checks passed without live Twilio.");
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
