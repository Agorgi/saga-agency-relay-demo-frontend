import { existsSync } from "node:fs";
import path from "node:path";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { getTwilioConfigPresence } from "@/sms-engine/env";
import {
  getPilotPublicLaunchStatus,
  type PilotReplyMode,
  type PilotStage,
} from "@/sms-engine/pilotControls";
import { getSmsSafetyConfig } from "@/sms-engine/smsSafety";
import {
  previewOutboundDraftSendReadiness,
  type SendReadinessStatus,
} from "@/sms-engine/producer/sendReadiness";

export const outboundSelfTestReadinessAuditEvent =
  "pilot.outbound_self_test_readiness_evaluated";

export const outboundSelfTestReadinessStatuses = [
  "READY_FOR_ONE_NUMBER_SELF_TEST",
  "BLOCKED_BY_SENDS_DISABLED",
  "BLOCKED_BY_COMPLIANCE",
  "BLOCKED_BY_ALLOWLIST",
  "BLOCKED_BY_RECIPIENT_COUNT",
  "BLOCKED_BY_PILOT_STAGE",
  "BLOCKED_BY_REPLY_MODE",
  "BLOCKED_BY_TWILIO_CONFIG",
  "BLOCKED_BY_WEBHOOK_VALIDATION",
  "BLOCKED_BY_MISSING_APPROVED_DRAFT",
  "BLOCKED_BY_UNKNOWN",
] as const;

export type OutboundSelfTestReadinessStatus =
  (typeof outboundSelfTestReadinessStatuses)[number];

export type OutboundSelfTestConfigInput = {
  providerMode?: string;
  sendsDisabled?: boolean;
  allowlistRequired?: boolean;
  allowedNumbersCount?: number;
  twilioStagingMode?: boolean;
  webhookValidationEnabled?: boolean;
  twilioConfigured?: boolean;
  smsComplianceApproved?: boolean;
  pilotStage?: PilotStage | string;
  pilotReplyMode?: PilotReplyMode | string;
  publicLaunchEnabled?: boolean;
  publicBetaEnabled?: boolean;
  activeDesignPartnerCount?: number;
  rollbackRunbookExists?: boolean;
  auditLoggingAvailable?: boolean;
  approvedDraftExists?: boolean;
  approvedDraftReadinessStatus?: SendReadinessStatus | string | null;
  approvedDraftRecipientAllowlisted?: boolean | null;
  approvedDraftRecipientOptedOut?: boolean | null;
};

export type OutboundSelfTestReadinessResult = {
  ready: boolean;
  readinessStatus: OutboundSelfTestReadinessStatus;
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
  dryRunOnly: true;
  safetySnapshot: {
    providerMode: string;
    sendsDisabled: boolean;
    allowlistRequired: boolean;
    allowedNumbersCount: number;
    twilioStagingMode: boolean;
    webhookValidationEnabled: boolean;
    smsComplianceApproved: boolean;
    pilotStage: string;
    pilotReplyMode: string;
    publicLaunchEnabled: boolean;
    publicBetaEnabled: boolean;
  };
  recommendedNextStep: string;
  explanationForAudit: string;
};

export type PostA2POneNumberSelfTestReadinessResult =
  OutboundSelfTestReadinessResult & {
    postA2PSelfTestPlanAvailable: boolean;
    postA2PSelfTestChecklistAvailable: boolean;
    oneNumberSelfTestReady: boolean;
    oneNumberSelfTestBlockers: string[];
    expectedNextAction: string;
  };

type Blocker = {
  status: OutboundSelfTestReadinessStatus;
  message: string;
  requiredAction: string;
};

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function blocker(
  status: OutboundSelfTestReadinessStatus,
  message: string,
  requiredAction: string,
): Blocker {
  return { status, message, requiredAction };
}

