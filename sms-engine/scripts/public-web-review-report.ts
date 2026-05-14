import { getDb } from "@/sms-engine/db";
import { redactForLog } from "@/sms-engine/safeLogging";
import { getPublicWebResearchHealthSnapshot } from "@/sms-engine/sourcing/publicWebResearchProvider";

async function main() {
  const health = await getPublicWebResearchHealthSnapshot();
  const statusCounts = process.env.DATABASE_URL
    ? await getDb().publicWebResearchResult.groupBy({
        by: ["status"],
        _count: { status: true },
      })
    : [];
  const sourceQualityCounts = process.env.DATABASE_URL
    ? await getDb().publicWebResearchResult.groupBy({
        by: ["sourceQualityBand"],
        _count: { sourceQualityBand: true },
      })
    : [];
  const contactabilityStatusCounts = process.env.DATABASE_URL
    ? await getDb().contactabilityEvidence.groupBy({
        by: ["reviewStatus"],
        _count: { reviewStatus: true },
      })
    : [];
  const contactabilityRiskCounts = process.env.DATABASE_URL
    ? await getDb().contactabilityEvidence.groupBy({
        by: ["outreachRisk"],
        _count: { outreachRisk: true },
      })
    : [];

  console.log(
    redactForLog(
      [
        "# Public Web Research Review Report",
        "",
        `Generated: ${new Date().toISOString()}`,
        `Review available: ${health.publicWebResearchReviewAvailable}`,
        `Mode: ${health.publicWebResearchMode}`,
        `Pending jobs: ${health.publicWebResearchPendingJobCount ?? "n/a"}`,
        `Failed jobs: ${health.publicWebResearchFailedJobCount ?? "n/a"}`,
        `Pending review: ${health.publicWebPendingReviewCount ?? "n/a"}`,
        `Needs more research: ${health.publicWebNeedsMoreResearchCount ?? "n/a"}`,
        `Needs contact research: ${health.publicWebNeedsMoreContactResearchCount ?? "n/a"}`,
        `Discarded/archived: ${health.publicWebDiscardedCount ?? "n/a"}`,
        `Duplicates: ${health.publicWebDuplicateCount ?? "n/a"}`,
        `Do not contact: ${health.publicWebDoNotContactCount ?? "n/a"}`,
        `Contactability pending review: ${health.contactabilityPendingReviewCount ?? "n/a"}`,
        `Contactability high risk: ${health.contactabilityHighRiskCount ?? "n/a"}`,
        `Review risk: ${health.publicWebReviewRiskLevel}`,
        "",
        "## Status Counts",
        ...statusCounts.map((item) => `- ${item.status}: ${item._count.status}`),
        "",
        "## Source Quality Counts",
        ...sourceQualityCounts.map(
          (item) => `- ${item.sourceQualityBand || "unknown"}: ${item._count.sourceQualityBand}`,
        ),
        "",
        "## Contactability Review Counts",
        ...contactabilityStatusCounts.map(
          (item) => `- ${item.reviewStatus}: ${item._count.reviewStatus}`,
        ),
        "",
        "## Contactability Risk Counts",
        ...contactabilityRiskCounts.map(
          (item) => `- ${item.outreachRisk}: ${item._count.outreachRisk}`,
        ),
        "",
        "No SMS sent. No outreach sent. No group chat created. No source URLs, prompts, raw outputs, phone numbers, emails, or secrets printed.",
      ].join("\n"),
    ),
  );
}

main().catch((error) => {
  console.error(redactForLog(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
