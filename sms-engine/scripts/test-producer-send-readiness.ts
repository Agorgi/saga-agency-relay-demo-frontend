import assert from "node:assert/strict";
import {
  evaluateApprovedDraftSendReadiness,
  producerDraftSendReadinessAuditEvent,
} from "@/sms-engine/producer/sendReadiness";

const validConfig = {
  providerMode: "TWILIO",
  sendsDisabled: false,
  allowlistRequired: true,
  allowedNumbers: ["+14155550123"],
  allowedNumbersCount: 1,
  twilioStagingMode: true,
  webhookValidationEnabled: true,
  twilioConfigured: true,
  complianceApproved: true,
  publicLaunchEnabled: false,
  pilotStage: "design_partner",
  pilotReplyMode: "manual_approval",
  autoRepliesEnabled: false,
  supportContactConfigured: true,
  privacyUrlConfigured: true,
  termsUrlConfigured: true,
  dailySendCapConfigured: true,
  dailyInboundCapConfigured: true,
  maxActiveParticipantsConfigured: true,
};

const approvedOrganizerDraft = {
  draftId: "draft_organizer",
  type: "ORGANIZER_SHORTLIST",
  status: "APPROVED",
  body:
    "Here's a draft shortlist. These people are not confirmed yet - they are candidates Saga thinks may be worth considering.",
  recipientKind: "ORGANIZER",
  projectBriefId: "brief_1",
  projectId: "project_1",
  shortlistPacketId: "packet_1",
  shortlistPacketStatus: "APPROVED",
  recipientPhone: "+14155550123",
  recipientOptedOut: false,
};

const approvedCandidateDraft = {
  draftId: "draft_candidate",
  type: "CANDIDATE_OUTREACH",
  status: "APPROVED",
  body:
    "Hey Rae - Saga is helping explore an anime picnic in Los Angeles. Would you be open to being considered for photographer if the organizer moves forward?",
  recipientKind: "CANDIDATE",
  projectBriefId: "brief_1",
  projectId: "project_1",
  candidateRecommendationId: "rec_1",
  candidateRecommendationStatus: "APPROVED_FOR_SHORTLIST",
  recipientPhone: "+14155550123",
  recipientOptedOut: false,
};

function evaluate(
  draft: Parameters<typeof evaluateApprovedDraftSendReadiness>[0]["draft"],
  config: Partial<typeof validConfig> = {},
) {
  return evaluateApprovedDraftSendReadiness({
    draft,
    config: { ...validConfig, ...config },
  });
}

function testBlockedBySendsDisabled() {
  const result = evaluate(approvedCandidateDraft, { sendsDisabled: true });
  assert.equal(result.readinessStatus, "BLOCKED_BY_SENDS_DISABLED");
  assert.equal(result.eligible, false);
  assert.equal(result.dryRunOnly, true);
  assert.ok(result.blockers.join(" ").includes("SMS_SENDS_DISABLED"));
}

function testDraftStatusGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    status: "NEEDS_REVIEW",
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_DRAFT_STATUS");
  assert.ok(result.blockers.join(" ").includes("not approved"));
}

function testMissingRecipientGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    recipientPhone: null,
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_MISSING_RECIPIENT");
}

function testAllowlistGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    recipientPhone: "+14155559999",
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_ALLOWLIST");
  assert.equal(result.recipientSummary.isAllowlisted, false);
}

function testOptOutGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    recipientOptedOut: true,
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_OPTOUT");
  assert.equal(result.recipientSummary.optedOut, true);
}

function testMissingTwilioConfigGate() {
  const result = evaluate(approvedCandidateDraft, { twilioConfigured: false });
  assert.equal(result.readinessStatus, "BLOCKED_BY_UNKNOWN");
  assert.ok(result.blockers.join(" ").includes("Twilio credentials"));
}

