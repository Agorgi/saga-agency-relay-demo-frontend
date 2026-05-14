import assert from "node:assert/strict";
import { generateCandidateOutreachDraft } from "@/sms-engine/producer/outboundDrafts";
import {
  canMarkContactableForAdminReview,
  evaluateContactabilityEvidence,
} from "@/sms-engine/sourcing/contactabilityEvidence";
import {
  detectPublicWebDuplicateFromCandidates,
} from "@/sms-engine/sourcing/publicWebDeduplication";
import {
  archiveResearchRun,
  canPromotePublicWebResult,
  cleanupOldShadowResults,
  cleanupTestTaggedResults,
  discardResult,
  evaluatePublicWebResearchResultForReview,
  markDoNotContact,
  markNeedsMoreContactResearch,
  markResultDuplicate,
  summarizeCleanupImpact,
} from "@/sms-engine/sourcing/publicWebResearchCleanup";
import { getPublicWebResearchHealthSnapshot } from "@/sms-engine/sourcing/publicWebResearchProvider";
import { evaluatePublicWebResearchSafety } from "@/sms-engine/sourcing/publicWebResearchSafety";
import {
  canonicalizeProfileUrl,
  normalizeSourceUrl,
  validateCitationSet,
} from "@/sms-engine/sourcing/sourceNormalization";
import { scorePublicWebSourceQuality } from "@/sms-engine/sourcing/sourceQuality";
import {
  contactabilityAuditEvents,
  publicWebReviewAuditEvents,
  type PublicResearchCandidateCard,
} from "@/sms-engine/sourcing/talentTypes";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafeEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.LLM_MODE = "shadow";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.OPENAI_API_KEY = "sk-test-secret";
}

function card(overrides: Partial<PublicResearchCandidateCard> = {}): PublicResearchCandidateCard {
  return {
    displayName: "LA Cosplay Photo Studio",
    likelyRole: "cosplay or anime event photographer",
    city: "Los Angeles",
    region: "California",
    publicProfileUrls: ["https://www.example.com/la-cosplay-photo/?utm_source=test#top"],
    sourceUrls: [
      "https://www.example.com/la-cosplay-photo/?utm_source=test#top",
      "https://example.com/la-cosplay-photo",
    ],
    sourceTitles: ["LA cosplay photography portfolio"],
    roleFitEvidence: ["Portfolio shows cosplay and event photography."],
    fandomFitEvidence: ["Portfolio references anime convention shoots."],
    locationEvidence: ["Public site lists Los Angeles."],
    portfolioEvidence: ["Public portfolio includes event galleries."],
    recentActivityEvidence: ["Recent public event album listed."],
    whyTheyMayFit: ["Evidence suggests relevant public portfolio work."],
    missingEvidence: ["Availability is unknown.", "Rates are unknown."],
    riskFlags: ["requires_human_review"],
    confidence: 0.84,
    requiresHumanReview: true,
    availabilityKnown: false,
    willingnessKnown: false,
    ratesKnown: false,
    sensitiveDataDetected: false,
    privateSourceDetected: false,
    ...overrides,
  };
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "person@example.com",
    "sk-test-secret",
    "twilio-secret-token",
    "https://example.com/la-cosplay-photo",
    "production_saga",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
}

