import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { ensureProjectForProjectBrief } from "@/lib/networkBridge";
import { buildProjectUnderstanding } from "@/lib/producer/projectUnderstanding";
import { generateRoleMap } from "@/lib/producer/roleMap";
import { buildSourcingPlan } from "@/lib/producer/sourcingPlan";
import {
  persistInternalCandidateRecommendations,
  recommendInternalCandidates,
} from "@/lib/producer/candidateRecommendations";
import { generateShortlistDraft } from "@/lib/producer/shortlistDraft";
import type {
  InternalCandidateRecommendation,
  ProjectUnderstanding,
  RoleMap,
  SourcingPlan,
} from "@/lib/producer/producerAgentTypes";
import {
  assertProjectBriefStatusTransition,
  logWorkflowTransition,
} from "@/lib/workflowStateMachine";

function requiredRolesForBrief(roleMap: RoleMap): Prisma.InputJsonValue {
  return roleMap.requiredRoles.map((role) => ({
    role: role.title,
    reason: role.whyThisRoleMatters,
    priority: "core",
    tags: role.requiredSkills,
  })) as Prisma.InputJsonValue;
}

function producerRoleData(roleMap: RoleMap, understanding: ProjectUnderstanding) {
  return [...roleMap.requiredRoles, ...roleMap.optionalRoles].map((role) => ({
    roleType: role.roleType,
    title: role.title,
    description: role.description,
    requiredSkills: role.requiredSkills,
    preferredFandoms: role.preferredFandoms,
    locationRequirement: role.localRequired ? understanding.city : null,
    compensationType: "UNKNOWN" as const,
    status: "OPEN" as const,
  }));
}

export async function loadProducerProjectInput(projectBriefId: string) {
  const db = getDb();
  const projectBrief = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectBriefId },
    include: {
      user: true,
      project: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
  return {
    projectBrief,
    project: projectBrief.project,
    recentMessages: [...projectBrief.messages]
      .reverse()
      .map((message) => ({
        body: message.body,
        direction: message.direction,
      })),
    organizerContext: projectBrief.user.name,
  };
}

export async function generateProducerProjectUnderstanding(projectBriefId: string) {
  const input = await loadProducerProjectInput(projectBriefId);
  const understanding = buildProjectUnderstanding(input);
  await logAudit({
    actorType: "SYSTEM",
    action: "producer.project_understanding_generated",
    entityType: "ProjectBrief",
    entityId: projectBriefId,
    metadata: {
      projectBriefId,
      title: understanding.title,
      projectType: understanding.projectType,
      sourceKind: understanding.sourceKind,
      missingInfo: understanding.missingInfo,
      riskFlags: understanding.riskFlags,
      confidence: understanding.confidence,
      explanationForAudit: understanding.explanationForAudit,
    },
  });
  return understanding;
}

export async function generateProducerRoleMap(projectBriefId: string) {
  const input = await loadProducerProjectInput(projectBriefId);
  const understanding = buildProjectUnderstanding(input);
  const roleMap = generateRoleMap(understanding);
  const db = getDb();
  const existing = input.projectBrief;
  const nextStatus =
    existing.status === "BRIEF_READY_FOR_REVIEW"
      ? "ROLE_MAPPING_READY"
      : existing.status;

  if (roleMap.requiredRoles.length > 0) {
    assertProjectBriefStatusTransition(existing.status, nextStatus, {
      allowAdminOverride: nextStatus === existing.status,
    });
    await db.projectBrief.update({
      where: { id: projectBriefId },
      data: {
        requiredRoles: requiredRolesForBrief(roleMap),
        status: nextStatus,
      },
    });
    if (nextStatus !== existing.status) {
      await logWorkflowTransition({
        action: "project_brief.status_transitioned",
        entityType: "ProjectBrief",
        entityId: projectBriefId,
        fromStatus: existing.status,
        toStatus: nextStatus,
        metadata: { reason: "producer_role_map_generated" },
      });
    }

    const project = await ensureProjectForProjectBrief(projectBriefId);
    for (const role of producerRoleData(roleMap, understanding)) {
      const existingRole = await db.roleOpening.findFirst({
        where: { projectId: project.id, roleType: role.roleType },
      });
      if (existingRole) {
        await db.roleOpening.update({
          where: { id: existingRole.id },
          data: role,
        });
      } else {
        await db.roleOpening.create({
          data: { projectId: project.id, ...role },
        });
      }
    }
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "producer.role_map_generated",
    entityType: "ProjectBrief",
    entityId: projectBriefId,
    metadata: {
      projectBriefId,
      requiredRoleCount: roleMap.requiredRoles.length,
      optionalRoleCount: roleMap.optionalRoles.length,
      confidence: roleMap.confidence,
      adminReviewRequired: roleMap.humanReviewRequired,
      rolePriority: roleMap.rolePriority,
      explanationForAudit: roleMap.explanationForAudit,
    },
  });
  return { understanding, roleMap };
}

