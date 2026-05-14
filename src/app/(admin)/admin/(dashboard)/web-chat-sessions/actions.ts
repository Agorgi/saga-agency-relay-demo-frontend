"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/sms-engine/adminAuth";
import { setAutonomousEnabled } from "@/lib/webChatRuntimeSettings";

export async function toggleAutonomousAction(formData: FormData) {
  const adminSessionId = await requireAdminForAction();

  const nextValue = String(formData.get("nextValue") || "").trim().toLowerCase();
  if (nextValue !== "true" && nextValue !== "false") {
    redirect("/admin/web-chat-sessions?toggle_error=invalid_value");
  }

  const result = await setAutonomousEnabled(nextValue === "true", adminSessionId);

  if (!result.ok) {
    redirect("/admin/web-chat-sessions?toggle_error=env_ceiling");
  }

  revalidatePath("/admin/web-chat-sessions");
  redirect("/admin/web-chat-sessions");
}
