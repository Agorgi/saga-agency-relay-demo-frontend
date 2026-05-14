import type {
  ContactabilityReviewStatus,
  PublicWebResearchResultStatus,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import {
  evaluateContactabilityEvidence,
  extractContactabilityEvidenceFromCandidate,
} from "@/sms-engine/sourcing/contactabilityEvidence";
import { detectPublicWebDuplicate } from "@/sms-engine/sourcing/publicWebDeduplication";
import { evaluatePublicWebResearchSafety } from "@/sms-engine/sourcing/publicWebResearchSafety";
import { scorePublicWebSourceQuality } from "@/sms-engine/sourcing/sourceQuality";
import {
  contactabilityAuditEvents,
  publicResearchCandidateCardSchema,
  publicWebReviewAuditEvents,
  type PublicResearchCandidateCard,
} from "@/sms-engine/sourcing/talentTypes";

export type PublicWebReviewAction =
  | "SEND_TO_QUALITY_REVIEW"
  | "NEEDS_MORE_RESEARCH"
  | "NEEDS_MORE_CONTACT_RESEARCH"
  | "DISCARD"
  | "REJECT"
  | "LINK_TO_INTERNAL_PROFILE"
  | "MARK_DUPLICATE"
  | "MARK_DO_NOT_CONTACT"
  | "ARCHIVE";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function resultToCandidateCard(result: {
  displayName: string;
  role: string;
  city: string | null;
  publicProfileUrls: unknown;
  sourceUrls: unknown;
  sourceTitles: unknown;
  evidence: unknown;
  candidateCard: unknown;
  riskFlags: unknown;
  missingEvidence: unknown;
  confidence: number;
}): PublicResearchCandidateCard {
  const parsed = publicResearchCandidateCardSchema.safeParse(result.candidateCard);
  if (parsed.success) return parsed.data;
  const evidence =
    result.evidence && typeof result.evidence === "object" && !Array.isArray(result.evidence)
      ? (result.evidence as Record<string, unknown>)
      : {};
  return publicResearchCandidateCardSchema.parse({
    displayName: result.displayName,
    likelyRole: result.role,
    city: result.city,
    region: null,
    publicProfileUrls: stringArray(result.publicProfileUrls),
    sourceUrls: stringArray(result.sourceUrls),
    sourceTitles: stringArray(result.sourceTitles),
    roleFitEvidence: stringArray(evidence.roleFitEvidence),
    fandomFitEvidence: stringArray(evidence.fandomFitEvidence),
    locationEvidence: stringArray(evidence.locationEvidence),
    portfolioEvidence: stringArray(evidence.portfolioEvidence),
    recentActivityEvidence: stringArray(evidence.recentActivityEvidence),
    whyTheyMayFit: stringArray(evidence.whyTheyMayFit),
    missingEvidence: stringArray(result.missingEvidence),
    riskFlags: stringArray(result.riskFlags),
    confidence: result.confidence,
    requiresHumanReview: true,
    availabilityKnown: false,
    willingnessKnown: false,
    ratesKnown: false,
    sensitiveDataDetected: false,
    privateSourceDetected: false,
  });
}

export async function evaluatePublicWebResearchResultForReview(input: {
  result: Parameters<typeof resultToCandidateCard>[0] & { id?: string };
}) {
  const candidate = resultToCandidateCard(input.result);
  const safety = evaluatePublicWebResearchSafety({ candidate });
  const sourceQuality = scorePublicWebSourceQuality({ candidate });
  const duplicate = await detectPublicWebDuplicate({
    resultId: input.result.id,
    displayName: candidate.displayName,
    city: candidate.city,
    role: candidate.likelyRole,
    profileUrls: candidate.publicProfileUrls,
    sourceUrls: candidate.sourceUrls,
  });
  const contactability = extractContactabilityEvidenceFromCandidate(candidate).map(
    (evidence) => ({
      evidence,
      review: evaluateContactabilityEvidence(evidence),
    }),
  );
  const recommendedAction =
    safety.safe &&
    sourceQuality.recommendedAction === "SEND_TO_QUALITY_REVIEW" &&
    duplicate.duplicateStatus !== "LIKELY_DUPLICATE"
      ? "SEND_TO_QUALITY_REVIEW"
      : duplicate.duplicateStatus !== "NO_DUPLICATE"
        ? duplicate.recommendedAction
        : contactability.some(
              (item) =>
                item.review.band === "NEEDS_MORE_CONTACT_RESEARCH" ||
                item.review.band === "CONTACT_METHOD_BLOCKED",
            )
          ? "NEEDS_MORE_CONTACT_RESEARCH"
        : sourceQuality.recommendedAction;

  return {
    candidate,
    safety,
    sourceQuality,
    duplicate,
    contactability,
    recommendedAction,
    organizerSafeSummary: candidate.whyTheyMayFit.join(" ").replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[redacted-email]",
    ),
  };
}

