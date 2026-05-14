"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/sms-engine/adminAuth";
import { setAutonomousEnabled } from "@/lib/webChatRuntimeSettings";

const ADMIN_COOKIE_NAME = "saga_admin_session";

export async function toggleAutonomousAction(formData: FormData) {
  await requireAdminForAction();

  const nextValue = String(formData.get("nextValue") || "").trim().toLowerCase();
  if (nextValue !== "true" && nextValue !== "false") {
    redirect("/admin/web-chat-sessions?toggle_error=invalid_value");
  }

  const adminSessionId =
    (await cookies()).get(ADMIN_COOKIE_NAME)?.value?.trim() || null;
  const result = await setAutonomousEnabled(nextValue === "true", adminSessionId);

  if (!result.ok) {
    redirect("/admin/web-chat-sessions?toggle_error=env_ceiling");
  }

  revalidatePath("/admin/web-chat-sessions");
  redirect("/admin/web-chat-sessions");
}
