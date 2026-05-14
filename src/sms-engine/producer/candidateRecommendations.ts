import type {
  CandidateRecommendation,
  CreatorProfile,
  Person,
  ProximityTier,
  RelationshipEdge,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { ensureProjectForProjectBrief } from "@/sms-engine/networkBridge";
import {
  internalCandidateRecommendationSchema,
  type CandidatePoolItem,
  type InternalCandidateRecommendation,
  type ProjectUnderstanding,
  type RoleMap,
  type SourcingPlan,
} from "@/sms-engine/producer/producerAgentTypes";

type ProfileWithPerson = CreatorProfile & {
  person: Person & {
    legacyContact?: { id: string } | null;
  };
};

function canonical(value: string) {
  return value.toLowerCase().trim();
}

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(canonical));
  return left.filter((item) => rightSet.has(canonical(item)));
}

function relatedRoleMatches(roleType: string, profile: CandidatePoolItem) {
  const role = canonical(roleType);
  const aliases: Record<string, string[]> = {
    photographer: ["photo", "photography", "content", "camera"],
    videographer: ["video", "videography", "content", "camera"],
    dj: ["music", "audio", "nightlife", "sound"],
    host: ["host", "hosting", "performance", "community"],
    venue: ["venue", "space", "location"],
    "guest cosplayer": ["cosplay", "cosplayer", "costume"],
    illustrator: ["illustration", "illustrator", "artist", "art"],
    "graphic designer": ["design", "graphics", "branding"],
    "vendor coordinator": ["vendor", "market", "partners"],
    "volunteer coordinator": ["volunteer", "staffing", "operations"],
    "production assistant": ["production", "operations", "logistics"],
    "production lead": ["producer", "production", "operations"],
    "social/content creator": ["content", "creator", "social"],
  };
  const aliasesForRole = aliases[role] || [role];
  const haystack = [...(profile.roles || []), ...(profile.skills || [])];
  return haystack.filter((item) =>
    aliasesForRole.some((alias) => canonical(item).includes(alias)),
  );
}

function reliabilityScore(profile: CandidatePoolItem) {
  const reviewStatus = profile.reviewStatus || "UNKNOWN";
  const hasProof =
    (profile.portfolioUrls || []).length > 0 || (profile.socialUrls || []).length > 0;
  let score = 0;
  const reasons = [];
  const risks = [];

  if (reviewStatus === "APPROVED") {
    score += 3;
    reasons.push("Profile reviewed by Saga");
  } else if (reviewStatus === "PENDING_REVIEW") {
    risks.push("Pending human profile review");
  } else if (reviewStatus === "REJECTED") {
    risks.push("Profile rejected");
  }

  if (hasProof) {
    score += 2;
    reasons.push("Has portfolio or social proof");
  } else {
    risks.push("Missing portfolio/social proof");
  }

  return { score, reasons, risks };
}

function isSameCity(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  return canonical(left).includes(canonical(right)) || canonical(right).includes(canonical(left));
}

