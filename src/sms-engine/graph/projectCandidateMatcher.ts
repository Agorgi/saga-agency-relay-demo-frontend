import type {
  CandidateGraphMatchReviewStatus,
  CandidateGraphMatchSourceMode,
  Prisma,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import type { ProducerRole, ProjectUnderstanding, RoleMap } from "@/sms-engine/producer/producerAgentTypes";
import {
  retrieveCandidatePoolForProject,
  type CandidatePoolProfile,
  type CandidateRetrievalOptions,
} from "@/sms-engine/graph/candidateRetrieval";
import {
  RELATIONSHIP_AWARE_SCORING_VERSION,
  canPromoteMatchResultToReview,
  scoreCandidateForRole,
} from "@/sms-engine/graph/relationshipAwareScoring";
import type { ProximityContext, RelationshipGraphEdge } from "@/sms-engine/graph/relationshipProximity";

export const graphMatchingAuditEvents = {
  matchRunCreated: "graph.match_run_created",
  matchRunCompleted: "graph.match_run_completed",
  matchRunFailed: "graph.match_run_failed",
  candidateScored: "graph.candidate_scored",
  relationshipPathExplained: "graph.relationship_path_explained",
  matchPromotedToReview: "graph.match_promoted_to_review",
  matchRejected: "graph.match_rejected",
  matchMarkedDoNotContact: "graph.match_marked_do_not_contact",
  matchNeedsMoreResearch: "graph.match_needs_more_research",
} as const;

export type RankCandidatesOptions = CandidateRetrievalOptions & {
  projectUnderstanding?: ProjectUnderstanding;
  roleMap?: RoleMap;
  requesterId?: string | null;
  graphContext?: ProximityContext;
  persist?: boolean;
  createCandidateRecommendations?: boolean;
};

type RankedCandidate = {
  candidate: CandidatePoolProfile;
  role: ProducerRole;
  totalScore: number;
  scoreBreakdown: ReturnType<typeof scoreCandidateForRole>["scoreBreakdown"];
  proximityTier: string;
  relationshipPath: ReturnType<typeof scoreCandidateForRole>["relationshipPath"];
  matchReasons: string[];
  riskFlags: string[];
  missingEvidence: string[];
  contactabilitySummary: ReturnType<typeof scoreCandidateForRole>["contactabilitySummary"];
  sourceMode: CandidateGraphMatchSourceMode;
  reviewStatus: CandidateGraphMatchReviewStatus;
  organizerSafeSummary: string;
};

function sourceMode(profile: CandidatePoolProfile): CandidateGraphMatchSourceMode {
  if (profile.sourceMode === "PUBLIC_WEB_RESEARCH") return "PUBLIC_WEB_RESEARCH";
  if (profile.sourceMode === "ADMIN_ADDED") return "ADMIN_ADDED";
  if (profile.sourceMode === "MIXED") return "MIXED";
  return "INTERNAL_DB";
}

function reviewStatusFor(profile: CandidatePoolProfile): CandidateGraphMatchReviewStatus {
  if (profile.doNotContact || profile.reviewStatus === "DO_NOT_CONTACT") return "DO_NOT_CONTACT";
  if (profile.reviewStatus === "REJECTED" || profile.reviewStatus === "ARCHIVED") return "REJECTED";
  if (profile.reviewStatus === "APPROVED_FOR_SHORTLIST") return "APPROVED_FOR_SHORTLIST";
  if (profile.sourceMode === "PUBLIC_WEB_RESEARCH") return "NEEDS_REVIEW";
  return "SUGGESTED";
}

function roles(roleMap: RoleMap) {
  return [...roleMap.requiredRoles, ...roleMap.optionalRoles];
}

async function loadProjectContext(projectBriefOrProjectId: string) {
  const db = getDb();
  const brief = await db.projectBrief.findUnique({
    where: { id: projectBriefOrProjectId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 10 },
      project: true,
    },
  });
  if (brief) {
    const understanding = buildProjectUnderstanding({
      projectBrief: brief,
      project: brief.project,
      recentMessages: brief.messages,
    });
    return {
      projectBriefId: brief.id,
      projectId: brief.projectId,
      requestedByUserId: brief.userId,
      requestedByPersonId: brief.project?.organizerPersonId || null,
      projectUnderstanding: understanding,
      roleMap: generateRoleMap(understanding),
    };
  }

  const project = await db.project.findUnique({
    where: { id: projectBriefOrProjectId },
    include: {
      projectBrief: true,
      roleOpenings: true,
    },
  });
  if (!project) throw new Error("project_or_project_brief_not_found");
  const understanding = buildProjectUnderstanding({
    projectBrief: project.projectBrief,
    project,
    recentMessages: [],
  });
  return {
    projectBriefId: project.projectBrief?.id || null,
    projectId: project.id,
    requestedByUserId: project.projectBrief?.userId || null,
    requestedByPersonId: project.organizerPersonId || null,
    projectUnderstanding: understanding,
    roleMap: generateRoleMap(understanding),
  };
}

