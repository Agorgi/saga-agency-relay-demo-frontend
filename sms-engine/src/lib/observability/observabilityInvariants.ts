export type ObservabilityRiskLevel = "green" | "yellow" | "red";

export type ObservabilityRiskInput = {
  database?: string | null;
  serializedOutput?: string;
  sms: {
    providerMode?: string | null;
    sendsDisabled: boolean;
    smsComplianceApproved: boolean;
    publicLaunchEnabled: boolean;
    recentOutboundCount: number;
    unexpectedOutboundDetected?: boolean;
    webhookValidationEnabled?: boolean | null;
  };
  llm: {
    activeLiveAllowed: boolean;
    recentCallCount?: number;
    recentFailureCount?: number;
    recentFallbackCount?: number;
    fallbackRate?: number;
  };
  pipeline: {
    failedJobs?: number | null;
  };
  pilot: {
    pilotStage?: string | null;
    activeParticipants?: number;
  };
};

export type ObservabilityRiskResult = {
  level: ObservabilityRiskLevel;
  blockers: string[];
  warnings: string[];
  recommendedActions: string[];
};

const RAW_PHONE_PATTERN =
  /(?:whatsapp:)?(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;

const SECRET_VALUE_KEYS = [
  "OPENAI_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "INTERNAL_API_KEY",
  "ADMIN_PASSWORD",
  "DATABASE_URL",
];

function outputContainsKnownSecret(serializedOutput: string) {
  return SECRET_VALUE_KEYS.some((key) => {
    const value = process.env[key];
    return Boolean(value && value.length >= 4 && serializedOutput.includes(value));
  });
}

export function serializedObservabilityContainsSensitiveValue(
  serializedOutput: string,
) {
  return (
    RAW_PHONE_PATTERN.test(serializedOutput) ||
    outputContainsKnownSecret(serializedOutput)
  );
}

function addUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

export function evaluateObservabilityRisk(
  input: ObservabilityRiskInput,
): ObservabilityRiskResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const recommendedActions: string[] = [];
  const providerMode = (input.sms.providerMode || "").toUpperCase();
  const failedJobs = input.pipeline.failedJobs ?? 0;
  const recentCallCount = input.llm.recentCallCount ?? 0;
  const recentFailureCount = input.llm.recentFailureCount ?? 0;
  const fallbackRate =
    input.llm.fallbackRate ??
    (recentCallCount > 0
      ? (input.llm.recentFallbackCount ?? 0) / recentCallCount
      : 0);
  const failureRate =
    recentCallCount > 0 ? recentFailureCount / recentCallCount : 0;

  if (input.database && !["connected", "not_configured"].includes(input.database)) {
    addUnique(blockers, "database_health_not_connected");
    addUnique(recommendedActions, "Check Railway Postgres connectivity and recent deploy logs.");
  }

  if (!input.sms.sendsDisabled && !input.sms.smsComplianceApproved) {
    addUnique(blockers, "sends_enabled_without_sms_compliance");
    addUnique(recommendedActions, "Set SMS_SENDS_DISABLED=true until A2P/compliance approval is confirmed.");
  }

  if (input.sms.publicLaunchEnabled && input.pilot.pilotStage !== "public_live") {
    addUnique(blockers, "public_launch_enabled_outside_public_live_stage");
    addUnique(recommendedActions, "Set PUBLIC_LAUNCH_ENABLED=false unless the approved stage is public_live.");
  }

  if (providerMode === "TWILIO" && input.sms.webhookValidationEnabled === false) {
    addUnique(blockers, "twilio_webhook_validation_disabled");
    addUnique(recommendedActions, "Restore TWILIO_VALIDATE_WEBHOOKS=true before accepting Twilio traffic.");
  }

  if (
    input.sms.unexpectedOutboundDetected ||
    (input.sms.sendsDisabled && input.sms.recentOutboundCount > 0)
  ) {
    addUnique(blockers, "outbound_activity_detected_while_sends_disabled");
    addUnique(recommendedActions, "Review Twilio logs, Message rows, and message.send_blocked audit events.");
  }

  if (input.llm.activeLiveAllowed && input.sms.sendsDisabled) {
    addUnique(blockers, "llm_active_live_allowed_while_sends_disabled");
    addUnique(recommendedActions, "Keep active_live disabled until the explicit live reply rollout.");
  }

  if (
    input.serializedOutput &&
    serializedObservabilityContainsSensitiveValue(input.serializedOutput)
  ) {
    addUnique(blockers, "sensitive_value_detected_in_observability_output");
    addUnique(recommendedActions, "Inspect the observability serializer and redact raw phones or secrets.");
  }

  if (failedJobs >= 5) {
    addUnique(blockers, "pipeline_failed_job_threshold_exceeded");
    addUnique(recommendedActions, "Open /admin/pipeline, inspect failures, and retry or mark skipped safely.");
  } else if (failedJobs > 0) {
    addUnique(warnings, "pipeline_failed_jobs_present");
    addUnique(recommendedActions, "Review failed inbound jobs before pilot traffic increases.");
  }

  if (recentCallCount >= 5 && failureRate >= 0.5) {
    addUnique(blockers, "llm_failure_rate_high");
    addUnique(recommendedActions, "Review llm.call_failed categories and keep fallback active.");
  } else if (recentCallCount > 0 && fallbackRate >= 0.5) {
    addUnique(warnings, "llm_fallback_rate_high");
    addUnique(recommendedActions, "Review LLM fallback reasons in /admin/llm-review and /admin/audit.");
  }

  if (!input.sms.smsComplianceApproved) {
    addUnique(warnings, "sms_compliance_not_approved");
    addUnique(recommendedActions, "Keep outbound SMS disabled until A2P/compliance approval is complete.");
  }

  if ((input.pilot.activeParticipants ?? 0) > 0 && input.sms.sendsDisabled) {
    addUnique(warnings, "active_pilot_participants_while_sends_disabled");
    addUnique(recommendedActions, "Confirm participants are mock/internal only while sends remain disabled.");
  }

  const level: ObservabilityRiskLevel =
    blockers.length > 0 ? "red" : warnings.length > 0 ? "yellow" : "green";

  return {
    level,
    blockers,
    warnings,
    recommendedActions,
  };
}
