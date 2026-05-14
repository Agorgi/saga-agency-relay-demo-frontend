import type {
  CandidateRecommendation,
  CreatorProfile,
  Opportunity,
  Person,
  ProximityTier,
  RelationshipEdge,
  RoleOpening,
} from "@prisma/client";
import { getDb } from "@/lib/db";
import {
  assertOpportunityStatusTransition,
  assertRoleOpeningStatusTransition,
  logWorkflowTransition,
} from "@/lib/workflowStateMachine";

type OpportunityWithRole = Opportunity & {
  roleOpening: RoleOpening & {
    project: {
      id: string;
      city: string | null;
      fandoms: string[];
      organizerPersonId: string | null;
    };
  };
};

type ProfileWithPerson = CreatorProfile & {
  person: Person;
};

function canonical(value: string) {
  return value.toLowerCase().trim();
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(canonical));
  return left.filter((item) => rightSet.has(canonical(item)));
}

function relatedSkillMatches(roleType: string, skills: string[]) {
  const role = canonical(roleType);
  const aliases: Record<string, string[]> = {
    photographer: ["photo", "photography", "content", "camera"],
    videographer: ["video", "videography", "content", "camera"],
    dj: ["music", "audio", "nightlife", "sound"],
    "venue owner": ["venue", "space", "location"],
    venue: ["venue", "space", "location"],
    cosplayer: ["cosplay", "costume", "performance"],
    illustrator: ["illustration", "art", "artist", "drawing"],
    "graphic designer": ["design", "graphics", "branding"],
    designer: ["design", "graphics", "branding"],
    "vendor coordinator": ["vendor", "market", "partners"],
    "volunteer coordinator": ["volunteer", "staffing", "operations"],
    producer: ["producer", "operations", "production"],
  };
  const candidates = aliases[role] || [role];
  return skills.filter((skill) =>
    candidates.some((alias) => canonical(skill).includes(alias)),
  );
}

function relationshipScore(edge: RelationshipEdge | null) {
  if (!edge) {
    return {
      score: 0,
      tier: "UNKNOWN" as ProximityTier,
      reason: null,
    };
  }

  switch (edge.relationshipType) {
    case "FRIEND":
      return {
        score: 10 * edge.strength,
        tier: "FRIEND" as ProximityTier,
        reason: "Direct friend of the organizer",
      };
    case "MUTUAL":
      return {
        score: 7 * edge.strength,
        tier: "MUTUAL" as ProximityTier,
        reason: "Mutual connection",
      };
    case "SAME_COMMUNITY":
      return {
        score: 5 * edge.strength,
        tier: "COMMUNITY" as ProximityTier,
        reason: "Same community",
      };
    case "ATTENDED_SAME_EVENT":
      return {
        score: 4 * edge.strength,
        tier: "COMMUNITY" as ProximityTier,
        reason: "Attended a related Saga event",
      };
    case "COLLABORATED":
      return {
        score: 4 * edge.strength,
        tier: "COMMUNITY" as ProximityTier,
        reason: "Has collaborated before",
      };
    case "FOLLOWING":
      return {
        score: 2 * edge.strength,
        tier: "EXTENDED" as ProximityTier,
        reason: "Social graph connection",
      };
    case "IMPORTED_CONNECTION":
      return {
        score: 1 * edge.strength,
        tier: "EXTENDED" as ProximityTier,
        reason: "Imported connection",
      };
  }
}

function bestRelationship(
  organizerPersonId: string | null,
  personId: string,
  edges: RelationshipEdge[],
) {
  if (!organizerPersonId) return null;
  const relevant = edges.filter(
    (edge) =>
      (edge.fromPersonId === organizerPersonId && edge.toPersonId === personId) ||
      (edge.fromPersonId === personId && edge.toPersonId === organizerPersonId),
  );

  return relevant.sort(
    (left, right) =>
      relationshipScore(right).score - relationshipScore(left).score,
  )[0] || null;
}

