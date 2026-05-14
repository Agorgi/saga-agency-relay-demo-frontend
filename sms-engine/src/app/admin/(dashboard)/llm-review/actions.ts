"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/sms-engine/adminAuth";
import { updateLlmReviewItem } from "@/sms-engine/llm/qualityReview";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateLlmReviewItemAction(formData: FormData) {
  await requireAdminForAction();
  const id = text(formData, "id");
  if (!id) return;

  await updateLlmReviewItem({
    id,
    reviewStatus: text(formData, "reviewStatus"),
    reviewerNotes: text(formData, "reviewerNotes"),
  });

  revalidatePath("/admin/llm-review");
}
