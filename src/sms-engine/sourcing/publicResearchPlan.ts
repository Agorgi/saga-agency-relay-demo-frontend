import type {
  ProjectUnderstanding,
  RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";
import type { SourcingStrategy } from "@/sms-engine/sourcing/sourcingStrategy";

export type PublicResearchPlan = {
  researchNeeded: boolean;
  roleTargets: Array<{
    role: string;
    city: string | null;
    criteria: string[];
  }>;
  queryPlan: string[];
  acceptableSources: string[];
  disallowedSources: string[];
  candidateEvidenceChecklist: string[];
  sourceCitationRequired: true;
  adminReviewRequired: true;
  warnings: string[];
};

export function generatePublicResearchPlan(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  sourcingStrategy: SourcingStrategy,
): PublicResearchPlan {
  const roles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  return {
    researchNeeded: sourcingStrategy.publicResearchNeeded,
    roleTargets: roles.map((role) => ({
      role: role.roleType,
      city: role.localRequired ? understanding.city : null,
      criteria: [
        ...role.requiredSkills,
        ...role.preferredFandoms,
        ...(role.localRequired && understanding.city
          ? [`local to ${understanding.city}`]
          : []),
      ],
    })),
    queryPlan: sourcingStrategy.searchQuerySuggestions,
    acceptableSources: [
      "public portfolio websites",
      "public Instagram/TikTok/YouTube profile pages available through public search only",
      "personal websites",
      "public event/vendor directories",
      "public convention artist/vendor pages",
      "public LinkedIn/profile pages available through search",
    ],
    disallowedSources: [
      "private or logged-in content",
      "scraped DMs",
      "private groups",
      "personal sensitive data",
      "data requiring account login",
      "non-public contact databases",
    ],
    candidateEvidenceChecklist: [
      "Public source URL and citation",
      "Role-fit evidence",
      "Fandom/community evidence if relevant",
      "City/service area evidence when local work matters",
      "Risks and missing info",
      "Explicit note that availability is unverified",
    ],
    sourceCitationRequired: true,
    adminReviewRequired: true,
    warnings: [
      "Plan only: do not scrape private or login-gated sources.",
      "Do not contact anyone automatically.",
      "Do not store sensitive personal data.",
    ],
  };
}
