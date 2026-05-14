"use server";

import type { CandidateGraphMatchReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  rankCandidatesForProject,
  updateCandidateGraphMatchResultReview,
} from "@/sms-engine/graph/projectCandidateMatcher";

const reviewStatuses = new Set<CandidateGraphMatchReviewStatus>([
  "SUGGESTED",
  "NEEDS_REVIEW",
  "APPROVED_FOR_SHORTLIST",
  "REJECTED",
  "DO_NOT_CONTACT",
]);

export async function runRelationshipAwareMatchingAction(formData: FormData) {
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  const poolCap = Number(formData.get("poolCap") || 250);
  if (!projectBriefId) redirect("/admin/matching");

  const result = await rankCandidatesForProject(projectBriefId, {
    persist: true,
    poolCap: Number.isFinite(poolCap) ? Math.min(Math.max(poolCap, 1), 250) : 250,
  });

  revalidatePath("/admin/matching");
  redirect(
    result.matchRunId
      ? `/admin/matching?projectBriefId=${encodeURIComponent(projectBriefId)}&runId=${encodeURIComponent(result.matchRunId)}`
      : `/admin/matching?projectBriefId=${encodeURIComponent(projectBriefId)}`,
  );
}

export async function updateMatchResultReviewAction(formData: FormData) {
  const resultId = String(formData.get("resultId") || "").trim();
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  const runId = String(formData.get("runId") || "").trim();
  const reviewStatus = String(formData.get("reviewStatus") || "").trim();
  const adminNotes = String(formData.get("adminNotes") || "").trim();

  if (!resultId || !reviewStatuses.has(reviewStatus as CandidateGraphMatchReviewStatus)) {
    redirect("/admin/matching");
  }

  await updateCandidateGraphMatchResultReview({
    resultId,
    reviewStatus: reviewStatus as CandidateGraphMatchReviewStatus,
    adminNotes: adminNotes || null,
  });

  revalidatePath("/admin/matching");
  const params = new URLSearchParams();
  if (projectBriefId) params.set("projectBriefId", projectBriefId);
  if (runId) params.set("runId", runId);
  redirect(params.size > 0 ? `/admin/matching?${params.toString()}` : "/admin/matching");
}
