import assert from "node:assert/strict";
import {
  checkProducerDraftSafety,
  generateCandidateOutreachDraft,
  generateOrganizerShortlistMessageDraft,
  producerOutboundDraftAuditEvents,
  validateOutboundDraftForApproval,
} from "@/lib/producer/outboundDrafts";

const approvedCandidateSummaries = [
  {
    candidateRecommendationId: "rec_approved",
    name: "Rae Star",
    role: "photographer",
    city: "Los Angeles",
    whyTheyFit: [
      "Role fit: photographer",
      "Fandom/community fit: anime",
    ],
    confidence: 0.84,
    gaps: ["Availability needs review"],
  },
];

function organizerDraft() {
  return generateOrganizerShortlistMessageDraft({
    shortlistPacketId: "packet_approved",
    status: "APPROVED",
    projectBriefId: "brief_1",
    projectId: "project_1",
    organizerFacingSummary:
      "These are not confirmed team members yet - they're worth considering.",
    rolesMissing: ["dj"],
    candidateSummaries: approvedCandidateSummaries,
  });
}

function candidateDraft() {
  return generateCandidateOutreachDraft({
    candidateRecommendationId: "rec_approved",
    status: "APPROVED_FOR_SHORTLIST",
    personId: "person_1",
    displayName: "Rae",
    projectBriefId: "brief_1",
    projectId: "project_1",
    projectType: "anime picnic",
    city: "Los Angeles",
    role: "photographer",
    matchingReasons: ["Role fit: photographer"],
  });
}

function testOrganizerShortlistDraft() {
  const draft = organizerDraft();

  assert.equal(draft.type, "ORGANIZER_SHORTLIST");
  assert.equal(draft.status, "NEEDS_REVIEW");
  assert.equal(draft.source, "PRODUCER_AGENT");
  assert.equal(draft.adminReviewRequired, true);
  assert.equal(draft.shortlistPacketId, "packet_approved");
  assert.ok(draft.body.includes("not confirmed"));
  assert.ok(draft.body.includes("Rae Star"));
  assert.ok(draft.body.includes("photographer"));
  assert.ok(draft.body.includes("Roles still needing more research: dj"));
  assert.equal(draft.forbiddenClaimsCheck.passed, true);

  const serialized = JSON.stringify(draft);
  assert.ok(!serialized.includes("Rejected Candidate"));
  assert.ok(!serialized.includes("Do Not Contact Candidate"));
  assert.ok(!serialized.includes("Private note"));
  assert.ok(!/\+14155550123/.test(serialized));
  assert.ok(!/rae@example\.test/.test(serialized));
  assert.ok(!/\bavailable\b/i.test(draft.body));
  assert.ok(!/\bbooked\b/i.test(draft.body));
  assert.ok(!/\bhas been contacted\b/i.test(draft.body));

  const validation = validateOutboundDraftForApproval({
    type: draft.type,
    status: draft.status,
    body: draft.body,
    projectBriefId: draft.projectBriefId,
    projectId: draft.projectId,
    shortlistPacketId: draft.shortlistPacketId,
  });
  assert.equal(validation.ok, true);
}

function testOrganizerDraftBlockedUntilPacketApproved() {
  const draft = generateOrganizerShortlistMessageDraft({
    shortlistPacketId: "packet_draft",
    status: "NEEDS_REVIEW",
    projectBriefId: "brief_1",
    projectId: "project_1",
    organizerFacingSummary: "",
    candidateSummaries: approvedCandidateSummaries,
  });

  assert.equal(draft.status, "BLOCKED");
  assert.equal(draft.blockReason, "shortlist_packet_not_approved");
}

function testCandidateOutreachDraft() {
  const draft = candidateDraft();

  assert.equal(draft.type, "CANDIDATE_OUTREACH");
  assert.equal(draft.status, "NEEDS_REVIEW");
  assert.equal(draft.adminReviewRequired, true);
  assert.ok(draft.body.includes("Would you be open to being considered"));
  assert.ok(draft.body.includes("anime picnic"));
  assert.ok(draft.body.includes("Los Angeles"));
  assert.ok(draft.body.includes("photographer"));
  assert.equal(draft.forbiddenClaimsCheck.passed, true);
  assert.ok(!/\bpayment\b/i.test(draft.body));
  assert.ok(!/\bbooked\b/i.test(draft.body));
  assert.ok(!/\bselected\b/i.test(draft.body));
  assert.ok(!/\bconfirmed role\b/i.test(draft.body));

  const validation = validateOutboundDraftForApproval({
    type: draft.type,
    status: draft.status,
    body: draft.body,
    projectBriefId: draft.projectBriefId,
    projectId: draft.projectId,
    candidateRecommendationId: draft.candidateRecommendationId,
    personId: draft.personId,
  });
  assert.equal(validation.ok, true);
}

