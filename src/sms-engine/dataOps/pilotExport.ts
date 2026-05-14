import type {
  AuditLog,
  LlmReviewItem,
  Message,
  PilotFeedback,
  PilotParticipant,
  ProjectBrief,
} from "@prisma/client";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import {
  redactEmail,
  redactPhone,
  redactSensitiveJson,
  safeExportValue,
} from "@/sms-engine/dataOps/dataClassification";
import { dataOpsAuditEvents } from "@/sms-engine/dataOps/pilotRedaction";

export type PilotExportType =
  | "participant_summary"
  | "conversation_transcript"
  | "project_brief"
  | "audit_summary"
  | "pilot_feedback"
  | "llm_review"
  | "producer_agent_output"
  | "pilot_summary";

export type PilotExportEnvelope<T = unknown> = {
  exportType: PilotExportType;
  generatedAt: string;
  adminOnly: true;
  redactedByDefault: true;
  includesProductionSagaData: false;
  records: T;
};

export function summarizePilotExportForAudit(exportData: PilotExportEnvelope) {
  const records = exportData.records;
  const recordCount = Array.isArray(records)
    ? records.length
    : records && typeof records === "object"
      ? Object.keys(records as Record<string, unknown>).length
      : 0;
  return {
    exportType: exportData.exportType,
    recordCount,
    adminOnly: exportData.adminOnly,
    redactedByDefault: exportData.redactedByDefault,
    includesProductionSagaData: exportData.includesProductionSagaData,
  };
}

export async function recordPilotExportCreated(exportData: PilotExportEnvelope) {
  const metadata = summarizePilotExportForAudit(exportData);
  if (process.env.DATABASE_URL) {
    await logAudit({
      actorType: "ADMIN",
      action: dataOpsAuditEvents.exportCreated,
      entityType: "DataOps",
      entityId: exportData.exportType,
      metadata,
    });
  }
  return metadata;
}

function envelope<T>(exportType: PilotExportType, records: T): PilotExportEnvelope<T> {
  return {
    exportType,
    generatedAt: new Date().toISOString(),
    adminOnly: true,
    redactedByDefault: true,
    includesProductionSagaData: false,
    records,
  };
}

export function participantSummaryExport(
  participants: Array<
    Pick<
      PilotParticipant,
      | "id"
      | "personId"
      | "projectBriefId"
      | "inviteCodeId"
      | "redactedPhone"
      | "name"
      | "email"
      | "role"
      | "cohort"
      | "status"
      | "consentTimestamp"
      | "joinedAt"
      | "lastActiveAt"
      | "createdAt"
      | "updatedAt"
    >
  >,
) {
  return envelope(
    "participant_summary",
    participants.map((participant) => ({
      id: participant.id,
      personId: participant.personId,
      projectBriefId: participant.projectBriefId,
      inviteCodeId: participant.inviteCodeId,
      redactedPhone: participant.redactedPhone
        ? redactPhone(participant.redactedPhone)
        : null,
      name: safeExportValue(participant.name),
      email: redactEmail(participant.email),
      role: participant.role,
      cohort: participant.cohort,
      status: participant.status,
      hasConsent: Boolean(participant.consentTimestamp),
      joinedAt: participant.joinedAt?.toISOString() || null,
      lastActiveAt: participant.lastActiveAt?.toISOString() || null,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString(),
    })),
  );
}

