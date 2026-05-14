import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  assertNoRawPiiOrSecrets,
  hashPhoneForLookup,
  redactEmail,
  redactPhone,
  redactSensitiveJson,
  safeExportValue,
} from "@/sms-engine/dataOps/dataClassification";
import {
  auditSummaryExport,
  conversationTranscriptExport,
  getPilotDataOpsAdminSnapshot,
  getPilotDataOpsDocumentStatus,
  getPilotDataOpsHealthSnapshot,
  participantSummaryCsv,
  participantSummaryExport,
  pilotFeedbackCsv,
  pilotFeedbackExport,
  projectBriefExport,
  recordPilotExportCreated,
  summarizePilotExportForAudit,
} from "@/sms-engine/dataOps/pilotExport";
import {
  buildRedactionSummary,
  dataOpsAuditEvents,
  markPilotParticipantCompleted,
  markPilotParticipantPaused,
  redactConversationMessageBodies,
  redactPilotFeedbackNotes,
  redactPilotParticipant,
} from "@/sms-engine/dataOps/pilotRedaction";

const originalEnv = { ...process.env };
const rawPhone = "+15551234567";
const rawEmail = "pilot@example.com";

function restoreEnv() {
  process.env = { ...originalEnv };
}

function assertNoSensitive(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(rawPhone), false, "raw phone leaked");
  assert.equal(serialized.includes("555-123-4567"), false, "formatted phone leaked");
  assert.equal(serialized.includes(rawEmail), false, "raw email leaked");
  assert.equal(serialized.includes("sk-test-secret"), false, "OpenAI key leaked");
  assert.equal(serialized.includes("twilio-secret-token"), false, "Twilio token leaked");
  assert.equal(serialized.includes("postgres://secret"), false, "database URL leaked");
  assert.equal(assertNoRawPiiOrSecrets(value), true);
}

