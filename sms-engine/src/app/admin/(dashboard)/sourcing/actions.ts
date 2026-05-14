"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  runInternalTalentSearchForProjectBrief,
  updateTalentCandidateStatus,
} from "@/sms-engine/sourcing/internalTalentSearch";
import { talentCandidateStatusSchema } from "@/sms-engine/sourcing/talentTypes";

export async function runInternalTalentSearchAction(formData: FormData) {
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  if (!projectBriefId) {
    redirect("/admin/sourcing");
  }
  await runInternalTalentSearchForProjectBrief(projectBriefId);
  revalidatePath("/admin/sourcing");
  redirect(`/admin/sourcing?projectBriefId=${encodeURIComponent(projectBriefId)}`);
}

export async function updateTalentCandidateStatusAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") || "").trim();
  const status = talentCandidateStatusSchema.parse(
    String(formData.get("status") || ""),
  );
  const projectBriefId = String(formData.get("projectBriefId") || "").trim();
  const adminNotes = String(formData.get("adminNotes") || "").trim();
  if (!candidateId) redirect("/admin/sourcing");
  await updateTalentCandidateStatus({
    candidateId,
    status,
    adminNotes: adminNotes || null,
  });
  revalidatePath("/admin/sourcing");
  redirect(
    projectBriefId
      ? `/admin/sourcing?projectBriefId=${encodeURIComponent(projectBriefId)}`
      : "/admin/sourcing",
  );
}
