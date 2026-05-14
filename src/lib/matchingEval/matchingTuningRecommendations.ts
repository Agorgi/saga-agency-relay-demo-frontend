import type { MatchingEvaluationFixtureResult } from "@/lib/matchingEval/runMatchingEvaluation";

export function generateMatchingTuningRecommendations(
  results: MatchingEvaluationFixtureResult[],
) {
  const recommendations: string[] = [];
  const failed = results.filter((result) => !result.passed);
  const allFailures = results.flatMap((result) => result.failures);
  const allWarnings = results.flatMap((result) => result.warnings);

  if (allFailures.some((item) => /public_web/i.test(item))) {
    recommendations.push(
      "Increase public-web unreviewed penalty or tighten public-web review gates.",
    );
  }
  if (allFailures.some((item) => /location/i.test(item))) {
    recommendations.push(
      "Review role-location requirements and increase local-required location weighting.",
    );
  }
  if (allFailures.some((item) => /relationship|proximity/i.test(item))) {
    recommendations.push(
      "Inspect graph edges and relationship proximity weights for direct/mutual paths.",
    );
  }
  if (allFailures.some((item) => /fandom|tag/i.test(item))) {
    recommendations.push(
      "Add tag aliases or adjust fandom/community weighting for missed affinity matches.",
    );
  }
  if (allFailures.some((item) => /contactability/i.test(item))) {
    recommendations.push(
      "Tune contactability readiness weight while keeping contactability as evidence, not permission.",
    );
  }
  if (allFailures.some((item) => /weak evidence|evidence/i.test(item))) {
    recommendations.push(
      "Increase weak-evidence penalties or require stronger source quality before ranking.",
    );
  }
  if (allWarnings.some((item) => /over.?source|overstaff/i.test(item))) {
    recommendations.push(
      "Reduce role count or optional-role weighting for interest checks and low-budget projects.",
    );
  }
  if (failed.length >= 3) {
    recommendations.push(
      "Review the baseline scoring weights as a set before changing individual candidates.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No automatic weight changes recommended. Keep current weights and inspect low-scoring fixtures manually.",
    );
  }

  return [...new Set(recommendations)];
}
