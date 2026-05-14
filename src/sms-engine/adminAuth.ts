import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/sms-engine/db";
import { getAdminEnv } from "@/sms-engine/env";

const ADMIN_COOKIE = "saga_admin_session";

async function getAdminSessionRecord() {
  const sessionId = (await cookies()).get(ADMIN_COOKIE)?.value?.trim();
  if (!sessionId) {
    return null;
  }

  const session = await getDb().adminSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      revokedAt: true,
    },
  });

  if (!session || session.revokedAt) {
    return null;
  }

  return session;
}

async function touchAdminSession(sessionId: string) {
  await getDb().adminSession.update({
    where: { id: sessionId },
    data: {
      lastSeenAt: new Date(),
    },
  });
}

export async function isAdminAuthenticated() {
  try {
    return Boolean(await getAdminSessionRecord());
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  const session = await getAdminSessionRecord();
  if (!session) {
    redirect("/admin");
  }

  await touchAdminSession(session.id);
  return session.id;
}

export async function requireAdminForAction() {
  const session = await getAdminSessionRecord();
  if (!session) {
    throw new Error("Unauthorized");
  }

  await touchAdminSession(session.id);
  return session.id;
}

export async function setAdminSession() {
  const session = await getDb().adminSession.create({
    data: {},
  });

  (await cookies()).set(ADMIN_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return session.id;
}

export async function clearAdminSession() {
  const sessionId = (await cookies()).get(ADMIN_COOKIE)?.value?.trim();
  if (sessionId) {
    await getDb().adminSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

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
  const left = Buffer.from(password);
  const right = Buffer.from(ADMIN_PASSWORD);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
