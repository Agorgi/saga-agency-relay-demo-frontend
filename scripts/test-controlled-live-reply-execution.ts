import assert from "node:assert/strict";
import {
  evaluateAndExecuteLiveReply,
  getLiveReplyCaps,
  liveReplyAuditEvents,
  safeLiveReplyHealthSummary,
  type LiveReplyConfigInput,
} from "@/lib/conversation/liveReplyExecutor";

const validConfig = {
  providerMode: "TWILIO",
  sendsDisabled: false,
  allowlistRequired: true,
  allowedNumbers: ["+14155550123"],
  allowedNumbersCount: 1,
  twilioStagingMode: true,
  webhookValidationEnabled: true,
  smsComplianceApproved: true,
  pilotStage: "design_partner",
  pilotReplyMode: "auto_allowlisted",
  publicLaunchEnabled: false,
  twilioConfigured: true,
} satisfies LiveReplyConfigInput;

const validCaps = {
  dailySendCap: 25,
  perNumberDailySendCap: 5,
  autonomousReplyDailyCap: 10,
  dailySendCount: 0,
  perNumberDailySendCount: 0,
  autonomousReplyDailyCount: 0,
};

const baseInput = {
  inboundMessage: {
    id: "inbound_1",
    twilioMessageSid: "SMCONTROLLEDLIVE000000000000000001",
    from: "+14155550123",
    userId: "user_1",
    projectBriefId: "brief_1",
  },
  replyText: "Saga here. I can help turn this into a project brief. What city should this happen in?",
  flow: "ORGANIZER_INTAKE",
  recipientPhone: "+14155550123",
  recipientOptedOut: false,
  conversationAutonomy: {
    mode: "AUTONOMOUS_UNTIL_OUTREACH",
    phoneHash: "test_phone_hash",
    redactedPhone: "+1 415•••0123",
  },
  hasActiveOutreachContext: false,
  hasGroupChatAction: false,
  replyPlan: {
    shouldEscalate: false,
    confidence: 0.9,
  },
  config: validConfig,
  caps: validCaps,
};

function auditCollector() {
  const events: Array<{ action: string; metadata: Record<string, unknown> }> = [];
  return {
    events,
    audit: (event: { action: string; metadata: Record<string, unknown> }) => {
      events.push(event);
    },
  };
}

async function evaluate(overrides = {}) {
  return evaluateAndExecuteLiveReply({
    ...baseInput,
    ...overrides,
  });
}