async function main() {
  try {
    process.env.DATABASE_URL = "";
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
    process.env.DATABASE_URL = "";
    process.env.ADMIN_PASSWORD = "admin-secret";

    assert.equal(redactPhone(rawPhone)?.includes("•••"), true);
    assert.equal(redactEmail(rawEmail), "p***@example.com");
    assert.equal(hashPhoneForLookup(rawPhone)?.length, 64);

    const redactedJson = redactSensitiveJson({
      phone: rawPhone,
      email: rawEmail,
      token: "twilio-secret-token",
      notes: "Reach me at 555-123-4567 and pilot@example.com",
      prompt: "raw prompt should be hidden",
    });
    assertNoSensitive(redactedJson);
    assert.match(JSON.stringify(redactedJson), /redacted-secret/);
    assert.match(JSON.stringify(redactedJson), /redacted-by-default/);

    const participants = participantSummaryExport([
      {
        id: "participant_1",
        personId: "person_1",
        projectBriefId: "brief_1",
        inviteCodeId: "invite_1",
        redactedPhone: rawPhone,
        name: "Ada Pilot",
        email: rawEmail,
        role: "ORGANIZER",
        cohort: "design_partner",
        status: "ACTIVE",
        consentTimestamp: new Date("2026-01-01T00:00:00.000Z"),
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        lastActiveAt: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
    assert.equal(participants.exportType, "participant_summary");
    assert.equal(participants.includesProductionSagaData, false);
    assertNoSensitive(participants);
    assert.match(participantSummaryCsv(participants), /participant_1/);

    const transcript = conversationTranscriptExport({
      projectBrief: {
        id: "brief_1",
        title: "Anime picnic",
        status: "INTAKE_IN_PROGRESS",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      participant: {
        id: "participant_1",
        redactedPhone: "+1 555•••4567",
        cohort: "design_partner",
        status: "ACTIVE",
      },
      messages: [
        {
          id: "message_1",
          direction: "INBOUND",
          channel: "SMS",
          projectBriefId: "brief_1",
          contactId: null,
          twilioMessageSid: "SM123",
          body: `Please text ${rawPhone} or ${rawEmail}`,
          metadata: { rawPhone, secretToken: "twilio-secret-token" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    assert.equal(transcript.exportType, "conversation_transcript");
    assertNoSensitive(transcript);

    const feedback = pilotFeedbackExport([
      {
        id: "feedback_1",
        projectBriefId: "brief_1",
        personId: null,
        pilotParticipantId: "participant_1",
        category: "tone",
        rating: 4,
        notes: `Loved it, contact me at ${rawEmail}`,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);
    assertNoSensitive(feedback);
    assert.match(pilotFeedbackCsv(feedback), /feedback_1/);

    const projectBriefs = projectBriefExport([
      {
        id: "brief_1",
        status: "INTAKE_IN_PROGRESS",
        city: "LA",
        projectType: "picnic",
        title: "Anime picnic",
        description: "A relaxed fandom picnic",
        targetDate: null,
        budgetRange: null,
        expectedAudienceSize: null,
        scope: null,
        vibe: null,
        helpNeeded: null,
        requiredRoles: [],
        adminNotes: `Private phone ${rawPhone}`,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    assertNoSensitive(projectBriefs);
    assert.equal(
      JSON.stringify(projectBriefs).includes("Private phone"),
      false,
      "admin notes should not export",
    );

    const auditExport = auditSummaryExport([
      {
        id: "audit_1",
        actorType: "ADMIN",
        action: dataOpsAuditEvents.participantRedacted,
        entityType: "PilotParticipant",
        entityId: "participant_1",
        metadata: { phone: rawPhone, token: "sk-test-secret" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    assertNoSensitive(auditExport);

    const exportSummary = summarizePilotExportForAudit(participants);
    assert.deepEqual(exportSummary, {
      exportType: "participant_summary",
      recordCount: 1,
      adminOnly: true,
      redactedByDefault: true,
      includesProductionSagaData: false,
    });
    const exportAudit = await recordPilotExportCreated(participants);
    assert.equal(exportAudit.exportType, "participant_summary");

    const pauseSkipped = await markPilotParticipantPaused("participant_1");
    const completeSkipped = await markPilotParticipantCompleted("participant_1");
    const participantRedacted = await redactPilotParticipant({
      participantId: "participant_1",
      redactPhone: true,
      redactNotes: true,
      softDelete: true,
    });
    const messagesRedacted = await redactConversationMessageBodies("brief_1");
    const feedbackRedacted = await redactPilotFeedbackNotes("feedback_1");
    for (const result of [
      pauseSkipped,
      completeSkipped,
      participantRedacted,
      messagesRedacted,
      feedbackRedacted,
    ]) {
      assert.equal(result.ok, false);
      assert.equal(result.skippedReason, "database_not_configured");
      assert.equal(JSON.stringify(result).includes("delete"), false);
    }

    const summary = buildRedactionSummary({
      ok: true,
      action: dataOpsAuditEvents.participantRedacted,
      participantId: "participant_1",
      affectedRecordCounts: { participants: 1 },
      redactionType: "participant_redaction",
    });
    assert.equal(summary.noRawPiiStoredInAudit, true);
    assertNoSensitive(summary);

    assert.equal(dataOpsAuditEvents.exportCreated, "data_ops.export_created");
    assert.equal(dataOpsAuditEvents.redactionFailed, "data_ops.redaction_failed");
    assert.equal(dataOpsAuditEvents.backupCheckRecorded, "data_ops.backup_check_recorded");

    const docStatus = getPilotDataOpsDocumentStatus();
    assert.equal(docStatus.dataInventoryAvailable, true);
    assert.equal(docStatus.backupRunbookAvailable, true);
    assert.equal(docStatus.migrationChecklistAvailable, true);
    assert.equal(docStatus.incidentRunbookAvailable, true);
    assert.equal(docStatus.retentionPolicyAvailable, true);
    for (const path of [
      "docs/pilot-data-inventory.md",
      "docs/pilot-backup-restore-runbook.md",
      "docs/pilot-migration-checklist.md",
      "docs/pilot-data-incident-runbook.md",
      "docs/pilot-data-retention.md",
    ]) {
      assert.equal(existsSync(path), true, `${path} should exist`);
    }

    const health = await getPilotDataOpsHealthSnapshot();
    assert.equal(health.pilotDataOpsAvailable, true);
    assert.equal(health.retentionPolicyAvailable, true);
    assert.equal(health.backupRunbookAvailable, true);
    assertNoSensitive(health);

    const adminSnapshot = await getPilotDataOpsAdminSnapshot();
    assert.equal(adminSnapshot.counts.databaseAvailable, false);
    assertNoSensitive(adminSnapshot);

    assertNoSensitive(safeExportValue(`email ${rawEmail}, phone ${rawPhone}`));
    console.log("Pilot data operations checks passed without SMS, Twilio, database, or production Saga data.");
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  restoreEnv();
  process.exit(1);
});
