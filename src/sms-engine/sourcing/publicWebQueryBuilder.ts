import type {
  ProjectUnderstanding,
  ProducerRole,
  RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";
import type { PublicResearchPlan } from "@/sms-engine/sourcing/publicResearchPlan";
import type { SourcingStrategy } from "@/sms-engine/sourcing/sourcingStrategy";

export type PublicWebQueryPlan = {
  targetRole: string;
  searchQueries: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  sourcePolicy: {
    allowedSources: string[];
    disallowedSources: string[];
    citationRequired: true;
    privateSourcesDisallowed: true;
    noOutreach: true;
  };
  evidenceChecklist: string[];
  expectedCandidateFields: string[];
  warnings: string[];
};

function cleanTerm(value?: string | null) {
  return String(value || "")
    .replace(/[^\w\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quoted(value?: string | null) {
  const clean = cleanTerm(value);
  if (!clean) return null;
  return clean.includes(" ") ? `"${clean}"` : clean;
}

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function roleFromMap(roleMap: RoleMap, targetRole: string): ProducerRole | null {
  return (
    [...roleMap.requiredRoles, ...roleMap.optionalRoles].find(
      (role) => role.roleType === targetRole || role.title === targetRole,
    ) || null
  );
}

function roleCriteria(strategy: SourcingStrategy, targetRole: string) {
  return (
    strategy.perRoleResearchCriteria.find((item) => item.role === targetRole) ||
    null
  );
}

export function parseDomainList(value?: string | null) {
  return unique(
    String(value || "")
      .split(",")
      .map((item) =>
        item
          .trim()
          .replace(/^https?:\/\//i, "")
          .replace(/\/.*$/, "")
          .toLowerCase(),
      )
      .filter(Boolean),
  );
}

export function buildPublicWebQueryPlan(input: {
  understanding: ProjectUnderstanding;
  roleMap: RoleMap;
  sourcingStrategy: SourcingStrategy;
  publicResearchPlan: PublicResearchPlan;
  targetRole: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
}): PublicWebQueryPlan {
  const role = roleFromMap(input.roleMap, input.targetRole);
  const criteria = roleCriteria(input.sourcingStrategy, input.targetRole);
  const city = role?.localRequired ? input.understanding.city : criteria?.city;
  const fandoms = unique([
    ...input.understanding.fandoms,
    ...(role?.preferredFandoms || []),
    ...(criteria?.fandoms || []),
  ]).slice(0, 3);
  const skills = unique([...(role?.requiredSkills || []), ...(criteria?.skills || [])]).slice(
    0,
    3,
  );
  const roleTerm = quoted(role?.roleType || input.targetRole) || "creative producer";
  const cityTerm = quoted(city);
  const fandomTerm = fandoms.map(quoted).filter(Boolean).join(" ");
  const skillTerm = skills.map(quoted).filter(Boolean).join(" ");

  const baseTerms = unique([cityTerm, fandomTerm, roleTerm, skillTerm]);
  const searchQueries = unique([
    [...baseTerms, "portfolio"].filter(Boolean).join(" "),
    [cityTerm, roleTerm, fandomTerm, "event portfolio"].filter(Boolean).join(" "),
    [cityTerm, roleTerm, "anime cosplay creator portfolio"].filter(Boolean).join(" "),
    [cityTerm, roleTerm, "artist alley vendor event"].filter(Boolean).join(" "),
    ...input.publicResearchPlan.queryPlan.filter((query) =>
      query.toLowerCase().includes(input.targetRole.toLowerCase()),
    ),
  ]).slice(0, 6);

  return {
    targetRole: input.targetRole,
    searchQueries,
    allowedDomains: input.allowedDomains || [],
    blockedDomains: input.blockedDomains || [],
    sourcePolicy: {
      allowedSources: input.publicResearchPlan.acceptableSources,
      disallowedSources: input.publicResearchPlan.disallowedSources,
      citationRequired: true,
      privateSourcesDisallowed: true,
      noOutreach: true,
    },
    evidenceChecklist: input.publicResearchPlan.candidateEvidenceChecklist,
    expectedCandidateFields: [
      "displayName",
      "likelyRole",
      "city",
      "publicProfileUrls",
      "sourceUrls",
      "roleFitEvidence",
      "fandomFitEvidence",
      "locationEvidence",
      "portfolioEvidence",
      "missingEvidence",
      "riskFlags",
      "requiresHumanReview",
    ],
    warnings: [
      "Do not search for private phone numbers or private contact details.",
      "Do not search private groups, DMs, login-gated profiles, or minors.",
      "Do not claim availability, willingness, rates, or confirmed fit.",
      "Do not contact candidates.",
    ],
  };
}