function runtimeConfig(): Required<OutboundSelfTestConfigInput> {
  const sms = getSmsSafetyConfig();
  const twilio = getTwilioConfigPresence();
  const pilot = getPilotPublicLaunchStatus({
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
  });

  return {
    providerMode: sms.providerMode,
    sendsDisabled: sms.sendsDisabled,
    allowlistRequired: sms.allowlistRequired,
    allowedNumbersCount: sms.allowedNumbersCount,
    twilioStagingMode: booleanEnv(process.env.TWILIO_STAGING_MODE, false),
    webhookValidationEnabled: twilio.webhookValidationEnabled,
    twilioConfigured:
      twilio.accountSidConfigured &&
      twilio.authTokenConfigured &&
      twilio.messagingConfigured,
    smsComplianceApproved: pilot.complianceApproved,
    pilotStage: pilot.pilotStage,
    pilotReplyMode: pilot.pilotReplyMode,
    publicLaunchEnabled: pilot.publicLaunchEnabled,
    publicBetaEnabled: booleanEnv(process.env.PUBLIC_BETA_ENABLED, false),
    activeDesignPartnerCount: 0,
    rollbackRunbookExists: docsExist([
      "docs/pilot-rollback-runbook.md",
      "docs/outbound-sms-self-test-runbook.md",
      "docs/outbound-self-test-checklist.md",
    ]),
    auditLoggingAvailable: Boolean(process.env.DATABASE_URL),
    approvedDraftExists: false,
    approvedDraftReadinessStatus: null,
    approvedDraftRecipientAllowlisted: null,
    approvedDraftRecipientOptedOut: null,
  };
}

function docsExist(relativePaths: string[]) {
  return relativePaths.every((relativePath) =>
    existsSync(path.join(process.cwd(), relativePath)),
  );
}

export function getPostA2POneNumberSelfTestDocumentStatus() {
  return {
    postA2PSelfTestPlanAvailable: docsExist([
      "docs/post-a2p-one-number-self-test-v0.9.md",
    ]),
    postA2PSelfTestChecklistAvailable: docsExist([
      "docs/post-a2p-self-test-checklist.md",
    ]),
  };
}

function mergeConfig(
  input?: OutboundSelfTestConfigInput,
): Required<OutboundSelfTestConfigInput> {
  return {
    ...runtimeConfig(),
    ...input,
  };
}

function readinessPriority(status: OutboundSelfTestReadinessStatus) {
  const priority: Record<OutboundSelfTestReadinessStatus, number> = {
    READY_FOR_ONE_NUMBER_SELF_TEST: 0,
    BLOCKED_BY_SENDS_DISABLED: 1,
    BLOCKED_BY_COMPLIANCE: 2,
    BLOCKED_BY_ALLOWLIST: 3,
    BLOCKED_BY_RECIPIENT_COUNT: 4,
    BLOCKED_BY_PILOT_STAGE: 5,
    BLOCKED_BY_REPLY_MODE: 6,
    BLOCKED_BY_TWILIO_CONFIG: 7,
    BLOCKED_BY_WEBHOOK_VALIDATION: 8,
    BLOCKED_BY_MISSING_APPROVED_DRAFT: 9,
    BLOCKED_BY_UNKNOWN: 10,
  };

  return priority[status];
}

function pickReadinessStatus(
  blockers: Blocker[],
): OutboundSelfTestReadinessStatus {
  if (blockers.length === 0) return "READY_FOR_ONE_NUMBER_SELF_TEST";
  return blockers
    .slice()
    .sort(
      (left, right) =>
        readinessPriority(left.status) - readinessPriority(right.status),
    )[0].status;
}

