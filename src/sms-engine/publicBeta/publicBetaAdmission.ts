import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPublicBetaAccessConfig } from "@/sms-engine/access/accessControl";
import { getPilotDataOpsHealthSnapshot } from "@/sms-engine/dataOps/pilotExport";
import { getLaunchDrillHealthSnapshot } from "@/sms-engine/launchDrill/launchReadinessDrill";
import { getCappedPublicBetaConfig } from "@/sms-engine/publicBeta/publicBetaConfig";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";

export type PublicBetaAdmissionStatus =
  | "ADMISSIBLE_FOR_REVIEW"
  | "BLOCKED_PUBLIC_BETA_DISABLED"
  | "BLOCKED_NO_CONSENT"
  | "BLOCKED_COMPLIANCE"
  | "BLOCKED_CAP_REACHED"
  | "BLOCKED_DUPLICATE"
  | "BLOCKED_PAUSED"
  | "BLOCKED_OPTED_OUT"
  | "BLOCKED_MISSING_SUPPORT_OR_POLICY"
  | "WAITLIST_ONLY";

export type PublicBetaAdmissionInput = {
  waitlistEntry: {
    id?: string | null;
    status?: string | null;
    consentCaptured?: boolean | null;
    desiredUseCase?: string | null;
    redactedPhone?: string | null;
    email?: string | null;
  };
  pilotStage?: string;
  accessMode?: string;
  activeParticipantCount: number;
  publicBetaMaxActiveParticipants: number;
  publicBetaEnabled: boolean;
  publicBetaRequireConsent: boolean;
  smsComplianceApproved: boolean;
  smsSendsDisabled: boolean;
  supportEmailConfigured: boolean;
  privacyUrlConfigured: boolean;
  termsUrlConfigured: boolean;
  duplicate?: boolean;
  optedOut?: boolean;
  paused?: boolean;
};

export type PublicBetaAdmissionDecision = {
  admissible: boolean;
  admissionStatus: PublicBetaAdmissionStatus;
  blockers: string[];
  warnings: string[];
  recommendedAction: string;
  redactedSummary: {
    waitlistEntryId?: string | null;
    status?: string | null;
    desiredUseCase?: string | null;
    hasPhone: boolean;
    hasEmail: boolean;
    consentCaptured: boolean;
  };
};

export type CappedPublicBetaReadiness = {
  publicBetaReady: boolean;
  publicBetaStage: "disabled" | "waitlist_preview" | "ready_for_review" | "blocked";
  blockers: string[];
  warnings: string[];
  recommendedNextAction: string;
};

