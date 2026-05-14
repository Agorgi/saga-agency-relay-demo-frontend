"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  setAdminSession,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "");

  if (!verifyAdminPassword(password)) {
    redirect("/admin?error=1");
  }

  await setAdminSession();
  redirect("/admin/projects");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin");
}
