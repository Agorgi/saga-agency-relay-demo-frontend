import { getDb } from "@/lib/db";
import { getPilotPublicLaunchStatus } from "@/lib/pilotControls";

export const publicBetaAuditEvents = {
  waitlistEntryCreated: "public_beta.waitlist_entry_created",
  waitlistEntryUpdated: "public_beta.waitlist_entry_updated",
  consentRecorded: "public_beta.consent_recorded",
  admissionEvaluated: "public_beta.admission_evaluated",
  entryInvited: "public_beta.entry_invited",
  entryAdmitted: "public_beta.entry_admitted",
  entryRejected: "public_beta.entry_rejected",
  entryPaused: "public_beta.entry_paused",
  capReached: "public_beta.cap_reached",
  readinessEvaluated: "public_beta.readiness_evaluated",
} as const;

export const PUBLIC_BETA_CONSENT_TEXT_VERSION = "public_beta_sms_v0.1";
export const PUBLIC_BETA_CONSENT_TEXT =
  "By joining the Saga SMS beta, you agree that Saga may message you about your creative project ideas, creator profile, pilot feedback, and production coordination. Message and data rates may apply. Reply STOP to opt out.";

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function positiveIntEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function configured(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function getCappedPublicBetaConfig() {
  const publicLaunch = getPilotPublicLaunchStatus();
  const supportEmail =
    process.env.PUBLIC_BETA_SUPPORT_EMAIL || process.env.PILOT_SUPPORT_CONTACT || "";
  const privacyUrl =
    process.env.PUBLIC_BETA_PRIVACY_URL || process.env.PILOT_PRIVACY_URL || "";
  const termsUrl =
    process.env.PUBLIC_BETA_TERMS_URL || process.env.PILOT_TERMS_URL || "";

  return {
    cappedPublicBetaInfrastructureAvailable: true,
    publicBetaEnabled: booleanEnv(process.env.PUBLIC_BETA_ENABLED),
    publicBetaLandingEnabled: booleanEnv(process.env.PUBLIC_BETA_LANDING_ENABLED),
    publicBetaWaitlistEnabled: booleanEnv(process.env.PUBLIC_BETA_WAITLIST_ENABLED),
    publicBetaPublicNumberVisible: booleanEnv(
      process.env.PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE,
    ),
    publicBetaMaxActiveParticipants: positiveIntEnv(
      process.env.PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS,
      100,
    ),
    publicBetaNewUserDailyCap: positiveIntEnv(
      process.env.PUBLIC_BETA_NEW_USER_DAILY_CAP,
      10,
    ),
    publicBetaRequireInviteCode: booleanEnv(
      process.env.PUBLIC_BETA_REQUIRE_INVITE_CODE,
      true,
    ),
    publicBetaRequireConsent: booleanEnv(
      process.env.PUBLIC_BETA_REQUIRE_CONSENT,
      true,
    ),
    supportEmailConfigured: configured(supportEmail),
    privacyUrlConfigured: configured(privacyUrl),
    termsUrlConfigured: configured(termsUrl),
    supportEmailRedacted: supportEmail ? "[configured]" : null,
    privacyUrlConfiguredValue: privacyUrl ? "[configured]" : null,
    termsUrlConfiguredValue: termsUrl ? "[configured]" : null,
    smsComplianceApproved: publicLaunch.complianceApproved,
    smsSendsDisabled: booleanEnv(process.env.SMS_SENDS_DISABLED, true),
    publicLaunchEnabled: publicLaunch.publicLaunchEnabled,
    pilotStage: publicLaunch.pilotStage,
    pilotReplyMode: publicLaunch.pilotReplyMode,
  };
}

export async function getCappedPublicBetaHealthSnapshot(input?: {
  publicBetaReady?: boolean;
  publicBetaBlockerCount?: number;
}) {
  const config = getCappedPublicBetaConfig();
  let waitlistCount: number | null = null;
  let admittedCount: number | null = null;

  if (process.env.DATABASE_URL) {
    try {
      [waitlistCount, admittedCount] = await Promise.all([
        getDb().publicBetaWaitlistEntry.count(),
        getDb().publicBetaWaitlistEntry.count({ where: { status: "ADMITTED" } }),
      ]);
    } catch {
      waitlistCount = null;
      admittedCount = null;
    }
  }

  return {
    cappedPublicBetaInfrastructureAvailable:
      config.cappedPublicBetaInfrastructureAvailable,
    publicBetaEnabled: config.publicBetaEnabled,
    publicBetaLandingEnabled: config.publicBetaLandingEnabled,
    publicBetaWaitlistEnabled: config.publicBetaWaitlistEnabled,
    publicBetaPublicNumberVisible: config.publicBetaPublicNumberVisible,
    publicBetaMaxActiveParticipants: config.publicBetaMaxActiveParticipants,
    publicBetaNewUserDailyCap: config.publicBetaNewUserDailyCap,
    publicBetaReady: input?.publicBetaReady ?? false,
    publicBetaBlockerCount: input?.publicBetaBlockerCount ?? 0,
    publicBetaWaitlistCount: waitlistCount,
    publicBetaAdmittedCount: admittedCount,
  };
}
