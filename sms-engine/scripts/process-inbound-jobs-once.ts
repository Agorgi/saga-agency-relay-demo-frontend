import { processPendingInboundJobsOnce } from "@/sms-engine/messagingPipeline";

function limitFromEnv() {
  const parsed = Number.parseInt(process.env.JOB_PROCESS_LIMIT || "10", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;
}

async function main() {
  const result = await processPendingInboundJobsOnce(limitFromEnv());
  console.log(
    JSON.stringify(
      {
        processed: result.processed,
        skipped: "skipped" in result ? result.skipped : false,
        reason: "reason" in result ? result.reason : undefined,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.name : "UnknownError",
      message:
        error instanceof Error
          ? error.message.replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
          : "unknown",
    }),
  );
  process.exit(1);
});
