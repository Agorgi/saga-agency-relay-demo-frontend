"use server";

import { redirect } from "next/navigation";
import { createPublicBetaWaitlistEntry } from "@/sms-engine/publicBeta/publicBetaWaitlist";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textArray(value: string | null) {
  if (!value) return [];
  return value
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function joinPublicBetaWaitlistAction(formData: FormData) {
  const consent = formData.get("consent") === "on";
  const result = await createPublicBetaWaitlistEntry({
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    city: text(formData, "city"),
    desiredUseCase: text(formData, "desiredUseCase"),
    fandoms: textArray(text(formData, "fandoms")),
    source: "public_beta_landing",
    consentCaptured: consent,
  });

  if (!result.ok) {
    redirect("/beta?status=closed");
  }

  redirect(result.duplicate ? "/beta?status=duplicate" : "/beta?status=joined");
}
