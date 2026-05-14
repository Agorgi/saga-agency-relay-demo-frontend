import type {
  CandidateRecommendationStatus,
  Prisma,
  ShortlistPacketStatus,
} from "@prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getCandidateRecommendationQualityGate } from "@/lib/sourcing/talentResearchQuality";
import {
  assertCandidateRecommendationStatusTransition,
} from "@/lib/workflowStateMachine";

export const candidateReviewStatuses = [
  "SUGGESTED",
  "APPROVED_FOR_SHORTLIST",
  "REJECTED",
  "NEEDS_MORE_INFO",
  "CONTACT_LATER",
  "DO_NOT_CONTACT",
] as const;

export const shortlistPacketStatuses = [
  "DRAFT",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "SENT",
] as const;

const candidateReviewStatusSchema = z.enum(candidateReviewStatuses);
const editableShortlistPacketStatusSchema = z.enum(["DRAFT", "NEEDS_REVIEW"]);

export type CandidateReviewStatus = z.infer<typeof candidateReviewStatusSchema>;

export type ShortlistPacketCandidateInput = {
  candidateRecommendationId: string;
  personId?: string | null;
  displayName: string;
  role: string;
  city?: string | null;
  score: number;
  scoreBreakdown?: unknown;
  proximityTier?: string | null;
  matchingReasons: string[];
  risks: string[];
  status: CandidateRecommendationStatus | string;
  adminReviewNotes?: string | null;
  shortlistReasonOverride?: string | null;
  organizerFacingSummaryOverride?: string | null;
  privateNotes?: string | null;
};

export type ShortlistPacketRoleInput = {
  role: string;
  title?: string | null;
  priority?: string | null;
};

export type ShortlistPacketDraftInput = {
  projectBriefId?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  roles?: ShortlistPacketRoleInput[];
  candidates: ShortlistPacketCandidateInput[];
};

export type ShortlistPacketCandidateSummary = {
  candidateRecommendationId: string;
  name: string;
  role: string;
  city: string | null;
  whyTheyFit: string[];
  confidence: number;
  gaps: string[];
};

export type ShortlistPacketDraft = {
  projectBriefId: string | null;
  projectId: string | null;
  status: "NEEDS_REVIEW";
  organizerFacingSummary: string;
  rolesCovered: string[];
  rolesMissing: string[];
  candidateSummaries: ShortlistPacketCandidateSummary[];
  adminReviewRequired: true;
  forbiddenClaimsCheck: {
    passed: boolean;
    flaggedTerms: string[];
  };
};

export type ShortlistPacketApprovalInput = {
  projectBriefId?: string | null;
  projectId?: string | null;
  status: ShortlistPacketStatus | string;
  organizerFacingSummary: string;
  candidateSummaries: unknown;
};

const rawEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const rawPhonePattern =
  /(?:\+\d{8,15})|\b(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;
const privateNotesPattern = /\b(private note|internal note|admin note|do not share|secret)\b/i;
const forbiddenClaimPatterns = [
  /\bguaranteed?\b/i,
  /\bbooked\b/i,
  /\bwill join\b/i,
  /\bhas agreed\b/i,
  /\bconfirmed (team|availability|booking|rate|payment|placement)\b/i,
  /\b(payment|rate|revenue|ticket sales|attendance|venue access) (is|are) confirmed\b/i,
  /\bcelebrity\b/i,
  /\binfluencer participation\b/i,
];

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function confidenceFromScore(score: number) {
  return Math.max(0.2, Math.min(0.95, 0.35 + score / 60));
}

function containsRawContactInfo(text: string) {
  return rawEmailPattern.test(text) || rawPhonePattern.test(text);
}

function findForbiddenClaims(text: string) {
  const matches: string[] = [];
  for (const pattern of forbiddenClaimPatterns) {
    const globalPattern = new RegExp(
      pattern,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    for (const match of text.matchAll(globalPattern)) {
      const index = match.index || 0;
      const prefix = text.slice(Math.max(0, index - 14), index).toLowerCase();
      if (/\b(not|are not|is not|no)\s*$/.test(prefix)) continue;
      matches.push(match[0].toLowerCase());
    }
  }
  return unique(matches);
}

function packetTextForSafety({
  organizerFacingSummary,
  candidateSummaries,
}: {
  organizerFacingSummary: string;
  candidateSummaries: unknown;
}) {
  return [organizerFacingSummary, JSON.stringify(candidateSummaries ?? [])].join(" ");
}

function approvedCandidate(candidate: ShortlistPacketCandidateInput) {
  return candidate.status === "APPROVED_FOR_SHORTLIST";
}

export function normalizeCandidateReviewStatus(
  status: string | null | undefined,
): CandidateReviewStatus | null {
  const parsed = candidateReviewStatusSchema.safeParse(status);
  return parsed.success ? parsed.data : null;
}

export function candidateReviewAuditAction(status: CandidateReviewStatus) {
  if (status === "APPROVED_FOR_SHORTLIST") {
    return "producer.candidate_approved_for_shortlist";
  }
  if (status === "REJECTED") return "producer.candidate_rejected";
  if (status === "NEEDS_MORE_INFO") {
    return "producer.candidate_needs_more_info";
  }
  return "producer.candidate_reviewed";
}

export function generateShortlistPacketDraft({
  projectBriefId = null,
  projectId = null,
  roles = [],
  candidates,
}: ShortlistPacketDraftInput): ShortlistPacketDraft {
  const approvedCandidates = candidates.filter(approvedCandidate);
  const candidateSummaries = approvedCandidates.map((candidate) => {
    const override = candidate.organizerFacingSummaryOverride?.trim();
    const reasonOverride = candidate.shortlistReasonOverride?.trim();
    const reasons = reasonOverride
      ? [reasonOverride]
      : candidate.matchingReasons.slice(0, 3);

    return {
      candidateRecommendationId: candidate.candidateRecommendationId,
      name: candidate.displayName || "Internal candidate",
      role: candidate.role,
      city: candidate.city || null,
      whyTheyFit:
        override && !containsRawContactInfo(override)
          ? [override]
          : reasons.length > 0
            ? reasons
            : ["Potential role fit for admin review"],
      confidence: confidenceFromScore(candidate.score),
      gaps: candidate.risks.slice(0, 3),
    };
  });

  const coveredSet = new Set(candidateSummaries.map((candidate) => candidate.role));
  const rolesCovered = unique([...coveredSet]);
  const roleNames = roles.map((role) => role.role);
  const rolesMissing = roleNames.length
    ? roleNames.filter((role) => !coveredSet.has(role))
    : [];

  const organizerFacingSummary =
    "Here's a draft shortlist based on the brief. These are not confirmed team members yet - they're people Saga thinks may be worth considering based on role fit, location, and community alignment.";
  const safetyText = packetTextForSafety({
    organizerFacingSummary,
    candidateSummaries,
  });

  return {
    projectBriefId,
    projectId,
    status: "NEEDS_REVIEW",
    organizerFacingSummary,
    rolesCovered,
    rolesMissing,
    candidateSummaries,
    adminReviewRequired: true,
    forbiddenClaimsCheck: {
      passed: findForbiddenClaims(safetyText).length === 0,
      flaggedTerms: findForbiddenClaims(safetyText),
    },
  };
}

export function validateShortlistPacketForApproval(
  packet: ShortlistPacketApprovalInput,
) {
  const errors: string[] = [];
  const statusParsed = editableShortlistPacketStatusSchema.safeParse(packet.status);
  const candidateSummaries = Array.isArray(packet.candidateSummaries)
    ? packet.candidateSummaries
    : [];
  const safetyText = packetTextForSafety({
    organizerFacingSummary: packet.organizerFacingSummary,
    candidateSummaries,
  });
  const forbiddenClaims = findForbiddenClaims(safetyText);

  if (!packet.projectBriefId && !packet.projectId) {
    errors.push("Shortlist packet must be linked to a ProjectBrief or Project.");
  }
  if (!statusParsed.success) {
    errors.push("Shortlist packet must be DRAFT or NEEDS_REVIEW before approval.");
  }
  if (candidateSummaries.length === 0) {
    errors.push("At least one candidate must be approved for shortlist.");
  }
  if (containsRawContactInfo(safetyText)) {
    errors.push("Organizer-facing shortlist text must not expose raw phone numbers or emails.");
  }
  if (privateNotesPattern.test(safetyText)) {
    errors.push("Organizer-facing shortlist text must not expose private or admin notes.");
  }
  if (forbiddenClaims.length > 0) {
    errors.push(`Forbidden claims detected: ${forbiddenClaims.join(", ")}.`);
  }
  if (
    !/\bnot confirmed\b/i.test(packet.organizerFacingSummary) &&
    !/\bfor consideration\b/i.test(packet.organizerFacingSummary) &&
    !/\bmay be worth considering\b/i.test(packet.organizerFacingSummary)
  ) {
    errors.push(
      "Shortlist packet must clearly state candidates are not confirmed or are for consideration.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    forbiddenClaimsCheck: {
      passed: forbiddenClaims.length === 0,
      flaggedTerms: forbiddenClaims,
    },
  };
}

type ProjectForPacket = Prisma.ProjectGetPayload<{
  include: {
    roleOpenings: {
      include: {
        opportunities: {
          include: {
            recommendations: {
              include: {
                person: {
                  include: {
                    creatorProfile: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

function projectRolesForPacket(project: ProjectForPacket): ShortlistPacketRoleInput[] {
  return project.roleOpenings.map((roleOpening) => ({
    role: roleOpening.roleType,
    title: roleOpening.title,
    priority: roleOpening.status === "OPEN" ? "required" : "optional",
  }));
}

function recommendationToPacketCandidate(
  recommendation: ProjectForPacket["roleOpenings"][number]["opportunities"][number]["recommendations"][number],
  roleOpening: ProjectForPacket["roleOpenings"][number],
): ShortlistPacketCandidateInput {
  const profile = recommendation.person.creatorProfile;
  return {
    candidateRecommendationId: recommendation.id,
    personId: recommendation.personId,
    displayName:
      profile?.displayName || recommendation.person.name || "Internal candidate",
    role: roleOpening.roleType,
    city: profile?.city || recommendation.person.city,
    score: recommendation.score,
    scoreBreakdown: recommendation.scoreBreakdown,
    proximityTier: recommendation.proximityTier,
    matchingReasons: recommendation.matchingReasons,
    risks: recommendation.risks,
    status: recommendation.status,
    adminReviewNotes: recommendation.adminReviewNotes,
    shortlistReasonOverride: recommendation.shortlistReasonOverride,
    organizerFacingSummaryOverride:
      recommendation.organizerFacingSummaryOverride,
    privateNotes: profile?.internalNotes,
  };
}

async function loadProjectForShortlistPacket(projectBriefId: string) {
  const db = getDb();
  const projectBrief = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectBriefId },
    select: { id: true, projectId: true, title: true },
  });
  if (!projectBrief.projectId) {
    throw new Error(
      "Generate Producer Agent role map and candidate recommendations before creating a shortlist packet.",
    );
  }
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectBrief.projectId },
    include: {
      roleOpenings: {
        include: {
          opportunities: {
            include: {
              recommendations: {
                include: {
                  person: {
                    include: {
                      creatorProfile: true,
                    },
                  },
                },
                orderBy: { score: "desc" },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  return { projectBrief, project };
}

export async function reviewCandidateRecommendationForShortlist({
  candidateRecommendationId,
  status,
  adminReviewNotes,
  reviewedBy = "admin",
  shortlistReasonOverride,
  organizerFacingSummaryOverride,
}: {
  candidateRecommendationId: string;
  status: CandidateReviewStatus;
  adminReviewNotes?: string | null;
  reviewedBy?: string | null;
  shortlistReasonOverride?: string | null;
  organizerFacingSummaryOverride?: string | null;
}) {
  const db = getDb();
  const current = await db.candidateRecommendation.findUniqueOrThrow({
    where: { id: candidateRecommendationId },
    include: {
      person: true,
      opportunity: {
        include: {
          roleOpening: {
            include: { project: true },
          },
        },
      },
    },
  });
  const oldStatus = current.status;

  if (
    oldStatus === "DO_NOT_CONTACT" &&
    status === "APPROVED_FOR_SHORTLIST"
  ) {
    throw new Error("A do-not-contact candidate cannot be approved for shortlist.");
  }
  if (current.person.optedOut && status === "APPROVED_FOR_SHORTLIST") {
    throw new Error("An opted-out candidate cannot be approved for shortlist.");
  }
  if (status === "APPROVED_FOR_SHORTLIST") {
    const qualityGate = await getCandidateRecommendationQualityGate(
      candidateRecommendationId,
    );
    if (!qualityGate.allowed) {
      throw new Error(
        `Candidate quality review blocks shortlist approval: ${qualityGate.blockers.join(", ")}`,
      );
    }
    if (
      qualityGate.review?.organizerFacingSummary &&
      !organizerFacingSummaryOverride
    ) {
      organizerFacingSummaryOverride = qualityGate.review.organizerFacingSummary;
    }
  }

  assertCandidateRecommendationStatusTransition(oldStatus, status, {
    allowAdminOverride: true,
    humanApproved: status === "APPROVED_FOR_SHORTLIST",
  });

  const updated = await db.candidateRecommendation.update({
    where: { id: candidateRecommendationId },
    data: {
      status,
      adminReviewNotes,
      reviewedAt: new Date(),
      reviewedBy,
      shortlistReasonOverride,
      organizerFacingSummaryOverride,
    },
  });
  const projectId = current.opportunity.roleOpening.projectId;
  const projectBriefId = current.opportunity.roleOpening.project.legacyProjectBriefId;
  const metadata = {
    projectId,
    projectBriefId,
    candidateRecommendationId,
    oldStatus,
    newStatus: updated.status,
    reviewer: reviewedBy || "admin",
  };

  await logAudit({
    actorType: "ADMIN",
    action: "producer.candidate_reviewed",
    entityType: "CandidateRecommendation",
    entityId: candidateRecommendationId,
    metadata,
  });

  const specificAction = candidateReviewAuditAction(status);
  if (specificAction !== "producer.candidate_reviewed") {
    await logAudit({
      actorType: "ADMIN",
      action: specificAction,
      entityType: "CandidateRecommendation",
      entityId: candidateRecommendationId,
      metadata,
    });
  }

  return updated;
}

export async function generateShortlistPacketForProjectBrief(projectBriefId: string) {
  const { projectBrief, project } = await loadProjectForShortlistPacket(projectBriefId);
  const candidates = project.roleOpenings.flatMap((roleOpening) =>
    roleOpening.opportunities.flatMap((opportunity) =>
      opportunity.recommendations.map((recommendation) =>
        recommendationToPacketCandidate(recommendation, roleOpening),
      ),
    ),
  );
  const draft = generateShortlistPacketDraft({
    projectBriefId: projectBrief.id,
    projectId: project.id,
    projectTitle: projectBrief.title || project.title,
    roles: projectRolesForPacket(project),
    candidates,
  });

  if (draft.candidateSummaries.length === 0) {
    throw new Error(
      "Approve at least one candidate for shortlist before generating a shortlist packet.",
    );
  }

  const packet = await getDb().shortlistPacket.create({
    data: {
      projectBriefId: draft.projectBriefId,
      projectId: draft.projectId,
      status: draft.status,
      organizerFacingSummary: draft.organizerFacingSummary,
      rolesCovered: draft.rolesCovered as Prisma.InputJsonValue,
      rolesMissing: draft.rolesMissing as Prisma.InputJsonValue,
      candidateSummaries: draft.candidateSummaries as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "producer.shortlist_packet_generated",
    entityType: "ShortlistPacket",
    entityId: packet.id,
    metadata: {
      projectBriefId,
      projectId: project.id,
      shortlistPacketId: packet.id,
      status: packet.status,
      candidateCount: draft.candidateSummaries.length,
      rolesCovered: draft.rolesCovered,
      rolesMissing: draft.rolesMissing,
      adminReviewRequired: true,
      forbiddenClaimsCheck: draft.forbiddenClaimsCheck,
    },
  });

  return packet;
}

export async function editShortlistPacket({
  shortlistPacketId,
  organizerFacingSummary,
  adminNotes,
}: {
  shortlistPacketId: string;
  organizerFacingSummary: string;
  adminNotes?: string | null;
}) {
  const db = getDb();
  const current = await db.shortlistPacket.findUniqueOrThrow({
    where: { id: shortlistPacketId },
  });
  if (containsRawContactInfo(organizerFacingSummary)) {
    throw new Error("Organizer-facing summary cannot include raw phone or email.");
  }
  if (privateNotesPattern.test(organizerFacingSummary)) {
    throw new Error("Organizer-facing summary cannot include private or admin notes.");
  }

  const nextStatus =
    current.status === "APPROVED" ? "NEEDS_REVIEW" : current.status;
  const updated = await db.shortlistPacket.update({
    where: { id: shortlistPacketId },
    data: {
      organizerFacingSummary,
      adminNotes,
      status: nextStatus,
      ...(current.status === "APPROVED"
        ? { approvedAt: null, approvedBy: null }
        : {}),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "producer.shortlist_packet_edited",
    entityType: "ShortlistPacket",
    entityId: shortlistPacketId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId,
      oldStatus: current.status,
      newStatus: updated.status,
    },
  });

  return updated;
}

export async function approveShortlistPacket({
  shortlistPacketId,
  approvedBy = "admin",
}: {
  shortlistPacketId: string;
  approvedBy?: string | null;
}) {
  const db = getDb();
  const packet = await db.shortlistPacket.findUniqueOrThrow({
    where: { id: shortlistPacketId },
  });
  const validation = validateShortlistPacketForApproval({
    projectBriefId: packet.projectBriefId,
    projectId: packet.projectId,
    status: packet.status,
    organizerFacingSummary: packet.organizerFacingSummary,
    candidateSummaries: packet.candidateSummaries,
  });
  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  const updated = await db.shortlistPacket.update({
    where: { id: shortlistPacketId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "producer.shortlist_packet_approved",
    entityType: "ShortlistPacket",
    entityId: shortlistPacketId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId,
      oldStatus: packet.status,
      newStatus: updated.status,
      approvedBy: approvedBy || "admin",
      candidateCount: Array.isArray(packet.candidateSummaries)
        ? packet.candidateSummaries.length
        : 0,
      forbiddenClaimsCheck: validation.forbiddenClaimsCheck,
      noSmsSent: true,
      noOutreachCreated: true,
      noGroupChatCreated: true,
    },
  });

  return updated;
}

export async function rejectShortlistPacket({
  shortlistPacketId,
  adminNotes,
}: {
  shortlistPacketId: string;
  adminNotes?: string | null;
}) {
  const db = getDb();
  const packet = await db.shortlistPacket.findUniqueOrThrow({
    where: { id: shortlistPacketId },
  });
  const updated = await db.shortlistPacket.update({
    where: { id: shortlistPacketId },
    data: {
      status: "REJECTED",
      adminNotes: adminNotes || packet.adminNotes,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action: "producer.shortlist_packet_rejected",
    entityType: "ShortlistPacket",
    entityId: shortlistPacketId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId,
      oldStatus: packet.status,
      newStatus: updated.status,
    },
  });

  return updated;
}
