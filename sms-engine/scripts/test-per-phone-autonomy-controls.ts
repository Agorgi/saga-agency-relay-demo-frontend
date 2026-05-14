import assert from "node:assert/strict";
import { sanitizeAuditMetadata } from "@/sms-engine/audit";
import {
  autonomyAuditEvents,
  evaluateConversationAutonomy,
  serializeConversationAutonomySettingForAdmin,
} from "@/sms-engine/conversation/conversationAutonomy";
import {
  evaluateAndExecuteLiveReply,
  type LiveReplyConfigInput,
} from "@/sms-engine/conversation/liveReplyExecutor";
import { buildNeedsAttentionSummary } from "@/sms-engine/admin/needsAttention";
import { assertNoRawPiiOrSecrets } from "@/sms-engine/dataOps/dataClassification";

const allowedPhone = "+14155550123";
const otherPhone = "+14155550999";

const openConfig = {
  providerMode: "TWILIO",
  sendsDisabled: false,
  allowlistRequired: true,
  allowedNumbers: [allowedPhone],
  allowedNumbersCount: 1,
  twilioStagingMode: true,
  webhookValidationEnabled: true,
  smsComplianceApproved: true,
  pilotStage: "design_partner",
  pilotReplyMode: "auto_allowlisted",
  publicLaunchEnabled: false,
  twilioConfigured: true,
} satisfies LiveReplyConfigInput;

const baseReply = {
  inboundMessage: {
    id: "inbound_autonomy_1",
    twilioMessageSid: "SM_AUTONOMY_TEST_1",
    from: allowedPhone,
    userId: "user_1",
    projectBriefId: "brief_1",
  },
  replyText: "Saga can help turn this into a clear project brief. What city should this happen in?",
  flow: "ORGANIZER_INTAKE",
  recipientPhone: allowedPhone,
  recipientOptedOut: false,
  conversationAutonomy: {
    mode: "AUTONOMOUS_UNTIL_OUTREACH",
    phoneHash: "test_phone_hash",
    redactedPhone: "+1 415•••0123",
  },
  config: openConfig,
  caps: {
    dailySendCap: 25,
    perNumberDailySendCap: 5,
    autonomousReplyDailyCap: 10,
    dailySendCount: 0,
    perNumberDailySendCount: 0,
    autonomousReplyDailyCount: 0,
  },
  dryRun: true,
};

function collectAudit() {
  const events: Array<{ action: string; metadata: Record<string, unknown> }> = [];
  return {
    events,
    audit(event: { action: string; metadata: Record<string, unknown> }) {
      events.push(event);
    },
  };
}

async function evaluateReply(overrides = {}) {
  return evaluateAndExecuteLiveReply({
    ...baseReply,
    ...overrides,
  });
}

function assertNoSmsSideEffects(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("sendSmsMessage"), false);
  assert.equal(serialized.includes("TwilioClient"), false);
  assert.equal(assertNoRawPiiOrSecrets(value), true);
  assert.notEqual(process.env.LLM_MODE, "active_live");
  assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");
}