export function evaluateOutboundSelfTestReadiness(input?: {
  config?: OutboundSelfTestConfigInput;
}): OutboundSelfTestReadinessResult {
  const config = mergeConfig(input?.config);
  const blockers: Blocker[] = [];
  const warnings = [
    "Dry run only: this evaluator never sends SMS and never calls Twilio send APIs.",
  ];

  if (config.providerMode !== "TWILIO") {
    blockers.push(
      blocker(
        "BLOCKED_BY_TWILIO_CONFIG",
        "MESSAGING_PROVIDER must be TWILIO for the outbound self-test readiness check.",
        "Use the dedicated Twilio staging environment for the eventual one-number self-test.",
      ),
    );
  }

  if (!config.twilioConfigured) {
    blockers.push(
      blocker(
        "BLOCKED_BY_TWILIO_CONFIG",
        "Twilio credentials or sender configuration are missing.",
        "Configure Twilio only in the approved Twilio staging environment after compliance approval.",
      ),
    );
  }

  if (!config.twilioStagingMode) {
    blockers.push(
      blocker(
        "BLOCKED_BY_TWILIO_CONFIG",
        "TWILIO_STAGING_MODE must be true for the first outbound self-test.",
        "Set TWILIO_STAGING_MODE=true before any one-number outbound self-test.",
      ),
    );
  }

  if (!config.webhookValidationEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_WEBHOOK_VALIDATION",
        "TWILIO_VALIDATE_WEBHOOKS must be true.",
        "Enable Twilio webhook signature validation before the self-test.",
      ),
    );
  }

  if (!config.smsComplianceApproved) {
    blockers.push(
      blocker(
        "BLOCKED_BY_COMPLIANCE",
        "SMS_COMPLIANCE_APPROVED is false or missing.",
        "Wait for A2P/provider compliance approval before any outbound self-test.",
      ),
    );
  }

  if (config.sendsDisabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_SENDS_DISABLED",
        "SMS_SENDS_DISABLED is true.",
        "Keep sends disabled until the operator explicitly approves the one-number self-test.",
      ),
    );
  }

  if (!config.allowlistRequired) {
    blockers.push(
      blocker(
        "BLOCKED_BY_ALLOWLIST",
        "SMS_REQUIRE_ALLOWLIST must be true.",
        "Require the SMS allowlist for the first outbound self-test.",
      ),
    );
  }

  if (config.allowedNumbersCount !== 1) {
    blockers.push(
      blocker(
        "BLOCKED_BY_RECIPIENT_COUNT",
        "The first outbound self-test requires exactly one allowlisted number.",
        "Set SMS_ALLOWED_NUMBERS to exactly the founder/operator test number.",
      ),
    );
  }

  if (config.pilotStage !== "internal_test") {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PILOT_STAGE must be internal_test for the first outbound self-test.",
        "Keep the self-test isolated from design partners and public stages.",
      ),
    );
  }

  const approvedReplyModes = ["manual_approval", "auto_allowlisted"];
  if (!approvedReplyModes.includes(String(config.pilotReplyMode))) {
    blockers.push(
      blocker(
        "BLOCKED_BY_REPLY_MODE",
        "PILOT_REPLY_MODE must be manual_approval or auto_allowlisted for the first outbound self-test.",
        "Use only the selected approved one-number self-test reply mode.",
      ),
    );
  }

  if (config.publicLaunchEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PUBLIC_LAUNCH_ENABLED must remain false for the one-number self-test.",
        "Disable public launch before any self-test.",
      ),
    );
  }

  if (config.publicBetaEnabled) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "PUBLIC_BETA_ENABLED must remain false for the one-number self-test.",
        "Disable public beta before any one-number outbound self-test.",
      ),
    );
  }

  if (config.activeDesignPartnerCount > 0) {
    blockers.push(
      blocker(
        "BLOCKED_BY_PILOT_STAGE",
        "Design partner participants must not be active during the first self-test.",
        "Pause design partner participants before the one-number self-test.",
      ),
    );
  }

  if (!config.rollbackRunbookExists) {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "Outbound self-test rollback and checklist docs are missing.",
        "Create and review the self-test and rollback runbooks before testing.",
      ),
    );
  }

  if (!config.auditLoggingAvailable) {
    blockers.push(
      blocker(
        "BLOCKED_BY_UNKNOWN",
        "Audit logging is not available.",
        "Run the self-test only in an environment with DATABASE_URL and audit logs.",
      ),
    );
  }

  if (!config.approvedDraftExists) {
    blockers.push(
      blocker(
        "BLOCKED_BY_MISSING_APPROVED_DRAFT",
        "No approved outbound draft is available for the self-test.",
        "Create and approve exactly one controlled test draft before the self-test.",
      ),
    );
  } else if (config.approvedDraftReadinessStatus !== "READY_IN_DRY_RUN") {
    blockers.push(
      blocker(
        "BLOCKED_BY_MISSING_APPROVED_DRAFT",
        "The approved draft does not pass dry-run send readiness.",
        "Resolve draft send-readiness blockers before the one-number self-test.",
      ),
    );
  }

  if (config.approvedDraftRecipientAllowlisted === false) {
    blockers.push(
      blocker(
        "BLOCKED_BY_ALLOWLIST",
        "The approved draft recipient is not allowlisted.",
        "Use only the one explicitly allowlisted founder/operator recipient.",
      ),
    );
  }

  if (config.approvedDraftRecipientOptedOut === true) {
    blockers.push(
      blocker(
        "BLOCKED_BY_MISSING_APPROVED_DRAFT",
        "The approved draft recipient is opted out.",
        "Do not run the self-test until the recipient has explicitly opted back in.",
      ),
    );
  }

  const readinessStatus = pickReadinessStatus(blockers);
  const ready = readinessStatus === "READY_FOR_ONE_NUMBER_SELF_TEST";
  const uniqueBlockers = [...new Set(blockers.map((item) => item.message))];
  const requiredActions = [
    ...new Set(blockers.map((item) => item.requiredAction)),
  ];

  return {
    ready,
    readinessStatus,
    blockers: uniqueBlockers,
    warnings,
    requiredActions,
    dryRunOnly: true,
    safetySnapshot: {
      providerMode: config.providerMode,
      sendsDisabled: config.sendsDisabled,
      allowlistRequired: config.allowlistRequired,
      allowedNumbersCount: config.allowedNumbersCount,
      twilioStagingMode: config.twilioStagingMode,
      webhookValidationEnabled: config.webhookValidationEnabled,
      smsComplianceApproved: config.smsComplianceApproved,
      pilotStage: String(config.pilotStage),
      pilotReplyMode: String(config.pilotReplyMode),
      publicLaunchEnabled: config.publicLaunchEnabled,
      publicBetaEnabled: config.publicBetaEnabled,
    },
    recommendedNextStep: ready
      ? "Seek explicit operator approval for the one-number self-test. This check did not send SMS."
      : requiredActions[0] || "Resolve readiness blockers before any outbound test.",
    explanationForAudit: ready
      ? "One-number outbound self-test is ready in dry-run evaluation only. No SMS was sent."
      : `One-number outbound self-test blocked: ${readinessStatus}. No SMS was sent.`,
  };
}

