import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const dataOpsAuditEvents = {
  exportCreated: "data_ops.export_created",
  exportFailed: "data_ops.export_failed",
  participantPaused: "data_ops.participant_paused",
  participantCompleted: "data_ops.participant_completed",
  participantRedacted: "data_ops.participant_redacted",
  messageRedacted: "data_ops.message_redacted",
  feedbackRedacted: "data_ops.feedback_redacted",
  redactionFailed: "data_ops.redaction_failed",
  retentionReviewed: "data_ops.retention_reviewed",
  backupCheckRecorded: "data_ops.backup_check_recorded",
  restoreCheckRecorded: "data_ops.restore_check_recorded",
} as const;

export type DataOpsActionResult = {
  ok: boolean;
  action: string;
  participantId?: string | null;
  projectBriefId?: string | null;
  affectedRecordCounts: Record<string, number>;
  redactionType?: string | null;
  skippedReason?: string | null;
  noRawPiiStoredInAudit?: boolean;
};

export function buildRedactionSummary(input: Partial<DataOpsActionResult>) {
  return {
    ok: Boolean(input.ok),
    action: input.action || "data_ops.unknown",
    participantId: input.participantId || null,
    projectBriefId: input.projectBriefId || null,
    affectedRecordCounts: input.affectedRecordCounts || {},
    redactionType: input.redactionType || null,
    skippedReason: input.skippedReason || null,
    noRawPiiStoredInAudit: true,
  };
}

async function auditResult(result: DataOpsActionResult) {
  await logAudit({
    actorType: "ADMIN",
    action: result.action,
    entityType: result.participantId ? "PilotParticipant" : "DataOps",
    entityId: result.participantId || result.projectBriefId || "data_ops",
    metadata: buildRedactionSummary(result),
  });
}

export async function markPilotParticipantPaused(participantId: string) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.participantPaused,
      participantId,
      skippedReason: "database_not_configured",
    });
  }
  const participant = await getDb().pilotParticipant.update({
    where: { id: participantId },
    data: { status: "PAUSED" },
  });
  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.participantPaused,
    participantId: participant.id,
    affectedRecordCounts: { participants: 1 },
  });
  await auditResult(result);
  return result;
}

export async function markPilotParticipantCompleted(participantId: string) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.participantCompleted,
      participantId,
      skippedReason: "database_not_configured",
    });
  }
  const participant = await getDb().pilotParticipant.update({
    where: { id: participantId },
    data: { status: "COMPLETED" },
  });
  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.participantCompleted,
    participantId: participant.id,
    affectedRecordCounts: { participants: 1 },
  });
  await auditResult(result);
  return result;
}

export async function markPilotParticipantOptedOut(participantId: string) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.participantRedacted,
      participantId,
      redactionType: "opted_out",
      skippedReason: "database_not_configured",
    });
  }
  const participant = await getDb().pilotParticipant.update({
    where: { id: participantId },
    data: { status: "OPTED_OUT" },
  });
  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.participantRedacted,
    participantId: participant.id,
    redactionType: "opted_out",
    affectedRecordCounts: { participants: 1 },
  });
  await auditResult(result);
  return result;
}

export async function redactPilotParticipant(input: {
  participantId: string;
  redactPhone?: boolean;
  redactNotes?: boolean;
  softDelete?: boolean;
}) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.participantRedacted,
      participantId: input.participantId,
      redactionType: "participant_redaction",
      skippedReason: "database_not_configured",
    });
  }

  const participant = await getDb().pilotParticipant.update({
    where: { id: input.participantId },
    data: {
      ...(input.redactPhone
        ? {
            phoneHash: null,
            redactedPhone: "[redacted-phone]",
            email: null,
          }
        : {}),
      ...(input.redactNotes ? { notes: null } : {}),
      ...(input.softDelete ? { status: "REJECTED", name: "[redacted]" } : {}),
    },
  });

  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.participantRedacted,
    participantId: participant.id,
    redactionType: "participant_redaction",
    affectedRecordCounts: { participants: 1 },
  });
  await auditResult(result);
  return result;
}

export async function redactConversationMessageBodies(projectBriefId: string) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.messageRedacted,
      projectBriefId,
      redactionType: "message_body",
      skippedReason: "database_not_configured",
    });
  }
  const updated = await getDb().message.updateMany({
    where: { projectBriefId },
    data: {
      body: "[redacted-message-body]",
    },
  });
  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.messageRedacted,
    projectBriefId,
    redactionType: "message_body",
    affectedRecordCounts: { messages: updated.count },
  });
  await auditResult(result);
  return result;
}

export async function redactPilotFeedbackNotes(feedbackId: string) {
  if (!process.env.DATABASE_URL) {
    return buildRedactionSummary({
      ok: false,
      action: dataOpsAuditEvents.feedbackRedacted,
      redactionType: "feedback_notes",
      affectedRecordCounts: {},
      skippedReason: "database_not_configured",
    });
  }
  await getDb().pilotFeedback.update({
    where: { id: feedbackId },
    data: { notes: "[redacted-feedback-notes]" },
  });
  const result = buildRedactionSummary({
    ok: true,
    action: dataOpsAuditEvents.feedbackRedacted,
    redactionType: "feedback_notes",
    affectedRecordCounts: { feedback: 1 },
  });
  await auditResult(result);
  return result;
}

export async function recordBackupCheck(input: {
  kind: "backup" | "restore" | "retention";
  notes?: string | null;
}) {
  const action =
    input.kind === "restore"
      ? dataOpsAuditEvents.restoreCheckRecorded
      : input.kind === "retention"
        ? dataOpsAuditEvents.retentionReviewed
        : dataOpsAuditEvents.backupCheckRecorded;
  const result = buildRedactionSummary({
    ok: true,
    action,
    affectedRecordCounts: {},
  });
  if (process.env.DATABASE_URL) {
    await logAudit({
      actorType: "ADMIN",
      action,
      entityType: "DataOps",
      entityId: input.kind,
      metadata: {
        ...result,
        hasNotes: Boolean(input.notes),
      },
    });
  }
  return result;
}
