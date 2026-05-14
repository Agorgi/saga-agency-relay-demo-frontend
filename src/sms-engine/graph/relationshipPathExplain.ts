import {
  computeProximityTier,
  computeRelationshipScore,
  findRelationshipPath,
  type ProximityContext,
  type ProximityTier,
  type RelationshipGraphEdge,
} from "@/sms-engine/graph/relationshipProximity";

export type RelationshipPathType =
  | "DIRECT"
  | "MUTUAL"
  | "SAME_PROJECT"
  | "SAME_EVENT"
  | "SAME_COMMUNITY"
  | "SAME_FANDOM"
  | "SAME_CITY"
  | "PUBLIC_WEB_ONLY"
  | "UNKNOWN";

function edgeEvidence(edge: RelationshipGraphEdge) {
  return {
    edgeType: edge.edgeType,
    sourceType: edge.sourceType || "unknown",
    strength: edge.strength ?? 0,
    confidence: edge.confidence ?? 0,
    isInferred: Boolean(edge.isInferred),
  };
}

function pathTypeFor(tier: ProximityTier, context: ProximityContext): RelationshipPathType {
  if (tier === "P1_DIRECT") return "DIRECT";
  if (tier === "P2_MUTUAL") return "MUTUAL";
  if (tier === "P3_SAME_PROJECT_OR_EVENT") {
    const sameEvent = (context.edges || []).some((edge) => edge.edgeType === "SAME_EVENT");
    return sameEvent ? "SAME_EVENT" : "SAME_PROJECT";
  }
  if (tier === "P4_SAME_COMMUNITY_OR_FANDOM") {
    return (context.candidateCommunityTags || []).length > 0 ||
      (context.requesterCommunityTags || []).length > 0
      ? "SAME_COMMUNITY"
      : "SAME_FANDOM";
  }
  if (tier === "P5_SAME_CITY_OR_METRO") return "SAME_CITY";
  if (tier === "P6_PUBLIC_WEB_ONLY") return "PUBLIC_WEB_ONLY";
  return "UNKNOWN";
}

export function explainRelationshipPath(input: {
  requesterId?: string | null;
  candidateId?: string | null;
  context: ProximityContext;
}) {
  const requesterId = input.requesterId || "";
  const candidateId = input.candidateId || "";
  const proximityTier = requesterId && candidateId
    ? computeProximityTier(requesterId, candidateId, input.context)
    : input.context.candidateSourceMode === "PUBLIC_WEB_RESEARCH"
      ? "P6_PUBLIC_WEB_ONLY"
      : "P7_UNKNOWN";
  const relationshipScore = computeRelationshipScore(proximityTier);
  const relationshipPath = requesterId && candidateId
    ? findRelationshipPath(requesterId, candidateId, 2, input.context)
    : null;
  const pathType = pathTypeFor(proximityTier, input.context);
  const shouldCallThisMutual = proximityTier === "P2_MUTUAL";
  const evidence = relationshipPath
    ? relationshipPath.map(edgeEvidence)
    : (input.context.edges || [])
        .filter((edge) => !edge.isInferred)
        .slice(0, 3)
        .map(edgeEvidence);
  const confidence =
    evidence.length > 0
      ? Number(
          (
            evidence.reduce((sum, item) => sum + (item.confidence || 0.5), 0) /
            evidence.length
          ).toFixed(2),
        )
      : proximityTier === "P6_PUBLIC_WEB_ONLY"
        ? 0.3
        : 0;

  const pathSummary =
    pathType === "DIRECT"
      ? "Direct internal relationship evidence supports this candidate."
      : pathType === "MUTUAL"
        ? "Two-hop internal relationship path through an existing Saga contact."
        : pathType === "SAME_PROJECT"
          ? "Shared internal project signal, but not a mutual relationship."
          : pathType === "SAME_EVENT"
            ? "Shared internal event signal, but not a mutual relationship."
            : pathType === "SAME_COMMUNITY" || pathType === "SAME_FANDOM"
              ? "Shared fandom/community signal, but no known direct relationship."
              : pathType === "SAME_CITY"
                ? "Same market signal, but no known direct relationship."
                : pathType === "PUBLIC_WEB_ONLY"
                  ? "Public-web-only candidate: no known internal relationship yet."
                  : "No relationship path evidence is recorded.";

  return {
    proximityTier,
    relationshipScore,
    pathType,
    pathSummary,
    evidence,
    confidence,
    shouldCallThisMutual,
  };
}
