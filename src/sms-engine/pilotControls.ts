import { z } from "zod";

export const pilotStageSchema = z.enum([
  "internal_test",
  "design_partner",
  "private_beta",
  "public_candidate",
  "capped_public_beta",
  "public_live",
]);

export const pilotReplyModeSchema = z.enum([
  "draft_only",
  "manual_approval",
  "auto_allowlisted",
]);

export type PilotStage = z.infer<typeof pilotStageSchema>;
export type PilotReplyMode = z.infer<typeof pilotReplyModeSchema>;

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function configured(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function getPilotStage(): PilotStage {
  const parsed = pilotStageSchema.safeParse(process.env.PILOT_STAGE);
  return parsed.success ? parsed.data : "internal_test";
}

export function getPilotReplyMode(): PilotReplyMode {
  const parsed = pilotReplyModeSchema.safeParse(process.env.PILOT_REPLY_MODE);
  return parsed.success ? parsed.data : "draft_only";
}

export function stageRequiresAllowlist(stage = getPilotStage()) {
  if (stage === "public_live") {
    return !booleanEnv(process.env.PUBLIC_LAUNCH_ENABLED);
  }

  return true;
}

export function stageRequiresComplianceApproval(stage = getPilotStage()) {
  return stage !== "internal_test";
}

export function getPilotPublicLaunchStatus(input?: {
  sendsDisabled?: boolean;
  allowlistRequired?: boolean;
}) {
  const pilotStage = getPilotStage();
  const pilotReplyMode = getPilotReplyMode();
  const publicLaunchEnabled = booleanEnv(process.env.PUBLIC_LAUNCH_ENABLED);
  const publicBetaEnabled = booleanEnv(process.env.PUBLIC_BETA_ENABLED);
  const complianceApproved = booleanEnv(process.env.SMS_COMPLIANCE_APPROVED);
  const supportContactConfigured = configured(process.env.PILOT_SUPPORT_CONTACT);
  const privacyUrlConfigured = configured(process.env.PILOT_PRIVACY_URL);
  const termsUrlConfigured = configured(process.env.PILOT_TERMS_URL);
  const sendsDisabled =
    input?.sendsDisabled ?? booleanEnv(process.env.SMS_SENDS_DISABLED, true);
  const allowlistRequired =
    input?.allowlistRequired ??
    booleanEnv(process.env.SMS_REQUIRE_ALLOWLIST, pilotStage !== "public_live");

  const publicLaunchBlockers: string[] = [];

  if (pilotStage === "public_live") {
    if (!publicLaunchEnabled) {
      publicLaunchBlockers.push("PUBLIC_LAUNCH_ENABLED must be true.");
    }
    if (sendsDisabled) {
      publicLaunchBlockers.push("SMS_SENDS_DISABLED must be false.");
    }
    if (!complianceApproved) {
      publicLaunchBlockers.push("SMS_COMPLIANCE_APPROVED must be true.");
    }
    if (pilotReplyMode === "draft_only") {
      publicLaunchBlockers.push("PILOT_REPLY_MODE must not be draft_only.");
    }
    if (!supportContactConfigured) {
      publicLaunchBlockers.push("PILOT_SUPPORT_CONTACT must be configured.");
    }
    if (!privacyUrlConfigured) {
      publicLaunchBlockers.push("PILOT_PRIVACY_URL must be configured.");
    }
    if (!termsUrlConfigured) {
      publicLaunchBlockers.push("PILOT_TERMS_URL must be configured.");
    }
  }

  const publicLaunchReady =
    pilotStage === "public_live" &&
    publicLaunchEnabled &&
    publicLaunchBlockers.length === 0;
  const stageAllowsPublicDistribution =
    (pilotStage === "public_live" && publicLaunchReady) ||
    (pilotStage === "capped_public_beta" &&
      publicBetaEnabled &&
      complianceApproved);
  const autoRepliesEnabled =
    pilotReplyMode === "auto_allowlisted" &&
    !sendsDisabled &&
    complianceApproved &&
    (allowlistRequired || publicLaunchReady) &&
    pilotStage !== "public_candidate";

  return {
    pilotStage,
    pilotReplyMode,
    publicLaunchEnabled,
    publicBetaEnabled,
    publicLaunchReady,
    stageAllowsPublicDistribution,
    stageRequiresAllowlist: stageRequiresAllowlist(pilotStage),
    stageRequiresComplianceApproval:
      stageRequiresComplianceApproval(pilotStage),
    complianceApproved,
    autoRepliesEnabled,
    publicLaunchBlockers,
    supportContactConfigured,
    privacyUrlConfigured,
    termsUrlConfigured,
    dailySendCapConfigured: configured(process.env.SMS_DAILY_SEND_CAP),
    dailyInboundCapConfigured: configured(process.env.SMS_DAILY_INBOUND_CAP),
    maxActiveParticipantsConfigured: configured(
      process.env.PILOT_MAX_ACTIVE_PARTICIPANTS,
    ),
  };
}

export function publicLaunchBlocksOutbound(input?: {
  sendsDisabled?: boolean;
  allowlistRequired?: boolean;
}) {
  const status = getPilotPublicLaunchStatus(input);
  return (
    status.pilotStage === "public_live" &&
    (!status.publicLaunchEnabled || !status.publicLaunchReady)
  );
}