async function loadGraphContext(requesterId?: string | null): Promise<ProximityContext> {
  if (!process.env.DATABASE_URL || !requesterId) return {};
  const [directEdges, person] = await Promise.all([
    getDb().candidateGraphEdge.findMany({
      where: {
        OR: [
          { fromEntityType: "PERSON", fromEntityId: requesterId },
          { toEntityType: "PERSON", toEntityId: requesterId },
        ],
      },
      take: 250,
    }),
    getDb().person.findUnique({
      where: { id: requesterId },
      include: { creatorProfile: true },
    }),
  ]);
  const neighborIds = [
    ...new Set(
      directEdges
        .flatMap((edge) => [edge.fromEntityId, edge.toEntityId])
        .filter((id) => id !== requesterId),
    ),
  ].slice(0, 75);
  const secondHopEdges =
    neighborIds.length > 0
      ? await getDb().candidateGraphEdge.findMany({
          where: {
            OR: [
              { fromEntityType: "PERSON", fromEntityId: { in: neighborIds } },
              { toEntityType: "PERSON", toEntityId: { in: neighborIds } },
            ],
          },
          take: 250,
        })
      : [];
  const graphEdges = [...directEdges, ...secondHopEdges];
  const edges: RelationshipGraphEdge[] = graphEdges.map((edge) => ({
    fromEntityType: edge.fromEntityType,
    fromEntityId: edge.fromEntityId,
    toEntityType: edge.toEntityType,
    toEntityId: edge.toEntityId,
    edgeType: edge.edgeType,
    strength: edge.strength,
    confidence: edge.confidence,
    isInferred: edge.isInferred,
    sourceType: edge.sourceType,
  }));
  return {
    edges,
    requesterCity: person?.city || person?.creatorProfile?.city || null,
    requesterFandomTags: person?.creatorProfile?.fandoms || [],
    requesterCommunityTags: person?.creatorProfile?.communities || [],
  };
}

function rankFromPool(input: {
  projectUnderstanding: ProjectUnderstanding;
  roleMap: RoleMap;
  candidates: CandidatePoolProfile[];
  requesterId?: string | null;
  graphContext?: ProximityContext;
}) {
  const ranked: RankedCandidate[] = [];
  for (const role of roles(input.roleMap)) {
    for (const candidate of input.candidates) {
      const scored = scoreCandidateForRole({
        project: input.projectUnderstanding,
        role,
        candidate,
        requesterId: input.requesterId,
        graphContext: input.graphContext,
      });
      if (scored.blocked || scored.totalScore <= 0) continue;
      ranked.push({
        candidate,
        role,
        totalScore: scored.totalScore,
        scoreBreakdown: scored.scoreBreakdown,
        proximityTier: scored.proximityTier,
        relationshipPath: scored.relationshipPath,
        matchReasons: scored.matchReasons,
        riskFlags: scored.riskFlags,
        missingEvidence: scored.missingEvidence,
        contactabilitySummary: scored.contactabilitySummary,
        sourceMode: sourceMode(candidate),
        reviewStatus: reviewStatusFor(candidate),
        organizerSafeSummary: scored.organizerSafeSummary,
      });
    }
  }
  return ranked.sort((left, right) => right.totalScore - left.totalScore);
}