export function participantSummaryCsv(
  exportData: ReturnType<typeof participantSummaryExport>,
) {
  const header = [
    "id",
    "cohort",
    "role",
    "status",
    "redactedPhone",
    "hasConsent",
    "joinedAt",
    "lastActiveAt",
  ];
  const rows = exportData.records.map((participant) =>
    header
      .map((key) => {
        const value = participant[key as keyof typeof participant];
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function conversationTranscriptExport(input: {
  projectBrief?: Pick<ProjectBrief, "id" | "title" | "status" | "createdAt"> | null;
  participant?: Pick<PilotParticipant, "id" | "redactedPhone" | "cohort" | "status"> | null;
  messages: Array<
    Pick<
      Message,
      | "id"
      | "direction"
      | "channel"
      | "projectBriefId"
      | "contactId"
      | "twilioMessageSid"
      | "body"
      | "metadata"
      | "createdAt"
    >
  >;
}) {
  return envelope("conversation_transcript", {
    projectBrief: input.projectBrief
      ? {
          id: input.projectBrief.id,
          title: safeExportValue(input.projectBrief.title),
          status: input.projectBrief.status,
          createdAt: input.projectBrief.createdAt.toISOString(),
        }
      : null,
    participant: input.participant
      ? {
          id: input.participant.id,
          redactedPhone: input.participant.redactedPhone,
          cohort: input.participant.cohort,
          status: input.participant.status,
        }
      : null,
    messages: input.messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      channel: message.channel,
      projectBriefId: message.projectBriefId,
      contactId: message.contactId,
      twilioMessageSid: message.twilioMessageSid,
      body: safeExportValue(message.body),
      metadata: redactSensitiveJson(message.metadata),
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export function projectBriefExport(
  briefs: Array<
    Pick<
      ProjectBrief,
      | "id"
      | "status"
      | "city"
      | "projectType"
      | "title"
      | "description"
      | "targetDate"
      | "budgetRange"
      | "expectedAudienceSize"
      | "scope"
      | "vibe"
      | "helpNeeded"
      | "requiredRoles"
      | "adminNotes"
      | "createdAt"
      | "updatedAt"
    >
  >,
) {
  return envelope(
    "project_brief",
    briefs.map((brief) => ({
      ...brief,
      title: safeExportValue(brief.title),
      description: safeExportValue(brief.description),
      adminNotes: "[admin-only-redacted]",
      createdAt: brief.createdAt.toISOString(),
      updatedAt: brief.updatedAt.toISOString(),
    })),
  );
}

export function pilotFeedbackExport(
  feedback: Array<
    Pick<
      PilotFeedback,
      | "id"
      | "projectBriefId"
      | "personId"
      | "pilotParticipantId"
      | "category"
      | "rating"
      | "notes"
      | "createdAt"
      | "updatedAt"
    >
  >,
) {
  return envelope(
    "pilot_feedback",
    feedback.map((item) => ({
      id: item.id,
      projectBriefId: item.projectBriefId,
      personId: item.personId,
      pilotParticipantId: item.pilotParticipantId,
      category: item.category,
      rating: item.rating,
      notes: safeExportValue(item.notes),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  );
}

export function pilotFeedbackCsv(exportData: ReturnType<typeof pilotFeedbackExport>) {
  const header = ["id", "category", "rating", "projectBriefId", "pilotParticipantId", "createdAt"];
  const rows = exportData.records.map((item) =>
    header
      .map((key) => {
        const value = item[key as keyof typeof item];
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function auditSummaryExport(
  logs: Array<Pick<AuditLog, "id" | "actorType" | "action" | "entityType" | "entityId" | "metadata" | "createdAt">>,
) {
  return envelope(
    "audit_summary",
    logs.map((log) => ({
      id: log.id,
      actorType: log.actorType,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: redactSensitiveJson(log.metadata),
      createdAt: log.createdAt.toISOString(),
    })),
  );
}

export function llmReviewExport(
  items: Array<
    Pick<
      LlmReviewItem,
      | "id"
      | "operation"
      | "flow"
      | "provider"
      | "model"
      | "mode"
      | "validationStatus"
      | "forbiddenClaimsDetected"
      | "fallbackUsed"
      | "fallbackReason"
      | "reviewStatus"
      | "createdAt"
    >
  >,
) {
  return envelope(
    "llm_review",
    items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  );
}

export async function getPilotDataSummaryCounts() {
  if (!process.env.DATABASE_URL) {
    return {
      databaseAvailable: false,
      participants: 0,
      activeParticipants: 0,
      waitlistedParticipants: 0,
      optedOutParticipants: 0,
      projectBriefs: 0,
      messages: 0,
      auditEvents: 0,
      feedbackNotes: 0,
      llmReviewItems: 0,
      outboundDrafts: 0,
      processingJobs: 0,
    };
  }

  const db = getDb();
  const [
    participants,
    activeParticipants,
    waitlistedParticipants,
    optedOutParticipants,
    projectBriefs,
    messages,
    auditEvents,
    feedbackNotes,
    llmReviewItems,
    outboundDrafts,
    processingJobs,
  ] = await Promise.all([
    db.pilotParticipant.count(),
    db.pilotParticipant.count({ where: { status: "ACTIVE" } }),
    db.pilotParticipant.count({ where: { status: "WAITLISTED" } }),
    db.pilotParticipant.count({ where: { status: "OPTED_OUT" } }),
    db.projectBrief.count(),
    db.message.count(),
    db.auditLog.count(),
    db.pilotFeedback.count(),
    db.llmReviewItem.count(),
    db.outboundDraft.count(),
    db.inboundProcessingJob.count(),
  ]);

  return {
    databaseAvailable: true,
    participants,
    activeParticipants,
    waitlistedParticipants,
    optedOutParticipants,
    projectBriefs,
    messages,
    auditEvents,
    feedbackNotes,
    llmReviewItems,
    outboundDrafts,
    processingJobs,
  };
}

export function getPilotDataOpsDocumentStatus() {
  const cwd = process.cwd();
  return {
    retentionPolicyAvailable: existsSync(join(cwd, "docs/pilot-data-retention.md")),
    backupRunbookAvailable: existsSync(
      join(cwd, "docs/pilot-backup-restore-runbook.md"),
    ),
    migrationChecklistAvailable: existsSync(
      join(cwd, "docs/pilot-migration-checklist.md"),
    ),
    incidentRunbookAvailable: existsSync(
      join(cwd, "docs/pilot-data-incident-runbook.md"),
    ),
    dataInventoryAvailable: existsSync(join(cwd, "docs/pilot-data-inventory.md")),
  };
}

export async function getPilotDataOpsHealthSnapshot() {
  const docs = getPilotDataOpsDocumentStatus();
  if (!process.env.DATABASE_URL) {
    const missing = Object.entries(docs)
      .filter(([, available]) => !available)
      .map(([key]) => key);
    return {
      pilotDataOpsAvailable: true,
      dataOpsWarningsCount: missing.length,
      ...docs,
      exportCountRecent: null,
      redactionCountRecent: null,
      participantsPausedCount: null,
      participantsOptedOutCount: null,
      dataOpsWarnings: missing,
      backupChecklistStatus: docs.backupRunbookAvailable ? "documented" : "missing",
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [exportCountRecent, redactionCountRecent, participantsPausedCount, participantsOptedOutCount] =
      await Promise.all([
        getDb().auditLog.count({
          where: {
            action: { in: [dataOpsAuditEvents.exportCreated, dataOpsAuditEvents.exportFailed] },
            createdAt: { gte: since },
          },
        }),
        getDb().auditLog.count({
          where: {
            action: {
              in: [
                dataOpsAuditEvents.participantRedacted,
                dataOpsAuditEvents.messageRedacted,
                dataOpsAuditEvents.feedbackRedacted,
                dataOpsAuditEvents.redactionFailed,
              ],
            },
            createdAt: { gte: since },
          },
        }),
        getDb().pilotParticipant.count({ where: { status: "PAUSED" } }),
        getDb().pilotParticipant.count({ where: { status: "OPTED_OUT" } }),
      ]);
    const missing = Object.entries(docs)
      .filter(([, available]) => !available)
      .map(([key]) => key);
    return {
      pilotDataOpsAvailable: true,
      dataOpsWarningsCount: missing.length,
      ...docs,
      exportCountRecent,
      redactionCountRecent,
      participantsPausedCount,
      participantsOptedOutCount,
      dataOpsWarnings: missing,
      backupChecklistStatus: docs.backupRunbookAvailable ? "documented" : "missing",
    };
  } catch {
    return {
      pilotDataOpsAvailable: true,
      dataOpsWarningsCount: 1,
      ...docs,
      exportCountRecent: null,
      redactionCountRecent: null,
      participantsPausedCount: null,
      participantsOptedOutCount: null,
      dataOpsWarnings: ["data_ops_db_unavailable"],
      backupChecklistStatus: docs.backupRunbookAvailable ? "documented" : "missing",
    };
  }
}

export async function getPilotDataOpsAdminSnapshot() {
  const [counts, health] = await Promise.all([
    getPilotDataSummaryCounts(),
    getPilotDataOpsHealthSnapshot(),
  ]);
  if (!process.env.DATABASE_URL) {
    return {
      counts,
      health,
      participants: [],
      projectBriefs: [],
      feedbackItems: [],
      recentExportsAndRedactions: [],
      safeSummaryExport: envelope("pilot_summary", counts),
      feedbackCsv: "",
      participantCsv: "",
    };
  }

  const [participants, projectBriefs, recentExportsAndRedactions, feedback] =
    await Promise.all([
      getDb().pilotParticipant.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          redactedPhone: true,
          role: true,
          cohort: true,
          status: true,
          joinedAt: true,
          lastActiveAt: true,
          updatedAt: true,
        },
      }),
      getDb().projectBrief.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      getDb().auditLog.findMany({
        where: { action: { startsWith: "data_ops." } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      getDb().pilotFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
  const participantExport = participantSummaryExport(
    participants.map((participant) => ({
      ...participant,
      personId: null,
      projectBriefId: null,
      inviteCodeId: null,
      email: null,
      consentTimestamp: null,
      createdAt: participant.updatedAt,
    })),
  );
  const feedbackExport = pilotFeedbackExport(feedback);

  return {
    counts,
    health,
    participants,
    projectBriefs,
    feedbackItems: feedback.slice(0, 100).map((item) => ({
      id: item.id,
      projectBriefId: item.projectBriefId,
      pilotParticipantId: item.pilotParticipantId,
      category: item.category,
      rating: item.rating,
      notesPreview: safeExportValue(item.notes),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    recentExportsAndRedactions,
    safeSummaryExport: await getPilotSummaryExport(),
    feedbackCsv: pilotFeedbackCsv(feedbackExport),
    participantCsv: participantSummaryCsv(participantExport),
  };
}

export async function getPilotSummaryExport() {
  if (!process.env.DATABASE_URL) return envelope("pilot_summary", await getPilotDataSummaryCounts());
  const [counts, participants, feedback, briefs, llmReviewItems, auditLogs] =
    await Promise.all([
      getPilotDataSummaryCounts(),
      getDb().pilotParticipant.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
      getDb().pilotFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      getDb().projectBrief.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
      getDb().llmReviewItem.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      getDb().auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

  return envelope("pilot_summary", {
    counts,
    participants: participantSummaryExport(participants).records,
    feedback: pilotFeedbackExport(feedback).records,
    projectBriefs: projectBriefExport(briefs).records,
    llmReviewItems: llmReviewExport(llmReviewItems).records,
    auditSummary: auditSummaryExport(auditLogs).records,
  });
}

export async function getTranscriptExportForProject(projectBriefId: string) {
  const [projectBrief, messages] = await Promise.all([
    getDb().projectBrief.findUnique({
      where: { id: projectBriefId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    }),
    getDb().message.findMany({
      where: { projectBriefId },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);

  return conversationTranscriptExport({ projectBrief, messages });
}