async function main() {
  const unknown = evaluateConversationAutonomy({
    normalizedPhone: allowedPhone,
    smsSafetyConfig: {
      sendsDisabled: false,
      allowlistRequired: true,
      allowedNumbers: [allowedPhone],
    },
    currentConversationFlow: "ORGANIZER_INTAKE",
  });
  assert.equal(unknown.mode, "MANUAL_REVIEW");
  assert.equal(unknown.decision, "BLOCKED_MANUAL_REVIEW");
  assert.equal(unknown.needsAttention, true);

  const manualCollector = collectAudit();
  const manual = await evaluateReply({
    conversationAutonomy: {
      mode: "MANUAL_REVIEW",
      phoneHash: "test_phone_hash",
      redactedPhone: "+1 415•••0123",
    },
    audit: manualCollector.audit,
  });
  assert.equal(manual.action, "needs_admin");
  assert.equal(manual.status, "NEEDS_ADMIN");
  assert.ok(
    manualCollector.events.some(
      (event) => event.action === autonomyAuditEvents.replyBlocked,
    ),
  );

  for (const flow of [
    "ORGANIZER_INTAKE",
    "CAPABILITY_FAQ",
    "GIG_SEEKER_ONBOARDING",
    "INTEREST_CHECK",
  ]) {
    const result = await evaluateReply({ flow });
    assert.equal(result.status, "SENT", `${flow} should be eligible`);
    assert.equal(result.action, "drafted_only");
    assert.equal(result.dryRun, true);
  }

  const sendsDisabled = await evaluateReply({
    config: { ...openConfig, sendsDisabled: true },
  });
  assert.equal(sendsDisabled.status, "BLOCKED_BY_SENDS_DISABLED");

  const nonAllowlisted = await evaluateReply({
    recipientPhone: otherPhone,
    inboundMessage: { ...baseReply.inboundMessage, from: otherPhone },
  });
  assert.equal(nonAllowlisted.status, "BLOCKED_BY_ALLOWLIST");

  const optedOut = await evaluateReply({ recipientOptedOut: true });
  assert.equal(optedOut.status, "BLOCKED_BY_OPTOUT");

  const paused = await evaluateReply({
    conversationAutonomy: {
      mode: "PAUSED",
      phoneHash: "test_phone_hash",
      redactedPhone: "+1 415•••0123",
    },
  });
  assert.equal(paused.status, "NEEDS_ADMIN");

  const outreachCollector = collectAudit();
  const outreachBoundary = await evaluateReply({
    flow: "CANDIDATE_OUTREACH",
    hasActiveOutreachContext: true,
    audit: outreachCollector.audit,
  });
  assert.notEqual(outreachBoundary.action, "sent");
  assert.ok(
    outreachCollector.events.some(
      (event) =>
        event.action ===
        autonomyAuditEvents.candidateOutreachBoundaryReached,
    ),
  );

  const shortlistCollector = collectAudit();
  const shortlistBoundary = await evaluateReply({
    flow: "ORGANIZER_SHORTLIST",
    audit: shortlistCollector.audit,
  });
  assert.notEqual(shortlistBoundary.action, "sent");
  assert.ok(
    shortlistCollector.events.some(
      (event) => event.action === autonomyAuditEvents.shortlistBoundaryReached,
    ),
  );

  const groupCollector = collectAudit();
  const groupBoundary = await evaluateReply({
    flow: "GROUP_CHAT",
    hasGroupChatAction: true,
    audit: groupCollector.audit,
  });
  assert.notEqual(groupBoundary.action, "sent");
  assert.ok(
    groupCollector.events.some(
      (event) => event.action === autonomyAuditEvents.groupChatBoundaryReached,
    ),
  );

  const rateCollector = collectAudit();
  const paymentIssue = await evaluateReply({
    replyPlan: {
      shouldEscalate: true,
      escalationReason: "rate/payment issue",
    },
    audit: rateCollector.audit,
  });
  assert.equal(paymentIssue.status, "NEEDS_ADMIN");
  assert.ok(
    rateCollector.events.some(
      (event) => event.action === autonomyAuditEvents.handoffRequired,
    ),
  );

  const attention = buildNeedsAttentionSummary([
    {
      id: "autonomy:test",
      type: "autonomy_handoff",
      severity: "needs_review",
      title: "Project ready for candidate outreach approval",
      description: `Do not contact ${allowedPhone}.`,
      href: "/admin/needs-attention",
      createdAt: new Date().toISOString(),
      source: "conversation_autonomy",
    },
  ]);
  assert.equal(attention.totalCount, 1);
  assert.equal(attention.messageCount, 1);
  assert.equal(attention.projectCount, 1);
  assert.equal(attention.sourcingCount, 1);

  const adminSetting = serializeConversationAutonomySettingForAdmin({
    mode: "AUTONOMOUS_UNTIL_OUTREACH",
    redactedPhone: allowedPhone,
    phoneHash: "safe_hash",
  });
  assert.equal(adminSetting.mode, "AUTONOMOUS_UNTIL_OUTREACH");
  assert.equal(
    JSON.stringify(adminSetting).includes(allowedPhone.replace("+", "")),
    false,
  );

  const safeAudit = sanitizeAuditMetadata({
    phoneHash: "safe_hash",
    redactedPhone: "+1 415•••0123",
    rawPhone: allowedPhone,
    secret: "sk-test-secret",
  });
  const serializedAudit = JSON.stringify(safeAudit);
  assert.equal(serializedAudit.includes(allowedPhone), false);
  assert.equal(serializedAudit.includes("sk-test-secret"), false);
  assert.equal(serializedAudit.includes("safe_hash"), true);

  assertNoSmsSideEffects({
    manual,
    sendsDisabled,
    nonAllowlisted,
    optedOut,
    paused,
    outreachBoundary,
    shortlistBoundary,
    groupBoundary,
    paymentIssue,
    attention,
    adminSetting,
    safeAudit,
  });

  console.log(
    "Per-phone autonomy controls passed without Twilio, SMS, outreach, group chats, or production Saga data.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
