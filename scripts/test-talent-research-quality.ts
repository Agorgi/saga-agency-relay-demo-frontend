import assert from "node:assert/strict";
import {
  applyTalentResearchQualityLlmReview,
  canQualityReviewPromoteToShortlist,
  classifyTalentResearchSource,
  evaluateTalentResearchQuality,
  qualityReviewBlocksOutreach,
  sanitizeOrganizerFacingText,
  talentResearchQualityAuditEvents,
  validateTalentResearchQualityLlmReview,
  type TalentResearchQualityCandidate,
} from "@/lib/sourcing/talentResearchQuality";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafeEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.LLM_MODE = "fallback";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "disabled";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "person@example.com",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "production_saga",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
}

function baseCandidate(
  overrides: Partial<TalentResearchQualityCandidate> = {},
): TalentResearchQualityCandidate {
  return {
    id: "candidate_1",
    searchRunId: "search_1",
    personId: "person_1",
    creatorProfileId: "profile_1",
    source: "INTERNAL_DB",
    displayName: "LA anime photographer",
    role: "photographer",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    skills: ["photography", "event photography"],
    portfolioUrls: ["https://example.com/la-anime-photo"],
    publicSourceUrls: [],
    evidence: {
      roleEvidence: ["anime event photography portfolio"],
      fandomEvidence: ["cosplay community work"],
      locationEvidence: ["Los Angeles profile"],
      recentActivityEvidence: ["recent event album"],
    },
    relationshipTier: "COMMUNITY",
    reviewStatus: "APPROVED",
    availabilityNotes: "Availability note exists but remains admin-unverified.",
    optedOut: false,
    doNotContact: false,
    consentStatus: "EXPLICIT",
    privateNotes: "Internal relationship note; never organizer-facing.",
    ...overrides,
  };
}

function publicCandidate(
  overrides: Partial<TalentResearchQualityCandidate> = {},
): TalentResearchQualityCandidate {
  return baseCandidate({
    id: "public_candidate",
    personId: null,
    creatorProfileId: null,
    source: "PUBLIC_WEB_RESEARCH",
    displayName: "Public portfolio photographer",
    city: "Los Angeles",
    fandoms: ["anime"],
    skills: ["photography"],
    portfolioUrls: ["https://example.com/portfolio"],
    publicSourceUrls: ["https://example.com/portfolio"],
    evidence: {
      roleEvidence: ["public portfolio includes cosplay event photos"],
      fandomEvidence: ["portfolio references anime convention work"],
      locationEvidence: ["public profile lists Los Angeles"],
    },
    relationshipTier: "PUBLIC",
    reviewStatus: null,
    availabilityNotes: null,
    privateNotes: null,
    ...overrides,
  });
}

const context = {
  expectedRole: "photographer",
  projectCity: "Los Angeles",
  projectFandoms: ["anime", "cosplay"],
};

