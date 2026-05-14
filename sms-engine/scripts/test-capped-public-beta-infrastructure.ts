import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  evaluateCappedPublicBetaReadiness,
  evaluatePublicBetaAdmission,
} from "@/sms-engine/publicBeta/publicBetaAdmission";
import {
  getCappedPublicBetaConfig,
  getCappedPublicBetaHealthSnapshot,
  publicBetaAuditEvents,
} from "@/sms-engine/publicBeta/publicBetaConfig";
import {
  createPublicBetaWaitlistEntry,
  detectWaitlistDuplicate,
  hashEmailForLookup,
  preparePublicBetaWaitlistData,
  recordPublicBetaConsentEvent,
  safePublicBetaWaitlistSummary,
} from "@/sms-engine/publicBeta/publicBetaWaitlist";
import { assertNoRawPiiOrSecrets } from "@/sms-engine/dataOps/dataClassification";

const originalEnv = { ...process.env };
const rawPhone = "+15551234567";
const rawEmail = "person@example.com";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setBaseEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.MESSAGING_PROVIDER = "TWILIO";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";
  process.env.SMS_ALLOWED_NUMBERS = rawPhone;
  process.env.SMS_COMPLIANCE_APPROVED = "false";
  process.env.PUBLIC_BETA_ENABLED = "false";
  process.env.PUBLIC_BETA_LANDING_ENABLED = "false";
  process.env.PUBLIC_BETA_WAITLIST_ENABLED = "false";
  process.env.PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE = "false";
  process.env.PUBLIC_BETA_REQUIRE_INVITE_CODE = "true";
  process.env.PUBLIC_BETA_REQUIRE_CONSENT = "true";
  process.env.PUBLIC_BETA_SUPPORT_EMAIL = "";
  process.env.PUBLIC_BETA_PRIVACY_URL = "";
  process.env.PUBLIC_BETA_TERMS_URL = "";
  process.env.PUBLIC_LAUNCH_ENABLED = "false";
  process.env.PILOT_STAGE = "internal_test";
  process.env.PILOT_REPLY_MODE = "draft_only";
  process.env.PILOT_SUPPORT_CONTACT = "";
  process.env.PILOT_PRIVACY_URL = "";
  process.env.PILOT_TERMS_URL = "";
  process.env.SMS_ACCESS_MODE = "allowlist_only";
  process.env.PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS = "100";
  process.env.PUBLIC_BETA_NEW_USER_DAILY_CAP = "10";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  Object.assign(process.env, overrides);
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(rawPhone), false);
  assert.equal(serialized.includes(rawEmail), false);
  assert.equal(serialized.includes("sk-test-secret"), false);
  assert.equal(serialized.includes("twilio-secret-token"), false);
  assert.equal(assertNoRawPiiOrSecrets(value), true);
}

function admissionInput(overrides = {}) {
  return {
    waitlistEntry: {
      id: "entry_1",
      status: "PENDING",
      consentCaptured: true,
      desiredUseCase: "ORGANIZER",
      redactedPhone: "+1 555•••4567",
      email: rawEmail,
    },
    pilotStage: "capped_public_beta",
    accessMode: "capped_public_beta",
    activeParticipantCount: 0,
    publicBetaMaxActiveParticipants: 100,
    publicBetaEnabled: true,
    publicBetaRequireConsent: true,
    smsComplianceApproved: true,
    smsSendsDisabled: false,
    supportEmailConfigured: true,
    privacyUrlConfigured: true,
    termsUrlConfigured: true,
    duplicate: false,
    optedOut: false,
    paused: false,
    ...overrides,
  };
}

