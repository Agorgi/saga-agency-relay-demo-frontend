import {
  evaluateLaunchReadinessDrill,
  formatLaunchDrillReport,
} from "@/lib/launchDrill/launchReadinessDrill";

async function main() {
  const result = await evaluateLaunchReadinessDrill();
  console.log(formatLaunchDrillReport(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