function scoreCandidateForRole({
  profile,
  role,
  understanding,
}: {
  profile: CandidatePoolItem;
  role: RoleMap["requiredRoles"][number];
  understanding: ProjectUnderstanding;
}): InternalCandidateRecommendation | null {
  if (profile.optedOut || profile.consentStatus === "OPTED_OUT") return null;
  if (profile.reviewStatus === "REJECTED") return null;

  const scoreBreakdown = {
    roleFit: 0,
    fandomFit: 0,
    locationFit: 0,
    proximity: 0,
    reliability: 0,
  };
  const matchingReasons: string[] = [];
  const risks: string[] = [];
  const missingInfo: string[] = [];

  const roleMatches = overlap([role.roleType, role.title], profile.roles || []);
  const skillMatches = unique([
    ...overlap(role.requiredSkills, profile.skills || []),
    ...relatedRoleMatches(role.roleType, profile),
  ]);
  if (roleMatches.length > 0) {
    scoreBreakdown.roleFit += 8;
    matchingReasons.push(`Role match: ${roleMatches[0]}`);
  }
  if (skillMatches.length > 0) {
    scoreBreakdown.roleFit += Math.min(10, skillMatches.length * 3);
    matchingReasons.push(`Skill fit: ${skillMatches.slice(0, 3).join(", ")}`);
  }

  const fandomMatches = overlap(
    [...understanding.fandoms, ...role.preferredFandoms],
    [...(profile.fandoms || []), ...(profile.communities || [])],
  );
  if (fandomMatches.length > 0) {
    scoreBreakdown.fandomFit += Math.min(10, fandomMatches.length * 4);
    matchingReasons.push(`Fandom/community fit: ${fandomMatches.slice(0, 3).join(", ")}`);
  } else if (understanding.fandoms.length > 0) {
    missingInfo.push("No clear fandom/community overlap");
  }

  if (isSameCity(profile.city, understanding.city)) {
    scoreBreakdown.locationFit += 7;
    matchingReasons.push(`Same city: ${understanding.city}`);
  } else if (role.localRequired) {
    risks.push("Local fit needs review");
  }

  const proximityTier = profile.proximityTier || "UNKNOWN";
  const proximityScores: Record<ProximityTier, number> = {
    FRIEND: 10,
    MUTUAL: 8,
    COMMUNITY: 6,
    LOCAL: 4,
    EXTENDED: 2,
    PUBLIC: 0,
    UNKNOWN: 0,
  };
  scoreBreakdown.proximity +=
    proximityScores[proximityTier] * (profile.relationshipStrength || 1);
  if (proximityTier !== "UNKNOWN" && proximityTier !== "PUBLIC") {
    matchingReasons.push(`Proximity: ${proximityTier.toLowerCase()}`);
  }

  const reliability = reliabilityScore(profile);
  scoreBreakdown.reliability += reliability.score;
  matchingReasons.push(...reliability.reasons);
  risks.push(...reliability.risks);

  const score = Object.values(scoreBreakdown).reduce((sum, item) => sum + item, 0);
  if (score <= 0) return null;

  return internalCandidateRecommendationSchema.parse({
    personId: profile.personId || null,
    contactId: profile.contactId || null,
    creatorProfileId: profile.creatorProfileId || null,
    displayName: profile.displayName || "Internal candidate",
    recommendedRole: role.roleType,
    score,
    scoreBreakdown,
    proximityTier,
    matchingReasons:
      matchingReasons.length > 0
        ? matchingReasons
        : ["Potential internal fit; needs human review"],
    risks,
    missingInfo,
    adminReviewStatus:
      profile.reviewStatus === "APPROVED"
        ? "reviewed_profile"
        : "needs_admin_review",
    confidence: Math.min(0.92, 0.45 + score / 50),
  });
}

export function recommendInternalCandidates(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  _sourcingPlan: SourcingPlan,
  candidatePool: CandidatePoolItem[] = [],
) {
  if (understanding.sourceKind !== "organizer_project") {
    return [];
  }

  const roles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  return roles.flatMap((role) =>
    candidatePool
      .map((profile) => scoreCandidateForRole({ profile, role, understanding }))
      .filter((item): item is InternalCandidateRecommendation => Boolean(item))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5),
  );
}

function relationshipTier(
  organizerPersonId: string | null,
  personId: string,
  edges: RelationshipEdge[],
) {
  if (!organizerPersonId) return { tier: "UNKNOWN" as ProximityTier, strength: 1 };
  const edge = edges.find(
    (item) =>
      (item.fromPersonId === organizerPersonId && item.toPersonId === personId) ||
      (item.toPersonId === organizerPersonId && item.fromPersonId === personId),
  );
  if (!edge) return { tier: "UNKNOWN" as ProximityTier, strength: 1 };

  const tierByType: Record<string, ProximityTier> = {
    FRIEND: "FRIEND",
    MUTUAL: "MUTUAL",
    SAME_COMMUNITY: "COMMUNITY",
    ATTENDED_SAME_EVENT: "COMMUNITY",
    COLLABORATED: "COMMUNITY",
    FOLLOWING: "EXTENDED",
    IMPORTED_CONNECTION: "EXTENDED",
  };
  return {
    tier: tierByType[edge.relationshipType] || "UNKNOWN",
    strength: edge.strength,
  };
}

