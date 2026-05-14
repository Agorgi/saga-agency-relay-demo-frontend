import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type MatchingEvaluationHealthSnapshot = {
  matchingEvaluationAvailable: boolean;
  lastMatchingEvaluationScore: number | null;
  lastMatchingEvaluationPassed: boolean | null;
  matchingEvaluationFailureCount: number | null;
  matchingEvaluationSafetyViolationCount: number | null;
  matchingEvaluationTuningRecommendationCount: number | null;
};

function numberFrom(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

export function getMatchingEvaluationHealthSnapshot(): MatchingEvaluationHealthSnapshot {
  const reportPath = join(process.cwd(), "reports", "matching-evaluation-report.md");
  if (!existsSync(reportPath)) {
    return {
      matchingEvaluationAvailable: true,
      lastMatchingEvaluationScore: null,
      lastMatchingEvaluationPassed: null,
      matchingEvaluationFailureCount: null,
      matchingEvaluationSafetyViolationCount: null,
      matchingEvaluationTuningRecommendationCount: null,
    };
  }
  try {
    const report = readFileSync(reportPath, "utf8");
    const score = numberFrom(report, /Average score: (\d+)/);
    const failureCount = numberFrom(report, /Fixture fail count: (\d+)/);
    const safetyCount = numberFrom(report, /Safety violations: (\d+)/);
    const recommendationSection =
      report.match(/## Tuning Recommendations\n([\s\S]*?)\n## /)?.[1] || "";
    const recommendationCount = (recommendationSection.match(/^- /gm) || []).length;
    return {
      matchingEvaluationAvailable: true,
      lastMatchingEvaluationScore: score,
      lastMatchingEvaluationPassed: /Overall: PASS/.test(report),
      matchingEvaluationFailureCount: failureCount,
      matchingEvaluationSafetyViolationCount: safetyCount,
      matchingEvaluationTuningRecommendationCount: recommendationCount,
    };
  } catch {
    return {
      matchingEvaluationAvailable: true,
      lastMatchingEvaluationScore: null,
      lastMatchingEvaluationPassed: null,
      matchingEvaluationFailureCount: null,
      matchingEvaluationSafetyViolationCount: null,
      matchingEvaluationTuningRecommendationCount: null,
    };
  }
}
