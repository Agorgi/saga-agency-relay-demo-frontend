"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/adminAuth";
import {
  runAllBetaCohortSimulations,
  runBetaCohortSimulation,
} from "@/lib/cohortSimulation/runCohortSimulation";
import {
  betaCohortSimulationAuditEvents,
  betaCohortSimulationTypes,
  type BetaCohortSimulationType,
} from "@/lib/cohortSimulation/cohortTypes";
import { logAudit } from "@/lib/audit";

function cohortTypeFromForm(formData: FormData): BetaCohortSimulationType | null {
  const value = formData.get("cohortType");
  if (typeof value !== "string") return null;
  return betaCohortSimulationTypes.includes(value as BetaCohortSimulationType)
    ? (value as BetaCohortSimulationType)
    : null;
}

export async function recordOneBetaCohortSimulationAction(formData: FormData) {
  await requireAdminForAction();
  const cohortType = cohortTypeFromForm(formData);
  if (!cohortType) return;
  const result = await runBetaCohortSimulation(cohortType, { persist: true });
  await logAudit({
    actorType: "ADMIN",
    action: betaCohortSimulationAuditEvents.reportGenerated,
    entityType: "BetaCohortSimulation",
    entityId: cohortType,
    metadata: {
      cohortType,
      status: result.status,
      riskLevel: result.riskLevel,
      blockersCount: result.blockers.length,
      warningsCount: result.warnings.length,
      dryRunOnly: true,
      noSmsSent: true,
      noTwilioCalls: true,
    },
  });
  revalidatePath("/admin/beta-simulations");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/launch-drill");
}

export async function recordAllBetaCohortSimulationsAction() {
  await requireAdminForAction();
  const results = await runAllBetaCohortSimulations({ persist: true });
  await logAudit({
    actorType: "ADMIN",
    action: betaCohortSimulationAuditEvents.reportGenerated,
    entityType: "BetaCohortSimulation",
    entityId: "all",
    metadata: {
      cohortCount: results.length,
      riskLevel: results.some((result) => result.riskLevel === "red")
        ? "red"
        : results.some((result) => result.riskLevel === "yellow")
          ? "yellow"
          : "green",
      dryRunOnly: true,
      noSmsSent: true,
      noTwilioCalls: true,
    },
  });
  revalidatePath("/admin/beta-simulations");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/launch-drill");
}