export function canPromotePublicWebResult(input: {
  status: string;
  sourceQualityBand?: string | null;
  duplicateStatus?: string | null;
  safetyBlockers?: string[];
  qualityReviewPassed?: boolean;
  contactabilityReviewed?: boolean;
  adminAction?: boolean;
  doNotContact?: boolean;
  optedOut?: boolean;
}) {
  const blockers = [
    input.status !== "APPROVED_FOR_INTERNAL_REVIEW"
      ? "public_web_result_not_approved_for_internal_review"
      : null,
    !input.adminAction ? "admin_action_required" : null,
    input.sourceQualityBand === "INSUFFICIENT_SOURCE" ||
    input.sourceQualityBand === "BLOCKED_SOURCE"
      ? "source_quality_blocked"
      : null,
    input.duplicateStatus === "DUPLICATE" ||
    input.duplicateStatus === "LIKELY_DUPLICATE"
      ? "duplicate_review_required"
      : null,
    (input.safetyBlockers || []).length > 0 ? "safety_blockers_present" : null,
    !input.qualityReviewPassed ? "quality_review_required" : null,
    !input.contactabilityReviewed ? "contactability_review_required" : null,
    input.doNotContact ? "do_not_contact" : null,
    input.optedOut ? "opted_out" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    allowed: blockers.length === 0,
    blockers,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
  };
}

function statusForAction(action: PublicWebReviewAction): PublicWebResearchResultStatus {
  if (action === "SEND_TO_QUALITY_REVIEW") return "IN_QUALITY_REVIEW";
  if (action === "NEEDS_MORE_RESEARCH") return "NEEDS_REVIEW";
  if (action === "NEEDS_MORE_CONTACT_RESEARCH") return "NEEDS_REVIEW";
  if (action === "DISCARD") return "DISCARDED";
  if (action === "REJECT") return "REJECTED";
  if (action === "LINK_TO_INTERNAL_PROFILE") return "DUPLICATE";
  if (action === "MARK_DUPLICATE") return "DUPLICATE";
  if (action === "MARK_DO_NOT_CONTACT") return "DO_NOT_CONTACT";
  return "ARCHIVED";
}

function actionAuditEvent(action: PublicWebReviewAction) {
  if (action === "SEND_TO_QUALITY_REVIEW") {
    return publicWebReviewAuditEvents.resultSentToQualityReview;
  }
  if (action === "DISCARD") return publicWebReviewAuditEvents.resultDiscarded;
  if (action === "ARCHIVE") return publicWebReviewAuditEvents.resultArchived;
  if (action === "MARK_DUPLICATE") {
    return publicWebReviewAuditEvents.resultMarkedDuplicate;
  }
  if (action === "LINK_TO_INTERNAL_PROFILE") {
    return publicWebReviewAuditEvents.resultLinkedToInternalProfile;
  }
  if (action === "MARK_DO_NOT_CONTACT") {
    return publicWebReviewAuditEvents.resultMarkedDoNotContact;
  }
  return publicWebReviewAuditEvents.resultReviewed;
}