async function main() {
  try {
    setBaseEnv();
    const defaultConfig = getCappedPublicBetaConfig();
    assert.equal(defaultConfig.publicBetaEnabled, false);
    assert.equal(defaultConfig.publicBetaLandingEnabled, false);
    assert.equal(defaultConfig.publicBetaWaitlistEnabled, false);
    assert.equal(defaultConfig.publicBetaPublicNumberVisible, false);
    assert.equal(defaultConfig.publicBetaRequireInviteCode, true);
    assert.equal(defaultConfig.publicBetaRequireConsent, true);

    const disabledHealth = await getCappedPublicBetaHealthSnapshot();
    assert.equal(disabledHealth.cappedPublicBetaInfrastructureAvailable, true);
    assert.equal(disabledHealth.publicBetaReady, false);
    assert.equal(disabledHealth.publicBetaWaitlistCount, null);

    const disabledCreate = await createPublicBetaWaitlistEntry({
      email: rawEmail,
      phone: rawPhone,
      consentCaptured: true,
    });
    assert.equal(disabledCreate.ok, false);
    assert.equal(disabledCreate.status, "waitlist_disabled");

    const prepared = preparePublicBetaWaitlistData({
      name: "Pilot Person",
      email: rawEmail,
      phone: rawPhone,
      city: "LA",
      desiredUseCase: "creator",
      fandoms: ["anime", "cosplay"],
      consentCaptured: true,
    });
    assert.equal(prepared.desiredUseCase, "CREATOR");
    assert.ok(prepared.emailHash);
    assert.ok(prepared.phoneHash);
    assert.notEqual(prepared.emailHash, rawEmail);
    assert.notEqual(prepared.phoneHash, rawPhone);

    const safeSummary = safePublicBetaWaitlistSummary({
      id: "entry_1",
      email: rawEmail,
      redactedPhone: prepared.redactedPhone,
      name: "Pilot Person",
      desiredUseCase: prepared.desiredUseCase,
      city: "LA",
      fandoms: prepared.fandoms,
      source: "test",
      status: "PENDING",
      inviteCodeId: null,
      consentCaptured: true,
      consentTextVersion: "v1",
      consentCapturedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assertSafe(safeSummary);
    assert.equal(safeSummary.email, "p***@example.com");

    setBaseEnv({
      PUBLIC_BETA_LANDING_ENABLED: "true",
      PUBLIC_BETA_WAITLIST_ENABLED: "true",
    });
    const previewCreate = await createPublicBetaWaitlistEntry({
      email: rawEmail,
      phone: rawPhone,
      city: "LA",
      desiredUseCase: "organizer",
      consentCaptured: true,
    });
    assert.equal(previewCreate.ok, true);
    assert.equal(previewCreate.status, "created_preview");
    assert.equal(previewCreate.persisted, false);
    assertSafe(previewCreate);

    const consentPreview = await recordPublicBetaConsentEvent({
      waitlistEntryId: "entry_1",
      consentType: "PUBLIC_BETA",
      source: "ADMIN",
    });
    assert.equal(consentPreview.persisted, false);
    assertSafe(consentPreview);

    assert.equal(
      detectWaitlistDuplicate({
        existingEmailHash: hashEmailForLookup(rawEmail),
        emailHash: hashEmailForLookup("PERSON@example.com"),
      }),
      true,
    );

    const noConsent = evaluatePublicBetaAdmission(
      admissionInput({
        waitlistEntry: {
          id: "entry_2",
          status: "PENDING",
          consentCaptured: false,
          desiredUseCase: "CREATOR",
        },
      }),
    );
    assert.equal(noConsent.admissionStatus, "BLOCKED_NO_CONSENT");

    const complianceBlocked = evaluatePublicBetaAdmission(
      admissionInput({ smsComplianceApproved: false }),
    );
    assert.equal(complianceBlocked.admissionStatus, "BLOCKED_COMPLIANCE");

    const capBlocked = evaluatePublicBetaAdmission(
      admissionInput({
        activeParticipantCount: 100,
        publicBetaMaxActiveParticipants: 100,
      }),
    );
    assert.equal(capBlocked.admissionStatus, "BLOCKED_CAP_REACHED");

    const duplicateBlocked = evaluatePublicBetaAdmission(
      admissionInput({ duplicate: true }),
    );
    assert.equal(duplicateBlocked.admissionStatus, "BLOCKED_DUPLICATE");

    const pausedBlocked = evaluatePublicBetaAdmission(
      admissionInput({ paused: true }),
    );
    assert.equal(pausedBlocked.admissionStatus, "BLOCKED_PAUSED");

    const optedOutBlocked = evaluatePublicBetaAdmission(
      admissionInput({ optedOut: true }),
    );
    assert.equal(optedOutBlocked.admissionStatus, "BLOCKED_OPTED_OUT");

    const missingSupport = evaluatePublicBetaAdmission(
      admissionInput({ supportEmailConfigured: false }),
    );
    assert.equal(
      missingSupport.admissionStatus,
      "BLOCKED_MISSING_SUPPORT_OR_POLICY",
    );

    const admissible = evaluatePublicBetaAdmission(admissionInput());
    assert.equal(admissible.admissionStatus, "ADMISSIBLE_FOR_REVIEW");
    assert.equal(admissible.admissible, true);
    assertSafe(admissible);

    setBaseEnv();
    const readiness = await evaluateCappedPublicBetaReadiness({
      observabilityRiskLevel: "green",
      launchRiskLevel: "green",
    });
    assert.equal(readiness.publicBetaReady, false);
    assert.ok(readiness.blockers.some((item) => item.includes("PUBLIC_BETA_ENABLED")));
    assert.ok(readiness.blockers.some((item) => item.includes("SMS_COMPLIANCE_APPROVED")));
    assert.ok(readiness.blockers.some((item) => item.includes("SMS_SENDS_DISABLED")));

    setBaseEnv({
      PUBLIC_BETA_ENABLED: "true",
      SMS_COMPLIANCE_APPROVED: "true",
      SMS_SENDS_DISABLED: "false",
      PILOT_STAGE: "capped_public_beta",
      SMS_ACCESS_MODE: "capped_public_beta",
      PUBLIC_BETA_LANDING_ENABLED: "true",
      PUBLIC_BETA_WAITLIST_ENABLED: "true",
      PUBLIC_BETA_SUPPORT_EMAIL: "",
      PUBLIC_BETA_PRIVACY_URL: "",
      PUBLIC_BETA_TERMS_URL: "",
    });
    const policyBlocked = await evaluateCappedPublicBetaReadiness({
      observabilityRiskLevel: "green",
      launchRiskLevel: "green",
    });
    assert.equal(policyBlocked.publicBetaReady, false);
    assert.ok(policyBlocked.blockers.some((item) => item.includes("SUPPORT")));
    assert.ok(policyBlocked.blockers.some((item) => item.includes("PRIVACY")));
    assert.ok(policyBlocked.blockers.some((item) => item.includes("TERMS")));

    assert.equal(
      existsSync("docs/capped-public-beta-infrastructure.md"),
      true,
      "capped public beta infrastructure docs should exist",
    );
    assert.equal(
      existsSync("docs/public-beta-landing-copy.md"),
      true,
      "public beta landing copy docs should exist",
    );
    assert.equal(existsSync("docs/incident-response-runbook.md"), true);
    assert.equal(existsSync("docs/pilot-rollback-runbook.md"), true);

    assert.equal(
      publicBetaAuditEvents.waitlistEntryCreated,
      "public_beta.waitlist_entry_created",
    );
    assert.equal(
      publicBetaAuditEvents.readinessEvaluated,
      "public_beta.readiness_evaluated",
    );
    assert.equal(process.env.PUBLIC_LAUNCH_ENABLED, "false");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    console.log(
      "Capped public beta infrastructure checks passed without SMS, Twilio, public launch, or production data.",
    );
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