export function evaluatePostA2POneNumberSelfTestReadiness(input?: {
  config?: OutboundSelfTestConfigInput;
}): PostA2POneNumberSelfTestReadinessResult {
  const base = evaluateOutboundSelfTestReadiness(input);
  const docs = getPostA2POneNumberSelfTestDocumentStatus();
  const docBlockers = [
    ...(!docs.postA2PSelfTestPlanAvailable
      ? ["Post-A2P one-number self-test v0.9 playbook is missing."]
      : []),
    ...(!docs.postA2PSelfTestChecklistAvailable
      ? ["Post-A2P self-test checklist is missing."]
      : []),
  ];
  const docActions = [
    ...(!docs.postA2PSelfTestPlanAvailable
      ? ["Create and review docs/post-a2p-one-number-self-test-v0.9.md."]
      : []),
    ...(!docs.postA2PSelfTestChecklistAvailable
      ? ["Create and review docs/post-a2p-self-test-checklist.md."]
      : []),
  ];
  const blockers = [...new Set([...base.blockers, ...docBlockers])];
  const requiredActions = [...new Set([...base.requiredActions, ...docActions])];
  const ready = base.ready && docBlockers.length === 0;

  return {
    ...base,
    ready,
    blockers,
    requiredActions,
    postA2PSelfTestPlanAvailable: docs.postA2PSelfTestPlanAvailable,
    postA2PSelfTestChecklistAvailable: docs.postA2PSelfTestChecklistAvailable,
    oneNumberSelfTestReady: ready,
    oneNumberSelfTestBlockers: blockers,
    expectedNextAction: ready
      ? "Get explicit operator approval, open a one-number test window, then immediately restore SMS_SENDS_DISABLED=true after verification."
      : requiredActions[0] || "Resolve post-A2P self-test blockers before opening any send window.",
    recommendedNextStep: ready
      ? "Get explicit operator approval for the one-number self-test. This readiness check did not send SMS."
      : requiredActions[0] || "Resolve post-A2P self-test blockers before any outbound test.",
    explanationForAudit: ready
      ? "Post-A2P one-number self-test is ready for an explicitly approved future test window. No SMS was sent."
      : `Post-A2P one-number self-test blocked: ${base.readinessStatus}. No SMS was sent.`,
  };
}