function assertNoSensitiveValues(serialized: string) {
  for (const unsafe of [
    "TWILIO_AUTH_TOKEN",
    "DATABASE_URL",
    "INTERNAL_API_KEY",
    "SMS_ALLOWED_NUMBERS",
    "+14155550123",
    "14155550123",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

async function testSafetyGates() {
  assert.equal(
    (await evaluate({ config: { ...validConfig, sendsDisabled: true } })).status,
    "BLOCKED_BY_SENDS_DISABLED",
  );
  assert.equal(
    (await evaluate({ config: { ...validConfig, smsComplianceApproved: false } })).status,
    "BLOCKED_BY_COMPLIANCE",
  );
  assert.equal(
    (await evaluate({ recipientPhone: "+14155559999" })).status,
    "BLOCKED_BY_ALLOWLIST",
  );
  assert.equal(
    (await evaluate({ recipientOptedOut: true })).status,
    "BLOCKED_BY_OPTOUT",
  );
  assert.equal(
    (await evaluate({ config: { ...validConfig, pilotReplyMode: "draft_only" } })).status,
    "BLOCKED_BY_REPLY_MODE",
  );
  assert.equal(
    (await evaluate({ config: { ...validConfig, pilotReplyMode: "manual_approval" } })).status,
    "BLOCKED_BY_REPLY_MODE",
  );
  assert.equal(
    (
      await evaluate({
        config: {
          ...validConfig,
          pilotStage: "public_live",
          publicLaunchEnabled: false,
        },
      })
    ).status,
    "BLOCKED_BY_PILOT_STAGE",
  );
}

async function testBlockedFlows() {
  for (const flow of [
    "CONTACT_REPLY",
    "CANDIDATE_OUTREACH",
    "ORGANIZER_SHORTLIST",
    "GROUP_CHAT",
  ]) {
    const result = await evaluate({ flow });
    assert.equal(result.status, "BLOCKED_BY_FLOW", `${flow} should block`);
    assert.equal(result.action, "blocked");
  }

  assert.equal(
    (await evaluate({ hasActiveOutreachContext: true })).status,
    "BLOCKED_BY_FLOW",
  );
  assert.equal(
    (await evaluate({ hasGroupChatAction: true })).status,
    "BLOCKED_BY_FLOW",
  );
}

async function testAllowedOrdinaryFlowsDryRun() {
  for (const flow of [
    "ORGANIZER_INTAKE",
    "GIG_SEEKER_ONBOARDING",
    "INTEREST_CHECK",
  ]) {
    const result = await evaluate({ flow, dryRun: true });
    assert.equal(result.status, "SENT", `${flow} should be eligible`);
    assert.equal(result.action, "drafted_only");
    assert.equal(result.dryRun, true);
  }
}

async function testSafetyEscalationAndForbiddenClaims() {
  const escalation = await evaluate({
    replyPlan: {
      shouldEscalate: true,
      escalationReason: "money_or_contract",
      confidence: 0.8,
    },
  });
  assert.equal(escalation.status, "NEEDS_ADMIN");
  assert.equal(escalation.action, "needs_admin");

  const forbidden = await evaluate({
    replyText: "You are guaranteed a paid booking and confirmed team placement.",
  });
  assert.equal(forbidden.status, "BLOCKED_BY_SAFETY");
  assert.ok(forbidden.blockers.join(" ").includes("Forbidden claims"));
}

async function testIdempotency() {
  const duplicate = await evaluate({
    idempotency: { alreadyRepliedToInboundSid: true },
  });
  assert.equal(duplicate.status, "BLOCKED_BY_IDEMPOTENCY");

  const alreadyHandled = await evaluate({
    idempotency: { latestMessageAlreadyHandled: true },
  });
  assert.equal(alreadyHandled.status, "BLOCKED_BY_IDEMPOTENCY");
}

async function testCaps() {
  assert.equal(
    (
      await evaluate({
        caps: { ...validCaps, dailySendCount: validCaps.dailySendCap },
      })
    ).status,
    "BLOCKED_BY_SAFETY",
  );
  assert.equal(
    (
      await evaluate({
        caps: {
          ...validCaps,
          perNumberDailySendCount: validCaps.perNumberDailySendCap,
        },
      })
    ).status,
    "BLOCKED_BY_SAFETY",
  );
  assert.equal(
    (
      await evaluate({
        caps: {
          ...validCaps,
          autonomousReplyDailyCount: validCaps.autonomousReplyDailyCap,
        },
      })
    ).status,
    "BLOCKED_BY_SAFETY",
  );
}

async function testMockProviderCalledOnce() {
  let sendCount = 0;
  const collector = auditCollector();
  const result = await evaluateAndExecuteLiveReply({
    ...baseInput,
    dryRun: false,
    audit: collector.audit,
    sendMessage: async () => {
      sendCount += 1;
      return {
        messageId: "outbound_1",
        twilioMessageSid: "SM_MOCKED_PROVIDER_ONLY",
      };
    },
  });

  assert.equal(result.status, "SENT");
  assert.equal(result.action, "sent");
  assert.equal(sendCount, 1);
  assert.ok(
    collector.events.some((event) => event.action === liveReplyAuditEvents.sent),
  );

  const duplicate = await evaluateAndExecuteLiveReply({
    ...baseInput,
    dryRun: false,
    idempotency: { alreadyRepliedToInboundSid: true },
    sendMessage: async () => {
      sendCount += 1;
      return {};
    },
  });
  assert.equal(duplicate.status, "BLOCKED_BY_IDEMPOTENCY");
  assert.equal(sendCount, 1);
}

async function testAuditEventsAndPrivacy() {
  const collector = auditCollector();
  const result = await evaluateAndExecuteLiveReply({
    ...baseInput,
    config: { ...validConfig, sendsDisabled: true },
    audit: collector.audit,
  });

  assert.equal(result.status, "BLOCKED_BY_SENDS_DISABLED");
  assert.ok(
    collector.events.some(
      (event) => event.action === liveReplyAuditEvents.evaluated,
    ),
  );
  assert.ok(
    collector.events.some(
      (event) => event.action === liveReplyAuditEvents.blocked,
    ),
  );
  assertNoSensitiveValues(JSON.stringify(result));
  assertNoSensitiveValues(JSON.stringify(collector.events));
}

function testCapDefaultsAndHealthShape() {
  const caps = getLiveReplyCaps();
  assert.equal(caps.dailySendCap, 25);
  assert.equal(caps.perNumberDailySendCap, 5);
  assert.equal(caps.autonomousReplyDailyCap, 10);

  const health = safeLiveReplyHealthSummary({
    liveReplyExecutionAvailable: true,
    autonomousRepliesEnabled: false,
    autonomousReplyBlockerCount: 2,
    blockers: ["blocked"],
    warnings: [],
    sendCaps: {
      dailySendCap: 25,
      perNumberDailySendCap: 5,
      autonomousReplyDailyCap: 10,
      dailySendCount: 0,
      autonomousReplyDailyCount: 0,
    },
    idempotency: {
      usesInboundTwilioMessageSid: true,
      oneReplyPerInboundSid: true,
    },
    safetySnapshot: {
      providerMode: "TWILIO",
      sendsDisabled: true,
      allowlistRequired: true,
      allowedNumbersCount: 1,
      twilioStagingMode: true,
      webhookValidationEnabled: true,
      smsComplianceApproved: false,
      pilotStage: "internal_test",
      pilotReplyMode: "draft_only",
      publicLaunchEnabled: false,
    },
  });
  assert.equal(health.liveReplyExecutionAvailable, true);
  assert.equal(health.autonomousRepliesEnabled, false);
  assert.equal("allowedNumbers" in health, false);
}

async function main() {
  await testSafetyGates();
  await testBlockedFlows();
  await testAllowedOrdinaryFlowsDryRun();
  await testSafetyEscalationAndForbiddenClaims();
  await testIdempotency();
  await testCaps();
  await testMockProviderCalledOnce();
  await testAuditEventsAndPrivacy();
  testCapDefaultsAndHealthShape();

  console.log(
    "Controlled live reply execution gates passed without real SMS, Twilio API calls, group chats, outreach sends, or production data.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
