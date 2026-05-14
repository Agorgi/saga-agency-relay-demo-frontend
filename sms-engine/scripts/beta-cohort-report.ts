import {
  formatBetaCohortSimulationReport,
  runAllBetaCohortSimulations,
} from "@/sms-engine/cohortSimulation/runCohortSimulation";

async function main() {
  const results = await runAllBetaCohortSimulations({
    includeOperationalDrills: true,
  });
  console.log(formatBetaCohortSimulationReport(results));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown beta cohort report error");
  process.exit(1);
});