function testComplianceGate() {
  const result = evaluate(approvedCandidateDraft, {
    complianceApproved: false,
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_COMPLIANCE");
}

function testDraftOnlyGate() {
  const result = evaluate(approvedCandidateDraft, {
    pilotReplyMode: "draft_only",
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_PILOT_STAGE");
  assert.ok(result.blockers.join(" ").includes("draft_only"));
}

function testPublicLiveFailsClosed() {
  const result = evaluate(approvedCandidateDraft, {
    pilotStage: "public_live",
    publicLaunchEnabled: false,
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_PILOT_STAGE");
  assert.ok(result.blockers.join(" ").includes("PUBLIC_LAUNCH_ENABLED"));
}

function testOrganizerRequiresApprovedShortlistPacket() {
  const result = evaluate({
    ...approvedOrganizerDraft,
    shortlistPacketStatus: "NEEDS_REVIEW",
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_DRAFT_STATUS");
  assert.ok(result.blockers.join(" ").includes("approved ShortlistPacket"));
}

function testCandidateDoNotContactGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    candidateRecommendationStatus: "DO_NOT_CONTACT",
    candidateDoNotContact: true,
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_DRAFT_STATUS");
  assert.ok(result.blockers.join(" ").includes("DO_NOT_CONTACT"));
}

function testForbiddenClaimsGate() {
  const result = evaluate({
    ...approvedCandidateDraft,
    body:
      "Hey Rae - you are booked for a confirmed paid role and will join the team.",
  });
  assert.equal(result.readinessStatus, "BLOCKED_BY_FORBIDDEN_CLAIMS");
  assert.ok(result.blockers.join(" ").includes("Forbidden claims"));
}

function testPrivacyGate() {
  const rawContact = evaluate({
    ...approvedOrganizerDraft,
    body:
      "Here's a draft shortlist. These people are not confirmed. Call +14155550123.",
  });
  assert.equal(rawContact.readinessStatus, "BLOCKED_BY_FORBIDDEN_CLAIMS");

  const privateNote = evaluate({
    ...approvedOrganizerDraft,
    body:
      "Here's a draft shortlist. These people are not confirmed. Private note: do not share.",
  });
  assert.equal(privateNote.readinessStatus, "BLOCKED_BY_FORBIDDEN_CLAIMS");
}

function testReadyInDryRun() {
  const result = evaluate(approvedCandidateDraft);
  assert.equal(result.readinessStatus, "READY_IN_DRY_RUN");
  assert.equal(result.eligible, true);
  assert.equal(result.dryRunOnly, true);
  assert.equal(result.recipientSummary.redactedPhone, "+1 415•••0123");
  assert.equal(result.safetySnapshot.allowedNumbersCount, 1);
}

function testNoSideEffectShape() {
  const result = evaluate(approvedCandidateDraft);
  const serialized = JSON.stringify(result).toLowerCase();
  assert.ok(!serialized.includes("twilio_auth_token"));
  assert.ok(!serialized.includes("internal_api_key"));
  assert.ok(!serialized.includes("database_url"));
  assert.ok(!serialized.includes("+14155550123"));
  assert.ok(!serialized.includes("sms sent"));
  assert.ok(!serialized.includes("group chat created"));
  assert.ok(!serialized.includes("outreach sent"));
}

function testAuditEventName() {
  assert.equal(
    producerDraftSendReadinessAuditEvent,
    "producer.draft_send_readiness_evaluated",
  );
}

testBlockedBySendsDisabled();
testDraftStatusGate();
testMissingRecipientGate();
testAllowlistGate();
testOptOutGate();
testMissingTwilioConfigGate();
testComplianceGate();
testDraftOnlyGate();
testPublicLiveFailsClosed();
testOrganizerRequiresApprovedShortlistPacket();
testCandidateDoNotContactGate();
testForbiddenClaimsGate();
testPrivacyGate();
testReadyInDryRun();
testNoSideEffectShape();
testAuditEventName();

console.log(
  "Producer send readiness checks passed without SMS, Twilio calls, outreach sends, group chat creation, or production data.",
);
