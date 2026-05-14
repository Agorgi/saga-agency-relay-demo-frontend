import assert from "node:assert/strict";
import { buildPublicWebLiveDryRunRequest } from "@/sms-engine/sourcing/publicWebLiveDryRunFixture";
import {
  getPublicWebResearchHealthSnapshot,
  processNextPublicWebResearchJobs,
  processPublicWebResearchJob,
  publicWebResearchErrorCategory,
  queuePublicWebResearchLiveDryRun,
  runPublicWebResearch,
} from "@/sms-engine/sourcing/publicWebResearchProvider";
import {
  publicWebResearchAuditEvents,
  type PublicResearchCandidateCard,
} from "@/sms-engine/sourcing/talentTypes";

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
}

function enableLiveDryRun() {
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "live_dry_run";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
  process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED = "true";
  process.env.PUBLIC_WEB_RESEARCH_MAX_RESULTS = "5";
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
    "https://example.com/la-cosplay-photo",
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
    const disabled = await queuePublicWebResearchLiveDryRun();
    assert.equal(disabled.queued, false);
    assert(disabled.blockers.includes("public_web_research_disabled"));

    enableLiveDryRun();
    let providerCalls = 0;
    const queuedNoDb = await queuePublicWebResearchLiveDryRun();
    assert.equal(queuedNoDb.queued, false);
    assert(queuedNoDb.blockers.includes("database_not_configured"));
    assert.equal(providerCalls, 0);

    const processNoDb = await processPublicWebResearchJob("job_test");
    assert.equal(processNoDb.status, "SKIPPED");
    assert.equal(processNoDb.calledProvider, false);
    assert.equal(processNoDb.errorCategory, "database_not_configured");

    const nextNoDb = await processNextPublicWebResearchJobs({
      provider: async () => {
        providerCalls += 1;
        return { candidates: [card()] };
      },
    });
    assert.equal(nextNoDb.processed, 0);
    assert.equal(providerCalls, 0);

    const request = buildPublicWebLiveDryRunRequest();
    const mockedCore = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return {
          candidates: [card()],
          sources: [{ url: "https://example.com/la-cosplay-photo" }],
        };
      },
      persistShadowResults: false,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(mockedCore.calledProvider, true);
    assert.equal(mockedCore.publicResearchCandidates.length, 1);
    assert.equal(mockedCore.publicResearchCandidates[0].availabilityKnown, false);
    assert.equal(mockedCore.publicResearchCandidates[0].willingnessKnown, false);
    assert.equal(mockedCore.publicResearchCandidates[0].ratesKnown, false);
    assert.equal(mockedCore.persistedCandidates, false);
    assert.equal(providerCalls, 1);

    const noCitation = await runPublicWebResearch({
      request,
      provider: async () => {
        providerCalls += 1;
        return {
          candidates: [{ ...card(), sourceUrls: [] } as PublicResearchCandidateCard],
        };
      },
      persistShadowResults: false,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(noCitation.publicResearchCandidates.length, 0);
    assert.equal(noCitation.calledProvider, true);

    assert.equal(
      publicWebResearchErrorCategory(new Error("OpenAI request timed out")),
      "provider_timeout",
    );
    assert.equal(
      publicWebResearchErrorCategory(new Error("429 rate limit")),
      "provider_rate_limit",
    );
    assert.equal(
      publicWebResearchErrorCategory(
        new Error("OpenAI web research failed: invalid_schema:400"),
      ),
      "invalid_schema",
    );
    assert.equal(
      publicWebResearchAuditEvents.jobCreated,
      "public_web_research.job_created",
    );
    assert.equal(
      publicWebResearchAuditEvents.jobSucceeded,
      "public_web_research.job_succeeded",
    );
    assert.equal(
      publicWebResearchAuditEvents.runFailedTimeout,
      "public_web_research.run_failed_timeout",
    );

    const health = await getPublicWebResearchHealthSnapshot();
    assert.equal(health.publicWebResearchAsyncAvailable, true);
    assertSafe({
      publicWebResearchEnabled: health.publicWebResearchEnabled,
      publicWebResearchMode: health.publicWebResearchMode,
      publicWebResearchPendingJobCount: health.publicWebResearchPendingJobCount,
      publicWebResearchFailedJobCount: health.publicWebResearchFailedJobCount,
      publicWebResearchBlockerCount: health.publicWebResearchBlockerCount,
    });
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log("Public web research async dry-run tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
