import {
  shortlistDraftSchema,
  type InternalCandidateRecommendation,
  type ProjectUnderstanding,
  type RoleMap,
  type ShortlistDraft,
} from "@/sms-engine/producer/producerAgentTypes";

const forbiddenClaimPattern =
  /\b(confirmed|booked|guaranteed?|payment|paid work|rate|revenue|ticket sales|attendance|venue access|celebrity|influencer|will join|has agreed)\b/i;

function sentenceList(items: string[]) {
  if (items.length === 0) return "none yet";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function topCandidatesByRole(
  role: string,
  candidates: InternalCandidateRecommendation[],
) {
  return candidates
    .filter((candidate) => candidate.recommendedRole === role)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function forbiddenClaimsCheck(text: string) {
  const matches = text.match(forbiddenClaimPattern) || [];
  return {
    passed: matches.length === 0,
    flaggedTerms: [...new Set(matches.map((match) => match.toLowerCase()))],
  };
}

export function generateShortlistDraft(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  candidateRecommendations: InternalCandidateRecommendation[],
): ShortlistDraft {
  const allRoles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  const recommendedTeamByRole = allRoles.map((role) => {
    const candidates = topCandidatesByRole(role.roleType, candidateRecommendations);
    return {
      role: role.roleType,
      candidates: candidates.map((candidate) => candidate.displayName),
      coverageStatus:
        candidates.length > 0
          ? ("covered" as const)
          : role.priority === "required"
            ? ("missing" as const)
            : ("needs_more_research" as const),
    };
  });
  const rolesCovered = recommendedTeamByRole
    .filter((role) => role.coverageStatus === "covered")
    .map((role) => role.role);
  const rolesMissing = recommendedTeamByRole
    .filter((role) => role.coverageStatus === "missing")
    .map((role) => role.role);
  const needsMoreResearch = recommendedTeamByRole
    .filter((role) => role.coverageStatus === "needs_more_research")
    .map((role) => role.role);

  const organizerFacingSummary = `Based on the brief, Saga would likely start by looking for ${sentenceList(
    roleMap.requiredRoles.map((role) => role.title.toLowerCase()),
  )}. I found ${
    candidateRecommendations.length
  } internal profile${
    candidateRecommendations.length === 1 ? "" : "s"
  } that may be a fit, but the Saga team should review before anything is sent.`;

  const candidateSummaries = candidateRecommendations.slice(0, 8).map((candidate) => ({
    name: candidate.displayName,
    role: candidate.recommendedRole,
    city:
      candidate.matchingReasons
        .find((reason) => reason.startsWith("Same city: "))
        ?.replace("Same city: ", "") || null,
    whyTheyFit: candidate.matchingReasons.slice(0, 3),
    confidence: candidate.confidence,
    gaps: [...candidate.risks, ...candidate.missingInfo].slice(0, 3),
  }));

  const recommendedNextMessageToOrganizer =
    rolesCovered.length > 0
      ? `I drafted an internal shortlist for ${sentenceList(
          rolesCovered,
        )}. A human on the Saga team should review fit, availability, and consent before we share names or contact anyone.`
      : "I mapped the roles, but Saga should do more internal review before showing a shortlist.";

  const combinedText = [
    organizerFacingSummary,
    recommendedNextMessageToOrganizer,
    ...candidateSummaries.flatMap((candidate) => [
      candidate.name,
      candidate.whyTheyFit.join(" "),
    ]),
  ].join(" ");

  return shortlistDraftSchema.parse({
    organizerFacingSummary,
    recommendedTeamByRole,
    coverage: {
      rolesCovered,
      rolesMissing,
      needsMoreResearch,
    },
    candidateSummaries,
    recommendedNextMessageToOrganizer,
    adminReviewRequired: true,
    forbiddenClaimsCheck: forbiddenClaimsCheck(combinedText),
  });
}