function docExists(relativePath: string) {
  return existsSync(join(process.cwd(), relativePath));
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function baseDecision(
  input: PublicBetaAdmissionInput,
  admissionStatus: PublicBetaAdmissionStatus,
  overrides: Partial<PublicBetaAdmissionDecision> = {},
): PublicBetaAdmissionDecision {
  const admissible = overrides.admissible ?? admissionStatus === "ADMISSIBLE_FOR_REVIEW";
  const blockers =
    overrides.blockers ??
    (admissible || admissionStatus === "WAITLIST_ONLY"
      ? []
      : [admissionStatus.toLowerCase()]);

  return {
    admissible,
    admissionStatus,
    blockers,
    warnings: overrides.warnings ?? [],
    recommendedAction:
      overrides.recommendedAction ??
      (admissible
        ? "Review entry manually before admitting a participant."
        : "Keep entry on the waitlist until blockers are resolved."),
    redactedSummary: {
      waitlistEntryId: input.waitlistEntry.id ?? null,
      status: input.waitlistEntry.status ?? null,
      desiredUseCase: input.waitlistEntry.desiredUseCase ?? null,
      hasPhone: Boolean(input.waitlistEntry.redactedPhone),
      hasEmail: Boolean(input.waitlistEntry.email),
      consentCaptured: Boolean(input.waitlistEntry.consentCaptured),
    },
    ...overrides,
  };
}

export function evaluatePublicBetaAdmission(
  input: PublicBetaAdmissionInput,
): PublicBetaAdmissionDecision {
  const status = input.waitlistEntry.status;

  if (input.optedOut || status === "OPTED_OUT") {
    return baseDecision(input, "BLOCKED_OPTED_OUT", {
      recommendedAction: "Keep participant opted out and do not message.",
    });
  }

  if (input.paused || status === "PAUSED") {
    return baseDecision(input, "BLOCKED_PAUSED", {
      recommendedAction: "Resume manually only after operator review.",
    });
  }

  if (input.duplicate || status === "DUPLICATE") {
    return baseDecision(input, "BLOCKED_DUPLICATE", {
      recommendedAction: "Merge or ignore duplicate entry before admission.",
    });
  }

  if (!input.publicBetaEnabled) {
    return baseDecision(input, "BLOCKED_PUBLIC_BETA_DISABLED", {
      recommendedAction:
        "Leave the entry waitlisted. PUBLIC_BETA_ENABLED must remain false until explicit approval.",
    });
  }

  if (!input.smsComplianceApproved || input.smsSendsDisabled) {
    return baseDecision(input, "BLOCKED_COMPLIANCE", {
      blockers: unique([
        !input.smsComplianceApproved ? "sms_compliance_not_approved" : "",
        input.smsSendsDisabled ? "sms_sends_disabled" : "",
      ]),
      recommendedAction:
        "Wait for A2P/compliance approval and a controlled send-readiness process.",
    });
  }

  if (
    !input.supportEmailConfigured ||
    !input.privacyUrlConfigured ||
    !input.termsUrlConfigured
  ) {
    return baseDecision(input, "BLOCKED_MISSING_SUPPORT_OR_POLICY", {
      blockers: unique([
        !input.supportEmailConfigured ? "public_beta_support_email_missing" : "",
        !input.privacyUrlConfigured ? "public_beta_privacy_url_missing" : "",
        !input.termsUrlConfigured ? "public_beta_terms_url_missing" : "",
      ]),
      recommendedAction:
        "Configure public beta support, privacy, and terms links before admission.",
    });
  }

  if (input.publicBetaRequireConsent && !input.waitlistEntry.consentCaptured) {
    return baseDecision(input, "BLOCKED_NO_CONSENT", {
      recommendedAction: "Capture auditable public-beta consent before admission.",
    });
  }

  if (input.activeParticipantCount >= input.publicBetaMaxActiveParticipants) {
    return baseDecision(input, "BLOCKED_CAP_REACHED", {
      recommendedAction: "Keep entry waitlisted or increase cap through an approved launch review.",
    });
  }

  if (input.pilotStage !== "capped_public_beta") {
    return baseDecision(input, "WAITLIST_ONLY", {
      admissible: false,
      warnings: ["pilot_stage_not_capped_public_beta"],
      recommendedAction:
        "Entry can remain on the waitlist; staged admission waits for capped_public_beta.",
    });
  }

  return baseDecision(input, "ADMISSIBLE_FOR_REVIEW", {
    warnings:
      input.accessMode !== "capped_public_beta"
        ? ["sms_access_mode_not_capped_public_beta"]
        : [],
  });
}

export async function evaluateCappedPublicBetaReadiness(input?: {
  observabilityRiskLevel?: "green" | "yellow" | "red";
  launchRiskLevel?: "green" | "yellow" | "red";
}): Promise<CappedPublicBetaReadiness> {
  const config = getCappedPublicBetaConfig();
  const sms = getSmsSafetyHealth();
  const access = getPublicBetaAccessConfig();
  const [launch, dataOps] = await Promise.all([
    getLaunchDrillHealthSnapshot(),
    getPilotDataOpsHealthSnapshot(),
  ]);

  const launchRisk = input?.launchRiskLevel || launch.launchRiskLevel;
  const observabilityRisk = input?.observabilityRiskLevel;
  const blockers = unique([
    !config.publicBetaEnabled ? "PUBLIC_BETA_ENABLED is false." : "",
    !config.smsComplianceApproved ? "SMS_COMPLIANCE_APPROVED is false." : "",
    config.smsSendsDisabled ? "SMS_SENDS_DISABLED is true." : "",
    !sms.allowlistRequired ? "SMS_REQUIRE_ALLOWLIST must remain true for capped beta." : "",
    config.pilotStage !== "capped_public_beta"
      ? "PILOT_STAGE is not capped_public_beta."
      : "",
    access.accessModeEffective !== "capped_public_beta"
      ? "SMS_ACCESS_MODE is not effectively capped_public_beta."
      : "",
    !config.publicBetaLandingEnabled
      ? "PUBLIC_BETA_LANDING_ENABLED is false."
      : "",
    !config.publicBetaWaitlistEnabled
      ? "PUBLIC_BETA_WAITLIST_ENABLED is false."
      : "",
    !config.supportEmailConfigured ? "PUBLIC_BETA_SUPPORT_EMAIL is missing." : "",
    !config.privacyUrlConfigured ? "PUBLIC_BETA_PRIVACY_URL is missing." : "",
    !config.termsUrlConfigured ? "PUBLIC_BETA_TERMS_URL is missing." : "",
    launchRisk === "red" ? "Launch drill risk is red." : "",
    observabilityRisk === "red" ? "Observability risk is red." : "",
    !dataOps.pilotDataOpsAvailable ? "Pilot data ops are unavailable." : "",
    !docExists("docs/incident-response-runbook.md")
      ? "Incident response runbook is missing."
      : "",
    !docExists("docs/pilot-rollback-runbook.md")
      ? "Pilot rollback runbook is missing."
      : "",
    !docExists("docs/pilot-data-incident-runbook.md")
      ? "Pilot data incident runbook is missing."
      : "",
    !docExists("docs/public-launch-foundations.md")
      ? "Public launch foundations doc is missing."
      : "",
    !docExists("docs/abuse-and-rate-limit-readiness.md")
      ? "Abuse/rate-limit readiness doc is missing."
      : "",
  ]);

  const warnings = unique([
    config.publicBetaPublicNumberVisible
      ? "Public beta number visibility is enabled; confirm this was explicitly approved."
      : "Public beta number is hidden.",
    !config.publicBetaRequireInviteCode
      ? "Public beta invite-code requirement is disabled."
      : "",
    !config.publicBetaRequireConsent
      ? "Public beta consent requirement is disabled."
      : "",
    launchRisk === "yellow" ? "Launch drill risk is yellow." : "",
    observabilityRisk === "yellow" ? "Observability risk is yellow." : "",
    config.publicLaunchEnabled
      ? "PUBLIC_LAUNCH_ENABLED is true; public launch should stay disabled."
      : "",
  ]);

  const publicBetaReady = blockers.length === 0;
  const publicBetaStage = !config.publicBetaEnabled
    ? "disabled"
    : publicBetaReady
      ? "ready_for_review"
      : config.publicBetaWaitlistEnabled
        ? "waitlist_preview"
        : "blocked";

  return {
    publicBetaReady,
    publicBetaStage,
    blockers,
    warnings,
    recommendedNextAction: publicBetaReady
      ? "Review public beta readiness with an operator before changing any live gates."
      : "Keep capped public beta disabled and resolve blockers through the launch drill.",
  };
}
