import assert from "node:assert/strict";
import { buildPublicWebLiveDryRunRequest } from "@/lib/sourcing/publicWebLiveDryRunFixture";
import {
  evaluatePublicWebResearchLiveDryRunReadiness,
  getPublicWebResearchConfig,
  runPublicWebResearch,
} from "@/lib/sourcing/publicWebResearchProvider";
import {
  evaluatePublicWebResearchSafety,
  sanitizePublicResearchCandidateCard,
} from "@/lib/sourcing/publicWebResearchSafety";
import { evaluateTalentResearchQuality } from "@/lib/sourcing/talentResearchQuality";
import {
  publicResearchCandidateCardSchema,
  publicWebResearchAuditEvents,
  type PublicResearchCandidateCard,
} from "@/lib/sourcing/talentTypes";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setBaseEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.LLM_PROVIDER = "openai";
  process.env.LLM_MODE = "shadow";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "disabled";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "none";
  process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
  process.env.PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS = "false";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED = "false";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES = "1";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG = "live_dry_run";
  process.env.PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS = "private.example";
}

function enableLiveDryRun() {
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "live_dry_run";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
  process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED = "true";
  process.env.PUBLIC_WEB_RESEARCH_MAX_RESULTS = "";
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

function card(
  overrides: Partial<PublicResearchCandidateCard> = {},
): PublicResearchCandidateCard {
  return {
    displayName: "LA Cosplay Photo Studio",
    likelyRole: "cosplay or anime event photographer",
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
    setBaseEnv();
    const request = buildPublicWebLiveDryRunRequest();

    const defaultConfig = getPublicWebResearchConfig();
    assert.equal(defaultConfig.publicWebResearchEnabled, false);
    assert.equal(defaultConfig.publicWebResearchMode, "disabled");
    assert.equal(defaultConfig.publicWebResearchLiveDryRunAllowed, false);
    assert.equal(defaultConfig.publicWebResearchLiveDryRunAvailable, true);

    let providerCalls = 0;
    const disabled = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return { candidates: [card()] };
      },
      persistShadowResults: true,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(disabled.calledProvider, false);
    assert.equal(providerCalls, 0);
    assert.equal(disabled.skippedReason, "public_web_research_disabled");

    process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
    process.env.PUBLIC_WEB_RESEARCH_MODE = "shadow";
    process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
    let blocked = evaluatePublicWebResearchLiveDryRunReadiness({
      request,
      adminTriggered: true,
      demoSafe: true,
      requireActionGate: true,
    });
    assert.equal(blocked.allowed, false);
    assert(blocked.blockers.includes("mode_not_live_dry_run"));
    const shadowAttempt = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return { candidates: [card()] };
      },
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(shadowAttempt.calledProvider, false);
    assert.equal(shadowAttempt.skippedReason, "shadow_mode_no_live_web_call");
    assert.equal(providerCalls, 0);

    process.env.PUBLIC_WEB_RESEARCH_MODE = "live_dry_run";
    process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "none";
    blocked = evaluatePublicWebResearchLiveDryRunReadiness({
      request,
      adminTriggered: true,
      demoSafe: true,
      requireActionGate: true,
    });
    assert.equal(blocked.allowed, false);
    assert(blocked.blockers.includes("provider_none"));

    process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
    process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "false";
    blocked = evaluatePublicWebResearchLiveDryRunReadiness({
      request,
      adminTriggered: true,
      demoSafe: true,
      requireActionGate: true,
    });
    assert.equal(blocked.allowed, false);
    assert(blocked.blockers.includes("citations_not_required"));

    process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED = "false";
    blocked = evaluatePublicWebResearchLiveDryRunReadiness({
      request,
      adminTriggered: true,
      demoSafe: true,
      requireActionGate: true,
    });
    assert.equal(blocked.allowed, false);
    assert(blocked.blockers.includes("live_dry_run_not_allowed"));

    enableLiveDryRun();
    const validConfig = getPublicWebResearchConfig();
    assert.equal(validConfig.publicWebResearchMode, "live_dry_run");
    assert.equal(validConfig.publicWebResearchMaxResults, 5);
    const ready = evaluatePublicWebResearchLiveDryRunReadiness({
      request,
      adminTriggered: true,
      demoSafe: true,
      requireActionGate: true,
    });
    assert.equal(ready.allowed, true);

    const result = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return {
          candidates: [card()],
          sources: [{ url: "https://example.com/la-cosplay-photo" }],
          responseId: "resp_live_dry_run_mock",
        };
      },
      persistShadowResults: false,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(providerCalls, 1);
    assert.equal(result.calledProvider, true);
    assert.equal(result.mode, "live_dry_run");
    assert.equal(result.persistedCandidates, false);
    assert.equal(result.publicResearchCandidates.length, 1);
    assert.equal(result.publicResearchCandidates[0].requiresHumanReview, true);
    assert.equal(result.publicResearchCandidates[0].availabilityKnown, false);
    assert.equal(result.publicResearchCandidates[0].willingnessKnown, false);
    assert.equal(result.publicResearchCandidates[0].ratesKnown, false);
    assert.equal(result.researchRunId, null);
    assert.equal(result.resultIds.length, 0);
    assert.equal(result.talentCandidateIds.length, 0);

    const noCitation = publicResearchCandidateCardSchema.safeParse({
      ...card(),
      sourceUrls: [],
    });
    assert.equal(noCitation.success, false);
    const invalidResult = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return { candidates: [{ ...card(), sourceUrls: [] } as PublicResearchCandidateCard] };
      },
      persistShadowResults: false,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(invalidResult.publicResearchCandidates.length, 0);

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
        roleFitEvidence: ["Call 555-123-4567. They are available."],
        publicProfileUrls: ["https://example.com/portfolio"],
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
        fandoms: ["anime", "cosplay"],
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
        projectFandoms: ["anime", "cosplay"],
      },
    );
    assert.equal(quality.shouldPromoteToShortlist, false);
    assert.equal(quality.shouldBlockOutreach, true);

    assert.equal(
      publicWebResearchAuditEvents.liveDryRunRequested,
      "public_web_research.live_dry_run_requested",
    );
    assert.equal(
      publicWebResearchAuditEvents.liveDryRunCompleted,
      "public_web_research.live_dry_run_completed",
    );
    assert.equal(
      publicWebResearchAuditEvents.liveDryRunSentToQualityReview,
      "public_web_research.live_dry_run_sent_to_quality_review",
    );
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");
    assertSafe(result);

    console.log("Public web research live dry-run tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
