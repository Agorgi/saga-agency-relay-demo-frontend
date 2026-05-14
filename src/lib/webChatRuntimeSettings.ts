import { getDb } from "@/sms-engine/db";

const WEB_CHAT_RUNTIME_SETTING_KEY = "global";

function envFlagEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

async function ensureRuntimeSetting() {
  const db = getDb();
  const envEnabled = envFlagEnabled(
    process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED,
  );
  const setting = await db.webChatRuntimeSetting.upsert({
    where: { key: WEB_CHAT_RUNTIME_SETTING_KEY },
    update: {},
    create: {
      key: WEB_CHAT_RUNTIME_SETTING_KEY,
      autonomousEnabled: envEnabled,
      updatedByAdminSessionId: null,
    },
  });

  return {
    envEnabled,
    setting,
  };
}

export async function getRuntimeSettingSnapshot() {
  const { envEnabled, setting } = await ensureRuntimeSetting();
  return {
    envEnabled,
    effectiveAutonomousEnabled: envEnabled && setting.autonomousEnabled,
    requestedAutonomousEnabled: setting.autonomousEnabled,
    updatedAt: setting.updatedAt,
    updatedByAdminSessionId: setting.updatedByAdminSessionId,
  };
}

export async function getEffectiveAutonomous() {
  const snapshot = await getRuntimeSettingSnapshot();
  return snapshot.effectiveAutonomousEnabled;
}

export async function setAutonomousEnabled(
  newValue: boolean,
  adminSessionId: string | null,
) {
  const envEnabled = envFlagEnabled(
    process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED,
  );

  if (newValue && !envEnabled) {
    return {
      ok: false as const,
      error:
        "Autonomous replies are disabled by the environment ceiling. Restart with WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true before enabling the runtime toggle.",
    };
  }

  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const current = await tx.webChatRuntimeSetting.upsert({
      where: { key: WEB_CHAT_RUNTIME_SETTING_KEY },
      update: {},
      create: {
        key: WEB_CHAT_RUNTIME_SETTING_KEY,
        autonomousEnabled: envEnabled,
        updatedByAdminSessionId: null,
      },
    });

    if (current.autonomousEnabled === newValue) {
      return {
        oldValue: current.autonomousEnabled,
        newValue,
        changed: false,
      };
    }

    await tx.webChatRuntimeSetting.update({
      where: { key: WEB_CHAT_RUNTIME_SETTING_KEY },
      data: {
        autonomousEnabled: newValue,
        updatedByAdminSessionId: adminSessionId,
      },
    });

    await tx.webChatRuntimeSettingAudit.create({
      data: {
        oldValue: current.autonomousEnabled,
        newValue,
        actorAdminSessionId: adminSessionId,
      },
    });

    return {
      oldValue: current.autonomousEnabled,
      newValue,
      changed: true,
    };
  });

  return {
    ok: true as const,
    ...result,
  };
}

export async function getRecentAudit(limit = 20) {
  return getDb().webChatRuntimeSettingAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