export async function rankCandidatesForProject(
  projectBriefOrProjectId: string,
  options: RankCandidatesOptions = {},
) {
  const projectContext =
    options.projectUnderstanding && options.roleMap
      ? {
          projectBriefId: null,
          projectId: null,
          requestedByUserId: null,
          requestedByPersonId: options.requesterId || null,
          projectUnderstanding: options.projectUnderstanding,
          roleMap: options.roleMap,
        }
      : process.env.DATABASE_URL
        ? await loadProjectContext(projectBriefOrProjectId)
        : (() => {
            throw new Error("project_context_required_without_database");
          })();
  const graphContext =
    options.graphContext || (await loadGraphContext(projectContext.requestedByPersonId));
  const retrieved = await retrieveCandidatePoolForProject(
    projectContext.projectUnderstanding,
    projectContext.roleMap,
    options,
  );
  const ranked = rankFromPool({
    projectUnderstanding: projectContext.projectUnderstanding,
    roleMap: projectContext.roleMap,
    candidates: retrieved.candidates,
    requesterId: projectContext.requestedByPersonId || options.requesterId,
    graphContext,
  });
  const cappedRanked = ranked.slice(0, options.poolCap || 250);

  if (!process.env.DATABASE_URL || options.persist === false) {
    return {
      matchRunId: null,
      status: "COMPLETED",
      candidatePoolSize: retrieved.candidatePoolSize,
      resultCount: cappedRanked.length,
      filtersApplied: retrieved.filtersApplied,
      scoringVersion: RELATIONSHIP_AWARE_SCORING_VERSION,
      results: cappedRanked,
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChatCreated: true,
      noLiveWebCall: true,
      noProductionSagaData: true,
    };
  }

  const db = getDb();
  const run = await db.candidateGraphMatchRun.create({
    data: {
      projectBriefId: projectContext.projectBriefId,
      projectId: projectContext.projectId,
      requestedByPersonId: projectContext.requestedByPersonId,
      requestedByUserId: projectContext.requestedByUserId,
      status: "RUNNING",
      roleTargets: roles(projectContext.roleMap).map((role) => role.roleType),
      candidatePoolSize: retrieved.candidatePoolSize,
      resultCount: 0,
      filtersApplied: retrieved.filtersApplied,
      scoringVersion: RELATIONSHIP_AWARE_SCORING_VERSION,
      warnings: [],
    },
  });
  await logAudit({
    actorType: "SYSTEM",
    action: graphMatchingAuditEvents.matchRunCreated,
    entityType: "CandidateGraphMatchRun",
    entityId: run.id,
    metadata: {
      projectBriefId: projectContext.projectBriefId,
      projectId: projectContext.projectId,
      candidatePoolSize: retrieved.candidatePoolSize,
      scoringVersion: RELATIONSHIP_AWARE_SCORING_VERSION,
    },
  });

  try {
    for (const result of cappedRanked) {
      await db.candidateGraphMatchResult.create({
        data: {
          matchRunId: run.id,
          candidateSearchProfileId: result.candidate.candidateSearchProfileId || result.candidate.id,
          personId: result.candidate.personId || null,
          creatorProfileId: result.candidate.creatorProfileId || null,
          contactId: result.candidate.contactId || null,
          talentCandidateId: result.candidate.talentCandidateId || null,
          candidateRecommendationId: result.candidate.candidateRecommendationId || null,
          publicWebResearchResultId: result.candidate.publicWebResearchResultId || null,
          role: result.role.roleType,
          totalScore: result.totalScore,
          scoreBreakdown: result.scoreBreakdown as unknown as Prisma.InputJsonValue,
          proximityTier: result.proximityTier,
          relationshipPath: result.relationshipPath as unknown as Prisma.InputJsonValue,
          matchReasons: result.matchReasons,
          riskFlags: result.riskFlags,
          missingEvidence: result.missingEvidence,
          contactabilitySummary:
            result.contactabilitySummary as unknown as Prisma.InputJsonValue,
          sourceMode: result.sourceMode,
          reviewStatus: result.reviewStatus,
          organizerSafeSummary: result.organizerSafeSummary,
        },
      });
      await logAudit({
        actorType: "SYSTEM",
        action: graphMatchingAuditEvents.candidateScored,
        entityType: "CandidateGraphMatchRun",
        entityId: run.id,
        metadata: {
          role: result.role.roleType,
          totalScore: result.totalScore,
          proximityTier: result.proximityTier,
          sourceMode: result.sourceMode,
          riskFlagCount: result.riskFlags.length,
        },
      });
    }
    await db.candidateGraphMatchRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        resultCount: cappedRanked.length,
        completedAt: new Date(),
      },
    });
    await logAudit({
      actorType: "SYSTEM",
      action: graphMatchingAuditEvents.matchRunCompleted,
      entityType: "CandidateGraphMatchRun",
      entityId: run.id,
      metadata: {
        resultCount: cappedRanked.length,
        noSmsSent: true,
        noOutreachSent: true,
        noGroupChatCreated: true,
      },
    });
  } catch (error) {
    await db.candidateGraphMatchRun.update({
      where: { id: run.id },
      data: { status: "FAILED", warnings: ["match_result_persistence_failed"] },
    });
    await logAudit({
      actorType: "SYSTEM",
      action: graphMatchingAuditEvents.matchRunFailed,
      entityType: "CandidateGraphMatchRun",
      entityId: run.id,
      metadata: { errorCategory: "match_result_persistence_failed" },
    });
    throw error;
  }

  return {
    matchRunId: run.id,
    status: "COMPLETED",
    candidatePoolSize: retrieved.candidatePoolSize,
    resultCount: cappedRanked.length,
    filtersApplied: retrieved.filtersApplied,
    scoringVersion: RELATIONSHIP_AWARE_SCORING_VERSION,
    results: cappedRanked,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
    noLiveWebCall: true,
    noProductionSagaData: true,
  };
}

