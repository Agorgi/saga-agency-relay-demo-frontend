import assert from "node:assert/strict";
import {
  type ProjectUnderstanding,
  type RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";
import { generatePublicResearchPlan } from "@/sms-engine/sourcing/publicResearchPlan";
import {
  getPublicWebResearchConfig,
  runPublicWebResearch,
} from "@/sms-engine/sourcing/publicWebResearchProvider";
import { buildPublicWebQueryPlan } from "@/sms-engine/sourcing/publicWebQueryBuilder";
import {
  evaluatePublicWebResearchSafety,
  sanitizePublicResearchCandidateCard,
} from "@/sms-engine/sourcing/publicWebResearchSafety";
import { generateSourcingStrategy } from "@/sms-engine/sourcing/sourcingStrategy";
import { evaluateTalentResearchQuality } from "@/sms-engine/sourcing/talentResearchQuality";
import {
  publicResearchCandidateCardSchema,
  publicWebResearchAuditEvents,
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
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.LLM_MODE = "fallback";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "disabled";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "none";
  process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
  process.env.PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS = "false";
  process.env.PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS = "";
  process.env.PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS = "private.example";
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

function project(): ProjectUnderstanding {
  return {
    title: "LA anime picnic",
    projectType: "anime picnic",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    communities: ["LA creators"],
    format: "picnic",
    scope: "small community event",
    vibe: "friendly",
    targetDate: null,
    timing: null,
    budgetRange: null,
    expectedAudienceSize: "30",
    audience: "fans",
    helpNeeded: "photographer and illustrator",
    riskFlags: [],
    missingInfo: [],
    sourceKind: "organizer_project",
    confidence: 0.9,
    explanationForAudit: ["synthetic test project"],
  };
}

function roleMap(): RoleMap {
  return {
    requiredRoles: [
      {
        roleType: "photographer",
        title: "Photographer",
        priority: "required",
        description: "Capture event moments.",
        requiredSkills: ["event photography", "portrait photography"],
        preferredFandoms: ["anime", "cosplay"],
        localRequired: true,
        whyThisRoleMatters: "The organizer needs usable event photos.",
        roleFitCriteria: ["portfolio", "local event work"],
        missingInfoForRole: [],
        confidence: 0.9,
      },
    ],
    optionalRoles: [],
    rolePriority: ["photographer"],
    roleDescriptions: { photographer: "Event photographer" },
    roleFitCriteria: { photographer: ["portfolio", "local event work"] },
    localRequired: { photographer: true },
    whyThisRoleMatters: { photographer: "Photos are part of the deliverable." },
    missingInfoForRole: { photographer: [] },
    confidence: 0.9,
    humanReviewRequired: true,
    explanationForAudit: ["synthetic role map"],
  };
}

function card(
  overrides: Partial<PublicResearchCandidateCard> = {},
): PublicResearchCandidateCard {
  return {
    displayName: "LA Cosplay Photo Studio",
    likelyRole: "photographer",
    city: "Los Angeles",
    region: "California",
    publicProfileUrls: ["https://example.com/la-cosplay-photo"],
    sourceUrls: ["https://example.com/la-cosplay-photo"],
    sourceTitles: ["LA cosplay photography portfolio"],
    roleFitEvidence: ["Portfolio shows cosplay and event photography."],
    fandomFitEvidence: ["Portfolio references anime convention shoots."],
    locationEvidence: ["Public site lists Los Angeles."],
    portfolioEvidence: ["Public portfolio includes event galleries."],
    recentActivityEvidence: ["Recent public event album listed."],
    whyTheyMayFit: ["Evidence suggests relevant public portfolio work."],
    missingEvidence: ["Availability is unknown.", "Rates are unknown."],
    riskFlags: ["requires_human_review"],
    confidence: 0.74,
    requiresHumanReview: true,
    availabilityKnown: false,
    willingnessKnown: false,
    ratesKnown: false,
    sensitiveDataDetected: false,
    privateSourceDetected: false,
    ...overrides,
  };
}

async function main() {
  try {
    setSafeEnv();

    const currentProject = project();
    const currentRoleMap = roleMap();
    const strategy = generateSourcingStrategy(currentProject, currentRoleMap, {
      internalCandidateCount: 0,
    });
    const plan = generatePublicResearchPlan(currentProject, currentRoleMap, strategy);
    const queryPlan = buildPublicWebQueryPlan({
      understanding: currentProject,
      roleMap: currentRoleMap,
      sourcingStrategy: strategy,
      publicResearchPlan: plan,
      targetRole: "photographer",
      blockedDomains: ["private.example"],
    });
    assert.match(queryPlan.searchQueries.join(" "), /photographer/i);
    assert.match(queryPlan.searchQueries.join(" "), /Los Angeles|LA/i);
    assert.match(queryPlan.searchQueries.join(" "), /anime|cosplay/i);
    assert.equal(queryPlan.sourcePolicy.citationRequired, true);
    assert.equal(queryPlan.sourcePolicy.noOutreach, true);

    let providerCalled = false;
    const disabled = await runPublicWebResearch({
      request: {
        queryPlan: queryPlan.searchQueries,
        roleTargets: [{ role: "photographer", city: "Los Angeles" }],
        blockedDomains: queryPlan.blockedDomains,
      },
      provider: async () => {
        providerCalled = true;
        return { candidates: [card()] };
      },
      persistShadowResults: true,
    });
    assert.equal(disabled.calledProvider, false);
    assert.equal(providerCalled, false);
    assert.equal(disabled.skippedReason, "public_web_research_disabled");

    process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
    process.env.PUBLIC_WEB_RESEARCH_MODE = "shadow";
    process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
    const config = getPublicWebResearchConfig();
    assert.equal(config.publicWebResearchMode, "shadow");
    assert.equal(config.publicWebResearchStoreRawResults, false);

    const shadow = await runPublicWebResearch({
      request: {
        queryPlan: queryPlan.searchQueries,
        roleTargets: [{ role: "photographer", city: "Los Angeles" }],
        blockedDomains: queryPlan.blockedDomains,
      },
      provider: async () => {
        providerCalled = true;
        return {
          candidates: [card()],
          sources: [{ url: "https://example.com/la-cosplay-photo" }],
          responseId: "resp_mock",
        };
      },
      persistShadowResults: false,
    });
    assert.equal(providerCalled, false);
    assert.equal(shadow.calledProvider, false);
    assert.equal(shadow.skippedReason, "shadow_mode_no_live_web_call");
    assert.equal(shadow.persistedCandidates, false);
    assert.equal(shadow.talentCandidateIds.length, 0);
    assert.equal(shadow.resultIds.length, 0);
    assert.equal(shadow.publicResearchCandidates.length, 0);
    assert.equal(shadow.candidates.length, 0);

    const noCitation = publicResearchCandidateCardSchema.safeParse({
      ...card(),
      sourceUrls: [],
    });
    assert.equal(noCitation.success, false, "source URLs are required");
    const noCitationSafety = evaluatePublicWebResearchSafety({
      candidate: { ...card(), sourceUrls: [] },
    });
    assert.equal(noCitationSafety.safe, false);
    assert(noCitationSafety.blockers.includes("candidate_schema_invalid"));

    const privateSource = evaluatePublicWebResearchSafety({
      candidate: card({
        sourceUrls: ["https://private.example/login/profile"],
        privateSourceDetected: true,
      }),
      blockedDomains: ["private.example"],
    });
    assert.equal(privateSource.safe, false);
    assert(
      privateSource.blockers.includes("private_or_login_gated_source_detected"),
    );

    const rawContact = sanitizePublicResearchCandidateCard(
      card({
        displayName: "person@example.com",
        roleFitEvidence: ["Call 555-123-4567 for availability."],
        whyTheyMayFit: ["They are available next weekend."],
      }),
    );
    assertSafe(rawContact);
    const unsupportedAvailability = evaluatePublicWebResearchSafety({
      candidate: rawContact,
    });
    assert.equal(unsupportedAvailability.safe, false);
    assert(
      unsupportedAvailability.blockers.includes(
        "unsupported_availability_or_willingness_claim",
      ),
    );

    const quality = evaluateTalentResearchQuality(
      {
        source: "PUBLIC_WEB_RESEARCH",
        displayName: card().displayName,
        role: card().likelyRole,
        city: card().city,
        fandoms: ["anime"],
        skills: ["photography"],
        portfolioUrls: card().publicProfileUrls,
        publicSourceUrls: card().sourceUrls,
        evidence: {
          roleEvidence: card().roleFitEvidence,
          fandomEvidence: card().fandomFitEvidence,
          locationEvidence: card().locationEvidence,
        },
        optedOut: false,
        doNotContact: false,
      },
      {
        expectedRole: "photographer",
        projectCity: "Los Angeles",
        projectFandoms: ["anime"],
      },
    );
    assert.equal(quality.recommendedReviewStatus, "NEEDS_MORE_RESEARCH");
    assert.equal(quality.shouldPromoteToShortlist, false);
    assert.equal(quality.shouldBlockOutreach, true);

    assert.equal(
      publicWebResearchAuditEvents.runStarted,
      "public_web_research.run_started",
    );
    assert.equal(
      publicWebResearchAuditEvents.resultSentToQualityReview,
      "public_web_research.result_sent_to_quality_review",
    );
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");
    assertSafe(shadow);

    console.log("Public web research shadow tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
