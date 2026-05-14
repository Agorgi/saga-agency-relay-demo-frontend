export type MatchingWeightConfig = {
  scoringVersion: string;
  baseWeights: {
    roleFit: number;
    fandomCommunityFit: number;
    locationFit: number;
    relationshipProximity: number;
    evidenceQuality: number;
    contactabilityReadiness: number;
    reviewTrust: number;
  };
  roleSpecificOverrides: {
    localRequiredRoleLocationWeightBoost: number;
    remoteFriendlyLocationWeightReduction: number;
    publicWebUnreviewedPenalty: number;
    doNotContactHardBlock: boolean;
    optedOutHardBlock: boolean;
    weakEvidencePenalty: number;
    veryWeakEvidencePenalty: number;
    noContactabilityPenalty: number;
    ambiguousIdentityPenalty: number;
    directRelationshipBoost: number;
    mutualRelationshipBoost: number;
  };
};

export const relationshipAwareMatchingWeights: MatchingWeightConfig = {
  scoringVersion: "relationship-aware-v0.7-baseline",
  baseWeights: {
    roleFit: 25,
    fandomCommunityFit: 15,
    locationFit: 15,
    relationshipProximity: 15,
    evidenceQuality: 10,
    contactabilityReadiness: 10,
    reviewTrust: 10,
  },
  roleSpecificOverrides: {
    localRequiredRoleLocationWeightBoost: 5,
    remoteFriendlyLocationWeightReduction: 6,
    publicWebUnreviewedPenalty: 12,
    doNotContactHardBlock: true,
    optedOutHardBlock: true,
    weakEvidencePenalty: 7,
    veryWeakEvidencePenalty: 15,
    noContactabilityPenalty: 5,
    ambiguousIdentityPenalty: 18,
    directRelationshipBoost: 0,
    mutualRelationshipBoost: 0,
  },
};

export function getRelationshipAwareMatchingWeights() {
  return relationshipAwareMatchingWeights;
}
