import { getDb } from "@/lib/db";

export type CandidateGraphHealthSnapshot = {
  candidateGraphAvailable: boolean;
  relationshipAwareMatchingAvailable: boolean;
  candidateSearchProfileCount: number | null;
  graphEdgeCount: number | null;
  unverifiedResearchCandidateCount: number | null;
  doNotContactCandidateCount: number | null;
  publicWebOnlyCandidateCount: number | null;
  recentMatchRunCount: number | null;
  pendingMatchReviewCount: number | null;
  internalCandidateCoverage: number | null;
  publicWebCandidateCoverage: number | null;
  averageCandidateScore: number | null;
  highRiskMatchCount: number | null;
  doNotContactExcludedCount: number | null;
};

export async function getCandidateGraphHealthSnapshot(): Promise<CandidateGraphHealthSnapshot> {
  if (!process.env.DATABASE_URL) {
    return {
      candidateGraphAvailable: true,
      relationshipAwareMatchingAvailable: true,
      candidateSearchProfileCount: null,
      graphEdgeCount: null,
      unverifiedResearchCandidateCount: null,
      doNotContactCandidateCount: null,
      publicWebOnlyCandidateCount: null,
      recentMatchRunCount: null,
      pendingMatchReviewCount: null,
      internalCandidateCoverage: null,
      publicWebCandidateCoverage: null,
      averageCandidateScore: null,
      highRiskMatchCount: null,
      doNotContactExcludedCount: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      candidateSearchProfileCount,
      graphEdgeCount,
      unverifiedResearchCandidateCount,
      doNotContactCandidateCount,
      publicWebOnlyCandidateCount,
      recentMatchRunCount,
      pendingMatchReviewCount,
      internalCandidateCoverage,
      publicWebCandidateCoverage,
      averageScore,
      highRiskMatchCount,
      doNotContactExcludedCount,
    ] = await Promise.all([
      getDb().candidateSearchProfile.count(),
      getDb().candidateGraphEdge.count(),
      getDb().candidateSearchProfile.count({
        where: {
          reviewStatus: {
            in: [
              "DISCOVERED",
              "NEEDS_IDENTITY_REVIEW",
              "NEEDS_CONTACTABILITY_REVIEW",
              "NEEDS_QUALITY_REVIEW",
            ],
          },
        },
      }),
      getDb().candidateSearchProfile.count({
        where: { OR: [{ doNotContact: true }, { reviewStatus: "DO_NOT_CONTACT" }] },
      }),
      getDb().candidateSearchProfile.count({
        where: { sourceMode: "PUBLIC_WEB_RESEARCH", reviewStatus: { not: "APPROVED_FOR_SHORTLIST" } },
      }),
      getDb().candidateGraphMatchRun.count({
        where: { createdAt: { gte: since } },
      }),
      getDb().candidateGraphMatchResult.count({
        where: { reviewStatus: { in: ["SUGGESTED", "NEEDS_REVIEW"] } },
      }),
      getDb().candidateSearchProfile.count({
        where: { sourceMode: { not: "PUBLIC_WEB_RESEARCH" } },
      }),
      getDb().candidateSearchProfile.count({
        where: { sourceMode: "PUBLIC_WEB_RESEARCH" },
      }),
      getDb().candidateGraphMatchResult.aggregate({
        _avg: { totalScore: true },
      }),
      getDb().candidateGraphMatchResult.count({
        where: { totalScore: { lt: 40 } },
      }),
      getDb().candidateSearchProfile.count({
        where: { OR: [{ doNotContact: true }, { optedOut: true }] },
      }),
    ]);

    return {
      candidateGraphAvailable: true,
      relationshipAwareMatchingAvailable: true,
      candidateSearchProfileCount,
      graphEdgeCount,
      unverifiedResearchCandidateCount,
      doNotContactCandidateCount,
      publicWebOnlyCandidateCount,
      recentMatchRunCount,
      pendingMatchReviewCount,
      internalCandidateCoverage,
      publicWebCandidateCoverage,
      averageCandidateScore: averageScore._avg.totalScore
        ? Number(averageScore._avg.totalScore.toFixed(2))
        : null,
      highRiskMatchCount,
      doNotContactExcludedCount,
    };
  } catch {
    return {
      candidateGraphAvailable: true,
      relationshipAwareMatchingAvailable: true,
      candidateSearchProfileCount: null,
      graphEdgeCount: null,
      unverifiedResearchCandidateCount: null,
      doNotContactCandidateCount: null,
      publicWebOnlyCandidateCount: null,
      recentMatchRunCount: null,
      pendingMatchReviewCount: null,
      internalCandidateCoverage: null,
      publicWebCandidateCoverage: null,
      averageCandidateScore: null,
      highRiskMatchCount: null,
      doNotContactExcludedCount: null,
    };
  }
}
