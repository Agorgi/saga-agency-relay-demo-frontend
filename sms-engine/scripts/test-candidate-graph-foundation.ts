import assert from "node:assert/strict";
import { normalizeLocationText, computeLocationFit } from "@/sms-engine/graph/locationNormalization";
import {
  computeFandomFit,
  computeRoleFitFromTags,
  expandTagAliases,
  explainTagMatch,
  normalizeTag,
} from "@/sms-engine/graph/tagTaxonomy";
import {
  computeProximityTier,
  computeRelationshipScore,
  explainProximity,
  findRelationshipPath,
} from "@/sms-engine/graph/relationshipProximity";
import {
  buildCandidateSearchProfile,
  canPromotePersistedCandidate,
} from "@/sms-engine/graph/candidateSearchProfile";
import { persistIdentifiedCandidate } from "@/sms-engine/graph/candidatePersistence";
import { evaluateContactabilityEvidence } from "@/sms-engine/sourcing/contactabilityEvidence";
import { detectPublicWebDuplicateFromCandidates } from "@/sms-engine/sourcing/publicWebDeduplication";

const originalEnv = { ...process.env };

function setSafeEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.LLM_MODE = "shadow";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "person@example.com",
    "sk-test",
    "twilio-secret",
    "production_saga",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
}

