"use server";

import type { ContactabilityReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveResearchRun,
  cleanupTestTaggedResults,
  reviewPublicWebResearchResult,
  updateContactabilityEvidenceReview,
  type PublicWebReviewAction,
} from "@/sms-engine/sourcing/publicWebResearchCleanup";

function reviewAction(value: string): PublicWebReviewAction {
  if (
    value === "SEND_TO_QUALITY_REVIEW" ||
    value === "NEEDS_MORE_RESEARCH" ||
    value === "NEEDS_MORE_CONTACT_RESEARCH" ||
    value === "DISCARD" ||
    value === "REJECT" ||
    value === "LINK_TO_INTERNAL_PROFILE" ||
    value === "MARK_DUPLICATE" ||
    value === "MARK_DO_NOT_CONTACT" ||
    value === "ARCHIVE"
  ) {
    return value;
  }
  return "NEEDS_MORE_RESEARCH";
}

function contactabilityStatus(value: string): ContactabilityReviewStatus {
  if (
    value === "UNREVIEWED" ||
    value === "VERIFIED" ||
    value === "UNSAFE" ||
    value === "NEEDS_MORE_RESEARCH" ||
    value === "DO_NOT_CONTACT"
  ) {
    return value;
  }
  return "UNREVIEWED";
}

export async function reviewPublicWebResearchResultAction(formData: FormData) {
  const resultId = String(formData.get("resultId") || "").trim();
  if (!resultId) redirect("/admin/sourcing/public-web-review");
  await reviewPublicWebResearchResult({
    resultId,
    action: reviewAction(String(formData.get("reviewAction") || "")),
    reviewerNotes: String(formData.get("reviewerNotes") || "").trim() || null,
    duplicateMatchedType:
      String(formData.get("duplicateMatchedType") || "").trim() || null,
    duplicateMatchedId:
      String(formData.get("duplicateMatchedId") || "").trim() || null,
  });
  revalidatePath("/admin/sourcing/public-web-review");
  revalidatePath("/admin/sourcing/public-web");
  revalidatePath("/admin/sourcing-quality");
  redirect("/admin/sourcing/public-web-review?reviewed=1");
}

export async function archivePublicWebResearchRunAction(formData: FormData) {
  const runId = String(formData.get("runId") || "").trim();
  if (!runId) redirect("/admin/sourcing/public-web-review");
  await archiveResearchRun(runId);
  revalidatePath("/admin/sourcing/public-web-review");
  revalidatePath("/admin/sourcing/public-web");
  redirect("/admin/sourcing/public-web-review?archived=1");
}

export async function cleanupTestTaggedPublicWebResultsAction(formData: FormData) {
  const tag = String(formData.get("tag") || "live_dry_run").trim() || "live_dry_run";
  await cleanupTestTaggedResults(tag);
  revalidatePath("/admin/sourcing/public-web-review");
  revalidatePath("/admin/sourcing/public-web");
  redirect("/admin/sourcing/public-web-review?cleanup=1");
}

export async function reviewContactabilityEvidenceAction(formData: FormData) {
  const evidenceId = String(formData.get("evidenceId") || "").trim();
  if (!evidenceId) redirect("/admin/sourcing/public-web-review");
  await updateContactabilityEvidenceReview({
    evidenceId,
    status: contactabilityStatus(String(formData.get("status") || "")),
  });
  revalidatePath("/admin/sourcing/public-web-review");
  redirect("/admin/sourcing/public-web-review?contactabilityReviewed=1");
}
