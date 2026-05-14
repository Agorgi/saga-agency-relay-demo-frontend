import assert from "node:assert/strict";
import twilio from "twilio";
import { POST as statusPost } from "@/app/api/twilio/status/route";
import { getDb } from "@/sms-engine/db";
import { redactForLog } from "@/sms-engine/safeLogging";
import { validateTwilioWebhookRequest } from "@/sms-engine/twilioWebhook";

const fakeEnv = {
  MESSAGING_PROVIDER: "TWILIO",
  TWILIO_VALIDATE_WEBHOOKS: "true",
  TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  TWILIO_AUTH_TOKEN: "fake_twilio_status_callback_token",
  TWILIO_PHONE_NUMBER: "+15550109999",
  APP_BASE_URL: "https://saga.example.test",
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

function statusPayload(overrides: Record<string, string> = {}) {
  return {
    MessageSid: "SMSTATUS0000000000000000000000000001",
    SmsSid: "SMSTATUS0000000000000000000000000001",
    MessageStatus: "delivered",
    SmsStatus: "delivered",
    To: "+15550107777",
    From: "+15550109999",
    ...overrides,
  };
}

function signedRequest(
  payload: Record<string, string>,
  pathname = "/api/twilio/status",
) {
  const baseUrl = (process.env.APP_BASE_URL || "https://saga.example.test")
    .replace(/\/+$/, "");
  const url = `${baseUrl}${pathname}`;
  const signature = twilio.getExpectedTwilioSignature(
    process.env.TWILIO_AUTH_TOKEN || "",
    url,
    payload,
  );

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
    },
    body: new URLSearchParams(payload),
  });
}

async function testSignatureFixtures() {
  await withEnv(fakeEnv, async () => {
    const payload = statusPayload({
      ExtraTwilioParam: "extra-value",
      SequenceNumber: "42",
    });
    const valid = await validateTwilioWebhookRequest({
      request: signedRequest(payload),
      payload,
      route: "/api/twilio/status",
    });
    assert.equal(valid, true);

    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    const reorderedValid = await validateTwilioWebhookRequest({
      request: signedRequest(reordered),
      payload: reordered,
      route: "/api/twilio/status",
    });
    assert.equal(reorderedValid, true);

    const invalid = await validateTwilioWebhookRequest({
      request: new Request("https://saga.example.test/api/twilio/status", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "invalid",
        },
        body: new URLSearchParams(payload),
      }),
      payload,
      route: "/api/twilio/status",
    });
    assert.equal(invalid, false);

    const missing = await validateTwilioWebhookRequest({
      request: new Request("https://saga.example.test/api/twilio/status", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload),
      }),
      payload,
      route: "/api/twilio/status",
    });
    assert.equal(missing, false);

    const baseUrl = (process.env.APP_BASE_URL || "https://saga.example.test")
      .replace(/\/+$/, "");
    const statusUrl = `${baseUrl}/api/twilio/status`;
    const wrongUrlSignature = twilio.getExpectedTwilioSignature(
      process.env.TWILIO_AUTH_TOKEN || "",
      statusUrl,
      payload,
    );
    const wrongUrl = await validateTwilioWebhookRequest({
      request: new Request(`${baseUrl}/api/twilio/inbound`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": wrongUrlSignature,
        },
        body: new URLSearchParams(payload),
      }),
      payload,
      route: "/api/twilio/status",
    });
    assert.equal(wrongUrl, false);
  });
}

async function testStatusRoutePreDbGuards() {
  await withEnv(fakeEnv, async () => {
    const missingSid = await statusPost(
      signedRequest({
        MessageStatus: "delivered",
        To: "+15550107777",
        From: "+15550109999",
      }),
    );
    assert.equal(missingSid.status, 400);

    const invalidSignature = await statusPost(
      new Request("https://saga.example.test/api/twilio/status", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "invalid",
        },
        body: new URLSearchParams(statusPayload()),
      }),
    );
    assert.equal(invalidSignature.status, 403);

    const nonTwilioPost = await statusPost(
      new Request("https://saga.example.test/api/twilio/status", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(statusPayload()),
      }),
    );
    assert.equal(nonTwilioPost.status, 403);
  });
}

async function testDbBackedStatusUpdates() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "Skipping database-backed Twilio status callback checks because DATABASE_URL is not set.",
    );
    return;
  }

  await withEnv(fakeEnv, async () => {
    const db = getDb();
    const suffix = String(Date.now()).slice(-8);
    const sid = `SM_STATUS_${suffix}`;
    const message = await db.message.create({
      data: {
        direction: "OUTBOUND",
        channel: "SMS",
        body: "Status callback fixture",
        twilioMessageSid: sid,
        metadata: { fixture: "twilio-status-callbacks" },
      },
    });

    for (const status of [
      "sent",
      "delivered",
      "failed",
      "undelivered",
      "mystery_status",
    ]) {
      const response = await statusPost(
        signedRequest(
          statusPayload({
            MessageSid: sid,
            SmsSid: sid,
            MessageStatus: status,
            SmsStatus: status,
            ...(status === "failed"
              ? { ErrorCode: "30007", ErrorMessage: "Filtered" }
              : {}),
          }),
        ),
      );
      assert.equal(response.status, 200);
      const payload = (await response.json()) as { ok: boolean; matched: boolean };
      assert.equal(payload.ok, true);
      assert.equal(payload.matched, true);
    }

    const duplicate = await statusPost(
      signedRequest(
        statusPayload({
          MessageSid: sid,
          SmsSid: sid,
          MessageStatus: "delivered",
          SmsStatus: "delivered",
        }),
      ),
    );
    assert.equal(duplicate.status, 200);

    const messagesWithSid = await db.message.count({
      where: { twilioMessageSid: sid },
    });
    assert.equal(messagesWithSid, 1);

    const updated = await db.message.findUniqueOrThrow({
      where: { id: message.id },
    });
    const metadata = updated.metadata as Record<string, unknown> | null;
    assert.equal(metadata?.twilioStatus, "delivered");
    assert.equal(
      JSON.stringify(metadata).includes(process.env.TWILIO_AUTH_TOKEN || ""),
      false,
    );

    const audits = await db.auditLog.count({
      where: {
        action: "twilio.status_updated",
        entityId: message.id,
      },
    });
    assert.ok(audits >= 1);

    const unmatched = await statusPost(
      signedRequest(
        statusPayload({
          MessageSid: `SM_UNMATCHED_${suffix}`,
          SmsSid: `SM_UNMATCHED_${suffix}`,
          MessageStatus: "delivered",
          SmsStatus: "delivered",
        }),
      ),
    );
    assert.equal(unmatched.status, 200);
    const unmatchedPayload = (await unmatched.json()) as {
      ok: boolean;
      matched: boolean;
    };
    assert.equal(unmatchedPayload.matched, false);
  });
}

async function main() {
  await testSignatureFixtures();
  await testStatusRoutePreDbGuards();
  await testDbBackedStatusUpdates();
  console.log("Twilio status callback checks passed without sending SMS.");
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
