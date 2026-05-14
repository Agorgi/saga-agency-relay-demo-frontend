import { computeFandomFit } from "@/sms-engine/graph/tagTaxonomy";
import { computeLocationFit } from "@/sms-engine/graph/locationNormalization";

export type ProximityTier =
  | "P0_SELF"
  | "P1_DIRECT"
  | "P2_MUTUAL"
  | "P3_SAME_PROJECT_OR_EVENT"
  | "P4_SAME_COMMUNITY_OR_FANDOM"
  | "P5_SAME_CITY_OR_METRO"
  | "P6_PUBLIC_WEB_ONLY"
  | "P7_UNKNOWN";

export type RelationshipGraphEdge = {
  fromEntityType?: string;
  fromEntityId: string;
  toEntityType?: string;
  toEntityId: string;
  edgeType: string;
  strength?: number;
  confidence?: number;
  isInferred?: boolean;
  sourceType?: string;
};

export type ProximityContext = {
  edges?: RelationshipGraphEdge[];
  requesterFandomTags?: string[];
  requesterCommunityTags?: string[];
  requesterCity?: string | null;
  requesterMetro?: string | null;
  candidateFandomTags?: string[];
  candidateCommunityTags?: string[];
  candidateCity?: string | null;
  candidateMetro?: string | null;
  candidateSourceMode?: string;
  candidateMatchedInternal?: boolean;
};

const DIRECT_INTERNAL_EDGE_TYPES = new Set([
  "FRIEND",
  "REFERRED_BY",
  "WORKED_TOGETHER",
  "ADMIN_LINKED",
]);
const PROJECT_EVENT_EDGE_TYPES = new Set(["SAME_PROJECT", "SAME_EVENT"]);

function isPersonEdge(edge: RelationshipGraphEdge) {
  return (
    (!edge.fromEntityType || edge.fromEntityType === "PERSON") &&
    (!edge.toEntityType || edge.toEntityType === "PERSON")
  );
}

function connects(edge: RelationshipGraphEdge, a: string, b: string) {
  return (
    (edge.fromEntityId === a && edge.toEntityId === b) ||
    (edge.fromEntityId === b && edge.toEntityId === a)
  );
}

function internalEdge(edge: RelationshipGraphEdge) {
  return !edge.isInferred && edge.sourceType !== "PUBLIC_WEB_RESEARCH";
}

export function findRelationshipPath(
  requesterId: string,
  candidateId: string,
  maxDepth = 2,
  context: ProximityContext = {},
) {
  const edges = (context.edges || []).filter((edge) => isPersonEdge(edge) && internalEdge(edge));
  if (maxDepth < 1) return null;
  const direct = edges.find(
    (edge) => connects(edge, requesterId, candidateId) && DIRECT_INTERNAL_EDGE_TYPES.has(edge.edgeType),
  );
  if (direct) return [direct];
  if (maxDepth < 2) return null;

  for (const first of edges.filter((edge) => edge.fromEntityId === requesterId || edge.toEntityId === requesterId)) {
    if (!DIRECT_INTERNAL_EDGE_TYPES.has(first.edgeType)) continue;
    const middle = first.fromEntityId === requesterId ? first.toEntityId : first.fromEntityId;
    const second = edges.find(
      (edge) =>
        connects(edge, middle, candidateId) &&
        DIRECT_INTERNAL_EDGE_TYPES.has(edge.edgeType),
    );
    if (second) return [first, second];
  }
  return null;
}

export function computeProximityTier(
  requesterId: string,
  candidateId: string,
  context: ProximityContext = {},
): ProximityTier {
  if (requesterId && requesterId === candidateId) return "P0_SELF";
  const path = findRelationshipPath(requesterId, candidateId, 2, context);
  if (path?.length === 1) return "P1_DIRECT";
  if (path?.length === 2) return "P2_MUTUAL";

  const projectOrEvent = (context.edges || []).some(
    (edge) =>
      connects(edge, requesterId, candidateId) &&
      PROJECT_EVENT_EDGE_TYPES.has(edge.edgeType) &&
      internalEdge(edge),
  );
  if (projectOrEvent) return "P3_SAME_PROJECT_OR_EVENT";

  if (
    context.candidateSourceMode === "PUBLIC_WEB_RESEARCH" &&
    !context.candidateMatchedInternal
  ) {
    return "P6_PUBLIC_WEB_ONLY";
  }

  const fandomFit = computeFandomFit({
    candidateFandomTags: [
      ...(context.candidateFandomTags || []),
      ...(context.candidateCommunityTags || []),
    ],
    targetFandomTags: [
      ...(context.requesterFandomTags || []),
      ...(context.requesterCommunityTags || []),
    ],
    inferredCandidateTags: context.candidateSourceMode === "PUBLIC_WEB_RESEARCH",
  });
  if (fandomFit.score > 0) return "P4_SAME_COMMUNITY_OR_FANDOM";

  const locationFit = computeLocationFit(
    context.candidateCity || context.candidateMetro,
    context.requesterCity || context.requesterMetro,
  );
  if (locationFit.bucket === "same_city" || locationFit.bucket === "same_metro") {
    return "P5_SAME_CITY_OR_METRO";
  }

  return "P7_UNKNOWN";
}

export function computeRelationshipScore(tier: ProximityTier) {
  const scores: Record<ProximityTier, number> = {
    P0_SELF: 100,
    P1_DIRECT: 85,
    P2_MUTUAL: 70,
    P3_SAME_PROJECT_OR_EVENT: 58,
    P4_SAME_COMMUNITY_OR_FANDOM: 42,
    P5_SAME_CITY_OR_METRO: 30,
    P6_PUBLIC_WEB_ONLY: 12,
    P7_UNKNOWN: 0,
  };
  return scores[tier];
}

export function explainProximity(tier: ProximityTier) {
  const explanations: Record<ProximityTier, string> = {
    P0_SELF: "Requester and candidate are the same internal person record.",
    P1_DIRECT: "Direct internal relationship evidence supports this candidate.",
    P2_MUTUAL: "A two-hop internal relationship path supports this candidate.",
    P3_SAME_PROJECT_OR_EVENT: "Internal evidence shows shared project or event context.",
    P4_SAME_COMMUNITY_OR_FANDOM:
      "Evidence-backed community or fandom overlap exists, but this is not a mutual.",
    P5_SAME_CITY_OR_METRO:
      "Location evidence shows same city or metro, but no relationship is implied.",
    P6_PUBLIC_WEB_ONLY:
      "Candidate is public-web-only unless later matched to the internal graph.",
    P7_UNKNOWN: "No relationship, community, or location proximity evidence is available.",
  };
  return explanations[tier];
}
