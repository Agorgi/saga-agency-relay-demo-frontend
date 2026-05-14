"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/adminAuth";
import { logAudit } from "@/lib/audit";
import { redactSensitiveTextForDisplay } from "@/lib/adminPrivacy";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function markTranscriptDryRunReviewAction(formData: FormData) {
  await requireAdminForAction();
  const scenarioId = text(formData, "scenarioId");
  const reviewStatus = text(formData, "reviewStatus") || "UNREVIEWED";
  const reviewerNotes = text(formData, "reviewerNotes");
  if (!scenarioId) return;

  await logAudit({
    actorType: "ADMIN",
    action: "dry_run.transcript_review_marked",
    entityType: "TranscriptDryRun",
    entityId: scenarioId,
    metadata: {
      scenarioId,
      reviewStatus,
      hasReviewerNotes: Boolean(reviewerNotes),
      reviewerNotes: reviewerNotes
        ? redactSensitiveTextForDisplay(reviewerNotes)
        : null,
      source: "admin_transcript_dry_runs",
    },
  });

  revalidatePath("/admin/transcript-dry-runs");
}