async function main() {
  try {
    setSafeEnv();

    assert.equal(normalizeTag("JJK").canonical, "Jujutsu Kaisen");
    assert(expandTagAliases(["JJK"]).includes("anime"));
    assert(computeFandomFit({
      candidateFandomTags: ["Jujutsu Kaisen"],
      targetFandomTags: ["anime"],
    }).score > 0);
    assert(computeRoleFitFromTags({
      candidateRoleTags: ["cosplay photographer"],
      targetRoleTags: ["photography"],
    }).score > 0);
    assert(explainTagMatch({
      candidateTags: ["artist alley"],
      targetTags: ["convention vendor"],
    }).includes("Matched"));

    assert.equal(normalizeLocationText("Silver Lake, LA").city, "Los Angeles");
    assert.equal(normalizeLocationText("NYC").metro, "New York City");
    assert.equal(normalizeLocationText("Atlanta").state, "GA");
    assert.equal(computeLocationFit("Silver Lake", "Los Angeles").bucket, "same_city");
    assert.equal(computeLocationFit("Brooklyn", "Manhattan").bucket, "same_city");

    const edges = [
      {
        fromEntityType: "PERSON",
        fromEntityId: "requester",
        toEntityType: "PERSON",
        toEntityId: "direct",
        edgeType: "FRIEND",
        isInferred: false,
        sourceType: "INTERNAL_RELATIONSHIP_EDGE",
      },
      {
        fromEntityType: "PERSON",
        fromEntityId: "requester",
        toEntityType: "PERSON",
        toEntityId: "mutual",
        edgeType: "FRIEND",
        isInferred: false,
        sourceType: "INTERNAL_RELATIONSHIP_EDGE",
      },
      {
        fromEntityType: "PERSON",
        fromEntityId: "mutual",
        toEntityType: "PERSON",
        toEntityId: "candidate",
        edgeType: "WORKED_TOGETHER",
        isInferred: false,
        sourceType: "INTERNAL_RELATIONSHIP_EDGE",
      },
      {
        fromEntityType: "PERSON",
        fromEntityId: "requester",
        toEntityType: "PERSON",
        toEntityId: "event_candidate",
        edgeType: "SAME_EVENT",
        isInferred: false,
        sourceType: "INTERNAL_RELATIONSHIP_EDGE",
      },
    ];
    assert.equal(computeProximityTier("requester", "requester", { edges }), "P0_SELF");
    assert.equal(computeProximityTier("requester", "direct", { edges }), "P1_DIRECT");
    assert.equal(computeProximityTier("requester", "candidate", { edges }), "P2_MUTUAL");
    assert.equal(computeProximityTier("requester", "event_candidate", { edges }), "P3_SAME_PROJECT_OR_EVENT");
    assert.equal(
      computeProximityTier("requester", "fandom_candidate", {
        requesterFandomTags: ["Jujutsu Kaisen"],
        candidateFandomTags: ["anime"],
      }),
      "P4_SAME_COMMUNITY_OR_FANDOM",
    );
    assert.equal(
      computeProximityTier("requester", "city_candidate", {
        requesterCity: "Los Angeles",
        candidateCity: "Silver Lake",
      }),
      "P5_SAME_CITY_OR_METRO",
    );
    assert.equal(
      computeProximityTier("requester", "web_candidate", {
        candidateSourceMode: "PUBLIC_WEB_RESEARCH",
      }),
      "P6_PUBLIC_WEB_ONLY",
    );
    assert.equal(findRelationshipPath("requester", "candidate", 2, { edges })?.length, 2);
    assert(computeRelationshipScore("P1_DIRECT") > computeRelationshipScore("P4_SAME_COMMUNITY_OR_FANDOM"));
    assert(explainProximity("P4_SAME_COMMUNITY_OR_FANDOM").includes("not a mutual"));

    const persisted = await persistIdentifiedCandidate({
      displayName: "Demo Cosplay Photographer",
      role: "cosplay photographer",
      city: "Los Angeles",
      fandoms: ["JJK"],
      skills: ["photography"],
      source: "PUBLIC_WEB_RESEARCH",
      publicSourceUrls: ["https://example.com/demo-cosplay-photo"],
      provenance: {
        source: "PUBLIC_WEB_RESEARCH",
        sourceUrls: ["https://example.com/demo-cosplay-photo"],
        evidenceSummary: "Public portfolio citation exists.",
      },
      contactabilityEvidence: [
        {
          channel: "PUBLIC_CONTACT_FORM",
          sourceUrl: "https://example.com/contact",
          isPubliclyVisible: true,
          isBusinessFacing: true,
        },
      ],
    });
    assert.equal(persisted.ok, true);
    assert.equal(persisted.noSmsSent, true);
    assert.equal(persisted.noOutreachSent, true);
    assert.equal(persisted.noGroupChatCreated, true);
    assertSafe(persisted);

    const blockedPublicWeb = await persistIdentifiedCandidate({
      displayName: "Unsourced Public Candidate",
      role: "photographer",
      source: "PUBLIC_WEB_RESEARCH",
      provenance: {
        source: "PUBLIC_WEB_RESEARCH",
        evidenceSummary: "No citation should block persistence.",
      },
    });
    assert.equal(blockedPublicWeb.ok, false);
    assert(
      (blockedPublicWeb.blockers || []).includes("public_web_source_url_required"),
    );

    const duplicate = detectPublicWebDuplicateFromCandidates({
      displayName: "Demo Cosplay Photographer",
      city: "Los Angeles",
      role: "photographer",
      profileUrls: ["https://example.com/demo-cosplay-photo"],
      existing: [
        {
          id: "creator_1",
          type: "CreatorProfile",
          displayName: "Demo Cosplay Photographer",
          city: "Los Angeles",
          role: "photographer",
          profileUrls: ["https://example.com/demo-cosplay-photo"],
          approvedInternal: true,
        },
      ],
    });
    assert.equal(duplicate.duplicateStatus, "MATCHES_INTERNAL_PROFILE");
    assert.equal(duplicate.recommendedAction, "LINK_TO_INTERNAL_PROFILE");

    const promotionBlocked = canPromotePersistedCandidate({
      verificationStatus: "DISCOVERED",
      doNotContact: true,
      sourceMode: "INTERNAL_DB",
      adminAction: true,
    });
    assert.equal(promotionBlocked.allowed, false);
    assert(promotionBlocked.blockers.includes("do_not_contact"));
    const optedOutBlocked = canPromotePersistedCandidate({
      verificationStatus: "DISCOVERED",
      optedOut: true,
      sourceMode: "INTERNAL_DB",
      adminAction: true,
    });
    assert.equal(optedOutBlocked.allowed, false);
    assert(optedOutBlocked.blockers.includes("opted_out"));

    const profile = buildCandidateSearchProfile({
      displayName: "Safe Search Profile",
      roles: ["maid gigs"],
      skills: ["performance"],
      fandoms: ["Love and Deepspace"],
      city: "LA",
      sourceMode: "PUBLIC_WEB_RESEARCH",
      privateNotes: "person@example.com +15551234567",
      contactabilityEvidence: [
        {
          channel: "BOOKING_LINK",
          value: "https://example.com/book",
          sourceUrl: "https://example.com/book",
          isPubliclyVisible: true,
          isBusinessFacing: true,
        },
      ],
    });
    assert.equal(profile.privateNotesRedacted, "[redacted]");
    assert(profile.contactabilityScore > 0);
    assertSafe(profile.organizerSafe);

    const contactability = evaluateContactabilityEvidence({
      channel: "BOOKING_LINK",
      sourceUrl: "https://example.com/book",
      value: "https://example.com/book",
      isPubliclyVisible: true,
      isBusinessFacing: true,
    });
    assert.equal(contactability.outreachRisk, "LOW");
    assert.equal(contactability.checklist.contactRequiresHumanReview, true);
    assert.equal("outreachAllowed" in contactability, false);

    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.equal(process.env.PUBLIC_WEB_RESEARCH_ENABLED, "false");
    assert.equal(process.env.MESSAGE_PROCESSING_MODE, "sync");

    console.log("candidate graph foundation checks passed", {
      noSmsSent: true,
      noTwilioRequired: true,
      noLiveWebCallRequired: true,
      noProductionSagaAppDataRequired: true,
    });
  } finally {
    process.env = { ...originalEnv };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