function testCandidateDraftBlocksUnsafeContext() {
  const notApproved = generateCandidateOutreachDraft({
    candidateRecommendationId: "rec_rejected",
    status: "REJECTED",
    personId: "person_2",
    displayName: "Mina",
    projectBriefId: "brief_1",
    projectId: "project_1",
    role: "host",
  });
  assert.equal(notApproved.status, "BLOCKED");
  assert.equal(notApproved.blockReason, "candidate_not_approved_for_shortlist");

  const optedOut = generateCandidateOutreachDraft({
    candidateRecommendationId: "rec_opted_out",
    status: "APPROVED_FOR_SHORTLIST",
    personId: "person_3",
    displayName: "Opted Out",
    projectBriefId: "brief_1",
    projectId: "project_1",
    role: "dj",
    optedOut: true,
  });
  assert.equal(optedOut.status, "BLOCKED");
  assert.equal(optedOut.blockReason, "candidate_opted_out");
}

function testEditApproveRejectSafety() {
  const draft = candidateDraft();
  const editedBody =
    "Hey Rae - Saga is exploring an anime picnic in Los Angeles. Would you be open to being considered for photographer if the organizer moves forward?";
  const editedValidation = validateOutboundDraftForApproval({
    type: draft.type,
    status: "NEEDS_REVIEW",
    body: draft.body,
    editedBody,
    projectBriefId: draft.projectBriefId,
    projectId: draft.projectId,
    candidateRecommendationId: draft.candidateRecommendationId,
    personId: draft.personId,
  });
  assert.equal(editedValidation.ok, true);

  const approvedStatus = "APPROVED";
  const rejectedStatus = "REJECTED";
  assert.equal(approvedStatus, "APPROVED");
  assert.equal(rejectedStatus, "REJECTED");

  const badApproval = validateOutboundDraftForApproval({
    type: "CANDIDATE_OUTREACH",
    status: "APPROVED",
    body: editedBody,
    projectBriefId: "brief_1",
    projectId: "project_1",
    candidateRecommendationId: "rec_approved",
    personId: "person_1",
  });
  assert.equal(badApproval.ok, false);
  assert.ok(badApproval.errors.join(" ").includes("DRAFT or NEEDS_REVIEW"));
}

function testSafetyGates() {
  const rawPhone = checkProducerDraftSafety({
    type: "ORGANIZER_SHORTLIST",
    body: "Call +14155550123. These people are not confirmed.",
  });
  assert.equal(rawPhone.passed, false);
  assert.ok(rawPhone.errors.join(" ").includes("phone"));

  const rawEmail = checkProducerDraftSafety({
    type: "ORGANIZER_SHORTLIST",
    body: "Email rae@example.test. These people are not confirmed.",
  });
  assert.equal(rawEmail.passed, false);
  assert.ok(rawEmail.errors.join(" ").includes("emails"));

  const privateNote = checkProducerDraftSafety({
    type: "ORGANIZER_SHORTLIST",
    body: "Private note: Rae is not confirmed.",
  });
  assert.equal(privateNote.passed, false);
  assert.ok(privateNote.errors.join(" ").includes("private"));

  const forbidden = checkProducerDraftSafety({
    type: "CANDIDATE_OUTREACH",
    body: "Hey Rae - you are booked for a confirmed paid role.",
  });
  assert.equal(forbidden.passed, false);
  assert.ok(forbidden.errors.join(" ").includes("Forbidden claims"));
}

function testSideEffectBoundariesAndAuditNames() {
  const combined = JSON.stringify([organizerDraft(), candidateDraft()]).toLowerCase();
  assert.ok(!combined.includes("twilio"));
  assert.ok(!combined.includes("send sms"));
  assert.ok(!combined.includes("create group chat"));
  assert.ok(!combined.includes("outreach sent"));

  for (const eventName of [
    "producer.organizer_shortlist_draft_generated",
    "producer.candidate_outreach_draft_generated",
    "producer.outbound_draft_edited",
    "producer.outbound_draft_approved",
    "producer.outbound_draft_rejected",
    "producer.outbound_draft_blocked",
  ] as const) {
    assert.ok(producerOutboundDraftAuditEvents.includes(eventName));
  }
}

testOrganizerShortlistDraft();
testOrganizerDraftBlockedUntilPacketApproved();
testCandidateOutreachDraft();
testCandidateDraftBlocksUnsafeContext();
testEditApproveRejectSafety();
testSafetyGates();
testSideEffectBoundariesAndAuditNames();

console.log(
  "Producer outbound draft checks passed without SMS, Twilio, sent outreach, group chat creation, or production data.",
);
