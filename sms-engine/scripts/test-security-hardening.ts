import assert from "node:assert/strict";
import type { AuditLog, CreatorProfile, Person } from "@prisma/client";
import { adminContactLabel, redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { safeAuditLogForDisplay } from "@/sms-engine/audit";
import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";
import { safePerson } from "@/sms-engine/internalSagaApi";
import { getMessagingProvider } from "@/sms-engine/messagingProvider";
import { buildStructuredLogEvent, redactForLog } from "@/sms-engine/safeLogging";
import { validateTwilioWebhookRequest } from "@/sms-engine/twilioWebhook";

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

async function testInternalApiAuth() {
  await withEnv({ INTERNAL_API_KEY: "expected-internal-test-key" }, async () => {
    const missing = await requireInternalApiKey(
      new Request("https://example.test/api/internal/saga/opportunities"),
    );
    assert.equal(missing?.status, 401);
    const missingBody = await missing?.text();
    assert.ok(!missingBody?.includes("expected-internal-test-key"));

    const wrong = await requireInternalApiKey(
      new Request("https://example.test/api/internal/saga/opportunities", {
        headers: { "X-Saga-Internal-Key": "wrong-key" },
      }),
    );
    assert.equal(wrong?.status, 401);

    const authorized = await requireInternalApiKey(
      new Request("https://example.test/api/internal/saga/opportunities", {
        headers: { "X-Saga-Internal-Key": "expected-internal-test-key" },
      }),
    );
    assert.equal(authorized, null);
  });
}

function testSafePersonSerializer() {
  const now = new Date("2026-05-07T00:00:00.000Z");
  const profile = {
    id: "profile_test",
    personId: "person_test",
    displayName: "Test Creator",
    bio: "Public bio",
    city: "Los Angeles",
    roles: ["photographer"],
    skills: ["lighting"],
    fandoms: ["anime"],
    communities: ["Saga LA"],
    portfolioUrls: ["https://example.test/portfolio"],
    socialUrls: ["https://instagram.test/test"],
    availabilityNotes: "private availability note",
    rateNotes: "private rate note",
    preferredOpportunityTypes: ["paid"],
    reviewStatus: "APPROVED",
    internalNotes: "private internal note",
    createdAt: now,
    updatedAt: now,
  } satisfies CreatorProfile;
  const person = {
    id: "person_test",
    sagaUserId: "saga_user_test",
    phone: "+15551234567",
    email: "private@example.test",
    name: "Test Person",
    city: "Los Angeles",
    state: "CA",
    country: "US",
    source: "APP",
    optedOut: false,
    consentStatus: "IMPLIED",
    createdAt: now,
    updatedAt: now,
    creatorProfile: profile,
  } satisfies Person & { creatorProfile: CreatorProfile };

  const safe = safePerson(person);
  const serialized = JSON.stringify(safe);

  assert.ok(!serialized.includes("+15551234567"));
  assert.ok(!serialized.includes("private@example.test"));
  assert.ok(!serialized.includes("private availability note"));
  assert.ok(!serialized.includes("private rate note"));
  assert.ok(!serialized.includes("private internal note"));
  assert.ok(!("internalNotes" in (safe.creatorProfile || {})));
  assert.ok(!("rateNotes" in (safe.creatorProfile || {})));
  assert.ok(!("availabilityNotes" in (safe.creatorProfile || {})));
}

function testAdminPhoneDisplayRedaction() {
  const redacted = redactPhoneForDisplay("+14016326160");
  assert.equal(redacted, "+1 401•••6160");
  assert.ok(!redacted.includes("6326160"));
  assert.ok(!redacted.includes("+14016326160"));

  const fallback = adminContactLabel({
    phone: "+15551234567",
    fallback: "person_test",
  });
  assert.equal(fallback, "+1 555•••4567");
  assert.ok(!fallback.includes("+15551234567"));

  assert.equal(
    adminContactLabel({
      name: "Public Name",
      phone: "+15551234567",
      fallback: "person_test",
    }),
    "Public Name",
  );
}

async function testMockProviderBoundary() {
  await withEnv(
    {
      MESSAGING_PROVIDER: "MOCK",
      TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      TWILIO_AUTH_TOKEN: "test-twilio-token",
      TWILIO_PHONE_NUMBER: "+15551234567",
      TWILIO_CONVERSATIONS_SERVICE_SID: "ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    async () => {
      const provider = getMessagingProvider("TWILIO");
      assert.equal(provider.name, "MOCK");
      const result = await provider.sendMessage({
        to: "+15557654321",
        body: "Test",
      });
      assert.equal(result.mock, true);
      assert.equal(result.provider, "mock");
    },
  );
}

async function testWebhookUnconfiguredGuard() {
  await withEnv(
    {
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_VALIDATE_WEBHOOKS: "false",
      MESSAGING_PROVIDER: "MOCK",
    },
    async () => {
      const valid = await validateTwilioWebhookRequest({
        request: new Request("https://example.test/api/twilio/inbound", {
          method: "POST",
        }),
        payload: { MessageSid: "SMtest" },
        route: "/api/twilio/inbound",
      });
      assert.equal(valid, false);
    },
  );
}

function testLogRedaction() {
  return withEnv(
    {
      DATABASE_URL: "postgresql://user:password@example.test:5432/db",
      INTERNAL_API_KEY: "internal-secret-value",
      ADMIN_PASSWORD: "admin-secret-value",
      TWILIO_AUTH_TOKEN: "twilio-secret-value",
      OPENAI_API_KEY: "openai-secret-value",
    },
    () => {
      const redacted = JSON.stringify(
        redactForLog({
          databaseUrl: process.env.DATABASE_URL,
          internalApiKey: process.env.INTERNAL_API_KEY,
          phone: "+15551234567",
          email: "private@example.test",
          message:
            "Reach me at +1 (555) 123-4567 or private@example.test after this.",
          nested: {
            error: new Error(
              `Failed with ${process.env.ADMIN_PASSWORD} and ${process.env.OPENAI_API_KEY}`,
            ),
            token: process.env.TWILIO_AUTH_TOKEN,
          },
        }),
      );

      for (const secret of [
        "password@example.test",
        "internal-secret-value",
        "admin-secret-value",
        "twilio-secret-value",
        "openai-secret-value",
        "+15551234567",
        "+1 (555) 123-4567",
        "private@example.test",
      ]) {
        assert.ok(!redacted.includes(secret), `Secret leaked: ${secret}`);
      }
    },
  );
}

function testStructuredLogRedaction() {
  return withEnv(
    {
      INTERNAL_API_KEY: "internal-log-secret",
      MESSAGING_PROVIDER: "MOCK",
    },
    () => {
      const event = JSON.stringify(
        buildStructuredLogEvent({
          level: "error",
          action: "test.structured_log",
          entityType: "Contact",
          entityId: "contact_test",
          status: "error",
          result: "failure",
          requestId: "req_test",
          metadata: {
            internalApiKey: process.env.INTERNAL_API_KEY,
            accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            twilioMessageSid: "SM1234567890abcdef1234567890abcdef",
            phone: "+15551234567",
            email: "private@example.test",
            adminNotes: "private operator note",
          },
          error: new Error(
            `Bad input from +15551234567 / private@example.test / ${process.env.INTERNAL_API_KEY}`,
          ),
        }),
      );

      assert.ok(event.includes("test.structured_log"));
      assert.ok(event.includes("Contact"));
      assert.ok(event.includes("MOCK"));
      assert.ok(event.includes("SM1234567890abcdef1234567890abcdef"));
      for (const unsafe of [
        "internal-log-secret",
        "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "+15551234567",
        "private@example.test",
        "private operator note",
      ]) {
        assert.ok(!event.includes(unsafe), `Structured log leaked: ${unsafe}`);
      }
    },
  );
}

function testSafeAuditSerializer() {
  const now = new Date("2026-05-07T00:00:00.000Z");
  const auditLog = {
    id: "audit_test",
    actorType: "SYSTEM",
    action: "test.audit",
    entityType: "Project",
    entityId: "project_test",
    metadata: {
      projectId: "project_test",
      phone: "+15551234567",
      email: "private@example.test",
      adminNotes: "private admin note",
      internalNotes: "private internal note",
      nested: {
        body: "private inbound body",
        publicId: "candidate_test",
      },
      accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      twilioMessageSid: "SM1234567890abcdef1234567890abcdef",
      token: "secret-token",
    },
    createdAt: now,
  } satisfies AuditLog;

  const safe = safeAuditLogForDisplay(auditLog);
  const serialized = JSON.stringify(safe);

  assert.ok(serialized.includes("project_test"));
  assert.ok(serialized.includes("candidate_test"));
  assert.ok(serialized.includes("SM1234567890abcdef1234567890abcdef"));
  for (const unsafe of [
    "+15551234567",
    "private@example.test",
    "private admin note",
    "private internal note",
    "private inbound body",
    "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "secret-token",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Audit display leaked: ${unsafe}`);
  }
}

function testSignatureFailureAuditRedaction() {
  const now = new Date("2026-05-07T00:00:00.000Z");
  const auditLog = {
    id: "audit_signature_test",
    actorType: "SYSTEM",
    action: "sms.inbound_signature_failed",
    entityType: "Webhook",
    entityId: "/api/twilio/inbound",
    metadata: {
      route: "/api/twilio/inbound",
      from: "+15551234567",
      accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      authToken: "twilio-auth-token-should-not-display",
      twilioMessageSid: "SMffffffffffffffffffffffffffffffff",
      hasSignature: true,
    },
    createdAt: now,
  } satisfies AuditLog;

  const serialized = JSON.stringify(safeAuditLogForDisplay(auditLog));
  assert.ok(serialized.includes("sms.inbound_signature_failed"));
  assert.ok(serialized.includes("SMffffffffffffffffffffffffffffffff"));
  for (const unsafe of [
    "+15551234567",
    "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "twilio-auth-token-should-not-display",
  ]) {
    assert.ok(
      !serialized.includes(unsafe),
      `Signature failure audit leaked: ${unsafe}`,
    );
  }
}

async function main() {
  await testInternalApiAuth();
  testSafePersonSerializer();
  testAdminPhoneDisplayRedaction();
  await testMockProviderBoundary();
  await testWebhookUnconfiguredGuard();
  await testLogRedaction();
  await testStructuredLogRedaction();
  testSafeAuditSerializer();
  testSignatureFailureAuditRedaction();
  console.log("Security hardening checks passed.");
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
