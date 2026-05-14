import assert from "node:assert/strict";
import {
  candidateReviewAuditAction,
  generateShortlistPacketDraft,
  normalizeCandidateReviewStatus,
  validateShortlistPacketForApproval,
  type ShortlistPacketCandidateInput,
} from "@/lib/producer/approvalQueue";

const approvedCandidate: ShortlistPacketCandidateInput = {
  candidateRecommendationId: "rec_approved",
  personId: "person_approved",
  displayName: "Rae Star",
  role: "photographer",
  city: "Los Angeles",
  score: 28,
  scoreBreakdown: {
    roleFit: 10,
    fandomFit: 6,
    locationFit: 7,
    proximity: 3,
    reliability: 2,
  },
  proximityTier: "FRIEND",
  matchingReasons: [
    "Role fit: photographer",
    "Same city: Los Angeles",
    "Fandom/community fit: anime",
  ],
  risks: ["Availability needs review"],
  status: "APPROVED_FOR_SHORTLIST",
  adminReviewNotes: "Private note: admin-only availability concern",
  privateNotes: "Do not share this internal note.",
};

const rejectedCandidate: ShortlistPacketCandidateInput = {
  ...approvedCandidate,
  candidateRecommendationId: "rec_rejected",
  displayName: "Rejected Candidate",
  status: "REJECTED",
};

const doNotContactCandidate: ShortlistPacketCandidateInput = {
  ...approvedCandidate,
  candidateRecommendationId: "rec_dnc",
  displayName: "Do Not Contact Candidate",
  status: "DO_NOT_CONTACT",
};

const needsMoreInfoCandidate: ShortlistPacketCandidateInput = {
  ...approvedCandidate,
  candidateRecommendationId: "rec_more_info",
  displayName: "Needs More Info Candidate",
  status: "NEEDS_MORE_INFO",
};

const contactLaterCandidate: ShortlistPacketCandidateInput = {
  ...approvedCandidate,
  candidateRecommendationId: "rec_contact_later",
  displayName: "Contact Later Candidate",
  status: "CONTACT_LATER",
};

function generatePacket(candidates: ShortlistPacketCandidateInput[]) {
  return generateShortlistPacketDraft({
    projectBriefId: "brief_1",
    projectId: "project_1",
    projectTitle: "Anime picnic",
    roles: [
      { role: "photographer", title: "Photographer", priority: "required" },
      { role: "dj", title: "DJ", priority: "optional" },
    ],
    candidates,
  });
}

function testCandidateReviewStatuses() {
  assert.equal(
    normalizeCandidateReviewStatus("APPROVED_FOR_SHORTLIST"),
    "APPROVED_FOR_SHORTLIST",
  );
  assert.equal(normalizeCandidateReviewStatus("REJECTED"), "REJECTED");
  assert.equal(normalizeCandidateReviewStatus("NEEDS_MORE_INFO"), "NEEDS_MORE_INFO");
  assert.equal(normalizeCandidateReviewStatus("DO_NOT_CONTACT"), "DO_NOT_CONTACT");
  assert.equal(normalizeCandidateReviewStatus("CONTACTED"), null);

  assert.equal(
    candidateReviewAuditAction("APPROVED_FOR_SHORTLIST"),
    "producer.candidate_approved_for_shortlist",
  );
  assert.equal(
    candidateReviewAuditAction("REJECTED"),
    "producer.candidate_rejected",
  );
  assert.equal(
    candidateReviewAuditAction("NEEDS_MORE_INFO"),
    "producer.candidate_needs_more_info",
  );
  assert.equal(
    candidateReviewAuditAction("CONTACT_LATER"),
    "producer.candidate_reviewed",
  );
}

