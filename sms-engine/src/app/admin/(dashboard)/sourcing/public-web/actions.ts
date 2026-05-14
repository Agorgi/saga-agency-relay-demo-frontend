"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PublicWebResearchResultStatus } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import { generatePublicResearchPlan } from "@/sms-engine/sourcing/publicResearchPlan";
import {
  cancelPublicWebResearchJob,
  getPublicWebResearchConfig,
  queuePublicWebResearchLiveDryRun,
  runPublicWebResearch,
  updatePublicWebResearchResultStatus,
} from "@/sms-engine/sourcing/publicWebResearchProvider";
import { buildPublicWebQueryPlan } from "@/sms-engine/sourcing/publicWebQueryBuilder";
import { generateSourcingStrategy } from "@/sms-engine/sourcing/sourcingStrategy";
import { publicWebResearchAuditEvents } from "@/sms-engine/sourcing/talentTypes";

function resultStatus(value: string): PublicWebResearchResultStatus {
  if (
    value === "SHADOW_RESULT" ||
    value === "NEEDS_REVIEW" ||
    value === "IN_QUALITY_REVIEW" ||
    value === "APPROVED_FOR_REVIEW" ||
    value === "APPROVED_FOR_INTERNAL_REVIEW" ||
    value === "REJECTED" ||
    value === "DISCARDED" ||
    value === "ARCHIVED" ||
    value === "DUPLICATE" ||
    value === "DO_NOT_CONTACT"
  ) {
    return value;
  }
  return "NEEDS_REVIEW";
}

export async function runPublicWebResearchShadowAction(formData: FormData) {
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  const targetRole = String(formData.get("targetRole") || "").trim();
  if (!projectBriefId || !targetRole || !process.env.DATABASE_URL) {
    redirect("/admin/sourcing/public-web");
  }

  const config = getPublicWebResearchConfig();
  const projectBrief = await getDb().projectBrief.findUnique({
    where: { id: projectBriefId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 10 },
      project: true,
      talentSearchRuns: {
        include: { candidates: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!projectBrief) redirect("/admin/sourcing/public-web");

  const understanding = buildProjectUnderstanding({
    projectBrief,
    project: projectBrief.project,
    recentMessages: projectBrief.messages,
  });
  const roleMap = generateRoleMap(understanding);
  const latestCandidates = projectBrief.talentSearchRuns[0]?.candidates || [];
  const strategy = generateSourcingStrategy(understanding, roleMap, {
    internalCandidateCount: latestCandidates.length,
  });
  const publicPlan = generatePublicResearchPlan(understanding, roleMap, strategy);
  const queryPlan = buildPublicWebQueryPlan({
    understanding,
    roleMap,
    sourcingStrategy: strategy,
    publicResearchPlan: publicPlan,
    targetRole,
    allowedDomains: config.publicWebResearchAllowedDomains,
    blockedDomains: config.publicWebResearchBlockedDomains,
  });
  await logAudit({
    actorType: "ADMIN",
    action: publicWebResearchAuditEvents.planGenerated,
    entityType: "ProjectBrief",
    entityId: projectBriefId,
    metadata: {
      projectBriefId,
      projectId: projectBrief.projectId,
      role: targetRole,
      queryCount: queryPlan.searchQueries.length,
      allowedDomainCount: queryPlan.allowedDomains.length,
      blockedDomainCount: queryPlan.blockedDomains.length,
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChat: true,
    },
  });
  await runPublicWebResearch({
    request: {
      projectBriefId,
      projectId: projectBrief.projectId,
      searchRunId: projectBrief.talentSearchRuns[0]?.id || null,
      queryPlan: queryPlan.searchQueries,
      roleTargets: [
        {
          role: targetRole,
          city: understanding.city,
          criteria: queryPlan.evidenceChecklist,
        },
      ],
      allowedDomains: queryPlan.allowedDomains,
      blockedDomains: queryPlan.blockedDomains,
    },
    provider: undefined,
    persistShadowResults: true,
  });

  revalidatePath("/admin/sourcing/public-web");
  revalidatePath("/admin/sourcing");
  revalidatePath("/admin/sourcing-quality");
  redirect(`/admin/sourcing/public-web?projectBriefId=${encodeURIComponent(projectBriefId)}`);
}

export async function runPublicWebResearchLiveDryRunAction() {
  await queuePublicWebResearchLiveDryRun();

  revalidatePath("/admin/sourcing/public-web");
  revalidatePath("/admin/sourcing");
  revalidatePath("/admin/sourcing-quality");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/observability");
  redirect("/admin/sourcing/public-web?liveDryRunQueued=1");
}

export async function cancelPublicWebResearchJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "").trim();
  if (!jobId) redirect("/admin/sourcing/public-web");
  await cancelPublicWebResearchJob(jobId);
  revalidatePath("/admin/sourcing/public-web");
  revalidatePath("/admin/command-center");
  revalidatePath("/admin/observability");
  redirect("/admin/sourcing/public-web?jobCancelled=1");
}

export async function updatePublicWebResearchResultStatusAction(
  formData: FormData,
) {
  const resultId = String(formData.get("resultId") || "").trim();
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  const status = resultStatus(String(formData.get("status") || ""));
  if (!resultId) redirect("/admin/sourcing/public-web");
  await updatePublicWebResearchResultStatus({ resultId, status });
  revalidatePath("/admin/sourcing/public-web");
  revalidatePath("/admin/sourcing-quality");
  redirect(
    projectBriefId
      ? `/admin/sourcing/public-web?projectBriefId=${encodeURIComponent(projectBriefId)}`
      : "/admin/sourcing/public-web",
  );
}
