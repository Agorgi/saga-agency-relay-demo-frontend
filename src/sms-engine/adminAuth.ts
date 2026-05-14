import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminEnv } from "@/sms-engine/env";

const ADMIN_COOKIE = "saga_admin_session";

function sessionToken() {
  const { ADMIN_PASSWORD } = getAdminEnv();
  return createHash("sha256")
    .update(`saga-admin:${ADMIN_PASSWORD}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function isAdminAuthenticated() {
  try {
    const value = (await cookies()).get(ADMIN_COOKIE)?.value;
    return value ? safeEqual(value, sessionToken()) : false;
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }
}

export async function requireAdminForAction() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function verifyAdminPassword(password: string) {
  const { ADMIN_PASSWORD } = getAdminEnv();
  return safeEqual(password, ADMIN_PASSWORD);
}
