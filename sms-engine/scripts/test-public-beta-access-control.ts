import assert from "node:assert/strict";
import {
  accessAuditEvents,
  evaluateInboundAccess,
  getAccessModeEffective,
  getPublicBetaAccessHealthSnapshot,
  hashInviteCode,
  nextInviteCodeUsageState,
  shouldContinueInboundConversation,
  type EvaluateInboundAccessInput,
} from "@/sms-engine/access/accessControl";

const originalEnv = { ...process.env };
const phone = "+15551234567";
const otherPhone = "+15557654321";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function baseInput(
  overrides: Partial<EvaluateInboundAccessInput> = {},
): EvaluateInboundAccessInput {
  return {
    normalizedPhone: phone,
    messageBody: "hello",
    pilotStage: "internal_test",
    accessMode: "allowlist_only",
    allowedNumbers: [phone],
    participant: null,
    inviteCode: null,
    optedOut: false,
    activeParticipantCount: 0,
    maxActiveParticipants: 10,
    publicBetaDailyNewUserCap: 10,
    publicBetaEnabled: false,
    publicLaunchEnabled: false,
    smsComplianceApproved: false,
    ...overrides,
  };
}

function activeCode(overrides = {}) {
  return {
    id: "code_1",
    cohort: "private_beta",
    status: "ACTIVE" as const,
    uses: 0,
    maxUses: 2,
    expiresAt: null,
    ...overrides,
  };
}

function assertNoRawPhone(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(phone), false);
  assert.equal(serialized.includes(otherPhone), false);
  assert.equal(/555[-.\s]?123[-.\s]?4567/.test(serialized), false);
}

async function main() {
  try {
    process.env.DATABASE_URL = "";
    process.env.SMS_ACCESS_MODE = "allowlist_only";
    process.env.PILOT_STAGE = "internal_test";
    process.env.PUBLIC_BETA_ENABLED = "false";
    process.env.PUBLIC_LAUNCH_ENABLED = "false";
    process.env.SMS_COMPLIANCE_APPROVED = "false";
    process.env.SMS_ALLOWED_NUMBERS = phone;

    const allowlisted = evaluateInboundAccess(baseInput());
    assert.equal(allowlisted.allowed, true);
    assert.equal(allowlisted.accessStatus, "ALLOWLISTED");

    const unknownAllowlistOnly = evaluateInboundAccess(
      baseInput({ normalizedPhone: otherPhone, allowedNumbers: [] }),
    );
    assert.equal(unknownAllowlistOnly.allowed, false);
    assert.equal(unknownAllowlistOnly.accessStatus, "BLOCKED_NOT_ALLOWLISTED");

    const acceptedInvite = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        accessMode: "invite_code",
        allowedNumbers: [],
        inviteCode: activeCode(),
        smsComplianceApproved: false,
      }),
    );
    assert.equal(acceptedInvite.allowed, true);
    assert.equal(acceptedInvite.accessStatus, "INVITE_CODE_ACCEPTED");
    assert.equal(acceptedInvite.shouldCreateParticipant, true);

    const invalidInvite = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        accessMode: "invite_code",
        allowedNumbers: [],
        inviteCode: null,
      }),
    );
    assert.equal(invalidInvite.allowed, false);
    assert.equal(invalidInvite.accessStatus, "BLOCKED_INVALID_INVITE");

    for (const inviteCode of [
      activeCode({ status: "PAUSED" as const }),
      activeCode({ status: "EXHAUSTED" as const }),
      activeCode({ expiresAt: new Date(Date.now() - 1000) }),
      activeCode({ uses: 2, maxUses: 2 }),
    ]) {
      const result = evaluateInboundAccess(
        baseInput({
          normalizedPhone: otherPhone,
          accessMode: "invite_code",
          allowedNumbers: [],
          inviteCode,
        }),
      );
      assert.equal(result.accessStatus, "BLOCKED_INVALID_INVITE");
    }

    const nextUsage = nextInviteCodeUsageState(activeCode({ uses: 1, maxUses: 2 }));
    assert.equal(nextUsage.uses, 2);
    assert.equal(nextUsage.status, "EXHAUSTED");

    const capBlocked = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        accessMode: "invite_code",
        allowedNumbers: [],
        inviteCode: activeCode(),
        activeParticipantCount: 10,
        maxActiveParticipants: 10,
      }),
    );
    assert.equal(capBlocked.accessStatus, "BLOCKED_CAP_REACHED");
    assert.equal(capBlocked.shouldWaitlist, true);

    const optedOut = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        participant: {
          id: "participant_1",
          status: "OPTED_OUT",
          cohort: "private_beta",
          redactedPhone: "+1 555•••4321",
        },
        allowedNumbers: [],
      }),
    );
    assert.equal(optedOut.accessStatus, "BLOCKED_OPTED_OUT");

    const paused = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        participant: {
          id: "participant_2",
          status: "PAUSED",
          cohort: "private_beta",
          redactedPhone: "+1 555•••4321",
        },
        allowedNumbers: [],
      }),
    );
    assert.equal(paused.accessStatus, "BLOCKED_PAUSED");

    const activeParticipant = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        participant: {
          id: "participant_3",
          status: "ACTIVE",
          cohort: "private_beta",
          redactedPhone: "+1 555•••4321",
        },
        allowedNumbers: [],
      }),
    );
    assert.equal(activeParticipant.allowed, true);
    assert.equal(activeParticipant.accessStatus, "ACTIVE_PARTICIPANT");

    const publicBetaDisabled = evaluateInboundAccess(
      baseInput({
        normalizedPhone: otherPhone,
        pilotStage: "capped_public_beta",
        accessMode: "capped_public_beta",
        allowedNumbers: [],
        publicBetaEnabled: false,
        smsComplianceApproved: true,
      }),
    );
    assert.equal(publicBetaDisabled.accessStatus, "BLOCKED_PUBLIC_CLOSED");

    process.env.PILOT_STAGE = "public_live";
    process.env.PUBLIC_LAUNCH_ENABLED = "false";
    process.env.SMS_ACCESS_MODE = "capped_public_beta";
    const effective = getAccessModeEffective();
    assert.equal(effective.effective, "public_closed");
    assert.ok(effective.warnings.includes("public_beta_disabled"));

    const blockedUnknown = evaluateInboundAccess(
      baseInput({ normalizedPhone: otherPhone, allowedNumbers: [] }),
    );
    assert.equal(shouldContinueInboundConversation(blockedUnknown), false);

    for (const keyword of ["STOP", "START", "HELP"]) {
      const result = evaluateInboundAccess(
        baseInput({
          normalizedPhone: otherPhone,
          allowedNumbers: [],
          messageBody: keyword,
        }),
      );
      assert.equal(result.allowed, true, `${keyword} should bypass normal access blockers`);
    }

    assert.equal(hashInviteCode("abc123"), hashInviteCode(" ABC123 "));
    assert.notEqual(hashInviteCode("abc123"), "abc123");
    assert.equal(accessAuditEvents.inboundEvaluated, "access.inbound_evaluated");
    assert.equal(accessAuditEvents.unknownInboundBlocked, "access.unknown_inbound_blocked");

    const health = await getPublicBetaAccessHealthSnapshot();
    assert.equal(health.publicBetaAccessAvailable, true);
    assert.equal(health.publicAccessEnabled, false);
    assert.equal(health.currentActiveParticipants, null);

    assertNoRawPhone(allowlisted);
    assertNoRawPhone(acceptedInvite);
    assert.equal(acceptedInvite.redactedPhone.includes("•••"), true);

    console.log("Public beta access control checks passed without SMS, Twilio, or production data.");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