export async function reviewPublicWebResearchResult(input: {
  resultId: string;
  action: PublicWebReviewAction;
  reviewerNotes?: string | null;
  duplicateMatchedType?: string | null;
  duplicateMatchedId?: string | null;
}) {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: "database_not_configured" };
  }
  const db = getDb();
  const current = await db.publicWebResearchResult.findUniqueOrThrow({
    where: { id: input.resultId },
    include: { researchRun: true, talentCandidates: true },
  });
  const review = await evaluatePublicWebResearchResultForReview({ result: current });
  const nextStatus = statusForAction(input.action);
  const updated = await db.publicWebResearchResult.update({
    where: { id: current.id },
    data: {
      status: nextStatus,
      sourceQualityScore: review.sourceQuality.totalScore,
      sourceQualityBand: review.sourceQuality.band,
      duplicateStatus: input.duplicateMatchedId
        ? "MATCHED_BY_ADMIN"
        : review.duplicate.duplicateStatus,
      duplicateMatchedType:
        input.duplicateMatchedType || review.duplicate.matchedRecordType,
      duplicateMatchedId: input.duplicateMatchedId || review.duplicate.matchedRecordId,
      reviewNotes: input.reviewerNotes || undefined,
      riskFlags: [
        ...new Set([
          ...stringArray(current.riskFlags),
          ...review.safety.blockers,
          ...review.sourceQuality.blockers,
        ]),
      ],
      missingEvidence: [
        ...new Set([
          ...stringArray(current.missingEvidence),
          ...review.safety.requiredActions,
          ...review.sourceQuality.warnings,
          ...(input.action === "NEEDS_MORE_CONTACT_RESEARCH"
            ? ["needs_more_contact_research"]
            : []),
        ]),
      ],
    },
  });
  if (nextStatus === "DO_NOT_CONTACT") {
    await db.talentCandidate.updateMany({
      where: { publicWebResearchResultId: current.id },
      data: { status: "DO_NOT_CONTACT" },
    });
  }
  if (nextStatus === "IN_QUALITY_REVIEW") {
    for (const candidate of current.talentCandidates) {
      try {
        const { createTalentResearchReviewForCandidate } = await import(
          "@/sms-engine/sourcing/talentResearchQuality"
        );
        await createTalentResearchReviewForCandidate({
          talentCandidateId: candidate.id,
          reviewer: "public_web_review",
          adminReviewed: false,
        });
      } catch {
        // Existing quality-review creation is best-effort here; status remains gated.
      }
    }
  }
  await logAudit({
    actorType: "ADMIN",
    action: actionAuditEvent(input.action),
    entityType: "PublicWebResearchResult",
    entityId: updated.id,
    metadata: {
      researchRunId: current.researchRunId,
      resultId: updated.id,
      statusBefore: current.status,
      statusAfter: updated.status,
      sourceQualityScore: review.sourceQuality.totalScore,
      duplicateStatus: updated.duplicateStatus,
      reviewAction: input.action,
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChatCreated: true,
      noPrivateNotesInOrganizerFields: true,
    },
  });
  return { ok: true, result: updated, review };
}

export async function discardResult(resultId: string) {
  return reviewPublicWebResearchResult({ resultId, action: "DISCARD" });
}

export async function markResultDuplicate(
  resultId: string,
  matchedRecord?: { type?: string | null; id?: string | null },
) {
  return reviewPublicWebResearchResult({
    resultId,
    action: "MARK_DUPLICATE",
    duplicateMatchedType: matchedRecord?.type || null,
    duplicateMatchedId: matchedRecord?.id || null,
  });
}

export async function markDoNotContact(resultId: string) {
  return reviewPublicWebResearchResult({
    resultId,
    action: "MARK_DO_NOT_CONTACT",
  });
}

export async function markNeedsMoreContactResearch(resultId: string) {
  return reviewPublicWebResearchResult({
    resultId,
    action: "NEEDS_MORE_CONTACT_RESEARCH",
  });
}