function testPacketGenerationFiltersCandidates() {
  const packet = generatePacket([
    approvedCandidate,
    rejectedCandidate,
    doNotContactCandidate,
    needsMoreInfoCandidate,
    contactLaterCandidate,
  ]);

  assert.equal(packet.status, "NEEDS_REVIEW");
  assert.equal(packet.adminReviewRequired, true);
  assert.deepEqual(
    packet.candidateSummaries.map((candidate) => candidate.name),
    ["Rae Star"],
  );
  assert.deepEqual(packet.rolesCovered, ["photographer"]);
  assert.deepEqual(packet.rolesMissing, ["dj"]);
  assert.ok(packet.organizerFacingSummary.includes("not confirmed"));
  assert.equal(packet.forbiddenClaimsCheck.passed, true);

  const serialized = JSON.stringify(packet);
  assert.ok(!serialized.includes("Private note"));
  assert.ok(!serialized.includes("internal note"));
  assert.ok(!serialized.includes("Do Not Contact Candidate"));
  assert.ok(!serialized.includes("Rejected Candidate"));
  assert.ok(!serialized.includes("Contact Later Candidate"));
}

function testPacketApprovalValidation() {
  const packet = generatePacket([approvedCandidate]);
  const validation = validateShortlistPacketForApproval({
    projectBriefId: packet.projectBriefId,
    projectId: packet.projectId,
    status: packet.status,
    organizerFacingSummary: packet.organizerFacingSummary,
    candidateSummaries: packet.candidateSummaries,
  });
  assert.equal(validation.ok, true);

  const emptyValidation = validateShortlistPacketForApproval({
    projectBriefId: "brief_1",
    projectId: "project_1",
    status: "NEEDS_REVIEW",
    organizerFacingSummary: packet.organizerFacingSummary,
    candidateSummaries: [],
  });
  assert.equal(emptyValidation.ok, false);
  assert.ok(emptyValidation.errors.join(" ").includes("At least one candidate"));

  const statusValidation = validateShortlistPacketForApproval({
    projectBriefId: "brief_1",
    projectId: "project_1",
    status: "APPROVED",
    organizerFacingSummary: packet.organizerFacingSummary,
    candidateSummaries: packet.candidateSummaries,
  });
  assert.equal(statusValidation.ok, false);
  assert.ok(statusValidation.errors.join(" ").includes("DRAFT or NEEDS_REVIEW"));
}

function testOrganizerFacingSafety() {
  const basePacket = generatePacket([approvedCandidate]);
  const unsafePhone = validateShortlistPacketForApproval({
    ...basePacket,
    organizerFacingSummary: "Call Rae at +14155550123. They are not confirmed.",
  });
  assert.equal(unsafePhone.ok, false);
  assert.ok(unsafePhone.errors.join(" ").includes("phone numbers"));

  const unsafeEmail = validateShortlistPacketForApproval({
    ...basePacket,
    organizerFacingSummary: "Email rae@example.test. They are not confirmed.",
  });
  assert.equal(unsafeEmail.ok, false);
  assert.ok(unsafeEmail.errors.join(" ").includes("emails"));

  const privateNotes = validateShortlistPacketForApproval({
    ...basePacket,
    organizerFacingSummary:
      "Private note: this candidate is not confirmed and is for consideration.",
  });
  assert.equal(privateNotes.ok, false);
  assert.ok(privateNotes.errors.join(" ").includes("private"));

  const forbiddenClaim = validateShortlistPacketForApproval({
    ...basePacket,
    organizerFacingSummary:
      "Rae is a confirmed team member with guaranteed attendance.",
  });
  assert.equal(forbiddenClaim.ok, false);
  assert.ok(forbiddenClaim.errors.join(" ").includes("Forbidden claims"));

  const missingCaveat = validateShortlistPacketForApproval({
    ...basePacket,
    organizerFacingSummary: "Here is a draft shortlist for the project.",
  });
  assert.equal(missingCaveat.ok, false);
  assert.ok(missingCaveat.errors.join(" ").includes("not confirmed"));
}

function testSideEffectBoundaries() {
  const packet = generatePacket([approvedCandidate]);
  const serialized = JSON.stringify(packet).toLowerCase();

  assert.ok(!serialized.includes("send sms"));
  assert.ok(!serialized.includes("twilio"));
  assert.ok(!serialized.includes("groupchat"));
  assert.ok(!serialized.includes("outreach created"));
  assert.equal(packet.candidateSummaries.length, 1);
}

testCandidateReviewStatuses();
testPacketGenerationFiltersCandidates();
testPacketApprovalValidation();
testOrganizerFacingSafety();
testSideEffectBoundaries();

console.log(
  "Producer approval queue checks passed without SMS, Twilio, group chat creation, or production data.",
);