export async function generateProducerSourcingPlan(projectBriefId: string) {
  const input = await loadProducerProjectInput(projectBriefId);
  const understanding = buildProjectUnderstanding(input);
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  await logAudit({
    actorType: "SYSTEM",
    action: "producer.sourcing_plan_generated",
    entityType: "ProjectBrief",
    entityId: projectBriefId,
    metadata: {
      projectBriefId,
      searchOrder: sourcingPlan.searchOrder,
      roleCount: Object.keys(sourcingPlan.perRoleSearchCriteria).length,
      humanReviewRequired: sourcingPlan.humanReviewRequired,
      openWebResearchLater: sourcingPlan.openWebResearchLater,
      riskNotes: sourcingPlan.riskNotes,
    },
  });
  return { understanding, roleMap, sourcingPlan };
}

export async function generateProducerInternalCandidates(projectBriefId: string) {
  const { understanding, roleMap, sourcingPlan } =
    await generateProducerSourcingPlan(projectBriefId);
  const recommendations = await persistInternalCandidateRecommendations({
    projectBriefId,
    understanding,
    roleMap,
    sourcingPlan,
  });
  return { understanding, roleMap, sourcingPlan, recommendations };
}

async function loadExistingInternalRecommendations(
  projectBriefId: string,
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  sourcingPlan: SourcingPlan,
): Promise<InternalCandidateRecommendation[]> {
  const db = getDb();
  const project = await db.project.findUnique({
    where: { legacyProjectBriefId: projectBriefId },
    include: {
      roleOpenings: {
        include: {
          opportunities: {
            include: {
              recommendations: {
                include: {
                  person: {
                    include: { creatorProfile: true, legacyContact: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!project) return [];

  const candidatePool = project.roleOpenings.flatMap((roleOpening) =>
    roleOpening.opportunities.flatMap((opportunity) =>
      opportunity.recommendations.map((recommendation) => ({
        personId: recommendation.personId,
        contactId: recommendation.person.legacyContact?.id || null,
        creatorProfileId: recommendation.person.creatorProfile?.id || null,
        displayName:
          recommendation.person.creatorProfile?.displayName ||
          recommendation.person.name ||
          "Internal candidate",
        city:
          recommendation.person.creatorProfile?.city || recommendation.person.city,
        roles: recommendation.person.creatorProfile?.roles || [],
        skills: recommendation.person.creatorProfile?.skills || [],
        fandoms: recommendation.person.creatorProfile?.fandoms || [],
        communities: recommendation.person.creatorProfile?.communities || [],
        portfolioUrls: recommendation.person.creatorProfile?.portfolioUrls || [],
        socialUrls: recommendation.person.creatorProfile?.socialUrls || [],
        reviewStatus: recommendation.person.creatorProfile?.reviewStatus || "UNKNOWN",
        optedOut: recommendation.person.optedOut,
        consentStatus: recommendation.person.consentStatus,
        proximityTier: recommendation.proximityTier,
      })),
    ),
  );
  return recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
  );
}

export async function generateProducerShortlistDraft(projectBriefId: string) {
  const input = await loadProducerProjectInput(projectBriefId);
  const understanding = buildProjectUnderstanding(input);
  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);
  let recommendations = await loadExistingInternalRecommendations(
    projectBriefId,
    understanding,
    roleMap,
    sourcingPlan,
  );
  if (recommendations.length === 0) {
    const generated = await generateProducerInternalCandidates(projectBriefId);
    recommendations = await loadExistingInternalRecommendations(
      projectBriefId,
      generated.understanding,
      generated.roleMap,
      generated.sourcingPlan,
    );
  }

  const shortlistDraft = generateShortlistDraft(
    understanding,
    roleMap,
    recommendations,
  );
  await logAudit({
    actorType: "SYSTEM",
    action: "producer.shortlist_draft_generated",
    entityType: "ProjectBrief",
    entityId: projectBriefId,
    metadata: {
      projectBriefId,
      candidateCount: shortlistDraft.candidateSummaries.length,
      rolesCovered: shortlistDraft.coverage.rolesCovered,
      rolesMissing: shortlistDraft.coverage.rolesMissing,
      needsMoreResearch: shortlistDraft.coverage.needsMoreResearch,
      adminReviewRequired: shortlistDraft.adminReviewRequired,
      forbiddenClaimsCheck: shortlistDraft.forbiddenClaimsCheck,
      organizerFacingSummary: shortlistDraft.organizerFacingSummary,
      recommendedNextOrganizerCopy: shortlistDraft.recommendedNextMessageToOrganizer,
      candidateSummaries: shortlistDraft.candidateSummaries,
    },
  });

  return { understanding, roleMap, sourcingPlan, recommendations, shortlistDraft };
}
