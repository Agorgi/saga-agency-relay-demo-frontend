import { createOpenAiWebResearchProvider } from "@/lib/sourcing/openaiWebResearchProvider";
import {
  processPublicWebResearchJob,
  queuePublicWebResearchLiveDryRun,
} from "@/lib/sourcing/publicWebResearchProvider";
import { redactForLog } from "@/lib/safeLogging";

async function main() {
  const queue = await queuePublicWebResearchLiveDryRun();
  const shouldProcess =
    queue.queued &&
    queue.jobId &&
    process.env.RUN_LIVE_WEB_RESEARCH_TESTS === "true";

  const processed = shouldProcess
    ? await processPublicWebResearchJob(queue.jobId, {
        provider: createOpenAiWebResearchProvider(),
        lockedBy: "public_web_research_live_dry_run_cli",
      })
    : null;

  console.log(
    redactForLog(
      JSON.stringify(
        {
          queued: queue.queued,
          runId: queue.researchRunId,
          jobId: queue.jobId,
          blockers: queue.blockers,
          warnings: queue.warnings,
          processed: processed
            ? {
                status: processed.status,
                calledProvider: processed.calledProvider,
                resultCount: processed.resultCount,
                citationCount: processed.citationCount,
                errorCategory: processed.errorCategory,
                blockerCount: processed.blockers.length,
                warningCount: processed.warnings.length,
              }
            : null,
          processingSkippedReason: shouldProcess
            ? null
            : "RUN_LIVE_WEB_RESEARCH_TESTS_not_true_or_queue_blocked",
          noSmsSent: true,
          noTwilioCall: true,
          noOutreachSent: true,
          noGroupChatCreated: true,
          noProductionSagaData: true,
        },
        null,
        2,
      ),
    ),
  );
}

main().catch((error) => {
  console.error(redactForLog(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