export async function updateCandidateGraphMatchResultReview(input: {
  resultId: string;
  reviewStatus: CandidateGraphMatchReviewStatus;
  adminNotes?: string | null;
}) {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "database_not_configured" };
  const current = await getDb().candidateGraphMatchResult.findUniqueOrThrow({
    where: { id: input.resultId },
  });
  const promotion = canPromoteMatchResultToReview({
    reviewStatus: input.reviewStatus,
    sourceMode: current.sourceMode,
    riskFlags: Array.isArray(current.riskFlags)
      ? current.riskFlags.filter((item): item is string => typeof item === "string")
      : [],
    organizerSafeSummary: current.organizerSafeSummary,
    adminAction: true,
    doNotContact: input.reviewStatus === "DO_NOT_CONTACT",
  });
  const updated = await getDb().candidateGraphMatchResult.update({
    where: { id: input.resultId },
    data: {
      reviewStatus: input.reviewStatus,
      adminNotes: input.adminNotes || undefined,
      riskFlags: promotion.allowed
        ? ((current.riskFlags || []) as Prisma.InputJsonValue)
        : [
            ...new Set([
              ...(Array.isArray(current.riskFlags)
                ? current.riskFlags.filter((item): item is string => typeof item === "string")
                : []),
              ...promotion.blockers,
            ]),
          ],
    },
  });
  const event =
    input.reviewStatus === "DO_NOT_CONTACT"
      ? graphMatchingAuditEvents.matchMarkedDoNotContact
      : input.reviewStatus === "REJECTED"
        ? graphMatchingAuditEvents.matchRejected
        : input.reviewStatus === "NEEDS_REVIEW"
          ? graphMatchingAuditEvents.matchNeedsMoreResearch
          : graphMatchingAuditEvents.matchPromotedToReview;
  await logAudit({
    actorType: "ADMIN",
    action: event,
    entityType: "CandidateGraphMatchResult",
    entityId: updated.id,
    metadata: {
      matchRunId: updated.matchRunId,
      role: updated.role,
      totalScore: updated.totalScore,
      proximityTier: updated.proximityTier,
      sourceMode: updated.sourceMode,
      reviewStatus: updated.reviewStatus,
      riskFlagCount: Array.isArray(updated.riskFlags) ? updated.riskFlags.length : 0,
    },
  });
  return { ok: true, updated, promotion };
}