export async function archiveResearchRun(runId: string) {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const db = getDb();
  await logAudit({
    actorType: "ADMIN",
    action: publicWebReviewAuditEvents.cleanupRunStarted,
    entityType: "PublicWebResearchRun",
    entityId: runId,
    metadata: { runId, noSmsSent: true, noOutreachSent: true },
  });
  const run = await db.publicWebResearchRun.update({
    where: { id: runId },
    data: { status: "ARCHIVED" },
  });
  await db.publicWebResearchResult.updateMany({
    where: { researchRunId: runId, status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW"] } },
    data: { status: "ARCHIVED" },
  });
  await logAudit({
    actorType: "ADMIN",
    action: publicWebReviewAuditEvents.cleanupRunCompleted,
    entityType: "PublicWebResearchRun",
    entityId: runId,
    metadata: { runId, statusAfter: "ARCHIVED", noSmsSent: true },
  });
  return { ok: true, run };
}

export async function cleanupTestTaggedResults(tag = "live_dry_run") {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const db = getDb();
  const runs = await db.publicWebResearchRun.findMany({
    where: { sourceTag: tag },
    select: { id: true },
  });
  const runIds = runs.map((run) => run.id);
  const result = await db.publicWebResearchResult.updateMany({
    where: {
      researchRunId: { in: runIds },
      status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW", "IN_QUALITY_REVIEW"] },
    },
    data: { status: "ARCHIVED" },
  });
  await logAudit({
    actorType: "ADMIN",
    action: publicWebReviewAuditEvents.cleanupRunCompleted,
    entityType: "PublicWebResearchRun",
    entityId: tag,
    metadata: {
      tag,
      affectedRecordCounts: { runs: runIds.length, results: result.count },
      noSmsSent: true,
      noProductionData: true,
    },
  });
  return { ok: true, affectedResults: result.count, runCount: runIds.length };
}

export async function cleanupOldShadowResults(days = 30) {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const db = getDb();
  const cutoff = new Date(Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000);
  await logAudit({
    actorType: "ADMIN",
    action: publicWebReviewAuditEvents.cleanupRunStarted,
    entityType: "PublicWebResearchResult",
    entityId: `older_than_${days}_days`,
    metadata: { days, noSmsSent: true, noOutreachSent: true },
  });
  const result = await db.publicWebResearchResult.updateMany({
    where: {
      createdAt: { lt: cutoff },
      status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW"] },
      researchRun: { mode: { in: ["SHADOW", "LIVE_DRY_RUN"] } },
    },
    data: { status: "ARCHIVED" },
  });
  await logAudit({
    actorType: "ADMIN",
    action: publicWebReviewAuditEvents.cleanupRunCompleted,
    entityType: "PublicWebResearchResult",
    entityId: `older_than_${days}_days`,
    metadata: {
      affectedRecordCounts: { results: result.count },
      noSmsSent: true,
      noProductionData: true,
    },
  });
  return { ok: true, affectedResults: result.count };
}

export async function summarizeCleanupImpact() {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const db = getDb();
  const [
    pendingReviewCount,
    needsMoreResearchCount,
    archivedCount,
    duplicateCount,
    doNotContactCount,
    contactabilityPendingReviewCount,
    contactabilityHighRiskCount,
  ] = await Promise.all([
    db.publicWebResearchResult.count({
      where: { status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW", "IN_QUALITY_REVIEW"] } },
    }),
    db.publicWebResearchResult.count({
      where: { status: "NEEDS_REVIEW" },
    }),
    db.publicWebResearchResult.count({
      where: { status: { in: ["DISCARDED", "ARCHIVED"] } },
    }),
    db.publicWebResearchResult.count({ where: { status: "DUPLICATE" } }),
    db.publicWebResearchResult.count({ where: { status: "DO_NOT_CONTACT" } }),
    db.contactabilityEvidence.count({ where: { reviewStatus: "UNREVIEWED" } }),
    db.contactabilityEvidence.count({
      where: { outreachRisk: { in: ["HIGH", "BLOCKED"] } },
    }),
  ]);
  return {
    ok: true,
    pendingReviewCount,
    needsMoreResearchCount,
    archivedCount,
    duplicateCount,
    doNotContactCount,
    contactabilityPendingReviewCount,
    contactabilityHighRiskCount,
  };
}

export async function updateContactabilityEvidenceReview(input: {
  evidenceId: string;
  status: ContactabilityReviewStatus;
}) {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const db = getDb();
  const evidence = await db.contactabilityEvidence.update({
    where: { id: input.evidenceId },
    data: {
      reviewStatus: input.status,
      outreachAllowed: input.status === "VERIFIED" ? false : false,
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action:
      input.status === "VERIFIED"
        ? contactabilityAuditEvents.methodVerified
        : input.status === "UNSAFE"
          ? contactabilityAuditEvents.methodRejected
          : input.status === "DO_NOT_CONTACT"
            ? contactabilityAuditEvents.markedDoNotContact
            : contactabilityAuditEvents.evidenceReviewed,
    entityType: "ContactabilityEvidence",
    entityId: evidence.id,
    metadata: {
      resultId: evidence.publicWebResearchResultId,
      candidateId: evidence.talentCandidateId,
      channel: evidence.channel,
      riskLevel: evidence.outreachRisk,
      reviewStatus: evidence.reviewStatus,
      noRawEmail: true,
      noRawPhone: true,
      noSmsSent: true,
    },
  });
  return { ok: true, evidence };
}