async function main() {
  try {
    setSafeEnv();
    assert.equal(
      normalizeSourceUrl("https://www.Example.com/path/?utm_source=x#top"),
      "https://example.com/path",
    );
    assert.equal(
      canonicalizeProfileUrl("https://WWW.Example.com/Artist/"),
      "https://example.com/artist",
    );
    const citations = validateCitationSet({ candidate: card() });
    assert.equal(citations.valid, true);
    assert.equal(citations.normalizedSourceUrls.length, 1);
    assert.equal(validateCitationSet({ candidate: { ...card(), sourceUrls: [] } }).valid, false);

    const privateCitation = validateCitationSet({
      candidate: card({ sourceUrls: ["https://private.example/login/profile"] }),
      blockedDomains: ["private.example"],
    });
    assert.equal(privateCitation.valid, false);
    assert(privateCitation.blockers.includes("private_or_login_gated_source"));

    const strongQuality = scorePublicWebSourceQuality({ candidate: card() });
    assert(strongQuality.totalScore >= 60);
    assert.equal(strongQuality.recommendedAction, "SEND_TO_QUALITY_REVIEW");
    const weakQuality = scorePublicWebSourceQuality({
      candidate: card({
        sourceUrls: ["https://example.com/mention"],
        sourceTitles: [],
        roleFitEvidence: [],
        portfolioEvidence: [],
        recentActivityEvidence: [],
      }),
    });
    assert.notEqual(weakQuality.recommendedAction, "SEND_TO_QUALITY_REVIEW");

    const duplicate = detectPublicWebDuplicateFromCandidates({
      displayName: "LA Cosplay Photo Studio",
      city: "Los Angeles",
      role: "photographer",
      profileUrls: ["https://example.com/la-cosplay-photo"],
      sourceUrls: [],
      existing: [
        {
          id: "profile_1",
          type: "CreatorProfile",
          displayName: "LA Cosplay Photo Studio",
          city: "Los Angeles",
          role: "photographer",
          profileUrls: ["https://example.com/la-cosplay-photo"],
          approvedInternal: true,
        },
      ],
    });
    assert.equal(duplicate.duplicateStatus, "MATCHES_INTERNAL_PROFILE");
    assert.equal(duplicate.recommendedAction, "LINK_TO_INTERNAL_PROFILE");

    const safety = evaluatePublicWebResearchSafety({ candidate: card() });
    assert.equal(safety.safe, true);
    const review = await evaluatePublicWebResearchResultForReview({
      result: {
        id: "result_1",
        displayName: card().displayName,
        role: card().likelyRole,
        city: card().city,
        publicProfileUrls: card().publicProfileUrls,
        sourceUrls: card().sourceUrls,
        sourceTitles: card().sourceTitles,
        evidence: {
          roleFitEvidence: card().roleFitEvidence,
          fandomFitEvidence: card().fandomFitEvidence,
          locationEvidence: card().locationEvidence,
          portfolioEvidence: card().portfolioEvidence,
          recentActivityEvidence: card().recentActivityEvidence,
          whyTheyMayFit: card().whyTheyMayFit,
        },
        candidateCard: card(),
        riskFlags: [],
        missingEvidence: [],
        confidence: card().confidence,
      },
    });
    assert.equal(review.sourceQuality.recommendedAction, "SEND_TO_QUALITY_REVIEW");
    assert.equal(review.organizerSafeSummary.includes("person@example.com"), false);

    const booking = evaluateContactabilityEvidence({
      channel: "BOOKING_LINK",
      value: "https://example.com/book",
      sourceUrl: "https://example.com/book",
      isPubliclyVisible: true,
      isBusinessFacing: true,
    });
    assert.equal(booking.outreachRisk, "LOW");
    const businessEmail = evaluateContactabilityEvidence({
      channel: "PUBLIC_EMAIL",
      value: "bookings@example.com",
      sourceUrl: "https://example.com/contact",
      isPubliclyVisible: true,
      isBusinessFacing: true,
    });
    assert.equal(businessEmail.valueRedacted?.includes("bookings@example.com"), false);
    assert.notEqual(businessEmail.band, "CONTACT_METHOD_BLOCKED");
    const personalEmail = evaluateContactabilityEvidence({
      channel: "PUBLIC_EMAIL",
      value: "person@example.com",
      sourceUrl: "https://example.com/about",
      isPubliclyVisible: true,
      isPersonalContact: true,
    });
    assert.equal(personalEmail.outreachRisk, "HIGH");
    const instagram = evaluateContactabilityEvidence({
      channel: "INSTAGRAM_PROFILE",
      value: "https://instagram.com/example",
      sourceUrl: "https://instagram.com/example",
      isPubliclyVisible: true,
    });
    assert(instagram.warnings.includes("social_profile_is_not_dm_permission"));
    const phone = evaluateContactabilityEvidence({
      channel: "PUBLIC_BUSINESS_PHONE",
      value: "555-123-4567",
      sourceUrl: "https://example.com/contact",
      isPubliclyVisible: true,
      isBusinessFacing: false,
    });
    assert.equal(phone.outreachRisk, "HIGH");
    assertSafe(phone);
    const noContact = evaluateContactabilityEvidence({
      channel: "UNKNOWN",
      isPubliclyVisible: false,
    });
    assert.equal(noContact.band, "CONTACT_METHOD_BLOCKED");
    const doNotContact = evaluateContactabilityEvidence({
      channel: "BOOKING_LINK",
      sourceUrl: "https://example.com/book",
      isPubliclyVisible: true,
      isBusinessFacing: true,
      doNotContactMatched: true,
    });
    assert.equal(doNotContact.band, "DO_NOT_CONTACT");
    const optedOut = evaluateContactabilityEvidence({
      channel: "PUBLIC_CONTACT_FORM",
      sourceUrl: "https://example.com/contact",
      isPubliclyVisible: true,
      isBusinessFacing: true,
      optedOutMatched: true,
    });
    assert.equal(optedOut.outreachRisk, "BLOCKED");

    const contactPromotion = canMarkContactableForAdminReview({
      qualityReviewPassed: true,
      contactabilityReview: booking,
      adminReviewed: false,
    });
    assert.equal(contactPromotion.allowed, false);
    assert(contactPromotion.blockers.includes("admin_review_required"));

    const publicWebPromotion = canPromotePublicWebResult({
      status: "NEEDS_REVIEW",
      sourceQualityBand: "HIGH_CONFIDENCE_SOURCE",
      qualityReviewPassed: true,
      contactabilityReviewed: true,
      adminAction: true,
    });
    assert.equal(publicWebPromotion.allowed, false);
    assert(publicWebPromotion.blockers.includes("public_web_result_not_approved_for_internal_review"));

    const outreachDraft = generateCandidateOutreachDraft({
      candidateRecommendationId: "rec_1",
      displayName: "Candidate",
      role: "photographer",
      city: "Los Angeles",
      projectTitle: "Anime picnic",
      status: "DO_NOT_CONTACT",
      matchingReasons: ["Good portfolio."],
      optedOut: false,
    });
    assert.equal(outreachDraft.status, "BLOCKED");

    assert.equal((await archiveResearchRun("run_1")).ok, false);
    assert.equal((await cleanupTestTaggedResults("live_dry_run")).ok, false);
    assert.equal((await cleanupOldShadowResults(30)).ok, false);
    assert.equal((await summarizeCleanupImpact()).ok, false);
    assert.equal((await discardResult("result_1")).ok, false);
    assert.equal((await markResultDuplicate("result_1")).ok, false);
    assert.equal((await markDoNotContact("result_1")).ok, false);
    assert.equal((await markNeedsMoreContactResearch("result_1")).ok, false);
    const health = await getPublicWebResearchHealthSnapshot();
    assert.equal(health.publicWebResearchReviewAvailable, true);
    assert.equal(health.contactabilityEvidenceAvailable, true);
    assertSafe({
      publicWebResearchReviewAvailable: health.publicWebResearchReviewAvailable,
      publicWebPendingReviewCount: health.publicWebPendingReviewCount,
      publicWebNeedsMoreContactResearchCount:
        health.publicWebNeedsMoreContactResearchCount,
      publicWebReviewRiskLevel: health.publicWebReviewRiskLevel,
      contactabilityEvidenceAvailable: health.contactabilityEvidenceAvailable,
      contactabilityPendingReviewCount: health.contactabilityPendingReviewCount,
    });

    assert.equal(
      publicWebReviewAuditEvents.resultSentToQualityReview,
      "public_web_review.result_sent_to_quality_review",
    );
    assert.equal(
      contactabilityAuditEvents.methodVerified,
      "contactability.method_verified",
    );
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log("Public web research review and cleanup tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
