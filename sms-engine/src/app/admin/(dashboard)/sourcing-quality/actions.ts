"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createTalentResearchReviewForCandidate,
  updateTalentResearchReviewStatus,
} from "@/lib/sourcing/talentResearchQuality";

const reviewStatusSchema = z.enum([
  "UNREVIEWED",
  "APPROVED_FOR_SHORTLIST",
  "NEEDS_MORE_RESEARCH",
  "REJECTED",
  "DO_NOT_CONTACT",
  "NEEDS_ADMIN",
]);

export async function runTalentQualityReviewAction(formData: FormData) {
  const talentCandidateId = String(formData.get("talentCandidateId") || "").trim();
  if (!talentCandidateId) redirect("/admin/sourcing-quality");
  await createTalentResearchReviewForCandidate({
    talentCandidateId,
    reviewer: "admin",
    adminReviewed: false,
  });
  revalidatePath("/admin/sourcing-quality");
  revalidatePath("/admin/sourcing");
  redirect("/admin/sourcing-quality");
}

export async function updateTalentQualityReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") || "").trim();
  const reviewStatus = reviewStatusSchema.parse(
    String(formData.get("reviewStatus") || ""),
  );
  const reviewerNotes = String(formData.get("reviewerNotes") || "").trim();
  const organizerFacingSummary = String(
    formData.get("organizerFacingSummary") || "",
  ).trim();
  if (!reviewId) redirect("/admin/sourcing-quality");
  await updateTalentResearchReviewStatus({
    reviewId,
    reviewStatus,
    reviewerNotes: reviewerNotes || null,
    organizerFacingSummary: organizerFacingSummary || null,
    reviewedBy: "admin",
  });
  revalidatePath("/admin/sourcing-quality");
  revalidatePath("/admin/sourcing");
  redirect("/admin/sourcing-quality");
}
