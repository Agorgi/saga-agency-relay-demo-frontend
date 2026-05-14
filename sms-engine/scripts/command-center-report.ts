import {
  formatCommandCenterReport,
  getCommandCenterSummary,
} from "@/sms-engine/commandCenter/commandCenterSummary";

async function main() {
  const summary = await getCommandCenterSummary();
  console.log(formatCommandCenterReport(summary));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Command center report failed: ${message}`);
  process.exitCode = 1;
});
