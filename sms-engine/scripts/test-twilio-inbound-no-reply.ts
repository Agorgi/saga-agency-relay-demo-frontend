import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import twilio from "twilio";
import { POST as inboundPost } from "@/app/api/twilio/inbound/route";
import { safeAuditLogForDisplay } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { TwilioMessagingProvider } from "@/lib/messagingProvider";
import { normalizePhone } from "@/lib/phone";
import { redactForLog } from "@/lib/safeLogging";
import { shouldBlockInboundSmsForAllowlist } from "@/lib/smsSafety";

const fakeEnv = {
  MESSAGING_PROVIDER: "TWILIO",
  SMS_SENDS_DISABLED: "true",
  SMS_REQUIRE_ALLOWLIST: "true",
  SMS_ALLOWED_NUMBERS: "+15550107777",
  TWILIO_STAGING_MODE: "true",
  TWILIO_VALIDATE_WEBHOOKS: "true",
  TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  TWILIO_AUTH_TOKEN: "fake_twilio_auth_token_for_inbound_tests",
  TWILIO_PHONE_NUMBER: "+15550109999",
  TWILIO_CONVERSATIONS_SERVICE_SID: "IS00000000000000000000000000000000",
  APP_BASE_URL: "https://saga.example.test",
  ADMIN_PASSWORD: "fake-admin-password",
  TWILIO_API_CALLS_FORBIDDEN: "true",
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

function inboundPayload(overrides: Record<string, string> = {}) {
  return {
    MessageSid: `SM${Date.now()}${Math.random().toString().slice(2, 8)}`,
    SmsSid: `SM${Date.now()}${Math.random().toString().slice(2, 8)}`,
    From: "+15550107777",
    To: process.env.TWILIO_PHONE_NUMBER || "+15550109999",
    Body: "I want to produce a small anime art night in LA.",
    ...overrides,
  };
}

function signedFormRequest(pathname: string, payload: Record<string, string>) {
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

async function assertNoTwimlMessage(response: Response, label: string) {
  const text = await response.text();
  assert.equal(
    /<\s*Message\b/i.test(text),
    false,
    `${label} returned TwiML <Message> content.`,
  );
  assert.match(
    text,
    /<\s*Response\s*\/\s*>|<\s*Response\s*>\s*<\s*\/\s*Response\s*>/i,
    `${label} should return empty TwiML response XML.`,
  );
}

async function findAuditBySid(action: string, twilioMessageSid: string) {
  const audits = await getDb().auditLog.findMany({
    where: { action },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return audits.find((audit) =>
    JSON.stringify(audit.metadata).includes(twilioMessageSid),
  );
}

async function assertSafeAuditForSid({
  action,
  twilioMessageSid,
  unsafePhone,
}: {
  action: string;
  twilioMessageSid: string;
  unsafePhone: string;
}) {
  const audit = await findAuditBySid(action, twilioMessageSid);
  assert.ok(audit, `Expected audit action ${action} for ${twilioMessageSid}`);

  const serialized = JSON.stringify(safeAuditLogForDisplay(audit));
  assert.ok(serialized.includes(twilioMessageSid));
  assert.ok(!serialized.includes(unsafePhone), `${action} leaked raw phone.`);
  assert.ok(!serialized.includes(fakeEnv.TWILIO_AUTH_TOKEN));
  assert.ok(!serialized.includes(fakeEnv.TWILIO_ACCOUNT_SID));
}

async function assertInboundRouteSourceHasNoMessageTwiml() {
  const sourcePath = path.join(
    process.cwd(),
    "src/app/api/twilio/inbound/route.ts",
  );
  const source = await readFile(sourcePath, "utf8");
  assert.equal(
    /<\s*Message\b/i.test(source),
    false,
    "Inbound route source contains TwiML <Message> content.",
  );
}

async function assertRoutePreDbResponsesDoNotReply() {
  const missingBody = await inboundPost(
    signedFormRequest(
      "/api/twilio/inbound",
      inboundPayload({ Body: "", MessageSid: "SMNO_BODY_NO_REPLY" }),
    ),
  );
  assert.equal(missingBody.status, 400);
  await assertNoTwimlMessage(missingBody, "missing-field inbound");

  const provider = new TwilioMessagingProvider();
  const blocked = await provider.sendMessage({
    to: "+15550107777",
    body: "Inbound no-reply provider guard check.",
  });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.blockReason, "sms_sends_disabled");
}

function assertAllowlistDecisions() {
  assert.equal(
    shouldBlockInboundSmsForAllowlist({
      from: "+15550108888",
      body: "Normal inbound idea.",
    }),
    true,
  );
  assert.equal(
    shouldBlockInboundSmsForAllowlist({
      from: "+15550108888",
      body: "STOP",
    }),
    false,
  );
  assert.equal(
    shouldBlockInboundSmsForAllowlist({
      from: "+15550107777",
      body: "Normal inbound idea.",
    }),
    false,
  );
}

async function assertDbBackedInboundPaths() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "Skipping database-backed inbound no-reply checks because DATABASE_URL is not set.",
    );
    return;
  }

  const db = getDb();
  const suffix = String(Date.now()).slice(-8);
  const allowedPhone = normalizePhone("+15550107777");
  const blockedPhone = normalizePhone("+15550108888");
  const stopStartPhone = normalizePhone("+15550106666");

  const allowedPayload = inboundPayload({
    MessageSid: `SM_ALLOWED_${suffix}`,
    SmsSid: `SM_ALLOWED_${suffix}`,
    From: allowedPhone,
  });
  const allowedResponse = await inboundPost(
    signedFormRequest("/api/twilio/inbound", allowedPayload),
  );
  assert.equal(allowedResponse.status, 200);
  await assertNoTwimlMessage(allowedResponse, "allowlisted inbound");

  const allowedInbound = await db.message.findUniqueOrThrow({
    where: { twilioMessageSid: allowedPayload.MessageSid },
    include: { user: true, projectBrief: true },
  });
  assert.equal(allowedInbound.direction, "INBOUND");
  assert.equal(allowedInbound.user?.phone, allowedPhone);

  const blockedOutbound = await db.message.findFirstOrThrow({
    where: {
      direction: "OUTBOUND",
      userId: allowedInbound.userId,
      projectBriefId: allowedInbound.projectBriefId,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(blockedOutbound.twilioMessageSid, null);
  assert.equal(
    (blockedOutbound.metadata as Record<string, unknown> | null)?.blocked,
    true,
  );
  assert.equal(
    (blockedOutbound.metadata as Record<string, unknown> | null)?.blockReason,
    "sms_sends_disabled",
  );
  assert.equal(
    (blockedOutbound.metadata as Record<string, unknown> | null)
      ?.inboundTwilioMessageSid,
    allowedPayload.MessageSid,
  );

  await assertSafeAuditForSid({
    action: "sms.inbound_webhook_received",
    twilioMessageSid: allowedPayload.MessageSid,
    unsafePhone: allowedPhone,
  });
  await assertSafeAuditForSid({
    action: "message.inbound_persisted",
    twilioMessageSid: allowedPayload.MessageSid,
    unsafePhone: allowedPhone,
  });
  await assertSafeAuditForSid({
    action: "message.send_blocked",
    twilioMessageSid: allowedPayload.MessageSid,
    unsafePhone: allowedPhone,
  });

  const blockedPayload = inboundPayload({
    MessageSid: `SM_BLOCKED_${suffix}`,
    SmsSid: `SM_BLOCKED_${suffix}`,
    From: blockedPhone,
  });
  const blockedResponse = await inboundPost(
    signedFormRequest("/api/twilio/inbound", blockedPayload),
  );
  assert.equal(blockedResponse.status, 200);
  await assertNoTwimlMessage(blockedResponse, "non-allowlisted inbound");

  const blockedInbound = await db.message.findUniqueOrThrow({
    where: { twilioMessageSid: blockedPayload.MessageSid },
    include: { user: true, projectBrief: true },
  });
  assert.equal(blockedInbound.user?.phone, blockedPhone);
  assert.equal(blockedInbound.projectBrief?.status, "NEEDS_ADMIN");
  assert.equal(
    blockedInbound.projectBrief?.escalationReason,
    "inbound_sender_not_allowlisted",
  );
  assert.equal(
    (blockedInbound.metadata as Record<string, unknown> | null)?.blockReason,
    "non_allowlisted",
  );
  assert.equal(
    (blockedInbound.metadata as Record<string, unknown> | null)?.replyBlocked,
    true,
  );

  const blockedNormalReply = await db.message.findFirst({
    where: {
      direction: "OUTBOUND",
      userId: blockedInbound.userId,
      projectBriefId: blockedInbound.projectBriefId,
    },
  });
  assert.equal(blockedNormalReply, null);
  await assertSafeAuditForSid({
    action: "sms.inbound_blocked_allowlist",
    twilioMessageSid: blockedPayload.MessageSid,
    unsafePhone: blockedPhone,
  });

  const stopPayload = inboundPayload({
    MessageSid: `SM_STOP_${suffix}`,
    SmsSid: `SM_STOP_${suffix}`,
    From: stopStartPhone,
    Body: "STOP",
  });
  const stopResponse = await inboundPost(
    signedFormRequest("/api/twilio/inbound", stopPayload),
  );
  assert.equal(stopResponse.status, 200);
  await assertNoTwimlMessage(stopResponse, "STOP inbound");

  const stoppedUser = await db.user.findUniqueOrThrow({
    where: { phone: stopStartPhone },
  });
  assert.notEqual(stoppedUser.smsOptedOutAt, null);

  const startPayload = inboundPayload({
    MessageSid: `SM_START_${suffix}`,
    SmsSid: `SM_START_${suffix}`,
    From: stopStartPhone,
    Body: "START",
  });
  const startResponse = await inboundPost(
    signedFormRequest("/api/twilio/inbound", startPayload),
  );
  assert.equal(startResponse.status, 200);
  await assertNoTwimlMessage(startResponse, "START inbound");

  const restartedUser = await db.user.findUniqueOrThrow({
    where: { phone: stopStartPhone },
  });
  assert.equal(restartedUser.smsOptedOutAt, null);

  const startOutbound = await db.message.findFirstOrThrow({
    where: {
      direction: "OUTBOUND",
      userId: restartedUser.id,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(
    (startOutbound.metadata as Record<string, unknown> | null)?.blocked,
    true,
  );
  assert.equal(
    (startOutbound.metadata as Record<string, unknown> | null)?.blockReason,
    "sms_sends_disabled",
  );
}

async function main() {
  await withEnv(fakeEnv, async () => {
    await assertInboundRouteSourceHasNoMessageTwiml();
    await assertRoutePreDbResponsesDoNotReply();
    assertAllowlistDecisions();
    await assertDbBackedInboundPaths();
  });

  console.log(
    "Twilio inbound no-reply checks passed: inbound TwiML stays empty and provider replies stay blocked.",
  );
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
