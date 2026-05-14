import {
  formatObservabilityDailyReport,
  getObservabilitySummary,
} from "@/sms-engine/observability/observabilitySummary";

async function main() {
  const summary = await getObservabilitySummary();
  console.log(formatObservabilityDailyReport(summary));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Observability daily report failed: ${message}`);
  process.exitCode = 1;
});
