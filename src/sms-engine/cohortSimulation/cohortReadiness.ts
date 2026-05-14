import type {
  BetaCohortSimulationHealthSnapshot,
  BetaCohortSimulationResult,
} from "@/sms-engine/cohortSimulation/cohortTypes";

export function summarizeBetaCohortReadiness(
  results: BetaCohortSimulationResult[],
): Pick<
  BetaCohortSimulationHealthSnapshot,
  | "simulationRiskLevel"
  | "simulationBlockerCount"
  | "designPartnerSimulationReady"
  | "privateBetaSimulationReady"
  | "publicBetaSimulationReady"
  | "overCapacitySimulationReady"
  | "requiredSimulationsPassed"
  | "warnings"
  | "blockers"
> {
  const byType = new Map(results.map((result) => [result.cohortType, result]));
  const design = byType.get("DESIGN_PARTNER_10");
  const privateBeta = byType.get("PRIVATE_BETA_25");
  const publicBeta = byType.get("CAPPED_PUBLIC_BETA_100");
  const overCapacity = byType.get("OVER_CAPACITY");
  const blockers = results
    .flatMap((result) => result.blockers)
    .filter((blocker, index, all) => all.indexOf(blocker) === index);
  const warnings = results
    .flatMap((result) => result.warnings)
    .filter((warning, index, all) => all.indexOf(warning) === index);
  const simulationRiskLevel = results.some((result) => result.riskLevel === "red")
    ? "red"
    : results.some((result) => result.riskLevel === "yellow")
      ? "yellow"
      : "green";
  const designPartnerSimulationReady = Boolean(
    design && design.riskLevel !== "red" && design.transcriptPassRate >= 0.8,
  );
  const privateBetaSimulationReady = Boolean(
    privateBeta && privateBeta.riskLevel !== "red" && privateBeta.transcriptPassRate >= 0.8,
  );
  const overCapacitySimulationReady = Boolean(
    overCapacity && overCapacity.riskLevel !== "red",
  );
  const publicBetaSimulationReady = Boolean(
    publicBeta &&
      publicBeta.riskLevel !== "red" &&
      publicBeta.transcriptPassRate >= 0.8 &&
      overCapacitySimulationReady,
  );

  return {
    simulationRiskLevel,
    simulationBlockerCount: blockers.length,
    designPartnerSimulationReady,
    privateBetaSimulationReady,
    publicBetaSimulationReady,
    overCapacitySimulationReady,
    requiredSimulationsPassed:
      designPartnerSimulationReady &&
      privateBetaSimulationReady &&
      publicBetaSimulationReady,
    warnings,
    blockers,
  };
}