export function scoreCreatorForOpportunity({
  opportunity,
  profile,
  relationshipEdges,
  requireApprovedProfiles = false,
}: {
  opportunity: OpportunityWithRole;
  profile: ProfileWithPerson;
  relationshipEdges: RelationshipEdge[];
  requireApprovedProfiles?: boolean;
}) {
  let score = 0;
  let proximityTier: ProximityTier = "UNKNOWN";
  const scoreBreakdown = {
    proximity: 0,
    roleFit: 0,
    fandomFit: 0,
    location: 0,
    reliability: 0,
  };
  const matchingReasons: string[] = [];
  const risks: string[] = [];
  const project = opportunity.roleOpening.project;
  const roleOpening = opportunity.roleOpening;

  const relationship = bestRelationship(
    project.organizerPersonId,
    profile.personId,
    relationshipEdges,
  );
  const relationshipResult = relationshipScore(relationship);
  score += relationshipResult.score;
  scoreBreakdown.proximity += relationshipResult.score;
  proximityTier = relationshipResult.tier;
  if (relationshipResult.reason) matchingReasons.push(relationshipResult.reason);

  const personCity = profile.city || profile.person.city;
  if (personCity && project.city && canonical(personCity) === canonical(project.city)) {
    score += 5;
    scoreBreakdown.location += 5;
    proximityTier = proximityTier === "UNKNOWN" ? "LOCAL" : proximityTier;
    matchingReasons.push(`Same city: ${project.city}`);
  } else if (
    personCity &&
    roleOpening.locationRequirement &&
    canonical(roleOpening.locationRequirement).includes(canonical(personCity))
  ) {
    score += 3;
    scoreBreakdown.location += 3;
    proximityTier = proximityTier === "UNKNOWN" ? "LOCAL" : proximityTier;
    matchingReasons.push("Location appears compatible");
  }

  const roleMatches = overlap([roleOpening.roleType, roleOpening.title], profile.roles);
  if (roleMatches.length > 0) {
    score += 5;
    scoreBreakdown.roleFit += 5;
    matchingReasons.push(`Role match: ${roleMatches[0]}`);
  }

  const skillMatches = [
    ...new Set([
      ...overlap(roleOpening.requiredSkills, profile.skills),
      ...relatedSkillMatches(roleOpening.roleType, [
        ...profile.roles,
        ...profile.skills,
      ]),
    ]),
  ];
  if (skillMatches.length > 0) {
    const skillScore = 2 * skillMatches.length;
    score += skillScore;
    scoreBreakdown.roleFit += skillScore;
    matchingReasons.push(`Skill fit: ${skillMatches.slice(0, 3).join(", ")}`);
  }

  const fandomMatches = overlap(
    [...roleOpening.preferredFandoms, ...project.fandoms],
    profile.fandoms,
  );
  if (fandomMatches.length > 0) {
    const fandomScore = 3 * fandomMatches.length;
    score += fandomScore;
    scoreBreakdown.fandomFit += fandomScore;
    matchingReasons.push(`Fandom fit: ${fandomMatches.slice(0, 3).join(", ")}`);
  }

  if (profile.portfolioUrls.length > 0 || profile.socialUrls.length > 0) {
    score += 1;
    scoreBreakdown.reliability += 1;
    matchingReasons.push("Has portfolio or social proof");
  }

  if (profile.reviewStatus === "APPROVED") {
    score += 1;
    scoreBreakdown.reliability += 1;
    matchingReasons.push("Profile reviewed by Saga");
  }

  if (profile.person.optedOut || profile.person.consentStatus === "OPTED_OUT") {
    score -= 5;
    scoreBreakdown.reliability -= 5;
    risks.push("Opted out");
  }

  if (profile.reviewStatus === "REJECTED") {
    score -= 5;
    scoreBreakdown.reliability -= 5;
    risks.push("Profile rejected");
  } else if (
    requireApprovedProfiles &&
    profile.reviewStatus !== "APPROVED"
  ) {
    score -= 5;
    scoreBreakdown.reliability -= 5;
    risks.push("Profile needs review before outreach");
  } else if (profile.reviewStatus === "PENDING_REVIEW") {
    risks.push("Pending human profile review");
  }

  return {
    score,
    scoreBreakdown,
    proximityTier,
    matchingReasons:
      matchingReasons.length > 0
        ? matchingReasons
        : ["No strong deterministic fit yet"],
    risks,
  };
}

export async function runCandidateRecommendations(opportunityId: string) {
  const db = getDb();
  const opportunity = await db.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      roleOpening: {
        include: {
          project: {
            select: {
              id: true,
              city: true,
              fandoms: true,
              organizerPersonId: true,
            },
          },
        },
      },
    },
  });
  const [profiles, relationshipEdges] = await Promise.all([
    db.creatorProfile.findMany({
      include: { person: true },
    }),
    db.relationshipEdge.findMany(),
  ]);

  const scored = profiles
    .map((profile) => ({
      profile,
      result: scoreCreatorForOpportunity({
        opportunity,
        profile,
        relationshipEdges,
        requireApprovedProfiles: false,
      }),
    }))
    .filter(({ result }) => result.score > 0)
    .sort((left, right) => right.result.score - left.result.score)
    .slice(0, 20);

  const recommendations: CandidateRecommendation[] = [];

  for (const item of scored) {
    recommendations.push(
      await db.candidateRecommendation.upsert({
        where: {
          opportunityId_personId: {
            opportunityId,
            personId: item.profile.personId,
          },
        },
        update: {
          score: item.result.score,
          scoreBreakdown: item.result.scoreBreakdown,
          proximityTier: item.result.proximityTier,
          matchingReasons: item.result.matchingReasons,
          risks: item.result.risks,
        },
        create: {
          opportunityId,
          personId: item.profile.personId,
          score: item.result.score,
          scoreBreakdown: item.result.scoreBreakdown,
          proximityTier: item.result.proximityTier,
          matchingReasons: item.result.matchingReasons,
          risks: item.result.risks,
        },
      }),
    );
  }

  assertOpportunityStatusTransition(opportunity.status, "ACTIVE");
  await db.opportunity.update({
    where: { id: opportunityId },
    data: { status: "ACTIVE" },
  });
  await logWorkflowTransition({
    action: "opportunity.status_transitioned",
    entityType: "Opportunity",
    entityId: opportunityId,
    fromStatus: opportunity.status,
    toStatus: "ACTIVE",
    metadata: { reason: "candidate_recommendations_run" },
  });
  assertRoleOpeningStatusTransition(opportunity.roleOpening.status, "RECOMMENDING");
  await db.roleOpening.update({
    where: { id: opportunity.roleOpeningId },
    data: { status: "RECOMMENDING" },
  });
  await logWorkflowTransition({
    action: "role_opening.status_transitioned",
    entityType: "RoleOpening",
    entityId: opportunity.roleOpeningId,
    fromStatus: opportunity.roleOpening.status,
    toStatus: "RECOMMENDING",
    metadata: { reason: "candidate_recommendations_run" },
  });

  return recommendations;
}