function profileToCandidatePoolItem(
  profile: ProfileWithPerson,
  organizerPersonId: string | null,
  edges: RelationshipEdge[],
): CandidatePoolItem {
  const relationship = relationshipTier(organizerPersonId, profile.personId, edges);
  return {
    personId: profile.personId,
    contactId: profile.person.legacyContact?.id || null,
    creatorProfileId: profile.id,
    displayName: profile.displayName || profile.person.name || "Internal candidate",
    city: profile.city || profile.person.city,
    roles: profile.roles,
    skills: profile.skills,
    fandoms: profile.fandoms,
    communities: profile.communities,
    portfolioUrls: profile.portfolioUrls,
    socialUrls: profile.socialUrls,
    reviewStatus: profile.reviewStatus,
    optedOut: profile.person.optedOut,
    consentStatus: profile.person.consentStatus,
    proximityTier: relationship.tier,
    relationshipStrength: relationship.strength,
    privateNotes: profile.internalNotes,
  };
}

export async function persistInternalCandidateRecommendations({
  projectBriefId,
  understanding,
  roleMap,
  sourcingPlan,
}: {
  projectBriefId: string;
  understanding: ProjectUnderstanding;
  roleMap: RoleMap;
  sourcingPlan: SourcingPlan;
}) {
  if (understanding.sourceKind !== "organizer_project") {
    await logAudit({
      actorType: "SYSTEM",
      action: "producer.internal_candidates_recommended",
      entityType: "ProjectBrief",
      entityId: projectBriefId,
      metadata: {
        skipped: true,
        reason: "not_organizer_project",
        sourceKind: understanding.sourceKind,
      },
    });
    return [];
  }

  const db = getDb();
  const project = await ensureProjectForProjectBrief(projectBriefId);
  const [profiles, relationshipEdges] = await Promise.all([
    db.creatorProfile.findMany({
      include: {
        person: {
          include: { legacyContact: { select: { id: true } } },
        },
      },
    }),
    db.relationshipEdge.findMany(),
  ]);
  const candidatePool = profiles.map((profile) =>
    profileToCandidatePoolItem(profile, project.organizerPersonId, relationshipEdges),
  );
  const recommendations = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
  );
  const persisted: CandidateRecommendation[] = [];

  for (const role of [...roleMap.requiredRoles, ...roleMap.optionalRoles]) {
    const roleRecommendations = recommendations.filter(
      (recommendation) => recommendation.recommendedRole === role.roleType,
    );
    if (roleRecommendations.length === 0) continue;

    const roleOpening =
      (await db.roleOpening.findFirst({
        where: { projectId: project.id, roleType: role.roleType },
      })) ||
      (await db.roleOpening.create({
        data: {
          projectId: project.id,
          roleType: role.roleType,
          title: role.title,
          description: role.description,
          requiredSkills: role.requiredSkills,
          preferredFandoms: role.preferredFandoms,
          locationRequirement: role.localRequired ? understanding.city : null,
          compensationType: "UNKNOWN",
          status: "OPEN",
        },
      }));
    const opportunity =
      (await db.opportunity.findFirst({
        where: { roleOpeningId: roleOpening.id },
      })) ||
      (await db.opportunity.create({
        data: {
          roleOpeningId: roleOpening.id,
          visibility: "PRIVATE",
          applicationMode: "INVITE_ONLY",
          status: "ACTIVE",
        },
      }));

    for (const recommendation of roleRecommendations) {
      if (!recommendation.personId) continue;
      persisted.push(
        await db.candidateRecommendation.upsert({
          where: {
            opportunityId_personId: {
              opportunityId: opportunity.id,
              personId: recommendation.personId,
            },
          },
          update: {
            score: recommendation.score,
            scoreBreakdown: recommendation.scoreBreakdown,
            proximityTier: recommendation.proximityTier,
            matchingReasons: recommendation.matchingReasons,
            risks: recommendation.risks,
          },
          create: {
            opportunityId: opportunity.id,
            personId: recommendation.personId,
            score: recommendation.score,
            scoreBreakdown: recommendation.scoreBreakdown,
            proximityTier: recommendation.proximityTier,
            matchingReasons: recommendation.matchingReasons,
            risks: recommendation.risks,
            status: "SUGGESTED",
          },
        }),
      );
    }
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "producer.internal_candidates_recommended",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      projectBriefId,
      candidateCount: persisted.length,
      roleCount: roleMap.requiredRoles.length + roleMap.optionalRoles.length,
      adminReviewRequired: true,
      confidence:
        recommendations.length > 0
          ? recommendations.reduce((sum, item) => sum + item.confidence, 0) /
            recommendations.length
          : 0,
    },
  });

  return persisted;
}
