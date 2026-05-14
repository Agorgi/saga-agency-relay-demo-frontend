import { getDb } from "@/sms-engine/db";
import { getPublicWebResearchHealthSnapshot } from "@/sms-engine/sourcing/publicWebResearchProvider";

export async function getTalentDiscoveryHealthSnapshot() {
  const publicWeb = await getPublicWebResearchHealthSnapshot();
  if (!process.env.DATABASE_URL) {
    return {
      talentDiscoveryAvailable: true,
      recentInternalSearchCount: null,
      recentSourcingPlanCount: null,
      recentPublicResearchPlanCount: null,
      ...publicWeb,
      candidateReviewQueueCount: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      recentInternalSearchCount,
      recentSourcingPlanCount,
      recentPublicResearchPlanCount,
      candidateReviewQueueCount,
    ] = await Promise.all([
      getDb().talentSearchRun.count({
        where: { createdAt: { gte: since } },
      }),
      getDb().auditLog.count({
        where: {
          action: "sourcing.strategy_generated",
          createdAt: { gte: since },
        },
      }),
      getDb().auditLog.count({
        where: {
          action: "sourcing.public_research_plan_generated",
          createdAt: { gte: since },
        },
      }),
      getDb().talentCandidate.count({
        where: { status: { in: ["SUGGESTED", "NEEDS_MORE_INFO"] } },
      }),
    ]);

    return {
      talentDiscoveryAvailable: true,
      recentInternalSearchCount,
      recentSourcingPlanCount,
      recentPublicResearchPlanCount,
      ...publicWeb,
      candidateReviewQueueCount,
    };
  } catch {
    return {
      talentDiscoveryAvailable: true,
      recentInternalSearchCount: null,
      recentSourcingPlanCount: null,
      recentPublicResearchPlanCount: null,
      ...publicWeb,
      candidateReviewQueueCount: null,
    };
  }
}
