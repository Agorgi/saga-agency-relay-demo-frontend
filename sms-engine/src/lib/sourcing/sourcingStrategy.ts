import type {
  ProjectUnderstanding,
  RoleMap,
} from "@/lib/producer/producerAgentTypes";

export type SourcingStrategy = {
  targetRoles: string[];
  internalSearchPriorities: string[];
  proximityStrategy: string[];
  fandomFitStrategy: string[];
  publicResearchNeeded: boolean;
  publicResearchReasons: string[];
  perRoleResearchCriteria: Array<{
    role: string;
    city: string | null;
    skills: string[];
    fandoms: string[];
    localRequired: boolean;
    evidenceRequired: string[];
  }>;
  searchQuerySuggestions: string[];
  humanReviewRequired: true;
  riskNotes: string[];
};

function quote(value: string) {
  return value.includes(" ") ? `"${value}"` : value;
}

function roleQuery(input: {
  role: string;
  city?: string | null;
  fandoms: string[];
}) {
  return [
    input.city,
    input.fandoms.slice(0, 2).map(quote).join(" "),
    quote(input.role),
    "portfolio OR creator OR vendor OR artist",
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateSourcingStrategy(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  options: { internalCandidateCount?: number } = {},
): SourcingStrategy {
  const roles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  const targetRoles = roles.map((role) => role.roleType);
  const internalCandidateCount = options.internalCandidateCount ?? 0;
  const publicResearchNeeded =
    targetRoles.length > 0 &&
    (internalCandidateCount < Math.min(3, targetRoles.length) ||
      understanding.missingInfo.includes("help needed"));

  return {
    targetRoles,
    internalSearchPriorities: [
      "Search approved creator profiles and known contacts first.",
      "Prefer same-city candidates for local/on-site roles.",
      "Prefer people with portfolio/social proof and reviewed profiles.",
      "Exclude opted-out or do-not-contact records.",
    ],
    proximityStrategy: [
      "Check direct organizer relationships before broader community matches.",
      "Use mutual/community proximity as supporting evidence, not confirmation of availability.",
      "Unknown public candidates should not outrank similarly qualified internal reviewed profiles.",
    ],
    fandomFitStrategy:
      understanding.fandoms.length > 0
        ? understanding.fandoms.map(
            (fandom) => `Prefer candidates with visible ${fandom} or adjacent community context.`,
          )
        : ["Look for genre/community alignment once the project fandom or scene is clearer."],
    publicResearchNeeded,
    publicResearchReasons: publicResearchNeeded
      ? [
          "Internal candidate coverage is thin or unverified.",
          "Public research may identify additional portfolio-backed options for admin review.",
        ]
      : ["Internal database coverage appears sufficient for first review."],
    perRoleResearchCriteria: roles.map((role) => ({
      role: role.roleType,
      city: understanding.city,
      skills: role.requiredSkills,
      fandoms: [...new Set([...understanding.fandoms, ...role.preferredFandoms])],
      localRequired: role.localRequired,
      evidenceRequired: [
        "Public portfolio or profile URL",
        "Role-fit evidence",
        "Location or service-area clue",
        "No claim of availability without direct confirmation",
      ],
    })),
    searchQuerySuggestions: roles.map((role) =>
      roleQuery({
        role: role.roleType,
        city: role.localRequired ? understanding.city : null,
        fandoms: [...new Set([...understanding.fandoms, ...role.preferredFandoms])],
      }),
    ),
    humanReviewRequired: true,
    riskNotes: [
      "Do not assume anyone is available, affordable, interested, or confirmed.",
      "Do not contact candidates automatically.",
      "Do not overstaff small projects; prioritize required roles before optional roles.",
    ],
  };
}
