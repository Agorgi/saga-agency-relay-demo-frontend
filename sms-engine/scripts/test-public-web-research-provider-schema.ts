import assert from "node:assert/strict";
import { createOpenAiWebResearchProvider } from "@/lib/sourcing/openaiWebResearchProvider";
import { buildPublicWebLiveDryRunRequest } from "@/lib/sourcing/publicWebLiveDryRunFixture";
import {
  publicWebResearchErrorCategory,
  runPublicWebResearch,
} from "@/lib/sourcing/publicWebResearchProvider";
import type { PublicResearchCandidateCard } from "@/lib/sourcing/talentTypes";

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
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "live_dry_run";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
  process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS = "true";
  process.env.PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS = "false";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED = "true";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES = "1";
  process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG = "live_dry_run";
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "+15551234567",
    "555-123-4567",
    "person@example.com",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
}

function extractedCard(): PublicResearchCandidateCard {
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
  };
}

function mockWebResponse(withCitations = true) {
  const text = withCitations
    ? "Candidate lead: LA Cosplay Photo Studio may fit based on a public portfolio at https://example.com/la-cosplay-photo"
    : "Candidate lead: LA Cosplay Photo Studio may fit, but no citations are present.";
  return {
    id: "resp_web_mock",
    output_text: text,
    output: [
      {
        type: "web_search_call",
        action: withCitations
          ? {
              type: "search",
              sources: [
                {
                  url: "https://example.com/la-cosplay-photo",
                  title: "LA cosplay photography portfolio",
                },
              ],
            }
          : { type: "search", sources: [] },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text,
            annotations: withCitations
              ? [
                  {
                    type: "url_citation",
                    url: "https://example.com/la-cosplay-photo",
                    title: "LA cosplay photography portfolio",
                    start_index: 87,
                    end_index: 125,
                  },
                ]
              : [],
          },
        ],
      },
    ],
  };
}

function mockClient(input?: {
  withCitations?: boolean;
  extractionCandidates?: unknown[];
  createThrows?: unknown;
}) {
  const calls = {
    create: [] as unknown[],
    parse: [] as unknown[],
  };
  return {
    calls,
    client: {
      responses: {
        create: async (body: unknown) => {
          calls.create.push(body);
          if (input?.createThrows) throw input.createThrows;
          return mockWebResponse(input?.withCitations !== false);
        },
        parse: async (body: unknown) => {
          calls.parse.push(body);
          return {
            id: "resp_extract_mock",
            output_text: "{}",
            output_parsed: {
              candidates: input?.extractionCandidates ?? [extractedCard()],
              warnings: [],
            },
          };
        },
      },
    },
  };
}

async function main() {
  try {
    setBaseEnv();
    const request = buildPublicWebLiveDryRunRequest();
    const okMock = mockClient();
    const provider = createOpenAiWebResearchProvider({
      client: okMock.client as never,
    });
    const response = await provider(request);
    const normalized = Array.isArray(response)
      ? { candidates: response, sources: [] }
      : response;
    assert.equal(normalized.candidates.length, 1);
    assert.equal(normalized.sources?.length, 1);
    assert.equal(okMock.calls.create.length, 1);
    assert.equal(okMock.calls.parse.length, 1);

    const webRequest = okMock.calls.create[0] as Record<string, unknown>;
    assert.equal(webRequest.text, undefined);
    assert.equal(webRequest.tool_choice, "required");
    assert(Array.isArray(webRequest.tools));
    assert.equal((webRequest.tools as Array<Record<string, unknown>>)[0].type, "web_search");
    assert.deepEqual(webRequest.include, ["web_search_call.action.sources"]);

    const extractionRequest = okMock.calls.parse[0] as Record<string, unknown>;
    assert.equal(extractionRequest.tool_choice, "none");
    assert.equal(extractionRequest.tools, undefined);
    const text = extractionRequest.text as Record<string, unknown>;
    const format = text.format as Record<string, unknown>;
    assert.equal(format.type, "json_schema");
    assert.equal(format.name, "PublicWebResearchCandidateExtraction");
    assertSafe({ webRequest, extractionRequest: { ...extractionRequest, input: null } });

    const coreResult = await runPublicWebResearch({
      request,
      provider,
      persistShadowResults: false,
      adminTriggered: true,
      demoSafe: true,
    });
    assert.equal(coreResult.calledProvider, true);
    assert.equal(coreResult.publicResearchCandidates.length, 1);
    assert.equal(coreResult.citationCount, 1);
    assert.equal(coreResult.persistedCandidates, false);

    const noCitationMock = mockClient({ withCitations: false });
    await assert.rejects(
      () =>
        createOpenAiWebResearchProvider({
          client: noCitationMock.client as never,
        })(request),
      (error: unknown) => {
        assert.equal(publicWebResearchErrorCategory(error), "invalid_structured_output");
        assertSafe(error);
        return true;
      },
    );

    const invalidOutputMock = mockClient({ extractionCandidates: [] });
    await assert.rejects(
      () =>
        createOpenAiWebResearchProvider({
          client: invalidOutputMock.client as never,
        })(request),
      (error: unknown) => {
        assert.equal(publicWebResearchErrorCategory(error), "invalid_structured_output");
        assertSafe(error);
        return true;
      },
    );

    const invalidSchemaError = Object.assign(
      new Error("invalid_schema: unsupported JSON schema field"),
      { status: 400 },
    );
    const invalidSchemaMock = mockClient({ createThrows: invalidSchemaError });
    await assert.rejects(
      () =>
        createOpenAiWebResearchProvider({
          client: invalidSchemaMock.client as never,
        })(request),
      (error: unknown) => {
        assert.equal(publicWebResearchErrorCategory(error), "invalid_schema");
        assertSafe(error);
        const diagnostic = (error as { providerDiagnostic?: unknown })
          .providerDiagnostic as Record<string, unknown>;
        assert.equal(diagnostic.operation, "web_search");
        assert.equal(diagnostic.structuredOutputRequested, false);
        assert.equal(diagnostic.webSearchRequested, true);
        return true;
      },
    );

    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log("Public web research provider schema tests passed");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
