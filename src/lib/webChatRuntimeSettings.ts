import { getDb } from "@/sms-engine/db";
import { getConfiguredModel, normalizeRouteLlmMode } from "@/lib/sagasanAgent";
import {
  hasWebChatDatabase,
  loadRecentAssistantMessagesForRuntime,
} from "@/lib/webChatSessionStore";

const WEB_CHAT_RUNTIME_SETTING_KEY = "global";
const memoryRuntimeSetting = {
  autonomousEnabled: false,
  updatedAt: new Date(),
  updatedByAdminSessionId: null as string | null,
};
const memoryRuntimeAudit: Array<{
  id: string;
  oldValue: boolean;
  newValue: boolean;
  actorAdminSessionId: string | null;
  createdAt: Date;
}> = [];

function envFlagEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

async function ensureRuntimeSetting() {
  const envEnabled = envFlagEnabled(
    process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED,
  );

  if (!hasWebChatDatabase()) {
    if (!memoryRuntimeSetting.updatedAt) {
      memoryRuntimeSetting.updatedAt = new Date();
    }
    if (!memoryRuntimeAudit.length) {
      memoryRuntimeSetting.autonomousEnabled = envEnabled;
    }
    return {
      envEnabled,
      setting: memoryRuntimeSetting,
    };
  }

  const db = getDb();
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

  if (!hasWebChatDatabase()) {
    const oldValue = memoryRuntimeSetting.autonomousEnabled;
    if (oldValue !== newValue) {
      memoryRuntimeSetting.autonomousEnabled = newValue;
      memoryRuntimeSetting.updatedAt = new Date();
      memoryRuntimeSetting.updatedByAdminSessionId = adminSessionId;
      memoryRuntimeAudit.unshift({
        id: crypto.randomUUID(),
        oldValue,
        newValue,
        actorAdminSessionId: adminSessionId,
        createdAt: new Date(),
      });
    }

    return {
      ok: true as const,
      oldValue,
      newValue,
      changed: oldValue !== newValue,
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
  if (!hasWebChatDatabase()) {
    return memoryRuntimeAudit.slice(0, limit);
  }

  return getDb().webChatRuntimeSettingAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function recordSystemHoldingFallback() {
  const snapshot = await getRuntimeSettingSnapshot();
  if (!hasWebChatDatabase()) {
    memoryRuntimeAudit.unshift({
      id: crypto.randomUUID(),
      oldValue: snapshot.requestedAutonomousEnabled,
      newValue: snapshot.requestedAutonomousEnabled,
      actorAdminSessionId: "system",
      createdAt: new Date(),
    });
    return;
  }

  await getDb().webChatRuntimeSettingAudit.create({
    data: {
      oldValue: snapshot.requestedAutonomousEnabled,
      newValue: snapshot.requestedAutonomousEnabled,
      actorAdminSessionId: "system",
    },
  });
}

export async function getWebChatRuntimeDashboard() {
  const snapshot = await getRuntimeSettingSnapshot();
  const configuredMode = normalizeRouteLlmMode(process.env.LLM_MODE);
  const configuredModel = getConfiguredModel();
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const publicLaunchGate = process.env.PUBLIC_LAUNCH_ENABLED === "true";

  const recentAssistantMessages = await loadRecentAssistantMessagesForRuntime(100);

  const recentAssistantCount = recentAssistantMessages.length;
  const recentFallbackCount = recentAssistantMessages.filter(
    (message) => message.selectedReplySource !== "openai_selected",
  ).length;
  const fallbackRate = recentAssistantCount
    ? recentFallbackCount / recentAssistantCount
    : 0;
  const latest = recentAssistantMessages[0] || null;

  const blockingGate = !snapshot.envEnabled
    ? "Environment ceiling is off."
    : !snapshot.requestedAutonomousEnabled
      ? "Runtime toggle is set to holding."
      : configuredMode !== "active_live"
        ? "LLM_MODE is active_mock."
        : !openAiConfigured
          ? "OPENAI_API_KEY is missing."
          : latest?.providerState === "openai_called_failed"
            ? "OpenAI call failed and deterministic fallback was selected."
            : latest?.providerState === "openai_called_validation_failed"
              ? "OpenAI responded but the reply failed validation."
              : null;

  const effectiveMode = !snapshot.effectiveAutonomousEnabled
    ? "holding"
    : configuredMode === "active_live" && openAiConfigured
      ? "active_live"
      : "active_mock";

  return {
    configuredModel,
    configuredMode,
    effectiveMode,
    envEnabled: snapshot.envEnabled,
    requestedAutonomousEnabled: snapshot.requestedAutonomousEnabled,
    effectiveAutonomousEnabled: snapshot.effectiveAutonomousEnabled,
    openAiConfigured,
    openAiActuallyCalled:
      latest?.providerState === "openai_called_succeeded" ||
      latest?.providerState === "openai_called_failed" ||
      latest?.providerState === "openai_called_validation_failed",
    fallbackReason: latest?.fallbackReason || null,
    providerState: latest?.providerState || null,
    blockingGate,
    activeLiveAllowed:
      snapshot.effectiveAutonomousEnabled &&
      configuredMode === "active_live" &&
      openAiConfigured,
    shadowMode: configuredMode !== "active_live",
    publicLaunchGate,
    recentAssistantCount,
    recentFallbackCount,
    fallbackRate,
    lastObservedAt: latest?.createdAt || null,
  };
}
