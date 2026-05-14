import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  formatMatchingEvaluationReport,
  runMatchingEvaluation,
} from "@/sms-engine/matchingEval/runMatchingEvaluation";

async function main() {
  const report = await runMatchingEvaluation();
  const markdown = formatMatchingEvaluationReport(report);
  const reportsDir = join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, "matching-evaluation-report.md");
  await writeFile(reportPath, markdown, "utf8");
  console.log(
    JSON.stringify(
      {
        reportPath,
        generatedAt: report.generatedAt,
        passed: report.passed,
        averageScore: report.averageScore,
        fixturesRun: report.fixturesRun,
        fixtureFailCount: report.fixtureFailCount,
        safetyViolationCount: report.safetyViolationCount,
        tuningRecommendationCount: report.tuningRecommendations.length,
        noSmsSent: report.noSmsSent,
        noTwilioRequired: report.noTwilioRequired,
        noLiveWebCallRequired: report.noLiveWebCallRequired,
        noProductionSagaAppDataRequired: report.noProductionSagaAppDataRequired,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
