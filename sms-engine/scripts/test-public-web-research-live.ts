import assert from "node:assert/strict";
import { createOpenAiWebResearchProvider } from "@/lib/sourcing/openaiWebResearchProvider";
import { buildPublicWebLiveDryRunRequest } from "@/lib/sourcing/publicWebLiveDryRunFixture";
import { evaluatePublicWebResearchSafety } from "@/lib/sourcing/publicWebResearchSafety";

async function main() {
  const shouldRun =
    process.env.PUBLIC_WEB_RESEARCH_ENABLED === "true" &&
    process.env.PUBLIC_WEB_RESEARCH_MODE === "live_dry_run" &&
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED === "true" &&
    process.env.SMS_SENDS_DISABLED === "true" &&
    process.env.RUN_LIVE_WEB_RESEARCH_TESTS === "true" &&
    Boolean(process.env.OPENAI_API_KEY);

  if (!shouldRun) {
    console.log(
      "Skipping live public web research test. Set PUBLIC_WEB_RESEARCH_ENABLED=true, PUBLIC_WEB_RESEARCH_MODE=live_dry_run, PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=true, SMS_SENDS_DISABLED=true, RUN_LIVE_WEB_RESEARCH_TESTS=true, and OPENAI_API_KEY to run.",
    );
    return;
  }

  const provider = createOpenAiWebResearchProvider();
  const result = await provider(buildPublicWebLiveDryRunRequest());
  const candidates = Array.isArray(result) ? result : result.candidates;
  assert.ok(candidates.length <= 5);
  for (const candidate of candidates) {
    const safety = evaluatePublicWebResearchSafety({ candidate });
    assert.ok(candidate.sourceUrls.length > 0, "source URLs are required");
    assert.equal(candidate.requiresHumanReview, true);
    assert.equal(safety.sanitizedCard?.requiresHumanReview, true);
  }
  assert.equal(process.env.SMS_SENDS_DISABLED, "true");
  console.log("Live public web research preflight passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