async function main() {
  try {
    setSafeEnv();

    const strongInternal = evaluateTalentResearchQuality(baseCandidate(), context);
    assert.equal(strongInternal.reviewBand, "STRONG_FIT");
    assert.equal(strongInternal.sourceReliability, "HIGH");
    assert.equal(strongInternal.evidenceChecklist.hasRoleEvidence, true);
    assert.equal(strongInternal.evidenceChecklist.hasLocationEvidence, true);
    assert.equal(strongInternal.evidenceChecklist.hasFandomCommunityEvidence, true);
    assert.equal(strongInternal.recommendedReviewStatus, "APPROVED_FOR_SHORTLIST");
    assert.equal(strongInternal.shouldPromoteToShortlist, true);

    const weakInternal = evaluateTalentResearchQuality(
      baseCandidate({
        creatorProfileId: null,
        city: null,
        fandoms: [],
        skills: [],
        portfolioUrls: [],
        evidence: {},
        relationshipTier: "UNKNOWN",
        reviewStatus: "PENDING_REVIEW",
      }),
      context,
    );
    assert.ok(weakInternal.totalScore < strongInternal.totalScore);
    assert.notEqual(weakInternal.reviewBand, "STRONG_FIT");

    const optedOut = evaluateTalentResearchQuality(
      baseCandidate({ optedOut: true }),
      context,
    );
    assert.equal(optedOut.recommendedReviewStatus, "DO_NOT_CONTACT");
    assert.equal(optedOut.shouldBlockOutreach, true);

    const doNotContact = evaluateTalentResearchQuality(
      baseCandidate({ doNotContact: true }),
      context,
    );
    assert.equal(doNotContact.recommendedReviewStatus, "DO_NOT_CONTACT");
    assert.equal(doNotContact.riskFlags.includes("do_not_contact"), true);

    const publicNoSource = evaluateTalentResearchQuality(
      publicCandidate({ publicSourceUrls: [], portfolioUrls: [] }),
      context,
    );
    assert.ok(
      ["NEEDS_MORE_RESEARCH", "REJECTED"].includes(
        String(publicNoSource.recommendedReviewStatus),
      ),
    );
    assert.equal(publicNoSource.riskFlags.includes("missing_public_source_urls"), true);

    const weakPublic = evaluateTalentResearchQuality(
      publicCandidate({
        publicSourceUrls: ["https://instagram.com/example-cosplay-photo"],
        portfolioUrls: [],
        evidence: { roleEvidence: ["single social post"] },
        fandoms: [],
      }),
      context,
    );
    assert.notEqual(weakPublic.reviewBand, "STRONG_FIT");

    const strongPublic = evaluateTalentResearchQuality(publicCandidate(), context);
    assert.equal(strongPublic.reviewBand, "LIKELY_FIT");
    assert.equal(strongPublic.recommendedReviewStatus, "NEEDS_MORE_RESEARCH");
    assert.equal(strongPublic.riskFlags.includes("public_web_needs_human_review"), true);

    const ambiguousIdentity = evaluateTalentResearchQuality(
      publicCandidate({ displayName: "" }),
      context,
    );
    assert.equal(ambiguousIdentity.riskFlags.includes("ambiguous_identity"), true);

    const missingLocation = evaluateTalentResearchQuality(
      publicCandidate({ city: null, evidence: { roleEvidence: ["portfolio"] } }),
      context,
    );
    assert.equal(missingLocation.evidenceChecklist.hasLocationEvidence, false);
    assert.equal(missingLocation.riskFlags.includes("missing_location_evidence"), true);

    const missingFandom = evaluateTalentResearchQuality(
      publicCandidate({ fandoms: [], evidence: { roleEvidence: ["portfolio"] } }),
      context,
    );
    assert.equal(missingFandom.evidenceChecklist.hasFandomCommunityEvidence, false);
    assert.equal(missingFandom.riskFlags.includes("missing_fandom_evidence"), true);

    const privateNoteRisk = evaluateTalentResearchQuality(
      baseCandidate({
        privateNotes: "private note: call +15551234567 or person@example.com",
      }),
      context,
    );
    assert.equal(privateNoteRisk.evidenceChecklist.hasPrivateNotesLeakRisk, true);
    assertSafe(privateNoteRisk.organizerSafeSummary);

    const rawContactRisk = evaluateTalentResearchQuality(
      publicCandidate({
        displayName: "person@example.com",
        evidence: { roleEvidence: ["text me at 555-123-4567"] },
      }),
      context,
    );
    assert.equal(rawContactRisk.evidenceChecklist.hasRawContactInfoLeakRisk, true);
    assertSafe(rawContactRisk.organizerSafeSummary);

    const unsupportedAvailability = evaluateTalentResearchQuality(
      publicCandidate({
        evidence: {
          roleEvidence: ["confirmed available for anime photography"],
        },
      }),
      context,
    );
    assert.equal(unsupportedAvailability.evidenceChecklist.hasUnsupportedClaims, true);
    assert.equal(
      unsupportedAvailability.riskFlags.includes(
        "availability_or_willingness_unverified",
      ),
      true,
    );

    const unsupportedRate = evaluateTalentResearchQuality(
      publicCandidate({
        evidence: { roleEvidence: ["confirmed rate is $500"] },
      }),
      context,
    );
    assert.equal(unsupportedRate.evidenceChecklist.hasUnsupportedClaims, true);
    assert.equal(
      unsupportedRate.riskFlags.includes("rate_or_payment_claim_unverified"),
      true,
    );

    const validLlm = validateTalentResearchQualityLlmReview({
      evidenceSummary: "Portfolio and source evidence are present.",
      unsupportedClaims: [],
      missingEvidence: ["availability"],
      sourceReliabilityAssessment: "MEDIUM",
      roleFitAssessment: "Good role evidence.",
      fandomFitAssessment: "Some fandom evidence.",
      locationFitAssessment: "Location appears to match.",
      organizerSafeSummary: "Public portfolio photographer may fit; availability is unverified.",
      riskFlags: ["public_web_needs_human_review"],
      confidence: 0.72,
      recommendedReviewStatus: "NEEDS_MORE_RESEARCH",
    });
    assert.equal(validLlm.success, true);

    const invalidLlmFallback = applyTalentResearchQualityLlmReview({
      deterministic: strongInternal,
      llmReview: { organizerSafeSummary: "" },
      llmAllowed: true,
    });
    assert.equal(invalidLlmFallback.fallbackUsed, true);
    assert.equal(invalidLlmFallback.usedLlm, false);

    assert.equal(
      canQualityReviewPromoteToShortlist({
        reviewStatus: "APPROVED_FOR_SHORTLIST",
        riskFlags: [],
      }),
      true,
    );
    assert.equal(
      canQualityReviewPromoteToShortlist({
        reviewStatus: "REJECTED",
        riskFlags: [],
      }),
      false,
    );
    assert.equal(
      canQualityReviewPromoteToShortlist({
        reviewStatus: "NEEDS_MORE_RESEARCH",
        riskFlags: [],
      }),
      false,
    );
    assert.equal(
      qualityReviewBlocksOutreach({
        reviewStatus: "DO_NOT_CONTACT",
        riskFlags: [],
      }),
      true,
    );

    const socialSource = classifyTalentResearchSource({
      candidate: publicCandidate({
        publicSourceUrls: ["https://instagram.com/example"],
      }),
    });
    assert.equal(socialSource.sourceType, "PUBLIC_SOCIAL_PROFILE");
    assert.equal(socialSource.sourceReliability, "LOW");

    assert.equal(
      sanitizeOrganizerFacingText("Call +15551234567 or person@example.com"),
      "Call [redacted phone] or [redacted email]",
    );
    assert.equal(
      talentResearchQualityAuditEvents.reviewCreated,
      "talent_quality.review_created",
    );
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");
    assert.equal(process.env.PUBLIC_WEB_RESEARCH_ENABLED, "false");

    assertSafe({
      strongInternal,
      weakInternal,
      optedOut,
      doNotContact,
      publicNoSource,
      weakPublic,
      strongPublic,
      ambiguousIdentity,
      missingLocation,
      missingFandom,
      privateNoteRisk,
      rawContactRisk,
      unsupportedAvailability,
      unsupportedRate,
      invalidLlmFallback,
    });

    console.log(
      "Talent research quality checks passed without SMS, Twilio, live web research, outreach, or production data.",
    );
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