export function safeOutboundSelfTestHealthSummary(
  readiness: OutboundSelfTestReadinessResult,
) {
  return {
    outboundSelfTestReadinessAvailable: true,
    outboundSelfTestReady: readiness.ready,
    outboundSelfTestBlockerCount: readiness.blockers.length,
    outboundSelfTestMode: "dry_run_only",
    outboundSelfTestReadinessStatus: readiness.readinessStatus,
  };
}

export async function getOutboundSelfTestReadinessSnapshot() {
  const config: OutboundSelfTestConfigInput = {
    ...runtimeConfig(),
  };

  if (!process.env.DATABASE_URL) {
    return evaluateOutboundSelfTestReadiness({ config });
  }

  try {
    const db = getDb();
    const [activeDesignPartnerCount, approvedDraft] = await Promise.all([
      db.pilotParticipant.count({
        where: {
          status: "ACTIVE",
          role: { not: "INTERNAL_TEST" },
        },
      }),
      db.outboundDraft.findFirst({
        where: { status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      }),
    ]);

    config.activeDesignPartnerCount = activeDesignPartnerCount;
    config.auditLoggingAvailable = true;

    if (approvedDraft) {
      const draftReadiness = await previewOutboundDraftSendReadiness(
        approvedDraft.id,
      );
      config.approvedDraftExists = true;
      config.approvedDraftReadinessStatus = draftReadiness.readinessStatus;
      config.approvedDraftRecipientAllowlisted =
        draftReadiness.recipientSummary.isAllowlisted;
      config.approvedDraftRecipientOptedOut =
        draftReadiness.recipientSummary.optedOut;
    }
  } catch {
    config.auditLoggingAvailable = false;
  }

  return evaluateOutboundSelfTestReadiness({ config });
}

export async function evaluateOutboundSelfTestReadinessForAdmin() {
  const readiness = await getOutboundSelfTestReadinessSnapshot();

  await logAudit({
    actorType: "ADMIN",
    action: outboundSelfTestReadinessAuditEvent,
    entityType: "PilotReadiness",
    entityId: "outbound-self-test",
    metadata: {
      ready: readiness.ready,
      readinessStatus: readiness.readinessStatus,
      blockersCount: readiness.blockers.length,
      warningsCount: readiness.warnings.length,
      dryRunOnly: true,
      providerMode: readiness.safetySnapshot.providerMode,
      pilotStage: readiness.safetySnapshot.pilotStage,
      pilotReplyMode: readiness.safetySnapshot.pilotReplyMode,
      sendsDisabled: readiness.safetySnapshot.sendsDisabled,
      allowlistRequired: readiness.safetySnapshot.allowlistRequired,
      allowedNumbersCount: readiness.safetySnapshot.allowedNumbersCount,
      noSmsSent: true,
      noTwilioApiCall: true,
      noOutreachCreated: true,
      noGroupChatCreated: true,
    },
  });

  return readiness;
}

export function currentEnvLooksLikeSafeSelfTestDefault() {
  return (
    booleanEnv(process.env.SMS_SENDS_DISABLED, true) &&
    !booleanEnv(process.env.SMS_COMPLIANCE_APPROVED, false)
  );
}
