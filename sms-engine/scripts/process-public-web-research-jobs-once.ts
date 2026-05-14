import { createOpenAiWebResearchProvider } from "@/lib/sourcing/openaiWebResearchProvider";
import {
  getPublicWebResearchConfig,
  processNextPublicWebResearchJobs,
} from "@/lib/sourcing/publicWebResearchProvider";
import { redactForLog } from "@/lib/safeLogging";

async function main() {
  const config = getPublicWebResearchConfig();
  const limit = Number.parseInt(process.env.JOB_PROCESS_LIMIT || "1", 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 5) : 1;

  if (!config.publicWebResearchEnabled) {
    console.log(
      redactForLog(
        JSON.stringify(
          {
            skipped: true,
            reason: "public_web_research_disabled",
            noSmsSent: true,
            noTwilioCall: true,
            noOutreachSent: true,
            noProductionSagaData: true,
          },
          null,
          2,
        ),
      ),
    );
    return;
  }

  if (
    config.publicWebResearchMode !== "live_dry_run" &&
    config.publicWebResearchMode !== "shadow"
  ) {
    console.log(
      redactForLog(
        JSON.stringify(
          {
            skipped: true,
            reason: "public_web_research_mode_not_processable",
            mode: config.publicWebResearchMode,
            noSmsSent: true,
            noTwilioCall: true,
            noOutreachSent: true,
          },
          null,
          2,
        ),
      ),
    );
    return;
  }

  const provider =
    config.publicWebResearchProvider === "openai_web_search"
      ? createOpenAiWebResearchProvider()
      : undefined;
  const result = await processNextPublicWebResearchJobs({
    limit: safeLimit,
    provider,
    lockedBy: "public_web_research_cli_once",
  });

  console.log(
    redactForLog(
      JSON.stringify(
        {
          processed: result.processed,
          results: result.results.map((item) => ({
            jobId: item.jobId,
            status: item.status,
            calledProvider: item.calledProvider,
            resultCount: item.resultCount,
            citationCount: item.citationCount,
            errorCategory: item.errorCategory,
            blockerCount: item.blockers?.length || 0,
            warningCount: item.warnings?.length || 0,
          })),
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
