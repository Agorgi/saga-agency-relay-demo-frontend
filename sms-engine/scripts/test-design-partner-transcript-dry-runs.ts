import assert from "node:assert/strict";
import type { z } from "zod";
import { designPartnerTranscriptScenarios } from "@/lib/dryRuns/designPartnerTranscriptScenarios";
import {
  runDesignPartnerTranscriptDryRuns,
  summarizeDesignPartnerTranscriptDryRuns,
} from "@/lib/dryRuns/runDesignPartnerTranscript";
import type {
  LlmRuntimeConfig,
  LlmStructuredProvider,
} from "@/lib/llm/llmProvider";

const originalEnv = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
  delete process.env.OPENAI_BASE_URL;
  Object.assign(process.env, {
    LLM_PROVIDER: "openai",
    LLM_MODE: "active_mock",
    OPENAI_API_KEY: "sk-test-dry-run",
    OPENAI_MODEL: "gpt-5.4-mini",
    LLM_LOG_PROMPTS: "false",
    LLM_LOG_OUTPUTS: "false",
    SMS_SENDS_DISABLED: "true",
    SMS_REQUIRE_ALLOWLIST: "true",
    TWILIO_STAGING_MODE: "true",
    TWILIO_VALIDATE_WEBHOOKS: "true",
    ...overrides,
  });
}

function extractFallback(prompt: string) {
  const match = prompt.match(/Deterministic fallback reply:\s*([\s\S]+?)\n\nReturn JSON/);
  return match?.[1]?.trim() || "Got it. What detail should Saga know next?";
}

const mockProvider: LlmStructuredProvider = async <T extends z.ZodType>({
  schema,
  prompt,
}: {
  schema: T;
  schemaName: string;
  instructions: string;
  prompt: string;
  config: LlmRuntimeConfig;
}) => {
  const fallback = extractFallback(prompt);
  const message = fallback.startsWith("Got it")
    ? fallback
    : `Got it. ${fallback}`;
  return {
    ok: true,
    data: schema.parse({
      message,
      confidence: 0.88,
      needsAdmin: false,
      reason: null,
    }),
    rawText: JSON.stringify({ message, confidence: 0.88 }),
    responseId: "resp_dry_run_mock",
  };
};

function assertNoSensitiveValues(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+14155550123",
    "14155550123",
    "sk-test-dry-run",
    "OPENAI_API_KEY",
    "TWILIO_AUTH_TOKEN",
  ]) {
    assert.ok(!serialized.includes(unsafe), `Leaked sensitive value: ${unsafe}`);
  }
}

async function main() {
  resetEnv();
  const results = await runDesignPartnerTranscriptDryRuns({
    llmProvider: mockProvider,
  });

  assert.equal(results.length, 10, "expected exactly 10 transcript dry runs");
  assert.equal(
    results.length,
    designPartnerTranscriptScenarios.length,
    "all fixtures should execute",
  );
  assert.ok(results.every((result) => result.turns.length > 0));
  assert.ok(results.every((result) => typeof result.score === "number"));

  const organizer = results.filter(
    (result) => result.finalState.flow === "ORGANIZER_INTAKE",
  );
  const gigSeekers = results.filter(
    (result) => result.finalState.flow === "GIG_SEEKER_ONBOARDING",
  );
  const interestChecks = results.filter(
    (result) => result.finalState.flow === "INTEREST_CHECK",
  );
  const contactReplies = results.filter(
    (result) => result.finalState.flow === "CONTACT_REPLY",
  );

  assert.ok(organizer.length >= 4, "organizer scenarios should route correctly");
  assert.ok(gigSeekers.length >= 3, "gig-seeker scenarios should route correctly");
  assert.ok(
    interestChecks.length >= 2,
    "interest-check scenarios should route correctly",
  );
  assert.ok(contactReplies.length >= 1, "contact reply scenario should route");

  const safetyScenario = results.find(
    (result) => result.scenarioId === "contact_reply_consent_and_payment",
  );
  assert.ok(safetyScenario, "safety contact scenario should exist");
  assert.equal(safetyScenario.escalationCorrect, true);
  assert.ok(
    safetyScenario.turns.some((turn) => turn.nextStage === "NEEDS_ADMIN"),
    "payment/rate question should escalate",
  );

  const gigGuarantee = results.find(
    (result) => result.scenarioId === "gig_seeker_guaranteed_paid_work",
  );
  assert.ok(gigGuarantee, "gig-seeker guarantee scenario should exist");
  assert.equal(gigGuarantee.finalState.needsAdmin, true);

  assert.equal(
    results.some((result) => result.forbiddenClaimsDetected),
    false,
    "dry-run replies should avoid forbidden claims",
  );
  assert.ok(
    results.some((result) => result.llmUsed),
    "active_mock should be used with mocked provider when configured",
  );
  assert.ok(
    results.some((result) => result.fallbackUsed),
    "fallback/skipped state should be clearly marked for safety turns",
  );
  assert.ok(
    results.some((result) => result.producerAgent),
    "brief-ready organizer scenarios should run Producer Agent dry-run steps",
  );
  assert.ok(
    results.every((result) => result.score >= 10),
    "each scenario should meet the minimum score",
  );
  assert.ok(
    results.filter((result) => result.passed).length >= 8,
    "at least 8/10 transcripts should pass",
  );

  const blockedSummary = summarizeDesignPartnerTranscriptDryRuns({ results });
  assert.equal(blockedSummary.readyForDryRunReview, true);
  assert.equal(blockedSummary.readyForDesignPartners, false);
  assert.ok(
    blockedSummary.blockers.some((blocker) =>
      blocker.includes("SMS compliance"),
    ),
  );

  const passingLiveGateSummary = summarizeDesignPartnerTranscriptDryRuns({
    results,
    smsComplianceApproved: true,
    sendsDisabled: false,
  });
  assert.equal(passingLiveGateSummary.readyForDryRunReview, true);
  assert.equal(passingLiveGateSummary.readyForDesignPartners, true);

  const failedSummary = summarizeDesignPartnerTranscriptDryRuns({
    results: [
      {
        ...safetyScenario,
        passed: false,
        forbiddenClaimsDetected: false,
        failures: ["Synthetic safety-critical failure"],
      },
    ],
    smsComplianceApproved: true,
    sendsDisabled: false,
  });
  assert.equal(failedSummary.readyForDryRunReview, false);
  assert.equal(failedSummary.readyForDesignPartners, false);

  assertNoSensitiveValues(results);
  assertNoSensitiveValues(blockedSummary);

  resetEnv();
  console.log(
    "Design partner transcript dry-run checks passed without Twilio, SMS, or production data.",
  );
}

main().catch((error) => {
  resetEnv();
  console.error(error);
  process.exit(1);
});
